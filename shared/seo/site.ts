export interface SiteConfig { origin: string | null; indexable: boolean }
export function siteConfig(env: Record<string, string | undefined>): SiteConfig {
    let origin: string | null = null;
    try {
        const url = new URL(env.SITE_URL || '');
        const local = /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(url.hostname);
        if (url.protocol === 'https:' && !local && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash) origin = url.origin;
    } catch { /* Missing/invalid domain must never produce localhost metadata. */ }
    return { origin, indexable: !!origin && env.SEO_INDEXING_ENABLED === 'true' && env.NODE_ENV === 'production' };
}
export function canonicalUrl(origin: string | null, path: string): string | null {
    if (!origin || !path.startsWith('/') || path.startsWith('//')) return null;
    const url = new URL(path, origin);
    if (url.origin !== origin) return null;
    url.search = ''; url.hash = '';
    url.pathname = url.pathname.replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/';
    return url.href;
}
export function safeImage(value: unknown, origin: string | null): string | undefined {
    if (typeof value !== 'string' || !origin) return undefined;
    try { const url = new URL(value, origin); return url.protocol === 'https:' && !url.username && !url.password ? url.href : undefined; } catch { return undefined; }
}
export function plainText(value: unknown, limit = 170): string {
    return String(value || '').replace(/<[^>]*>/g, ' ').replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*#_`>]/g, '').replace(/\s+/g, ' ').trim().slice(0, limit);
}
export function escapeHtml(value: unknown): string {
    return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
export function safeJson(value: unknown): string { return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029'); }

/** A production bundle copied to a preview host must not enable browser indexing there. */
export function indexableAtOrigin(site: SiteConfig, currentOrigin: string): boolean { return site.indexable && currentOrigin === site.origin; }
