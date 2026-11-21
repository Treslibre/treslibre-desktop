// Modified 2026 by Treslibre Project (Treslibre).
/* eslint-disable @typescript-eslint/naming-convention, @typescript-eslint/no-restricted-types */
import * as v from '@badrap/valita';

/**
 * Observed component type in the TOFU Local Observation System (§4.2).
 */
export type ObservedComponent = 'chat_server' | 'directory' | 'blob' | 'safe';

/**
 * History event type for key/certificate pinning and rotations (§4.2).
 */
export type ObservationEventType = 'initial_pin' | 'signed_rotation' | 'unverified_manual_override';

/**
 * Observed HTTP endpoint TLS record (§4.2).
 */
export interface ObservedHttpEndpoint {
    readonly host: string;
    readonly spki_sha256: string;
    readonly leaf_sha256: string;
}

/**
 * Single audit log entry in an observed server record's `history` array (§4.2).
 */
export interface ObservationHistoryEntry {
    readonly timestamp: string;
    readonly event: ObservationEventType;
    readonly component: ObservedComponent;
    readonly old_fingerprint: string | null;
    readonly new_fingerprint: string;
    readonly verified_by_admin_key: boolean;
}

/**
 * Canonical schema for each observed server record (§4.2).
 */
export interface ServerObservationRecord {
    readonly server_id: string;
    readonly chat_server_pubkey_curve25519: string;
    readonly http_endpoints: {
        readonly directory: ObservedHttpEndpoint;
        readonly blob: ObservedHttpEndpoint;
        readonly safe: ObservedHttpEndpoint;
    };
    readonly admin_signing_pubkey_ed25519: string | null;
    readonly first_seen_at: string;
    readonly last_seen_at: string;
    readonly rotation_count: number;
    readonly history: readonly ObservationHistoryEntry[];
    readonly last_rotation_monotonic?: number;
}

/**
 * Signed key/certificate rotation proof from the server administrator (§4.3).
 *
 * The Ed25519 signature covers the canonical UTF-8 payload:
 * `"${server_id}||${component}||${new_fingerprint}||${timestamp_monotonic}"`
 */
export interface SignedRotationProof {
    readonly server_id: string;
    readonly component: ObservedComponent;
    readonly new_fingerprint: string;
    readonly new_leaf_sha256?: string;
    readonly timestamp_monotonic: number;
    readonly signature_ed25519_hex: string;
}

/**
 * Details emitted when an unexpected server key or TLS certificate change is detected (§4.3).
 */
export interface ServerKeyChangeAlert {
    readonly server_id: string;
    readonly component: ObservedComponent;
    readonly host: string;
    readonly old_fingerprint: string;
    readonly new_fingerprint: string;
    readonly new_leaf_sha256?: string;
    readonly detected_at: string;
}

export const OBSERVED_HTTP_ENDPOINT_SCHEMA = v.object({
    host: v.string(),
    spki_sha256: v.string(),
    leaf_sha256: v.string(),
});

export const OBSERVATION_HISTORY_ENTRY_SCHEMA = v.object({
    timestamp: v.string(),
    event: v.union(
        v.literal('initial_pin'),
        v.literal('signed_rotation'),
        v.literal('unverified_manual_override'),
    ),
    component: v.union(
        v.literal('chat_server'),
        v.literal('directory'),
        v.literal('blob'),
        v.literal('safe'),
    ),
    old_fingerprint: v.string().nullable(),
    new_fingerprint: v.string(),
    verified_by_admin_key: v.boolean(),
});

export const SERVER_OBSERVATION_RECORD_SCHEMA: v.Type<ServerObservationRecord> = v.object({
    server_id: v.string(),
    chat_server_pubkey_curve25519: v.string(),
    http_endpoints: v.object({
        directory: OBSERVED_HTTP_ENDPOINT_SCHEMA,
        blob: OBSERVED_HTTP_ENDPOINT_SCHEMA,
        safe: OBSERVED_HTTP_ENDPOINT_SCHEMA,
    }),
    admin_signing_pubkey_ed25519: v.string().nullable(),
    first_seen_at: v.string(),
    last_seen_at: v.string(),
    rotation_count: v.number(),
    history: v.array(OBSERVATION_HISTORY_ENTRY_SCHEMA),
    last_rotation_monotonic: v.number().optional(),
});
