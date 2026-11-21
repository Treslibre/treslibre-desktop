// Modified 2026 by Treslibre Project (Treslibre).
/* eslint-disable @typescript-eslint/naming-convention, @typescript-eslint/no-restricted-types, no-bitwise */
import type {ReadonlyUint8Array} from '@threema/ts-utils/array/readonly-uint8-array';
import {bytesToHex} from '@threema/ts-utils/byte/bytes-to-hex';
import {hexToBytes} from '@threema/ts-utils/byte/hex-to-bytes';
import {UTF8} from '@threema/ts-utils/codec/utf8';

import type {
    ObservedComponent,
    ObservedHttpEndpoint,
    ServerKeyChangeAlert,
    ServerObservationRecord,
    SignedRotationProof,
} from '~/common/observation/types';
import {unreachable} from '~/common/utils/assert';

export type ObservationEvaluationResult =
    | {
          readonly status: 'matched';
          readonly record: ServerObservationRecord;
      }
    | {
          readonly status: 'rotated_by_admin';
          readonly record: ServerObservationRecord;
      }
    | {
          readonly status: 'mismatch_blocked';
          readonly alert: ServerKeyChangeAlert;
      };

/**
 * Signature verifier callback so the evaluator stays runtime-agnostic (usable with WebCrypto/libthreema or Node crypto).
 */
export type Ed25519VerifyFn = (
    publicKeyBytes: ReadonlyUint8Array,
    messageBytes: ReadonlyUint8Array,
    signatureBytes: ReadonlyUint8Array,
) => boolean;

/**
 * Create the initial TOFU observation record on First-Time Server Trust confirmation (§4.1 & §4.2).
 */
export function createInitialObservationRecord(params: {
    readonly server_id: string;
    readonly chat_server_pubkey_curve25519: string;
    readonly http_endpoints: {
        readonly directory: ObservedHttpEndpoint;
        readonly blob: ObservedHttpEndpoint;
        readonly safe: ObservedHttpEndpoint;
    };
    readonly admin_signing_pubkey_ed25519: string | null;
    readonly nowIso?: string;
}): ServerObservationRecord {
    const now = params.nowIso ?? new Date().toISOString();
    const chatHex = params.chat_server_pubkey_curve25519.toLowerCase();
    return {
        server_id: params.server_id,
        chat_server_pubkey_curve25519: chatHex,
        http_endpoints: {
            directory: {
                host: params.http_endpoints.directory.host,
                spki_sha256: params.http_endpoints.directory.spki_sha256,
                leaf_sha256: params.http_endpoints.directory.leaf_sha256.toLowerCase(),
            },
            blob: {
                host: params.http_endpoints.blob.host,
                spki_sha256: params.http_endpoints.blob.spki_sha256,
                leaf_sha256: params.http_endpoints.blob.leaf_sha256.toLowerCase(),
            },
            safe: {
                host: params.http_endpoints.safe.host,
                spki_sha256: params.http_endpoints.safe.spki_sha256,
                leaf_sha256: params.http_endpoints.safe.leaf_sha256.toLowerCase(),
            },
        },
        admin_signing_pubkey_ed25519:
            params.admin_signing_pubkey_ed25519 !== null
                ? params.admin_signing_pubkey_ed25519.toLowerCase()
                : null,
        first_seen_at: now,
        last_seen_at: now,
        rotation_count: 0,
        history: [
            {
                timestamp: now,
                event: 'initial_pin',
                component: 'chat_server',
                old_fingerprint: null,
                new_fingerprint: chatHex,
                verified_by_admin_key: false,
            },
            {
                timestamp: now,
                event: 'initial_pin',
                component: 'directory',
                old_fingerprint: null,
                new_fingerprint: params.http_endpoints.directory.spki_sha256,
                verified_by_admin_key: false,
            },
            {
                timestamp: now,
                event: 'initial_pin',
                component: 'blob',
                old_fingerprint: null,
                new_fingerprint: params.http_endpoints.blob.spki_sha256,
                verified_by_admin_key: false,
            },
            {
                timestamp: now,
                event: 'initial_pin',
                component: 'safe',
                old_fingerprint: null,
                new_fingerprint: params.http_endpoints.safe.spki_sha256,
                verified_by_admin_key: false,
            },
        ],
    };
}

/**
 * Build the canonical message bytes covered by an admin Ed25519 rotation signature (§4.3):
 * `"${server_id}||${component}||${new_fingerprint}||${timestamp_monotonic}"`
 */
export function buildCanonicalRotationPayload(params: {
    readonly server_id: string;
    readonly component: ObservedComponent;
    readonly new_fingerprint: string;
    readonly timestamp_monotonic: number;
}): Uint8Array {
    return UTF8.encode(
        `${params.server_id}||${params.component}||${params.new_fingerprint}||${params.timestamp_monotonic}`,
    );
}

/**
 * Lookup the current pinned fingerprint for a component.
 */
export function getPinnedFingerprint(
    record: ServerObservationRecord,
    component: ObservedComponent,
): {readonly fingerprint: string; readonly host: string} {
    switch (component) {
        case 'chat_server':
            return {
                fingerprint: record.chat_server_pubkey_curve25519,
                host: record.server_id,
            };
        case 'directory':
            return {
                fingerprint: record.http_endpoints.directory.spki_sha256,
                host: record.http_endpoints.directory.host,
            };
        case 'blob':
            return {
                fingerprint: record.http_endpoints.blob.spki_sha256,
                host: record.http_endpoints.blob.host,
            };
        case 'safe':
            return {
                fingerprint: record.http_endpoints.safe.spki_sha256,
                host: record.http_endpoints.safe.host,
            };
        default:
            return unreachable(component);
    }
}

function applyPinUpdate(params: {
    readonly record: ServerObservationRecord;
    readonly component: ObservedComponent;
    readonly newFingerprint: string;
    readonly newLeafSha256?: string;
    readonly event: 'signed_rotation' | 'unverified_manual_override';
    readonly verifiedByAdminKey: boolean;
    readonly nowIso: string;
    readonly monotonicTimestamp?: number;
}): ServerObservationRecord {
    const {record, component, newFingerprint, newLeafSha256, event, verifiedByAdminKey, nowIso} =
        params;
    const oldFingerprint = getPinnedFingerprint(record, component).fingerprint;

    const updatedEndpoints = {
        directory:
            component === 'directory'
                ? {
                      ...record.http_endpoints.directory,
                      spki_sha256: newFingerprint,
                      leaf_sha256:
                          newLeafSha256?.toLowerCase() ??
                          record.http_endpoints.directory.leaf_sha256,
                  }
                : record.http_endpoints.directory,
        blob:
            component === 'blob'
                ? {
                      ...record.http_endpoints.blob,
                      spki_sha256: newFingerprint,
                      leaf_sha256:
                          newLeafSha256?.toLowerCase() ?? record.http_endpoints.blob.leaf_sha256,
                  }
                : record.http_endpoints.blob,
        safe:
            component === 'safe'
                ? {
                      ...record.http_endpoints.safe,
                      spki_sha256: newFingerprint,
                      leaf_sha256:
                          newLeafSha256?.toLowerCase() ?? record.http_endpoints.safe.leaf_sha256,
                  }
                : record.http_endpoints.safe,
    };

    return {
        ...record,
        chat_server_pubkey_curve25519:
            component === 'chat_server'
                ? newFingerprint.toLowerCase()
                : record.chat_server_pubkey_curve25519,
        http_endpoints: updatedEndpoints,
        last_seen_at: nowIso,
        rotation_count: record.rotation_count + 1,
        last_rotation_monotonic: params.monotonicTimestamp ?? record.last_rotation_monotonic,
        history: [
            ...record.history,
            {
                timestamp: nowIso,
                event,
                component,
                old_fingerprint: oldFingerprint,
                new_fingerprint:
                    component === 'chat_server' ? newFingerprint.toLowerCase() : newFingerprint,
                verified_by_admin_key: verifiedByAdminKey,
            },
        ],
    };
}

/**
 * Evaluate an observed server key or TLS SPKI fingerprint against the stored TOFU record (§4.3).
 */
export function evaluateObservedFingerprint(params: {
    readonly record: ServerObservationRecord;
    readonly component: ObservedComponent;
    readonly observedFingerprint: string;
    readonly observedLeafSha256?: string;
    readonly rotationProof?: SignedRotationProof;
    readonly verifyEd25519?: Ed25519VerifyFn;
    readonly nowIso?: string;
}): ObservationEvaluationResult {
    const now = params.nowIso ?? new Date().toISOString();
    const {fingerprint: pinnedFingerprint, host} = getPinnedFingerprint(
        params.record,
        params.component,
    );
    const normalizedObserved =
        params.component === 'chat_server'
            ? params.observedFingerprint.toLowerCase()
            : params.observedFingerprint;
    const normalizedPinned =
        params.component === 'chat_server' ? pinnedFingerprint.toLowerCase() : pinnedFingerprint;

    // Case A: Exact match
    if (normalizedObserved === normalizedPinned) {
        return {
            status: 'matched',
            record: {
                ...params.record,
                last_seen_at: now,
            },
        };
    }

    // Case B: Signed rotation proof provided and admin_signing_pubkey_ed25519 is configured
    if (
        params.rotationProof !== undefined &&
        params.record.admin_signing_pubkey_ed25519 !== null &&
        params.verifyEd25519 !== undefined
    ) {
        const proof = params.rotationProof;
        const lastMonotonic = params.record.last_rotation_monotonic ?? 0;
        const normalizedProofFp =
            params.component === 'chat_server'
                ? proof.new_fingerprint.toLowerCase()
                : proof.new_fingerprint;

        if (
            proof.server_id === params.record.server_id &&
            proof.component === params.component &&
            normalizedProofFp === normalizedObserved &&
            proof.timestamp_monotonic > lastMonotonic
        ) {
            try {
                const adminKeyBytes = hexToBytes(params.record.admin_signing_pubkey_ed25519);
                const sigBytes = hexToBytes(proof.signature_ed25519_hex);
                const payloadBytes = buildCanonicalRotationPayload({
                    server_id: proof.server_id,
                    component: proof.component,
                    new_fingerprint: proof.new_fingerprint,
                    timestamp_monotonic: proof.timestamp_monotonic,
                });
                if (params.verifyEd25519(adminKeyBytes, payloadBytes, sigBytes)) {
                    return {
                        status: 'rotated_by_admin',
                        record: applyPinUpdate({
                            record: params.record,
                            component: params.component,
                            newFingerprint: normalizedObserved,
                            newLeafSha256: params.observedLeafSha256 ?? proof.new_leaf_sha256,
                            event: 'signed_rotation',
                            verifiedByAdminKey: true,
                            nowIso: now,
                            monotonicTimestamp: proof.timestamp_monotonic,
                        }),
                    };
                }
            } catch {
                // Fall through to hard-abort mismatch
            }
        }
    }

    // Case C: Unexpected key/cert change -> Hard-abort
    return {
        status: 'mismatch_blocked',
        alert: {
            server_id: params.record.server_id,
            component: params.component,
            host,
            old_fingerprint: normalizedPinned,
            new_fingerprint: normalizedObserved,
            new_leaf_sha256: params.observedLeafSha256,
            detected_at: now,
        },
    };
}

/**
 * Apply an explicit user-confirmed manual override after a secondary confirmation warning (§4.3 Case C).
 */
export function applyManualOverride(params: {
    readonly record: ServerObservationRecord;
    readonly component: ObservedComponent;
    readonly newFingerprint: string;
    readonly newLeafSha256?: string;
    readonly nowIso?: string;
}): ServerObservationRecord {
    const now = params.nowIso ?? new Date().toISOString();
    return applyPinUpdate({
        record: params.record,
        component: params.component,
        newFingerprint: params.newFingerprint,
        newLeafSha256: params.newLeafSha256,
        event: 'unverified_manual_override',
        verifiedByAdminKey: false,
        nowIso: now,
    });
}

/**
 * Map a hostname to the corresponding HTTP endpoint component in `ServerObservationRecord`, if any.
 */
export function resolveObservedHttpComponent(
    record: ServerObservationRecord,
    hostname: string,
): Extract<ObservedComponent, 'directory' | 'blob' | 'safe'> | undefined {
    const lower = hostname.toLowerCase();
    if (record.http_endpoints.directory.host.toLowerCase() === lower) {
        return 'directory';
    }
    if (record.http_endpoints.blob.host.toLowerCase() === lower) {
        return 'blob';
    }
    if (record.http_endpoints.safe.host.toLowerCase() === lower) {
        return 'safe';
    }
    return undefined;
}

/**
 * Generate a deterministic 5x5 symmetric visual identicon grid (boolean[25]) and RGB hex color
 * from any fingerprint string (hex or base64) for side-by-side comparison in `ServerKeyChangedModal`.
 */
export function computeFingerprintIdenticon(fingerprint: string): {
    readonly cells: readonly boolean[];
    readonly colorHex: string;
} {
    const bytes = UTF8.encode(fingerprint.trim());
    const words = new Uint32Array(8);
    for (let w = 0; w < 8; w++) {
        let h = (0x811c9dc5 ^ (w * 0x01000193)) >>> 0;
        for (const b of bytes) {
            h ^= b;
            h = Math.imul(h, 0x01000193) >>> 0;
        }
        words[w] = h;
    }

    const cells: boolean[] = [];
    for (let row = 0; row < 5; row++) {
        const rowWord = words[row] ?? 0;
        const c0 = ((rowWord >>> 0) & 1) === 1;
        const c1 = ((rowWord >>> 1) & 1) === 1;
        const c2 = ((rowWord >>> 2) & 1) === 1;
        cells.push(c0, c1, c2, c1, c0);
    }

    const colorWord = words[5] ?? 0;
    const r = 64 + (colorWord & 0x7f);
    const g = 64 + ((colorWord >>> 8) & 0x7f);
    const b = 64 + ((colorWord >>> 16) & 0x7f);
    const colorHex = `#${bytesToHex(new Uint8Array([r, g, b]))}`;
    return {cells, colorHex};
}
