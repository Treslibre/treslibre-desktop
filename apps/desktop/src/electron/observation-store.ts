// Modified 2026 by Treslibre Project (Treslibre).
/* eslint-disable @typescript-eslint/naming-convention, @typescript-eslint/no-restricted-types */
import {
    createCipheriv,
    createDecipheriv,
    createHash,
    createPublicKey,
    randomBytes,
    verify as cryptoVerify,
    X509Certificate,
} from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import * as tls from 'node:tls';

import type {ReadonlyUint8Array} from '@threema/ts-utils/array/readonly-uint8-array';
// eslint-disable-next-line import/no-extraneous-dependencies
import * as electron from 'electron';

import type {Logger} from '~/common/logging';
import {
    applyManualOverride,
    createInitialObservationRecord,
    evaluateObservedFingerprint,
    type ObservedComponent,
    type ObservedHttpEndpoint,
    resolveObservedHttpComponent,
    SERVER_OBSERVATION_RECORD_SCHEMA,
    type ServerKeyChangeAlert,
    type ServerObservationRecord,
    type SignedRotationProof,
} from '~/common/observation';

const OBSERVATION_FILE_NAME = 'server-observation.enc';
const FALLBACK_MAGIC = Buffer.from('TLOB1', 'ascii');

function deriveFallbackAesKey(filePath: string): Buffer {
    return createHash('sha256')
        .update('treslibre-observation-store-v1:')
        .update(os.hostname())
        .update(':')
        .update(filePath)
        .digest();
}

function isSafeStorageAvailable(): boolean {
    try {
        return (
            typeof electron.safeStorage !== 'undefined' &&
            typeof electron.safeStorage.isEncryptionAvailable === 'function' &&
            electron.safeStorage.isEncryptionAvailable()
        );
    } catch {
        return false;
    }
}

export function encryptObservationPayload(plainUtf8: string, filePath: string): Buffer {
    if (isSafeStorageAvailable()) {
        return electron.safeStorage.encryptString(plainUtf8);
    }
    const key = deriveFallbackAesKey(filePath);
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(plainUtf8, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([FALLBACK_MAGIC, iv, tag, ciphertext]);
}

export function decryptObservationPayload(encrypted: Buffer, filePath: string): string {
    if (
        encrypted.byteLength > FALLBACK_MAGIC.byteLength + 28 &&
        encrypted.subarray(0, FALLBACK_MAGIC.byteLength).equals(FALLBACK_MAGIC)
    ) {
        const key = deriveFallbackAesKey(filePath);
        const ivStart = FALLBACK_MAGIC.byteLength;
        const iv = encrypted.subarray(ivStart, ivStart + 12);
        const tag = encrypted.subarray(ivStart + 12, ivStart + 28);
        const ciphertext = encrypted.subarray(ivStart + 28);
        const decipher = createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    }
    if (isSafeStorageAvailable()) {
        return electron.safeStorage.decryptString(encrypted);
    }
    throw new Error('Unable to decrypt server observation record: safeStorage unavailable');
}

/**
 * Compute SPKI SHA-256 (Base64) and Leaf SHA-256 (64-char hex) from a PEM or DER certificate.
 */
export function extractCertFingerprints(certPemOrDer: string | Buffer): {
    readonly spki_sha256: string;
    readonly leaf_sha256: string;
} {
    const x509 = new X509Certificate(certPemOrDer);
    const spkiDer = x509.publicKey.export({type: 'spki', format: 'der'});
    const spkiSha256Base64 = createHash('sha256').update(spkiDer).digest('base64');
    const leafSha256Hex = createHash('sha256').update(x509.raw).digest('hex').toLowerCase();
    return {
        spki_sha256: spkiSha256Base64,
        leaf_sha256: leafSha256Hex,
    };
}

/**
 * Verify an Ed25519 signature using Node's built-in `node:crypto` module.
 */
export function verifyEd25519WithNodeCrypto(
    publicKeyBytes: ReadonlyUint8Array,
    messageBytes: ReadonlyUint8Array,
    signatureBytes: ReadonlyUint8Array,
): boolean {
    if (publicKeyBytes.byteLength !== 32 || signatureBytes.byteLength !== 64) {
        return false;
    }
    const ed25519SpkiPrefix = Buffer.from('302a300506032b6570032100', 'hex');
    const spkiDer = Buffer.concat([ed25519SpkiPrefix, Buffer.from(publicKeyBytes)]);
    const keyObj = createPublicKey({key: spkiDer, format: 'der', type: 'spki'});
    return cryptoVerify(undefined, Buffer.from(messageBytes), keyObj, Buffer.from(signatureBytes));
}

/**
 * Probe a live HTTPS URL (or host:port) to observe its current TLS leaf certificate SPKI SHA-256
 * (Base64) and leaf SHA-256 (hex-64) for the First-Time Server Trust Prompt (§4.1).
 */
export async function probeHttpsEndpointCertificate(
    urlString: string,
): Promise<ObservedHttpEndpoint> {
    const parsedUrl = new URL(
        urlString.startsWith('http://') || urlString.startsWith('https://')
            ? urlString
            : `https://${urlString}`,
    );
    const host = parsedUrl.hostname;
    const port = parsedUrl.port !== '' ? Number.parseInt(parsedUrl.port, 10) : 443;

    return await new Promise<ObservedHttpEndpoint>((resolve, reject) => {
        const socket = tls.connect(
            {
                host,
                port,
                servername: host,
                rejectUnauthorized: false,
                timeout: 8000,
            },
            () => {
                try {
                    const peerCert = socket.getPeerCertificate(false);
                    socket.end();
                    if (peerCert.raw.byteLength === 0) {
                        reject(new Error(`No TLS certificate presented by ${host}:${port}`));
                        return;
                    }
                    const {spki_sha256, leaf_sha256} = extractCertFingerprints(peerCert.raw);
                    resolve({
                        host,
                        spki_sha256,
                        leaf_sha256,
                    });
                } catch (error) {
                    socket.destroy();
                    reject(error instanceof Error ? error : new Error(String(error)));
                }
            },
        );
        socket.on('timeout', () => {
            socket.destroy();
            reject(new Error(`TLS probe timed out for ${host}:${port}`));
        });
        socket.on('error', (error: Error) => {
            socket.destroy();
            reject(error);
        });
    });
}

/**
 * Encrypted local store for the TOFU Server Observation Record (§4.2).
 */
export class EncryptedServerObservationStore {
    private readonly _filePath: string;
    private readonly _log: Logger | undefined;
    private _cachedRecord: ServerObservationRecord | undefined;

    public constructor(dataDirectoryPath: string, log?: Logger) {
        this._filePath = path.join(dataDirectoryPath, OBSERVATION_FILE_NAME);
        this._log = log;
    }

    public get filePath(): string {
        return this._filePath;
    }

    public getCached(): ServerObservationRecord | undefined {
        return this._cachedRecord;
    }

    public async load(): Promise<ServerObservationRecord | undefined> {
        try {
            const encrypted = await fs.readFile(this._filePath);
            const jsonStr = decryptObservationPayload(encrypted, this._filePath);
            const parsed = SERVER_OBSERVATION_RECORD_SCHEMA.parse(JSON.parse(jsonStr));
            this._cachedRecord = parsed;
            return parsed;
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                this._cachedRecord = undefined;
                return undefined;
            }
            this._log?.error('Failed to load encrypted server observation record:', error);
            throw error;
        }
    }

    public async save(record: ServerObservationRecord): Promise<ServerObservationRecord> {
        const validated = SERVER_OBSERVATION_RECORD_SCHEMA.parse(record);
        await fs.mkdir(path.dirname(this._filePath), {recursive: true});
        const encrypted = encryptObservationPayload(
            JSON.stringify(validated, undefined, 2),
            this._filePath,
        );
        await fs.writeFile(this._filePath, encrypted);
        this._cachedRecord = validated;
        return validated;
    }

    public async clear(): Promise<void> {
        this._cachedRecord = undefined;
        try {
            await fs.unlink(this._filePath);
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
                throw error;
            }
        }
    }

    public async pinInitialServer(params: {
        readonly server_id: string;
        readonly chat_server_pubkey_curve25519: string;
        readonly http_endpoints: {
            readonly directory: ObservedHttpEndpoint;
            readonly blob: ObservedHttpEndpoint;
            readonly safe: ObservedHttpEndpoint;
        };
        readonly admin_signing_pubkey_ed25519: string | null;
    }): Promise<ServerObservationRecord> {
        const record = createInitialObservationRecord(params);
        return await this.save(record);
    }

    /**
     * Evaluate a live TLS certificate presented during an Electron request against the stored TOFU record.
     */
    public evaluateTlsCertificateSync(params: {
        readonly hostname: string;
        readonly certPem: string;
        readonly rotationProof?: SignedRotationProof;
    }):
        | {readonly allowed: true; readonly record?: ServerObservationRecord}
        | {readonly allowed: false; readonly alert: ServerKeyChangeAlert} {
        const record = this._cachedRecord;
        if (record === undefined) {
            return {allowed: true};
        }
        const component = resolveObservedHttpComponent(record, params.hostname);
        if (component === undefined) {
            return {allowed: true, record};
        }

        const {spki_sha256, leaf_sha256} = extractCertFingerprints(params.certPem);
        const result = evaluateObservedFingerprint({
            record,
            component,
            observedFingerprint: spki_sha256,
            observedLeafSha256: leaf_sha256,
            rotationProof: params.rotationProof,
            verifyEd25519: verifyEd25519WithNodeCrypto,
        });

        if (result.status === 'matched' || result.status === 'rotated_by_admin') {
            this._cachedRecord = result.record;
            void this.save(result.record).catch((error: unknown) => {
                this._log?.error('Failed to persist updated observation record:', error);
            });
            return {allowed: true, record: result.record};
        }

        return {allowed: false, alert: result.alert};
    }

    /**
     * Evaluate the chat server's Curve25519 public key against the stored TOFU record.
     */
    public async evaluateChatServerKey(params: {
        readonly observedPubkeyHex: string;
        readonly rotationProof?: SignedRotationProof;
    }): Promise<
        | {readonly allowed: true; readonly record?: ServerObservationRecord}
        | {readonly allowed: false; readonly alert: ServerKeyChangeAlert}
    > {
        const record = this._cachedRecord ?? (await this.load());
        if (record === undefined) {
            return {allowed: true};
        }

        const result = evaluateObservedFingerprint({
            record,
            component: 'chat_server',
            observedFingerprint: params.observedPubkeyHex,
            rotationProof: params.rotationProof,
            verifyEd25519: verifyEd25519WithNodeCrypto,
        });

        if (result.status === 'matched' || result.status === 'rotated_by_admin') {
            await this.save(result.record);
            return {allowed: true, record: result.record};
        }

        return {allowed: false, alert: result.alert};
    }

    /**
     * Accept a new server key/certificate after explicit user confirmation in `ServerKeyChangedModal`.
     */
    public async acceptManualOverride(params: {
        readonly component: ObservedComponent;
        readonly newFingerprint: string;
        readonly newLeafSha256?: string;
    }): Promise<ServerObservationRecord> {
        const record = this._cachedRecord ?? (await this.load());
        if (record === undefined) {
            throw new Error('No active server observation record to override');
        }
        const updated = applyManualOverride({
            record,
            component: params.component,
            newFingerprint: params.newFingerprint,
            newLeafSha256: params.newLeafSha256,
        });
        return await this.save(updated);
    }
}
