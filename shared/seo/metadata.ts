import { canonicalUrl, escapeHtml, plainText, safeImage, safeJson, type SiteConfig } from './site.js';
import { routePolicy, type PageDefinition } from './routes.js';
export interface PublicEntity {
    kind: 'club' | 'event'; path: string; title: string; description: string; image?: string | undefined;
    updatedAt?: string | undefined; startsAt?: string | undefined; endsAt?: string | undefined; locationType?: string | undefined; venue?: string | undefined;
    clubName?: string | undefined; clubPath?: string | undefined; club?: Record<string, unknown>;
}
export interface PageData { entity?: PublicEntity; events?: PublicEntity[]; clubs?: PublicEntity[]; page?: number; hasNext?: boolean }
export interface SeoMetadata { title: string; description: string; canonical: string | null; robots: string; image?: string | undefined; imageAlt: string; type: string; schema: Record<string, unknown>[]; indexable: boolean }
const PRIVATE_TITLES: Record<string,string> = {
    '/auth/signin':'Sign In', '/auth/signup':'Create an Account', '/auth/callback':'Completing Sign In',
    '/onboarding':'Set Up Your Profile', '/auth/profiles':'Connect Your Profiles', '/profile/setup':'Set Up Your Profile',
    '/dashboard':'Developer Dashboard', '/settings':'Account Settings', '/profile':'Edit Your Profile',
    '/club/dashboard':'Club Dashboard', '/club/status':'Club Verification Status', '/club/settings':'Club Settings',
    '/club/profile':'Edit Club Profile', '/staff/club-reviews':'Club Review Workspace',
    '/verify':'Certificate Verification', '/leaderboard':'Developer Leaderboard', '/pricing':'Plans', '/customers':'Customer Stories',
};
export function metadataFor(path: string, site: SiteConfig, data?: PageData, status = 200): SeoMetadata {
    const policy = routePolicy(path);
    const candidate = data?.entity;
    const entity = candidate && candidate.path === policy.path && ((policy.kind === 'club' && candidate.kind === 'club') || (policy.kind === 'event' && candidate.kind === 'event')) ? candidate : undefined;
    const page: PageDefinition | undefined = policy.page;
    const indexable = site.indexable && status === 200 && (policy.indexable || !!entity) && !policy.redirect;
    let title = entity ? `${entity.title} | Orbix ${entity.kind === 'club' ? 'Clubs' : 'Events'}` : page?.title || (status === 404 || policy.kind === 'missing' ? 'Page Not Found | Orbix' : `${PRIVATE_TITLES[policy.path] || 'Account & Application'} | Orbix`);
    let description = plainText(entity?.description || page?.description || 'Sign in to manage your Orbix account and access application features.', 190);
    if ((data?.page || 1) > 1) { title += ` — Page ${data!.page}`; description += ` Page ${data!.page}.`; }
    let canonical = indexable ? canonicalUrl(site.origin, entity?.path || policy.path) : null;
    if (canonical && ['events','clubs'].includes(policy.kind) && (data?.page || 1) > 1) canonical += `?page=${data!.page}`;
    const image = indexable ? safeImage(entity?.image || page?.image || '/social-card.png', site.origin) : undefined;
    const schema: Record<string, unknown>[] = [];
    if (indexable && canonical && site.origin) {
        const org = { '@type': 'Organization', '@id': `${site.origin}/#organization`, name: 'Orbix', url: site.origin, logo: { '@type': 'ImageObject', url: `${site.origin}/icon-512.png` } };
        const web = { '@type': 'WebSite', '@id': `${site.origin}/#website`, name: 'Orbix', url: site.origin, publisher: { '@id': `${site.origin}/#organization` } };
        const pageSchema: Record<string, unknown> = { '@type': page?.kind === 'collection' ? 'CollectionPage' : page?.kind === 'doc' ? 'TechArticle' : page?.kind === 'article' ? 'Article' : 'WebPage', '@id': `${canonical}#page`, url: canonical, name: title, description, isPartOf: { '@id': `${site.origin}/#website` }, ...(image ? { image } : {}) };
        // Static registries supply month labels, not precise publication timestamps. Do not invent dates/authors.
        const crumbs = [{ '@type': 'ListItem', position: 1, name: 'Orbix', item: `${site.origin}/` }];
        if (policy.path !== '/') crumbs.push({ '@type': 'ListItem', position: 2, name: entity?.title || page?.title.split(' | ')[0] || title, item: canonical });
        const graph: Record<string, unknown>[] = [org, web, pageSchema, { '@type': 'BreadcrumbList', '@id': `${canonical}#breadcrumbs`, itemListElement: crumbs }];
        if (policy.path === '/') graph.push({ '@type': 'SoftwareApplication', '@id': `${site.origin}/#application`, name: 'Orbix', applicationCategory: 'DeveloperApplication', operatingSystem: 'Web browser', url: canonical, description });
        if (entity?.kind === 'club') graph.push({ '@type': 'Organization', '@id': `${canonical}#club`, name: entity.title, url: canonical, description, ...(image ? { image } : {}) });
        if (entity?.kind === 'event' && entity.startsAt) {
            const virtual = ['online', 'virtual'].includes(entity.locationType || '');
            graph.push({ '@type': 'Event', '@id': `${canonical}#event`, name: entity.title, description, url: canonical, startDate: entity.startsAt, ...(entity.endsAt ? { endDate: entity.endsAt } : {}), ...(image ? { image: [image] } : {}), eventStatus: 'https://schema.org/EventScheduled', eventAttendanceMode: virtual ? 'https://schema.org/OnlineEventAttendanceMode' : entity.locationType === 'hybrid' ? 'https://schema.org/MixedEventAttendanceMode' : 'https://schema.org/OfflineEventAttendanceMode', location: virtual ? { '@type': 'VirtualLocation', url: canonical } : { '@type': 'Place', name: entity.venue || entity.clubName || entity.title }, organizer: { '@type': 'Organization', name: entity.clubName, url: canonicalUrl(site.origin, entity.clubPath || '/clubs') } });
        }
        schema.push({ '@context': 'https://schema.org', '@graph': graph });
    }
    return { title, description, canonical, robots: indexable ? 'index,follow,max-image-preview:large' : 'noindex,nofollow', image, imageAlt: entity?.title || 'Orbix developer profiles and campus clubs', type: page?.kind === 'article' || page?.kind === 'doc' ? 'article' : 'website', schema, indexable };
}
export function headHtml(meta: SeoMetadata): string {
    const tags = [`<title data-orbix-seo>${escapeHtml(meta.title)}</title>`, `<meta data-orbix-seo name="description" content="${escapeHtml(meta.description)}">`, `<meta data-orbix-seo name="robots" content="${meta.robots}">`, '<meta data-orbix-seo name="theme-color" content="#FAF6EE">'];
    if (meta.canonical) tags.push(`<link data-orbix-seo rel="canonical" href="${escapeHtml(meta.canonical)}">`);
    for (const [property, content] of Object.entries({ 'og:title': meta.title, 'og:description': meta.description, 'og:type': meta.type, 'og:site_name': 'Orbix', 'og:locale': 'en_IN', ...(meta.canonical ? { 'og:url': meta.canonical } : {}), ...(meta.image ? { 'og:image': meta.image, 'og:image:alt': meta.imageAlt, ...(meta.image.endsWith('/social-card.png') ? { 'og:image:width': '1200', 'og:image:height': '630', 'og:image:type': 'image/png' } : {}) } : {}) })) tags.push(`<meta data-orbix-seo property="${property}" content="${escapeHtml(content)}">`);
    for (const [name, content] of Object.entries({ 'twitter:card': meta.image && !meta.image.endsWith('.svg') ? 'summary_large_image' : 'summary', 'twitter:title': meta.title, 'twitter:description': meta.description, ...(meta.image ? { 'twitter:image': meta.image, 'twitter:image:alt': meta.imageAlt } : {}) })) tags.push(`<meta data-orbix-seo name="${name}" content="${escapeHtml(content)}">`);
    for (const schema of meta.schema) tags.push(`<script data-orbix-seo type="application/ld+json">${safeJson(schema)}</script>`);
    return tags.join('\n');
}
