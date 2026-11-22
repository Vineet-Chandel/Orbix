import type { PageData } from './metadata.js';
/** Public bootstrap data is scoped to its URL/page; private shells carry no reusable data. */
export function hasPublicPageData(data: PageData | undefined, path: string, page = 1): boolean {
    if (!data) return false;
    if (data.entity) return data.entity.path === path && ['club','event'].includes(data.entity.kind);
    if (path === '/events') return Array.isArray(data.events) && (data.page || 1) === page;
    if (path === '/clubs') return Array.isArray(data.clubs) && (data.page || 1) === page;
    return false;
}
