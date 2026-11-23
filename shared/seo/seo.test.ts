import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { siteConfig, canonicalUrl, safeJson, indexableAtOrigin } from './site.js';
import { routePolicy, INDEXABLE_PAGES } from './routes.js';
import { APP_ROUTE_PATTERNS } from './appRoutes.js';
import { metadataFor, headHtml } from './metadata.js';
import { robotsTxt, sitemapXml } from './crawling.js';
const site = siteConfig({ SITE_URL: 'https://theorbix.world', SEO_INDEXING_ENABLED: 'true', NODE_ENV: 'production' });
test('origin is explicit, HTTPS and disabled in preview/missing/invalid configurations', () => {
    assert.equal(site.origin, 'https://theorbix.world'); assert.equal(site.indexable, true);
    for (const SITE_URL of ['https://localhost', 'http://theorbix.world', 'https://example.com/private', 'https://user:pass@example.com', '']) assert.equal(siteConfig({ SITE_URL, SEO_INDEXING_ENABLED: 'true', NODE_ENV: 'production' }).indexable, false);
    assert.equal(siteConfig({ SITE_URL: site.origin!, SEO_INDEXING_ENABLED: 'true', NODE_ENV: 'development' }).indexable, false);
});
test('canonicals discard tracking parameters, fragments, trailing slashes and foreign hosts', () => {
    assert.equal(canonicalUrl(site.origin, '/docs/?utm_source=a#b'), 'https://theorbix.world/docs');
    assert.equal(canonicalUrl(site.origin, '//evil.example'), null);
    assert.equal(canonicalUrl(null, '/'), null);
});
test('every indexable registry entry has unique meaningful metadata and valid JSON-LD', () => {
    const titles = new Set(), descriptions = new Set();
    for (const page of INDEXABLE_PAGES) {
        const meta = metadataFor(page.path, site);
        assert.equal(meta.indexable, true, page.path); assert.ok(meta.canonical?.startsWith(site.origin!));
        assert.ok(meta.description.length > 30); assert.ok(!titles.has(meta.title), meta.title); assert.ok(!descriptions.has(meta.description), meta.description);
        titles.add(meta.title); descriptions.add(meta.description);
        for (const schema of meta.schema) { const value = JSON.parse(safeJson(schema)); assert.equal(value['@context'], 'https://schema.org'); assert.ok(value['@graph'].length >= 4); }
        assert.equal((headHtml(meta).match(/rel="canonical"/g) || []).length, 1);
    }
});
test('auth, dashboard, personal, certificate and unknown routes never enter static sitemaps', () => {
    const xml = sitemapXml(INDEXABLE_PAGES, site);
    for (const path of ['/auth/signin','/dashboard','/profile/u/alice','/verify/certificate/id','/club/dashboard','/settings','/made-up']) {
        assert.equal(metadataFor(path, site).indexable, false); assert.equal(metadataFor(path, site).schema.length, 0); assert.ok(!xml.includes(`<loc>${site.origin}${path}</loc>`));
    }
});
test('aliases resolve to existing documents; arbitrary blog and docs URLs are real misses', () => {
    assert.equal(routePolicy('/docs/algorithm').redirect, '/docs/orbix-score-algorithm');
    assert.equal(routePolicy('/blogs/aws-sbg-psit/aws-launchpad-2026').redirect, '/blog/aws-sbg-psit/aws-launchpad-2026');
    assert.equal(routePolicy('/blog/anyone/fake-publication').status,404);
    assert.equal(routePolicy('/docs/does-not-exist').status,404);
});
test('route inventory matches the entire frontend router', () => {
    const app = readFileSync(fileURLToPath(new URL('../../Frontend/src/App.tsx', import.meta.url)), 'utf8');
    const paths = [...app.matchAll(/<Route\s+path="([^"]+)"/g)].map(match => match[1]);
    assert.deepEqual(paths, [...APP_ROUTE_PATTERNS]);
    assert.ok(paths.length > 100);
});
test('JSON-LD and HTML cannot be escaped by user-provided names or descriptions', () => {
    const data = { entity: { kind: 'club' as const, path: '/clubs/club', title: '</script><script>alert(1)</script>', description: 'A "club" & community' } };
    const html = headHtml(metadataFor('/clubs/club',site,data));
    assert.ok(!html.includes('<script>alert(1)</script>'));
    assert.ok(html.includes('\\u003c/script>')); assert.ok(html.includes('&amp;'));
});
test('robots includes canonical sitemap, leaves assets crawlable and blocks APIs/training-only bots', () => {
    const robots = robotsTxt(site);
    assert.ok(robots.includes(`Sitemap: ${site.origin}/sitemap.xml`)); assert.ok(robots.includes('Disallow: /api/'));
    assert.ok(!robots.includes('Disallow: /assets/')); assert.equal(robotsTxt({ origin: null,indexable:false }), 'User-agent: *\nDisallow: /\n');
});
test('sitemaps use real valid past timestamps only and never invent lastmod', () => {
    const xml = sitemapXml([{ path:'/docs', updatedAt:'invalid' },{ path:'/about',updatedAt:'2100-01-01' },{ path:'/clubs/test',updatedAt:'2026-01-01' }],site);
    assert.equal((xml.match(/<lastmod>/g)||[]).length,1);
    assert.equal(sitemapXml(INDEXABLE_PAGES,{origin:site.origin,indexable:false}).includes('<url>'),false);
});
test('dynamic events use published entity data and omit ratings, offers and private contacts', () => {
    const meta = metadataFor('/events/11111111-1111-4111-8111-111111111111',site,{entity:{kind:'event',path:'/events/11111111-1111-4111-8111-111111111111',title:'Public coding event',description:'A student coding event.',startsAt:'2026-12-01T10:00:00.000Z',locationType:'online',clubName:'Coding Club',clubPath:'/clubs/coding'}});
    const json=JSON.stringify(meta.schema);assert.ok(json.includes('VirtualLocation'));assert.ok(json.includes('2026-12-01'));assert.ok(!/telephone|email|aggregateRating|offers/.test(json));
    assert.equal(metadataFor('/events/11111111-1111-4111-8111-111111111111',site,undefined,404).indexable,false);
});

test('a supplied entity cannot make a private route indexable', () => {
    const metadata=metadataFor('/settings',site,{entity:{kind:'club',path:'/settings',title:'Private',description:'Private information'}});
    assert.equal(metadata.indexable,false);assert.equal(metadata.canonical,null);assert.deepEqual(metadata.schema,[]);
});

test('unknown dashboard subpaths return a real miss and pagination stays canonical',()=>{
    assert.equal(routePolicy('/settings/unknown/subpath').status,404);
    const page=metadataFor('/events',site,{page:2,events:[]});assert.equal(page.canonical,'https://theorbix.world/events?page=2');assert.ok(page.title.includes('Page 2'));
});

test('default social card is a real 1200x630 PNG asset',()=>{
    const png=readFileSync(fileURLToPath(new URL('../../Frontend/public/social-card.png',import.meta.url)));
    assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png.readUInt32BE(16),1200);assert.equal(png.readUInt32BE(20),630);
});

test('production favicon and application icon set is complete and dimensionally accurate',()=>{
    const read = (file: string) => readFileSync(fileURLToPath(new URL(`../../Frontend/public/${file}`, import.meta.url)));
    const checkPng = (file: string, width: number, height: number) => {
        const buf = read(file);
        assert.equal(buf.subarray(1,4).toString(),'PNG');
        assert.equal(buf.readUInt32BE(16), width, `${file} width mismatch`);
        assert.equal(buf.readUInt32BE(20), height, `${file} height mismatch`);
    };
    checkPng('favicon-48.png', 48, 48);
    checkPng('favicon-96.png', 96, 96);
    checkPng('apple-touch-icon.png', 180, 180);
    checkPng('icon-192.png', 192, 192);
    checkPng('icon-512.png', 512, 512);

    const ico = read('favicon.ico');
    assert.equal(ico.readUInt16LE(0), 0);
    assert.equal(ico.readUInt16LE(2), 1);
    assert.ok(ico.readUInt16LE(4) >= 3, 'ICO must contain at least 3 sizes (16, 32, 48)');

    const manifest = JSON.parse(read('site.webmanifest').toString());
    assert.equal(manifest.name, 'Orbix — The Engineering Credibility Network');
    assert.ok(manifest.icons.some((i: any) => i.sizes === '48x48' && i.src === '/favicon-48.png'));
    assert.ok(manifest.icons.some((i: any) => i.sizes === '192x192' && i.src === '/icon-192.png'));
    assert.ok(manifest.icons.some((i: any) => i.sizes === '512x512' && i.src === '/icon-512.png'));
});

test('the XML builder rejects accidentally supplied private, alias and duplicate URLs',()=>{
    const xml=sitemapXml([{path:'/docs'},{path:'/docs'},{path:'/settings'},{path:'/profile/u/alice'},{path:'/privacy-policy'}],site);
    assert.equal((xml.match(/<url>/g)||[]).length,1);assert.ok(xml.includes('/docs'));assert.ok(!xml.includes('settings'));
});


test('a production bundle cannot enable indexing when copied to another preview origin',()=>{
    assert.equal(indexableAtOrigin(site,'https://preview.example.com'),false);
    assert.equal(indexableAtOrigin(site,'http://localhost:4173'),false);
    assert.equal(indexableAtOrigin(site,'https://theorbix.world'),true);
});

test('SSR bootstrap avoids disallowed API fetches and cannot cross URL/page boundaries',async()=>{
    const {hasPublicPageData}=await import('./bootstrap.js');
    assert.equal(hasPublicPageData({events:[],page:1},'/events'),true);
    assert.equal(hasPublicPageData({events:[],page:1},'/events',2),false);
    assert.equal(hasPublicPageData({},'/events'),false);
    assert.equal(hasPublicPageData({entity:{kind:'club',path:'/clubs/a',title:'Club',description:'Public'}},'/clubs/b'),false);
});

test('synthetic club demos remain reachable but never become real indexed organizations',()=>{
    assert.equal(routePolicy('/clubs/aws-swg-psit').status,200);
    assert.equal(metadataFor('/clubs/aws-swg-psit',site).indexable,false);
    assert.ok(!sitemapXml([{path:'/clubs/aws-swg-psit'}],site).includes('<url>'));
});
