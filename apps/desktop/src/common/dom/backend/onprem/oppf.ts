// Modified 2026 by Treslibre Project (Treslibre).
/* eslint-disable @typescript-eslint/naming-convention */
import * as v from '@badrap/valita';
import type {ReadonlyUint8Array} from '@threema/ts-utils/array/readonly-uint8-array';
import {base64ToU8a} from '@threema/ts-utils/base64/base64-to-u8a';
import {u8aToBase64} from '@threema/ts-utils/base64/u8a-to-base64';
import {byteEquals} from '@threema/ts-utils/byte/byte-equals';
import {hexToBytes} from '@threema/ts-utils/byte/hex-to-bytes';
import {UTF8} from '@threema/ts-utils/codec/utf8';
import {ensureU16} from '@threema/ts-utils/integer/u16';
import {ensureU53} from '@threema/ts-utils/integer/u53';

import type {ServicesForBackend} from '~/common/backend';
import {
    ensurePublicKey,
    ensureEd25519PublicKey,
    ensureEd25519Signature,
    type Ed25519PublicKey,
} from '~/common/crypto';
import {ensureBaseUrl, validateUrl} from '~/common/network/types';
import {ensureSpkiValue} from '~/common/types';
import {entriesReverse} from '~/common/utils/array';

const OPPF_SIGNATURE_KEY_SCHEMA = v
    .string()
    .map((value) => base64ToU8a(value))
    .map(ensureEd25519PublicKey);

const OPPF_FILE_ONLY_SIGNATURE_KEY_SCHEMA = v
    .object({
        signatureKey: OPPF_SIGNATURE_KEY_SCHEMA,
    })
    .rest(v.unknown());

// Note: Since many of the URLs contain variables that we need to replace at runtime, we only
// validate those but not transform them to `URL` or `BaseUrl` as transforming would escape the
// curly brackets used for the variables.
export const OPPF_FILE_SCHEMA = v
    .object({
        version: v.string(),
        signatureKey: OPPF_SIGNATURE_KEY_SCHEMA,
        refresh: v.number().map(ensureU53),
        license: v
            .object({
                id: v.string(),
                expires: v.string().map((s) => new Date(s)),
                count: v.number().map(ensureU53),
            })
            .rest(v.unknown()),
        chat: v
            .object({
                publicKey: v.string().map((pk) => ensurePublicKey(base64ToU8a(pk))),
            })
            .rest(v.unknown()),
        directory: v
            .object({
                url: v.string().map((url) => ensureBaseUrl(url, 'https:')),
            })
            .rest(v.unknown()),
        work: v
            .object({
                url: v.string().map((url) => {
                    ensureBaseUrl(url, 'https:');
                    return url;
                }),
            })
            .rest(v.unknown()),
        avatar: v
            .object({
                url: v.string().map((url) => {
                    ensureBaseUrl(url, 'https:');
                    return url;
                }),
            })
            .rest(v.unknown()),
        safe: v
            .object({
                url: v.string().map((url) => {
                    ensureBaseUrl(url, 'https:');
                    return url;
                }),
            })
            .rest(v.unknown()),
        mediator: v
            .object({
                url: v.string().map((url) => {
                    ensureBaseUrl(url, 'wss:');
                    return url;
                }),
                blob: v
                    .object({
                        uploadUrl: v.string().map((url) => {
                            validateUrl(url, {
                                protocol: 'https:',
                                search: 'deny',
                                hash: 'deny',
                            });
                            return url;
                        }),
                        downloadUrl: v.string().map((url) => {
                            validateUrl(url, {
                                protocol: 'https:',
                                search: 'deny',
                                hash: 'deny',
                            });
                            return url;
                        }),
                        doneUrl: v.string().map((url) => {
                            validateUrl(url, {
                                protocol: 'https:',
                                search: 'deny',
                                hash: 'deny',
                            });
                            return url;
                        }),
                    })
                    .rest(v.unknown()),
            })
            .rest(v.unknown()),
        rendezvous: v
            .object({
                url: v.string().map((url) => {
                    ensureBaseUrl(url, 'wss:');
                    return url;
                }),
            })
            .rest(v.unknown()),
        updates: v
            .object({
                desktop: v
                    .object({
                        autoUpdate: v.boolean(),
                    })
                    .rest(v.unknown())
                    .optional(),
            })
            .rest(v.unknown())
            .optional(),
        domains: v
            .object({
                rules: v.array(
                    v
                        .object({
                            spkis: v.array(
                                v
                                    .object({
                                        algorithm: v.literal('sha256'),
                                        value: v
                                            .string()
                                            .map((value) => base64ToU8a(value))
                                            .map(ensureSpkiValue),
                                    })
                                    .rest(v.unknown()),
                            ),
                            fqdn: v.string(),
                            matchMode: v.union(v.literal('include-subdomains'), v.literal('exact')),
                        })
                        .rest(v.unknown()),
                ),
            })
            .optional(),
    })
    .rest(v.unknown());

export type OppfFile = v.Infer<typeof OPPF_FILE_SCHEMA>;

function decodeHexOrBase64Key(raw: string): Uint8Array {
    const trimmed = raw.trim();
    if (/^[0-9a-fA-F]{64}$/u.test(trimmed)) {
        return hexToBytes(trimmed);
    }
    return base64ToU8a(trimmed);
}

/**
 * Cleanroom provisioning schema (§4.1) supporting `.json` / `.tlpf` provisioning files or QR payloads.
 */
const CLEANROOM_PROVISIONING_SCHEMA = v
    .object({
        server_id: v.string(),
        chat_host: v.string().optional(),
        chat_port: v.number().map(ensureU16).optional(),
        chat_pubkey_curve25519: v.string().map((pk) => ensurePublicKey(decodeHexOrBase64Key(pk))),
        directory_url: v.string(),
        blob_url: v.string(),
        safe_url: v.string(),
        push_relay_url: v.string().optional(),
        admin_signing_pubkey_ed25519: v
            .string()
            .map((pk) => ensureEd25519PublicKey(decodeHexOrBase64Key(pk)))
            .nullable()
            .optional(),
        work_url: v.string().optional(),
        avatar_url: v.string().optional(),
        mediator_url: v.string().optional(),
        rendezvous_url: v.string().optional(),
    })
    .rest(v.unknown());

/**
 * Converts a cleanroom provisioning JSON object (§4.1) into a normalized {@link OppfFile}.
 */
export function parseCleanroomProvisioning(decoded: unknown): {
    readonly parsed: OppfFile;
    readonly string: string;
} {
    const clean = CLEANROOM_PROVISIONING_SCHEMA.parse(decoded);
    const baseHost = clean.chat_host ?? clean.server_id;
    const dirUrl = clean.directory_url.endsWith('/')
        ? clean.directory_url
        : `${clean.directory_url}/`;
    const safeUrl = clean.safe_url.endsWith('/') ? clean.safe_url : `${clean.safe_url}/`;
    const workUrl = (clean.work_url ?? `${dirUrl}work/`).endsWith('/')
        ? (clean.work_url ?? `${dirUrl}work/`)
        : `${clean.work_url ?? `${dirUrl}work/`}/`;
    const avatarUrl = (clean.avatar_url ?? `${dirUrl}avatar/`).endsWith('/')
        ? (clean.avatar_url ?? `${dirUrl}avatar/`)
        : `${clean.avatar_url ?? `${dirUrl}avatar/`}/`;
    const blobBase = clean.blob_url.replace(/\/+$/u, '');
    const mediatorUrl = clean.mediator_url ?? `wss://${baseHost}/mediator/`;
    const rendezvousUrl = clean.rendezvous_url ?? `wss://${baseHost}/rendezvous/`;
    const sigKey = clean.admin_signing_pubkey_ed25519 ?? ensureEd25519PublicKey(new Uint8Array(32));

    const synthesized = {
        version: '1.0',
        signatureKey: u8aToBase64(sigKey),
        refresh: 86400,
        license: {
            id: clean.server_id,
            expires: '2099-12-31',
            count: 1000,
        },
        chat: {
            hostname: baseHost,
            ports: [clean.chat_port ?? 5222],
            publicKey: u8aToBase64(clean.chat_pubkey_curve25519),
        },
        directory: {url: dirUrl},
        work: {url: workUrl},
        avatar: {url: avatarUrl},
        safe: {url: safeUrl},
        blob: {
            uploadUrl: `${blobBase}/upload`,
            downloadUrl: `${blobBase}/{blobId}`,
            doneUrl: `${blobBase}/{blobId}/done`,
        },
        mediator: {
            url: mediatorUrl.endsWith('/') ? mediatorUrl : `${mediatorUrl}/`,
            blob: {
                uploadUrl: `${blobBase}/upload`,
                downloadUrl: `${blobBase}/{blobId}`,
                doneUrl: `${blobBase}/{blobId}/done`,
            },
        },
        rendezvous: {
            url: rendezvousUrl.endsWith('/') ? rendezvousUrl : `${rendezvousUrl}/`,
        },
        updates: {
            desktop: {
                autoUpdate: false,
            },
        },
        domains: {
            rules: [],
        },
        server_id: clean.server_id,
        push_relay_url: clean.push_relay_url,
        admin_signing_pubkey_ed25519:
            clean.admin_signing_pubkey_ed25519 !== undefined &&
            clean.admin_signing_pubkey_ed25519 !== null
                ? u8aToBase64(clean.admin_signing_pubkey_ed25519)
                : null,
    };

    const parsed = OPPF_FILE_SCHEMA.parse(synthesized);
    return {
        parsed,
        string: JSON.stringify(synthesized),
    };
}

// An Ed25519 signature has 64 bytes which Base64 encoded result in 88 bytes.
const ED25519_BASE64_ENCODED_SIGNATURE_LENGTH = 88;

/**
 * Decode and verify the UTF-8 encoded OPPF JSON body against the Base64 encoded Ed25519 signature
 * (or parse an unsigned cleanroom `.json`/`.tlpf` provisioning payload when `trustedKeys` is empty).
 *
 * When `trustedKeys` is empty (default in Treslibre), any OPPF v1.0 file with a valid self-consistent
 * Ed25519 signature against its embedded `signatureKey`, or a cleanroom JSON provisioning payload,
 * is accepted for TOFU verification. When `trustedKeys` is non-empty, the embedded `signatureKey`
 * must match one of `trustedKeys`.
 *
 * @throws {@link Error} in case the provided data does not contain a valid OPPF file.
 * @throws {@link CryptoError} in case the signature does not match.
 * @returns the parsed OPPF JSON body and the OPPF string data.
 */
export function verifyOppfFile(
    services: Pick<ServicesForBackend, 'crypto'>,
    trustedKeys: readonly Ed25519PublicKey[],
    data: ReadonlyUint8Array,
): {readonly parsed: OppfFile; readonly string: string} {
    // Support unsigned cleanroom JSON / .tlpf provisioning files when trustedKeys is empty
    const rawTrimmed = UTF8.decode(data).trim();
    if (trustedKeys.length === 0 && rawTrimmed.startsWith('{') && rawTrimmed.endsWith('}')) {
        const rawDecoded = JSON.parse(rawTrimmed) as Record<string, unknown>;
        if (
            Object.hasOwn(rawDecoded, 'server_id') &&
            Object.hasOwn(rawDecoded, 'chat_pubkey_curve25519')
        ) {
            return parseCleanroomProvisioning(rawDecoded);
        }
    }

    const offset = calculateOppfBodyOffset(data);
    const bytes = extractOppfBodyAndSignature(data, offset);

    // Decode the signature
    const signature = ensureEd25519Signature(base64ToU8a(UTF8.decode(bytes.signature)));

    // Decode the OPPF file but only validate the signature key for now
    const string = UTF8.decode(bytes.body);
    const decoded = JSON.parse(string) as unknown;
    const {signatureKey} = OPPF_FILE_ONLY_SIGNATURE_KEY_SCHEMA.parse(decoded);

    // If an explicit allowlist of trustedKeys is provided, enforce it; otherwise allow TOFU self-verification
    if (
        trustedKeys.length > 0 &&
        !trustedKeys.some((trusted) => byteEquals(signatureKey, trusted))
    ) {
        throw new Error(
            `OPPF file is signed with an unknown signature key: ${u8aToBase64(signatureKey)} (Base64)`,
        );
    }

    // Validate the signature against the file body now
    services.crypto.verifyEd25519Signature(signatureKey, bytes.body, signature);

    // Now validate the rest of the file
    const parsed = OPPF_FILE_SCHEMA.parse(decoded);

    // Check whether the OPPF file expired
    if (new Date() > parsed.license.expires) {
        throw new Error(`OPPF file expired at ${parsed.license.expires}`);
    }

    // Now validate the rest of the file
    return {parsed, string};
}

export function calculateOppfBodyOffset(data: ReadonlyUint8Array): number {
    // Calculate the offset where the OPPF body ends. Disregard any excess new-line (ASCII 0x0a)
    // characters between the content and the signature.
    let offset = ED25519_BASE64_ENCODED_SIGNATURE_LENGTH;
    for (const [, byte] of entriesReverse(data.subarray(0, -offset))) {
        if (byte !== 0x0a) {
            break;
        }
        ++offset;
    }

    return offset;
}

// Extract the raw OPPF file body and the signature
export function extractOppfBodyAndSignature(
    data: ReadonlyUint8Array,
    offset: number,
): {body: ReadonlyUint8Array; signature: ReadonlyUint8Array} {
    return {
        body: data.subarray(0, -offset),
        signature: data.subarray(-ED25519_BASE64_ENCODED_SIGNATURE_LENGTH),
    };
}
