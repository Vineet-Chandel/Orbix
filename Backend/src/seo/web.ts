import { gzip } from 'node:zlib';
import { promisify } from 'node:util';
import express, { type RequestHandler } from 'express';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { siteConfig, escapeHtml, safeJson } from '../../../shared/seo/site.js';
import { routePolicy, INDEXABLE_PAGES } from '../../../shared/seo/routes.js';
import { metadataFor, headHtml, type PageData } from '../../../shared/seo/metadata.js';
import { robotsTxt, sitemapXml, sitemapIndex, SITEMAP_PAGE_SIZE } from '../../../shared/seo/crawling.js';
import { createPublicRepository, type PublicRepository } from './publicRepository.js';
export interface WebOptions { env?: NodeJS.ProcessEnv; repository?: Omit<PublicRepository, 'isUnlistedClub'> & Partial<Pick<PublicRepository, 'isUnlistedClub'>>; template?: string; render?: (url: string, data: PageData) => string | Promise<string>; dist?: string }
const gzipAsync = promisify(gzip);
export function createSeoWeb(options: WebOptions = {}) {
    const env = options.env || process.env;
    const site = siteConfig(env);
    const siteForHost = (host: string | undefined) => ({
        ...site,
        indexable: site.indexable && host?.toLowerCase() === new URL(site.origin!).host,
    });
    const repository = options.repository || createPublicRepository(undefined, site.origin);
    const dist = options.dist || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../Frontend/dist');
    const serverEntry = path.resolve(dist, '../dist-server/entry-server.js');
    let renderer: WebOptions['render'] = options.render;
    let template = options.template;
    const router = express.Router();
    router.use((_req,res,next) => { res.setHeader('X-Content-Type-Options','nosniff'); res.setHeader('Referrer-Policy','strict-origin-when-cross-origin'); next(); });
    const staticBodies = new Map<string, string>();
    const noindex: RequestHandler = (_req, res, next) => { res.setHeader('X-Robots-Tag', 'noindex, nofollow'); res.setHeader('Cache-Control', 'private, no-store'); next(); };
    router.get('/robots.txt', (req, res) => { res.type('text/plain').setHeader('Cache-Control', 'public, max-age=300'); res.send(robotsTxt(siteForHost(req.get('host')))); });
    router.get('/sitemap.xml', async (req, res) => {
        const requestSite = siteForHost(req.get('host'));
        res.type('application/xml').setHeader('Cache-Control', 'no-store');
        try {
            const counts = requestSite.indexable ? await repository.counts() : { clubs: 0, events: 0 };
            const paths = ['/sitemaps/static.xml'];
            for (const kind of ['clubs','events'] as const) for (let page = 1; page <= Math.ceil(counts[kind] / SITEMAP_PAGE_SIZE); page++) paths.push(`/sitemaps/${kind}-${page}.xml`);
            res.send(sitemapIndex(paths, requestSite));
        } catch { res.status(503).setHeader('Retry-After', '60'); res.send(sitemapIndex([], requestSite)); }
    });
    router.get('/sitemaps/:file', async (req, res) => {
        const requestSite = siteForHost(req.get('host'));
        res.type('application/xml').setHeader('Cache-Control', 'no-store');
        try {
            if (req.params.file === 'static.xml') { res.send(sitemapXml(INDEXABLE_PAGES, requestSite)); return; }
            const match = String(req.params.file).match(/^(clubs|events)-([1-9]\d{0,5})\.xml$/);
            if (!match) { res.status(404).send(sitemapXml([], requestSite)); return; }
            if (!requestSite.indexable) { res.send(sitemapXml([], requestSite)); return; }
            const items = await repository.sitemap(match[1] as 'clubs' | 'events', Number(match[2]));
            res.status(items.length ? 200 : 404).send(sitemapXml(items, requestSite));
        } catch { res.status(503).setHeader('Retry-After', '60'); res.send(sitemapXml([], requestSite)); }
    });
    router.get('/api/seo/page', noindex, async (req, res) => {
        const requested = String(req.query.path || '');
        const policy = routePolicy(requested);
        if (!['club','event','events','clubs'].includes(policy.kind)) { res.status(404).json({ success: false, message: 'Page unavailable.' }); return; }
        try { const data = await repository.page(policy.path, Math.max(1, Math.min(10000, Math.trunc(Number(req.query.page)) || 1))); res.status(data ? 200 : 404).json(data ? { success: true, data } : { success: false, message: 'Page unavailable.' }); }
        catch { res.status(503).json({ success: false, message: 'Page temporarily unavailable.' }); }
    });
    router.get('/index.html', (_req, res) => { res.setHeader('Cache-Control', 'private, no-store'); res.redirect(308, '/'); });
    router.use('/assets', express.static(path.join(dist, 'assets'), { immutable: true, maxAge: '1y', dotfiles: 'deny', fallthrough: true }));
    router.use(express.static(dist, { index: false, dotfiles: 'deny', maxAge: '1h', fallthrough: true, setHeaders: (res,file) => { res.setHeader('X-Content-Type-Options', 'nosniff'); if (file.endsWith('.pdf')) res.setHeader('X-Robots-Tag','noindex,nofollow'); } }));
    router.use(async (req, res, next) => {
        if (!['GET','HEAD'].includes(req.method) || req.path.startsWith('/api/') || req.path.startsWith('/health')) return next();
        // JSON clients of legacy API aliases keep working; HTML visitors get the public document.
        if (req.get('accept')?.includes('application/json') && !req.get('accept')?.includes('text/html')) return next();
        const permanentRedirect = (destination: string) => {
            res.setHeader('Cache-Control','private, no-store');
            res.setHeader('X-Robots-Tag','noindex,nofollow');
            res.redirect(308,destination);
        };
        const policy = routePolicy(req.path);
        if (policy.kind === 'missing' && path.extname(req.path)) { res.status(404).setHeader('X-Robots-Tag', 'noindex'); res.end(); return; }
        if (policy.redirect) { permanentRedirect(policy.redirect); return; }
        const rawNormalized = req.path.replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/';
        if (rawNormalized !== req.path) { permanentRedirect(rawNormalized + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '')); return; }
        if (env.SEO_ENFORCE_CANONICAL_HOST === 'true' && site.origin && req.get('host') !== new URL(site.origin).host) { permanentRedirect(site.origin + req.originalUrl); return; }
        // A signed-in dynamic document must use the existing per-viewer API authorization,
        // including moderation blocks, instead of rendering an anonymous public representation.
        const sessionDocument = ['club','event','events','clubs'].includes(policy.kind) && Boolean(req.headers.authorization || /(?:^|;\s*)(?:token|refreshToken)=/.test(req.headers.cookie || ''));
        let data: PageData = {};
        let status = policy.status;
        if (!sessionDocument && ['club','event','events','clubs'].includes(policy.kind)) {
            try {
                const page = Math.max(1, Math.min(10000, Math.trunc(Number(req.query.page)) || 1));
                const result = await repository.page(policy.path, page);
                if (result) data = result;
                else if (policy.kind !== 'club' || !(await repository.isUnlistedClub?.(policy.path))) status = 404;
            }
            catch { status = 503; }
        }
        if (data.entity && data.entity.path !== policy.path) { permanentRedirect(data.entity.path); return; }
        const requestSite = siteForHost(req.get('host'));
        const meta = metadataFor(policy.path, sessionDocument ? { ...requestSite, indexable:false } : requestSite, data, status);
        res.setHeader('X-Robots-Tag', meta.robots);
        // Dynamic publication withdrawal takes effect on the next request; no personalized/shared HTML caching.
        res.setHeader('Cache-Control', 'private, no-store');
        try {
            template ||= await readFile(path.join(dist, 'index.html'), 'utf8');
            let body = '';
            if (!sessionDocument && status === 200 && (policy.indexable || data.entity)) {
                renderer ||= (await import(pathToFileURL(serverEntry).href)).renderPublicPage;
                const isStatic = policy.kind === 'static';
                body = isStatic ? staticBodies.get(policy.path) || '' : '';
                if (!body) {
                    body = await renderer!(req.originalUrl, data);
                    if (isStatic) { if (staticBodies.size >= 64) staticBodies.delete(staticBodies.keys().next().value!); staticBodies.set(policy.path, body); }
                }
            } else if (status >= 400) {
                body = `<main><h1>${status === 503 ? 'Temporarily unavailable' : 'Page not found'}</h1><p>${status === 503 ? 'Please try again later.' : 'This page is unavailable.'}</p><a href="/">Orbix home</a></main>`;
            }
            const clean = template.replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, '').replace(/<(meta|link)\b[^>]*data-orbix-seo[^>]*>/gi, '');
            let html = clean.replace('</head>', () => `${headHtml(meta)}\n</head>`).replace('<div id="root"></div>', () => `<div id="root">${body}</div><script type="application/json" id="orbix-public-data">${safeJson({ path: policy.path, data })}</script>`);
            if (body) html = html.replace(/<div id="orbix-preloader-root"[\s\S]*?<div id="root">/, '<div id="root">').replace('<script src="/orbix-intro.js"></script>', '');
            res.status(status).type('html');
            res.vary('Accept-Encoding');
            if (html.length > 1024 && req.acceptsEncodings('gzip')) {
                const compressed = await gzipAsync(html);
                res.setHeader('Content-Encoding','gzip');
                res.send(compressed);
            } else res.send(html);
        } catch (error) {
            console.error('[SEO] Public document render failed:', error instanceof Error ? error.name : 'render failure');
            res.status(503).setHeader('X-Robots-Tag','noindex,nofollow').type('html').send(`<!doctype html><html lang="en"><head><meta name="robots" content="noindex,nofollow"><title>Temporarily unavailable | Orbix</title></head><body><main><h1>Temporarily unavailable</h1><p>Please try again later.</p><a href="/">${escapeHtml('Orbix home')}</a></main></body></html>`);
        }
    });
    return router;
}
