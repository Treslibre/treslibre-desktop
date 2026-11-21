// Modified 2026 by Treslibre Project (Treslibre).
import type {Logger} from '~/common/logging';

/**
 * Outbound crash reporting and telemetry are permanently disabled in Treslibre.
 */
export function initCrashReportingInSandboxBuilds(log?: Logger): void {
    void log;
}

export function handleError(message?: string, logTag?: string, error?: Error): void {
    void message;
    void logTag;
    void error;
}
