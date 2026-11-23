import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import { createSeoWeb } from './web.js';
import { createPublicRepository, PUBLIC_CLUB_SQL, PUBLIC_EVENT_SQL, type Query } from './publicRepository.js';
const env = { SITE_URL:'https://theorbix.world',SEO_INDEXING_ENABLED:'true',NODE_ENV:'production' };
const template = '<!doctype html><html lang="en"><head><title data-orbix-seo>Orbix</title><meta data-orbix-seo name="robots" content="noindex,nofollow"></head><body><div id="root"></div></body></html>';
function repository() {
    return { page: async () => null, counts: async () => ({ clubs:1,events:0 }), sitemap: async () => [{path:'/clubs/public',updatedAt:'2026-01-01'}] };
}
async function request(url: string, options: Parameters<typeof createSeoWeb>[0] = {}, headers: Record<string,string> = {}, existingApp?: express.Express) {
    const app = existingApp || express(); if (!existingApp) app.use(createSeoWeb({ env, template, repository:repository(), render: () => '<main><h1>Public content</h1></main>', ...options }));
    return new Promise<{ status: number; headers: ReturnType<ServerResponse['getHeaders']>; body: string; bytes: Buffer }>((resolve,reject) => {
        const socket = new Socket();
        const req = new IncomingMessage(socket); req.method='GET';req.url=url;req.headers={host:'theorbix.world',accept:'text/html',...headers};
        const res = new ServerResponse(req);
        res.end = ((chunk?: unknown) => {
            const body = chunk == null ? '' : String(chunk);
            const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(body);
            resolve({status:res.statusCode,headers:res.getHeaders(),body, bytes});
            res.emit('finish');
            socket.destroy();
            return res;
        }) as typeof res.end;
        const handle = app as unknown as (request: IncomingMessage, response: ServerResponse, next: (error?: unknown) => void) => void;
        handle(req,res,(error?: unknown) => { if (error) reject(error); else reject(new Error(`Unhandled route: ${url}`)); });
    });
}
test('initial public HTML has content, one title/canonical and parseable JSON-LD without JavaScript',async () => {
    const response = await request('/docs');assert.equal(response.status,200);
    assert.ok(response.body.includes('<h1>Public content</h1>'));assert.equal((response.body.match(/<title/g)||[]).length,1);
    assert.equal((response.body.match(/rel="canonical"/g)||[]).length,1);
    for (const block of response.body.matchAll(/<script data-orbix-seo type="application\/ld\+json">(.*?)<\/script>/g)) assert.ok(JSON.parse(block[1]!));
    assert.ok(String(response.headers['x-robots-tag']).startsWith('index'));
});
test('private pages return a noindex shell and never invoke the public data repository or renderer',async () => {
    const response = await request('/settings',{ repository:{ ...repository(),page:async()=>{throw Error('must not read private data');} },render:()=>{throw Error('must not render private content');} });
    assert.equal(response.status,200);assert.ok(String(response.headers['x-robots-tag']).includes('noindex'));assert.ok(!response.body.includes('rel="canonical"'));assert.ok(!response.body.includes('application/ld+json'));
});
test('real redirects and missing pages have correct HTTP statuses',async () => {
    const redirect=await request('/privacy-policy');assert.equal(redirect.status,308);assert.equal(redirect.headers.location,'/privacy');assert.equal(redirect.headers['cache-control'],'private, no-store');
    const trailing=await request('/docs/');assert.equal(trailing.status,308);assert.equal(trailing.headers.location,'/docs');
    const missing=await request('/docs/unknown');assert.equal(missing.status,404);assert.ok(String(missing.headers['x-robots-tag']).includes('noindex'));
});
test('private, deleted and unlisted dynamic records have no indexable document',async () => {
    const response=await request('/clubs/private');assert.equal(response.status,404);assert.ok(!response.body.includes('rel="canonical"'));
    const outage=await request('/clubs/private',{repository:{...repository(),page:async()=>{throw Error('database connection secret');}}});
    assert.equal(outage.status,503);assert.ok(!outage.body.includes('database connection secret'));
});
test('sitemaps split published entities, exclude private/static utility routes and fail safely',async () => {
    const index=await request('/sitemap.xml');assert.equal(index.status,200);assert.ok(index.body.includes('/sitemaps/clubs-1.xml'));assert.ok(!index.body.includes('profile'));
    const entries=await request('/sitemaps/static.xml');assert.ok(entries.body.includes('/docs'));assert.ok(!entries.body.includes('/auth/'));
    const outage=await request('/sitemap.xml',{repository:{...repository(),counts:async()=>{throw Error('secret');}}});assert.equal(outage.status,503);assert.ok(!outage.body.includes('secret'));
});
test('preview robots and sitemaps stay closed',async()=>{
    const robots=await request('/robots.txt',{env:{...env,SEO_INDEXING_ENABLED:'false'}});assert.ok(robots.body.includes('Disallow: /'));
    const sitemap=await request('/sitemap.xml',{env:{...env,SEO_INDEXING_ENABLED:'false'}});assert.ok(!sitemap.body.includes('<sitemap>'));
});
test('only live public database projections enter SEO data; no contact/auth fields selected',async()=>{
    const seen: string[]=[];
    const query:Query=async(sql)=>{seen.push(sql);return {rows:[]};};
    const publicData=createPublicRepository(query,'https://theorbix.world');
    await publicData.page('/clubs/example');await publicData.page('/events/11111111-1111-4111-8111-111111111111');await publicData.sitemap('clubs',1);await publicData.sitemap('events',1);
    for(const sql of seen){assert.ok(sql.includes(PUBLIC_CLUB_SQL));assert.ok(!/SELECT \*|contact_phone|public_email|password|token/i.test(sql));}
    assert.ok(seen[1]?.includes(PUBLIC_EVENT_SQL));
});


test('large public HTML is compressed without changing the document or caching private state',async()=>{
    const response=await request('/docs',{ render:()=>'<main><h1>Public content</h1>'+ '<p>Documentation</p>'.repeat(100)+'</main>' },{'accept-encoding':'gzip'});
    assert.equal(response.headers['content-encoding'],'gzip');
    assert.ok(gunzipSync(response.bytes).toString().includes('<h1>Public content</h1>'));
    assert.equal(response.headers['cache-control'],'private, no-store');
});


test('static anonymous React bodies are reused without caching dynamic metadata',async()=>{
    let renders=0;const app=express();app.use(createSeoWeb({env,template,repository:repository(),render:()=>{renders++;return '<main><h1>Documentation</h1></main>';}}));
    await request('/docs',{}, {}, app);await request('/docs',{}, {}, app);assert.equal(renders,1);
});

test('withdrawing a public club takes effect on the next request rather than serving cached HTML',async()=>{
    let published=true,reads=0;const app=express();
    app.use(createSeoWeb({env,template,repository:{...repository(),page:async()=>{reads++;return published?{entity:{kind:'club',path:'/clubs/public',title:'Public Club',description:'A published organization.'}}:null;}},render:()=>'<main><h1>Public Club</h1></main>'}));
    assert.equal((await request('/clubs/public',{}, {}, app)).status,200);published=false;
    const withdrawn=await request('/clubs/public',{}, {}, app);assert.equal(withdrawn.status,404);assert.ok(!withdrawn.body.includes('<h1>Public Club</h1>'));assert.equal(reads,2);
});

test('authenticated dynamic documents never render anonymous data that bypasses viewer restrictions',async()=>{
    let reads=0;
    const response=await request('/clubs/public',{repository:{...repository(),page:async()=>{reads++;throw Error('must not bypass viewer checks');}},render:()=>{throw Error('must use authorized CSR flow');}},{cookie:'token=existing-session'});
    assert.equal(response.status,200);assert.equal(reads,0);assert.ok(String(response.headers['x-robots-tag']).includes('noindex'));assert.ok(!response.body.includes('application/ld+json'));
});

test('alternate hosts stay noindex even with the production environment enabled', async () => {
    const headers = { host: 'preview.example.com' };
    const response = await request('/docs', {}, headers);
    assert.match(String(response.headers['x-robots-tag']), /^noindex/);
    assert.ok(!response.body.includes('rel="canonical"'));
    assert.match((await request('/robots.txt', {}, headers)).body, /Disallow: \/\n/);
    assert.ok(!(await request('/sitemap.xml', {}, headers)).body.includes('<loc>'));
});

test('HTML assembly preserves literal dollar sequences in page content and metadata', async () => {
    const title = "Budget $& and $` and $'";
    const entity = { kind: 'club' as const, path: '/clubs/public', title, description: title };
    const result = await request(entity.path, {
        repository: { ...repository(), page: async () => ({ entity }) },
        render: () => '<main><h1>Budget $&</h1></main>',
    });
    assert.ok(result.body.includes('<h1>Budget $&</h1>'));
    assert.equal(JSON.parse(result.body.match(/id="orbix-public-data">([^<]+)/)![1]!).data.entity.title, title);
    assert.equal((result.body.match(/<\/head>/g) || []).length, 1);
});

test('direct index.html requests redirect to the canonical homepage path', async () => {
    const response = await request('/index.html');
    assert.equal(response.status, 308);
    assert.equal(response.headers.location, '/');
});

test('unlisted club links remain usable without including their details or metadata in server HTML', async () => {
    const response = await request('/clubs/unlisted', {
        repository: { ...repository(), isUnlistedClub: async () => true },
        render: () => { throw Error('unlisted club should use the client flow'); },
    });
    assert.equal(response.status, 200);
    assert.match(String(response.headers['x-robots-tag']), /^noindex/);
    assert.ok(!response.body.includes('rel="canonical"'));
    assert.ok(!response.body.includes('application/ld+json'));
});

test('static favicon and manifest assets return HTTP 200 with correct media types', async () => {
    const app = express();
    app.use(createSeoWeb({ env, template, repository: repository(), render: () => '<main><h1>Public</h1></main>' }));
    const server = app.listen(0);
    try {
        const port = (server.address() as { port: number }).port;
        const checkAsset = async (path: string, mimeRegex: RegExp) => {
            const res = await fetch(`http://127.0.0.1:${port}${path}`, { headers: { host: 'theorbix.world' } });
            assert.equal(res.status, 200, `Expected 200 for ${path}`);
            assert.match(res.headers.get('content-type') || '', mimeRegex, `Expected ${mimeRegex} for ${path}`);
            assert.match(res.headers.get('cache-control') || '', /public|max-age/i, `Expected cache-control for ${path}`);
            await res.arrayBuffer(); // Drain response
        };
        await checkAsset('/favicon.ico', /image\/(vnd\.microsoft\.icon|x-icon)/);
        await checkAsset('/favicon-48.png', /^image\/png/);
        await checkAsset('/favicon-96.png', /^image\/png/);
        await checkAsset('/apple-touch-icon.png', /^image\/png/);
        await checkAsset('/icon-192.png', /^image\/png/);
        await checkAsset('/icon-512.png', /^image\/png/);
        await checkAsset('/favicon.svg', /^image\/svg\+xml/);
        await checkAsset('/site.webmanifest', /application\/(manifest\+json|json)/);
        await checkAsset('/robots.txt', /^text\/plain/);
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
});
