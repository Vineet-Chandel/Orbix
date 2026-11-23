import type { PageData } from '../../../shared/seo/metadata';
import { indexableAtOrigin, type SiteConfig } from '../../../shared/seo/site';
declare const __PUBLIC_SITE_CONFIG__: SiteConfig;
const configuredSite = __PUBLIC_SITE_CONFIG__;
export const publicSite = { ...configuredSite, indexable: typeof window === 'undefined' ? configuredSite.indexable : indexableAtOrigin(configuredSite,window.location.origin) };
export function initialSeoData(path: string): PageData | undefined {
    if (typeof document === 'undefined') return undefined;
    try { const payload = JSON.parse(document.getElementById('orbix-public-data')?.textContent || 'null'); return payload?.path === path ? payload.data : undefined; } catch { return undefined; }
}

interface PublicDataResult { status: number; data?: PageData }
const pending = new Map<string, Promise<PublicDataResult>>();
/** Deduplicate metadata/content requests without retaining withdrawn publication data. */
export function loadPublicData(path: string, page = 1): Promise<PublicDataResult> {
    const key = `${path}?page=${page}`;
    const existing = pending.get(key);
    if (existing) return existing;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const request = fetch(`/api/seo/page?path=${encodeURIComponent(path)}&page=${page}`, { credentials: 'omit', signal: controller.signal })
        .then(async response => { const payload = await response.json() as { data?: PageData }; return { status: response.status, data: payload.data }; })
        .finally(() => { clearTimeout(timeout); pending.delete(key); });
    pending.set(key,request);
    return request;
}

export function discardOtherBootstrap(path: string): void {
    if (typeof document === 'undefined') return;
    const node = document.getElementById('orbix-public-data');
    try { if (node && JSON.parse(node.textContent || 'null')?.path !== path) node.remove(); } catch { node?.remove(); }
}
