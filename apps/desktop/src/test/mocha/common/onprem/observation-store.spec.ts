// Modified 2026 by Treslibre Project (Treslibre).
import {generateKeyPairSync, sign as cryptoSign} from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as https from 'node:https';
import * as os from 'node:os';
import * as path from 'node:path';

import {base64ToU8a} from '@threema/ts-utils/base64/base64-to-u8a';
import {bytesToHex} from '@threema/ts-utils/byte/bytes-to-hex';
import {UTF8} from '@threema/ts-utils/codec/utf8';
import {expect} from 'chai';

import {STATIC_CONFIG} from '~/common/config';
import {
    calculateOppfBodyOffset,
    extractOppfBodyAndSignature,
    OPPF_FILE_SCHEMA,
} from '~/common/dom/backend/onprem/oppf';
import {
    applyManualOverride,
    buildCanonicalRotationPayload,
    computeFingerprintIdenticon,
    createInitialObservationRecord,
    evaluateObservedFingerprint,
} from '~/common/observation';
import {
    EncryptedServerObservationStore,
    probeHttpsEndpointCertificate,
    verifyEd25519WithNodeCrypto,
} from '~/electron/observation-store';

export function run(): void {
    describe('TOFU Server Observation Store & Key Rotation Verification (§4.2–§4.3)', () => {
        const initialChatKey = 'eafa1fc8fd8d2e1d10659a4026228cc1e1ee2f633466078bbf3f8588c4065992';
        const rotatedChatKey = '11223344556677889900aabbccddeeff0011223344556677889900aabbccddee';
        const initialEndpoints = {
            directory: {
                host: 'dir.thr.2sx.me',
                /* eslint-disable @typescript-eslint/naming-convention */
                spki_sha256: 'DTJU4+0HObYPrx9lF4Kz8hhjcJL3WBL4k829L++UlSk=',
                leaf_sha256: 'a'.repeat(64),
                /* eslint-enable @typescript-eslint/naming-convention */
            },
            blob: {
                host: 'blob.thr.2sx.me',
                /* eslint-disable @typescript-eslint/naming-convention */
                spki_sha256: 'C19RmQgZXzwovKRRJ2st7bsokiRchKcYjBo3m63fvn8=',
                leaf_sha256: 'b'.repeat(64),
                /* eslint-enable @typescript-eslint/naming-convention */
            },
            safe: {
                host: 'safe.thr.2sx.me',
                /* eslint-disable @typescript-eslint/naming-convention */
                spki_sha256: 'XIglSWPJ6aJ7LeIz6KsOrr0fNgNZ0PzGgDCDEZq5/U4=',
                leaf_sha256: 'c'.repeat(64),
                /* eslint-enable @typescript-eslint/naming-convention */
            },
        };

        it('creates canonical initial pin record and silently updates last_seen_at on match (Case A)', () => {
            const record = createInitialObservationRecord({
                /* eslint-disable @typescript-eslint/naming-convention */
                server_id: 'chat.thr.2sx.me',
                chat_server_pubkey_curve25519: initialChatKey,
                http_endpoints: initialEndpoints,
                admin_signing_pubkey_ed25519: null,
                nowIso: '2026-11-21T12:00:00Z',
                /* eslint-enable @typescript-eslint/naming-convention */
            });

            expect(record.server_id).to.equal('chat.thr.2sx.me');
            expect(record.rotation_count).to.equal(0);
            expect(record.history).to.have.lengthOf(4);
            expect(record.history[0]?.event).to.equal('initial_pin');

            const evalResult = evaluateObservedFingerprint({
                record,
                component: 'chat_server',
                observedFingerprint: initialChatKey,
                nowIso: '2026-11-21T13:00:00Z',
            });
            expect(evalResult.status).to.equal('matched');
            if (evalResult.status === 'matched') {
                expect(evalResult.record.last_seen_at).to.equal('2026-11-21T13:00:00Z');
                expect(evalResult.record.rotation_count).to.equal(0);
            }
        });

        it('verifies Ed25519 admin-signed key rotation and rejects replayed monotonic timestamps (Case B)', () => {
            const {publicKey, privateKey} = generateKeyPairSync('ed25519');
            const spkiDer = publicKey.export({type: 'spki', format: 'der'});
            const rawAdminPub = new Uint8Array(spkiDer.subarray(spkiDer.byteLength - 32));
            const adminPubHex = bytesToHex(rawAdminPub);

            const record = createInitialObservationRecord({
                /* eslint-disable @typescript-eslint/naming-convention */
                server_id: 'chat.thr.2sx.me',
                chat_server_pubkey_curve25519: initialChatKey,
                http_endpoints: initialEndpoints,
                admin_signing_pubkey_ed25519: adminPubHex,
                nowIso: '2026-11-21T12:00:00Z',
                /* eslint-enable @typescript-eslint/naming-convention */
            });

            const payload = buildCanonicalRotationPayload({
                /* eslint-disable @typescript-eslint/naming-convention */
                server_id: 'chat.thr.2sx.me',
                component: 'chat_server',
                new_fingerprint: rotatedChatKey,
                timestamp_monotonic: 100,
                /* eslint-enable @typescript-eslint/naming-convention */
            });
            const sigHex = bytesToHex(
                new Uint8Array(cryptoSign(null, Buffer.from(payload), privateKey)),
            );

            const rotatedResult = evaluateObservedFingerprint({
                record,
                component: 'chat_server',
                observedFingerprint: rotatedChatKey,
                rotationProof: {
                    /* eslint-disable @typescript-eslint/naming-convention */
                    server_id: 'chat.thr.2sx.me',
                    component: 'chat_server',
                    new_fingerprint: rotatedChatKey,
                    timestamp_monotonic: 100,
                    signature_ed25519_hex: sigHex,
                    /* eslint-enable @typescript-eslint/naming-convention */
                },
                verifyEd25519: verifyEd25519WithNodeCrypto,
                nowIso: '2026-11-21T14:00:00Z',
            });

            expect(rotatedResult.status).to.equal('rotated_by_admin');
            if (rotatedResult.status === 'rotated_by_admin') {
                expect(rotatedResult.record.chat_server_pubkey_curve25519).to.equal(rotatedChatKey);
                expect(rotatedResult.record.rotation_count).to.equal(1);
                const lastHistory = rotatedResult.record.history.at(-1);
                expect(lastHistory?.event).to.equal('signed_rotation');
                expect(lastHistory?.verified_by_admin_key).to.equal(true);
                expect(lastHistory?.old_fingerprint).to.equal(initialChatKey);

                // Replaying an older or equal timestamp_monotonic must be blocked
                const replayPayload = buildCanonicalRotationPayload({
                    /* eslint-disable @typescript-eslint/naming-convention */
                    server_id: 'chat.thr.2sx.me',
                    component: 'chat_server',
                    new_fingerprint: initialChatKey,
                    timestamp_monotonic: 100,
                    /* eslint-enable @typescript-eslint/naming-convention */
                });
                const replaySigHex = bytesToHex(
                    new Uint8Array(cryptoSign(null, Buffer.from(replayPayload), privateKey)),
                );
                const replayResult = evaluateObservedFingerprint({
                    record: rotatedResult.record,
                    component: 'chat_server',
                    observedFingerprint: initialChatKey,
                    rotationProof: {
                        /* eslint-disable @typescript-eslint/naming-convention */
                        server_id: 'chat.thr.2sx.me',
                        component: 'chat_server',
                        new_fingerprint: initialChatKey,
                        timestamp_monotonic: 100,
                        signature_ed25519_hex: replaySigHex,
                        /* eslint-enable @typescript-eslint/naming-convention */
                    },
                    verifyEd25519: verifyEd25519WithNodeCrypto,
                });
                expect(replayResult.status).to.equal('mismatch_blocked');
            }
        });

        it('hard-aborts on unexpected key/cert mismatch and records unverified_manual_override only on explicit override (Case C)', () => {
            const record = createInitialObservationRecord({
                /* eslint-disable @typescript-eslint/naming-convention */
                server_id: 'chat.thr.2sx.me',
                chat_server_pubkey_curve25519: initialChatKey,
                http_endpoints: initialEndpoints,
                admin_signing_pubkey_ed25519: null,
                /* eslint-enable @typescript-eslint/naming-convention */
            });

            const mismatch = evaluateObservedFingerprint({
                record,
                component: 'directory',
                observedFingerprint: 'MITM_ROGUE_SPKI_BASE64==================',
            });
            expect(mismatch.status).to.equal('mismatch_blocked');
            if (mismatch.status === 'mismatch_blocked') {
                expect(mismatch.alert.component).to.equal('directory');
                expect(mismatch.alert.old_fingerprint).to.equal(
                    initialEndpoints.directory.spki_sha256,
                );
            }

            const overridden = applyManualOverride({
                record,
                component: 'directory',
                newFingerprint: 'MITM_ROGUE_SPKI_BASE64==================',
            });
            expect(overridden.rotation_count).to.equal(1);
            expect(overridden.history.at(-1)?.event).to.equal('unverified_manual_override');
            expect(overridden.history.at(-1)?.verified_by_admin_key).to.equal(false);
        });

        it('persists encrypted observation record to disk and decrypts round-trip', async () => {
            const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'treslibre-obs-test-'));
            try {
                const store = new EncryptedServerObservationStore(tempDir);
                const pinned = await store.pinInitialServer({
                    /* eslint-disable @typescript-eslint/naming-convention */
                    server_id: 'chat.thr.2sx.me',
                    chat_server_pubkey_curve25519: initialChatKey,
                    http_endpoints: initialEndpoints,
                    admin_signing_pubkey_ed25519: null,
                    /* eslint-enable @typescript-eslint/naming-convention */
                });
                expect(pinned.server_id).to.equal('chat.thr.2sx.me');

                const rawFile = await fs.readFile(store.filePath);
                // Ciphertext must not contain plaintext server_id
                expect(rawFile.toString('utf8')).to.not.include('chat.thr.2sx.me');

                const store2 = new EncryptedServerObservationStore(tempDir);
                const loaded = await store2.load();
                expect(loaded?.server_id).to.equal('chat.thr.2sx.me');
                expect(loaded?.chat_server_pubkey_curve25519).to.equal(initialChatKey);

                const identicon = computeFingerprintIdenticon(initialChatKey);
                expect(identicon.cells).to.have.lengthOf(25);
            } finally {
                await fs.rm(tempDir, {recursive: true, force: true});
            }
        });

        it('verifies cleanroom unconfigured defaults and live TOFU provisioning against https://thr.2sx.me (§5.2)', async function () {
            this.timeout(30000);
            // 1. Verify zero upstream Threema fallback servers or keys in STATIC_CONFIG
            expect(STATIC_CONFIG.ONPREM_CONFIG_TRUSTED_PUBLIC_KEYS).to.have.lengthOf(0);
            expect(STATIC_CONFIG.UPDATE_SERVER_URL.href).to.include('.invalid');

            // 2. Live fetch of https://thr.2sx.me/prov/config.oppf with Basic auth demo:demo-password
            const rawOppf = await new Promise<Uint8Array>((resolve, reject) => {
                const auth = Buffer.from('demo:demo-password', 'utf8').toString('base64');
                const req = https.get(
                    'https://thr.2sx.me/prov/config.oppf',
                    {
                        headers: {
                            /* eslint-disable @typescript-eslint/naming-convention */
                            Authorization: `Basic ${auth}`,
                            /* eslint-enable @typescript-eslint/naming-convention */
                        },
                        timeout: 15000,
                    },
                    (res) => {
                        if (res.statusCode !== 200) {
                            reject(new Error(`Unexpected HTTP status ${res.statusCode}`));
                            return;
                        }
                        const chunks: Buffer[] = [];
                        res.on('data', (chunk: Buffer) => chunks.push(chunk));
                        res.on('end', () => resolve(new Uint8Array(Buffer.concat(chunks))));
                    },
                );
                req.on('timeout', () => {
                    req.destroy(new Error('Request timed out'));
                });
                req.on('error', reject);
            });

            // 3. Verify unlocked OPPF v1.0 Ed25519 self-signature and extract endpoints
            const offset = calculateOppfBodyOffset(rawOppf);
            const {body, signature} = extractOppfBodyAndSignature(rawOppf, offset);
            const sigBytes = base64ToU8a(UTF8.decode(signature));
            const decoded = JSON.parse(UTF8.decode(body)) as Record<string, unknown>;
            const parsedOppf = OPPF_FILE_SCHEMA.parse(decoded);

            expect(verifyEd25519WithNodeCrypto(parsedOppf.signatureKey, body, sigBytes)).to.equal(
                true,
            );
            const liveChatKeyHex = bytesToHex(parsedOppf.chat.publicKey).toLowerCase();
            const liveAdminKeyHex = bytesToHex(parsedOppf.signatureKey).toLowerCase();
            expect(liveChatKeyHex).to.have.lengthOf(64);
            expect(liveAdminKeyHex).to.have.lengthOf(64);

            // 4. Probe live TLS SPKI SHA-256 and leaf SHA-256 certificate fingerprints from https://thr.2sx.me
            const liveDirCert = await probeHttpsEndpointCertificate('https://thr.2sx.me');
            expect(liveDirCert.host).to.equal('thr.2sx.me');
            expect(liveDirCert.spki_sha256.length).to.be.greaterThan(20);
            expect(liveDirCert.leaf_sha256).to.match(/^[0-9a-f]{64}$/u);

            // 5. Persist initial TOFU observation record to encrypted store and evaluate subsequent connections
            const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'treslibre-live-2sx-'));
            try {
                const store = new EncryptedServerObservationStore(tempDir);
                const pinned = await store.pinInitialServer({
                    /* eslint-disable @typescript-eslint/naming-convention */
                    server_id: 'chat.thr.2sx.me',
                    chat_server_pubkey_curve25519: liveChatKeyHex,
                    http_endpoints: {
                        directory: liveDirCert,
                        blob: liveDirCert,
                        safe: liveDirCert,
                    },
                    admin_signing_pubkey_ed25519: liveAdminKeyHex,
                    /* eslint-enable @typescript-eslint/naming-convention */
                });
                expect(pinned.server_id).to.equal('chat.thr.2sx.me');

                // Subsequent connection with unchanged key succeeds silently
                const matchEval = await store.evaluateChatServerKey({
                    observedPubkeyHex: liveChatKeyHex,
                });
                expect(matchEval.allowed).to.equal(true);

                // Simulated rogue MitM key swap triggers immediate hard-abort + blocking alert
                const mitmKey = 'ff'.repeat(32);
                const mitmEval = await store.evaluateChatServerKey({
                    observedPubkeyHex: mitmKey,
                });
                expect(mitmEval.allowed).to.equal(false);
                if (!mitmEval.allowed) {
                    expect(mitmEval.alert.component).to.equal('chat_server');
                    expect(mitmEval.alert.old_fingerprint).to.equal(liveChatKeyHex);
                    expect(mitmEval.alert.new_fingerprint).to.equal(mitmKey);
                }
            } finally {
                await fs.rm(tempDir, {recursive: true, force: true});
            }
        });
    });
}
