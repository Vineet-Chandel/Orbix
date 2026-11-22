import { isDemoClubSlug } from "./demoClub.js";
import { APP_ROUTE_PATTERNS } from "./appRoutes.js";
import { ALL_DOC_FILES } from './docs.js';
import { DOC_ALIASES } from './docAliases.js';
import { WORKBOOK_SECTIONS } from './workbook.js';
export interface PageDefinition { path: string; title: string; description: string; kind?: 'doc' | 'article' | 'collection' | 'software'; image?: string | undefined }
export const WORKBOOK_BASE = '/blog/aws-sbg-psit/aws-launchpad-2026';
export const STATIC_PAGES: PageDefinition[] = [
    { path: '/', title: 'Orbix — Developer Profiles & Campus Clubs', description: 'Bring coding profiles, contest activity and projects together on Orbix. Discover campus clubs, public events and practical engineering documentation.', kind: 'software' },
    { path: '/clubs', title: 'Campus Clubs & Student Organizations | Orbix', description: 'Explore how Orbix helps campus clubs publish profiles, organize events and manage their teams through a dedicated club workspace.' },
    { path: '/platform', title: 'Developer Platform Overview | Orbix', description: 'Explore the Orbix platform for developer profiles, connected coding accounts, campus clubs and event participation.' },
    { path: '/card', title: 'Shareable Developer Cards | Orbix', description: 'Explore Orbix developer cards for sharing your coding profile and selected public achievements.' },
    { path: '/platforms', title: 'Connected Coding Platforms | Orbix', description: 'Explore coding-platform connections on Orbix, including GitHub, LeetCode, Codeforces and CodeChef. Read the integration registry for details.' },
    { path: '/events-showcase', title: 'Coding Contest Calendar | Orbix', description: 'Explore the Orbix contest calendar for discovering coding contests and tracking upcoming competitive programming events.' },
    { path: '/events', title: 'Public Campus & National Events | Orbix', description: 'Browse published national events open to all students. View event details, dates and the organizing club before registering.', kind: 'collection' },
    { path: '/blogs', title: 'Engineering Workbooks & Guides | Orbix', description: 'Read the AWS Cloud Launchpad workbook: deploy a website with Amazon EC2 and Nginx, verify access and learn practical troubleshooting.', kind: 'collection' },
    { path: '/docs', title: 'Developer & Club Documentation | Orbix', description: 'Read Orbix documentation for coding-platform connections, score calculations, profile privacy, college verification and club workflows.', kind: 'collection' },
    { path: '/privacy', title: 'Privacy Policy | Orbix', description: 'Read how Orbix describes account data collection, public profile visibility and privacy controls.' },
    { path: '/terms', title: 'Terms & Conditions | Orbix', description: 'Read the terms and conditions for using Orbix developer profiles, campus clubs and event features.' },
    { path: '/about', title: 'About Orbix | Developer Profiles & Campus Communities', description: 'Learn what Orbix provides for developers and campus clubs, how to get started and where to find feature and privacy documentation.' },
];
export const DOC_PAGES: PageDefinition[] = ALL_DOC_FILES.map(doc => ({ path: `/docs/${doc.slug}`, title: `${doc.title} | Orbix Docs`, description: doc.summary, kind: 'doc', image: doc.image }));
export const ARTICLE_PAGES: PageDefinition[] = WORKBOOK_SECTIONS.flatMap(section => section.items).filter(item => item.status === 'ready').map(item => ({ path: item.id === 'overview' ? WORKBOOK_BASE : `${WORKBOOK_BASE}/${item.id}`, title: `${item.title} | AWS Cloud Launchpad · Orbix`, description: item.description, kind: 'article' }));
export const INDEXABLE_PAGES = [...STATIC_PAGES, ...DOC_PAGES, ...ARTICLE_PAGES];
export const ROUTE_ALIASES: Record<string, string> = {
    ...{"/privacy-policy": "/privacy", "/terms-and-conditions": "/terms", "/terms-of-service": "/terms", "/demo": "/profile/u/Vineet-Chandel", "/demo/profile": "/profile/u/Vineet-Chandel", "/demo-profile": "/profile/u/Vineet-Chandel", "/demo/club": "/clubs/aws-swg-psit", "/demo-club": "/clubs/aws-swg-psit", "/auth/forgot-password": "/auth/signin?view=forgot-password", "/forgot-password": "/auth/signin?view=forgot-password", "/login": "/auth/signin", "/clubs/status": "/club/status", "/club": "/club/dashboard", "/club/trends": "/club/analytics", "/club/credibility": "/club/dashboard", "/club/manage-profile": "/club/profile", "/club/campus-clubs": "/club/clubs", "/club/other-clubs": "/club/clubs", "/wallet": "/activity?tab=certificates", "/certificates": "/activity?tab=certificates"},
    '/orbit': '/platforms', '/event-calendar': '/events-showcase', '/blog': '/blogs',
    ...Object.fromEntries(Object.entries(DOC_ALIASES).filter(([alias, slug]) => alias !== slug).map(([alias, slug]) => [`/docs/${alias}`, `/docs/${slug}`])),
};
const PRIVATE_PREFIXES = ['/auth', '/club', '/staff', '/dashboard', '/settings', '/workspace', '/notifications', '/inbox', '/activity', '/applications', '/profile', '/u', '/resume', '/projects', '/reports', '/trends', '/explore', '/college-clubs', '/campus-clubs', '/college-events', '/club-announcements', '/wallet', '/certificates'];
export interface RoutePolicy { path: string; page?: PageDefinition; redirect?: string | undefined; kind: 'static' | 'club' | 'event' | 'events' | 'clubs' | 'private' | 'utility' | 'missing'; indexable: boolean; status: number }
export function routePolicy(rawPath: string): RoutePolicy {
    let path: string;
    try { path = decodeURI(rawPath.split('?')[0] || '/').replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/'; } catch { return { path: '/', kind: 'missing', indexable: false, status: 400 }; }
    if (ROUTE_ALIASES[path]) return { path, kind: 'static', redirect: ROUTE_ALIASES[path], indexable: false, status: 308 };
    if (path.startsWith('/blogs/')) return { path, kind: 'static', redirect: path.replace('/blogs/', '/blog/'), indexable: false, status: 308 };
    if (path === `${WORKBOOK_BASE}/overview`) return { path, kind: 'static', redirect: WORKBOOK_BASE, indexable: false, status: 308 };
    const nestedDoc = path.match(/^\/docs\/([^/]+)\/([^/]+)$/);
    if (nestedDoc) { const doc = ALL_DOC_FILES.find(d => d.folderId === nestedDoc[1] && (d.slug === nestedDoc[2] || d.id === nestedDoc[2])); if (doc) return { path, kind: 'static', redirect: `/docs/${doc.slug}`, indexable: false, status: 308 }; }
    const page = INDEXABLE_PAGES.find(p => p.path === path);
    if (page) return { path, page, kind: path === '/events' ? 'events' : path === '/clubs' ? 'clubs' : 'static', indexable: true, status: 200 };
    if (path.startsWith('/clubs/') && isDemoClubSlug(path.slice(7))) return { path,kind:'utility',indexable:false,status:200 };
    if (/^\/clubs\/[a-zA-Z0-9_.-]+$/.test(path) && path !== '/clubs/status') return { path, kind: 'club', indexable: false, status: 200 };
    if (/^\/events\/[0-9a-f-]{36}$/i.test(path)) return { path, kind: 'event', indexable: false, status: 200 };
    const legacyProfile = path.match(/^\/(?:profile|u)\/([^/]+)$/);
    if (legacyProfile && legacyProfile[1] !== 'setup') return { path, kind: 'private', redirect: `/profile/u/${encodeURIComponent(legacyProfile[1]!)}`, indexable:false,status:308 };
    const knownAppPath = APP_ROUTE_PATTERNS.some(pattern => pattern !== '*' && new RegExp('^' + pattern.split('/').map(segment => segment.startsWith(':') ? '[^/]+' : segment.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('/') + '$').test(path));
    if (PRIVATE_PREFIXES.some(p => path === p || path.startsWith(p + '/'))) return { path, kind: knownAppPath ? 'private' : 'missing', indexable: false, status: knownAppPath ? 200 : 404 };
    if (/^\/(?:verify|verify-cert|demo|demo-profile|demo-club|join-club|workspace-invite|onboarding|login|forgot-password|leaderboard|customers|pricing|announcements)(?:\/|$)/.test(path) || /^\/events\/(?:guardian-consent|tracker|[^/]+\/register)$/.test(path) || path === '/student/activity') return { path, kind: 'utility', indexable: false, status: 200 };
    // Existing single-parameter blog aliases point at workbook lessons.
    const oldBlog = path.match(/^\/blog\/([^/]+)$/);
    if (oldBlog) { const target = oldBlog[1] === 'overview' ? WORKBOOK_BASE : `${WORKBOOK_BASE}/${oldBlog[1]}`; if (ARTICLE_PAGES.some(p => p.path === target)) return { path, kind: 'static', redirect: target, indexable: false, status: 308 }; }
    return { path, kind: 'missing', indexable: false, status: 404 };
}
