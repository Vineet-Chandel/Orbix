import { routePolicy } from "./routes.js";
import { canonicalUrl, escapeHtml, type SiteConfig } from './site.js';
export interface SitemapItem { path: string; updatedAt?: string | undefined }
export const SITEMAP_PAGE_SIZE = 1000;
export function sitemapXml(items: SitemapItem[], site: SiteConfig): string {
    const seen = new Set<string>();
    return '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + (site.indexable ? items.map(item => {
        const loc = canonicalUrl(site.origin, item.path);
        const policy = routePolicy(item.path);
        if (!loc || seen.has(loc) || policy.redirect || (!policy.indexable && !['club','event'].includes(policy.kind))) return '';
        seen.add(loc);
        const date = item.updatedAt && new Date(item.updatedAt);
        const modified = date && Number.isFinite(date.getTime()) && date.getTime() <= Date.now() ? `<lastmod>${date.toISOString()}</lastmod>` : '';
        return `<url><loc>${escapeHtml(loc)}</loc>${modified}</url>`;
    }).join('') : '') + '</urlset>';
}
export function sitemapIndex(paths: string[], site: SiteConfig): string {
    return '<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + (site.indexable ? paths.map(path => `<sitemap><loc>${escapeHtml(canonicalUrl(site.origin, path))}</loc></sitemap>`).join('') : '') + '</sitemapindex>';
}
export function robotsTxt(site: SiteConfig): string {
    if (!site.indexable) return 'User-agent: *\nDisallow: /\n';
    // Keep HTML routes crawlable so their noindex can be processed; disallow APIs/exports.
    return `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /assets-private/\n\nUser-agent: GPTBot\nDisallow: /\n\nUser-agent: CCBot\nDisallow: /\n\nSitemap: ${site.origin}/sitemap.xml\n`;
}
