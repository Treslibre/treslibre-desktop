// Modified 2026 by Treslibre Project (Treslibre).
import {ensureBaseUrl, validateUrl} from '~/common/network/types';

export function checkAndCompleteUrl(urlString: string): URL {
    const trimmed = urlString.trim();
    if (trimmed.startsWith('data:')) {
        return new URL(trimmed);
    }

    // Ensure the URL starts with 'https://'
    let httpsCheckedUrl = trimmed;
    if (!/^https?:\/\//iu.test(trimmed)) {
        httpsCheckedUrl = `https://${trimmed}`;
    }

    // Ensure it points to an '.oppf', '.tlpf', or '.json' file or apply the default path on the base URL.
    let url;
    if (
        httpsCheckedUrl.endsWith('.oppf') ||
        httpsCheckedUrl.endsWith('.tlpf') ||
        httpsCheckedUrl.endsWith('.json')
    ) {
        url = validateUrl(httpsCheckedUrl, {protocol: 'https:', search: 'deny', hash: 'deny'});
    } else {
        url = new URL('prov/config.oppf', ensureBaseUrl(httpsCheckedUrl, 'https:'));
    }

    return url;
}
