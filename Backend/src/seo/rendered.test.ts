import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { INDEXABLE_PAGES, routePolicy } from '../../../shared/seo/routes.js';
import { metadataFor, headHtml } from '../../../shared/seo/metadata.js';
import { siteConfig } from '../../../shared/seo/site.js';
import { createSeoWeb } from './web.js';
import type { PageData } from '../../../shared/seo/metadata.js';
const rendererPath = new URL('../../../Frontend/dist-server/entry-server.js',import.meta.url);
const { renderPublicPage } = await import(rendererPath.href) as { renderPublicPage: (path: string,data:PageData)=>Promise<string> };
const site = siteConfig({SITE_URL:'https://theorbix.world',SEO_INDEXING_ENABLED:'true',NODE_ENV:'production'});
test('all approved public pages render real content and headings before JavaScript or user interaction',async()=>{
    for(const page of INDEXABLE_PAGES){
        const html=await renderPublicPage(page.path,{events:[],clubs:[],page:1,hasNext:false});
        assert.ok(html.length>300,page.path);assert.ok(/<h1\b/.test(html),page.path);
        assert.ok(!/data-stack=/.test(html),page.path+' leaked server diagnostics');
        assert.ok(!/name="password"/.test(html),page.path+' unexpectedly rendered an account form');
        const meta=headHtml(metadataFor(page.path,site));assert.ok(meta.includes('rel="canonical"'));
        for(const script of meta.matchAll(/<script data-orbix-seo type="application\/ld\+json">(.*?)<\/script>/g)) assert.ok(JSON.parse(script[1]!));
        for (const link of html.matchAll(/href="([^"#]+)"/g)) {
            const href = link[1]!.replaceAll('&amp;','&');
            if (!href.startsWith('/') || href.startsWith('//') || /\.[a-z0-9]{2,5}(?:\?|$)/i.test(href) || href.startsWith('/api/')) continue;
            assert.notEqual(routePolicy(new URL(href,'https://theorbix.world').pathname).status,404,`${page.path}: broken internal route ${href}`);
        }
        // Images in server-rendered public HTML must have an explicit accessible alternative.
        for(const image of html.matchAll(/<img\b[^>]*>/g)) assert.ok(/\balt=/.test(image[0]),page.path+' missing image alt');
    }
});
test('dynamic public event and club content is in initial HTML with crawlable links',async()=>{
    const entity={kind:'event' as const,path:'/events/11111111-1111-4111-8111-111111111111',title:'Public Engineering Event',description:'An open engineering workshop.',startsAt:'2026-12-01T10:00:00.000Z',clubName:'Engineering Club',clubPath:'/clubs/engineering'};
    const event=await renderPublicPage(entity.path,{entity});assert.ok(event.includes(entity.title));assert.ok(event.includes(`${entity.path}/register`));
    const club=await renderPublicPage('/clubs/engineering',{entity:{kind:'club',path:'/clubs/engineering',title:'Engineering Club',description:'A published club',club:{name:'Engineering Club',slug:'engineering',collegeName:'Example College',about:'A published campus club',focusAreas:[]}}});assert.ok(club.includes('A published campus club'));
});
test('the built document supports anonymous SSR then intentional CSR takeover',async()=>{
    const template=await readFile(new URL('../../../Frontend/dist/index.html',import.meta.url),'utf8');
    assert.ok(template.includes('<div id="root"></div>'));assert.ok(/type="module"/.test(template));
    const source=await readFile(new URL('../../../Frontend/src/main.tsx',import.meta.url),'utf8');
    assert.ok(source.includes('createRoot'));assert.ok(!source.includes('hydrateRoot'));
    // Router creation without a listening socket also catches accidental browser globals.
    assert.ok(createSeoWeb({env:{SITE_URL:'https://theorbix.world',SEO_INDEXING_ENABLED:'false',NODE_ENV:'production'}}));
});
