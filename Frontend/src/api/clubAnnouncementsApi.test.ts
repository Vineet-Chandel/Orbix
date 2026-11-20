import test from 'node:test';
import assert from 'node:assert/strict';
import { announcementApi, shareAnnouncement, uploadAnnouncementFile, type UploadSignature } from './clubAnnouncementsApi';
const initialWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
Object.defineProperty(globalThis, 'window', { configurable: true, value: {} });
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => 'existing-session-token' } });
test('feed forwards existing sessions, cancellation and a bounded cursor', async () => {
    const original = globalThis.fetch;
    const controller = new AbortController();
    globalThis.fetch = async (url, options) => {
        const parsed = new URL(String(url), 'https://orbix.test');
        assert.equal(parsed.pathname, '/api/club/announcements');
        assert.equal(parsed.searchParams.get('limit'), '10');
        assert.equal(parsed.searchParams.get('scope'), 'campus');
        assert.equal(parsed.searchParams.get('cursor'), 'next+cursor');
        assert.equal(options?.credentials, 'include');
        assert.equal((options?.headers as Record<string, string>).Authorization, 'Bearer existing-session-token');
        assert.equal(options?.signal, controller.signal);
        return new Response(JSON.stringify({ success: true, data: { announcements: [], pagination: { hasMore: false, nextCursor: null } } }), { headers: { 'Content-Type': 'application/json' } });
    };
    try { assert.equal((await announcementApi.page('club', 'campus', 'next+cursor', controller.signal)).pagination.hasMore, false); }
    finally { globalThis.fetch = original; }
});
test('like and unlike use idempotent PUT and DELETE', async () => {
    const original = globalThis.fetch;
    const methods: string[] = [];
    globalThis.fetch = async (_url, options) => { methods.push(String(options?.method)); return new Response(JSON.stringify({ success: true, data: { liked: options?.method === 'PUT', likeCount: 1 } }), { headers: { 'Content-Type': 'application/json' } }); };
    try { await announcementApi.like('post', true); await announcementApi.like('post', false); assert.deepEqual(methods, ['PUT', 'DELETE']); }
    finally { globalThis.fetch = original; }
});
test('permission errors are displayed without losing their meaning', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = async () => new Response(JSON.stringify({ success: false, message: 'Active club membership is required.' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    try { await assert.rejects(announcementApi.one('post'), /Active club membership/); }
    finally { globalThis.fetch = original; }
});
interface FakeXHR { upload: { onprogress?: (event: { loaded: number; total: number; lengthComputable: boolean }) => void }; onabort?: () => void; form?: FormData }
test('direct upload reports progress and supports cancellation', async () => {
    const instances: FakeXHR[] = [];
    const original = globalThis.XMLHttpRequest;
    class XHR {
        upload = {};
        status = 200;
        timeout = 0;
        onabort?: () => void;
        form?: FormData;
        constructor() { instances.push(this); }
        open(method: string, url: string) { assert.equal(method, 'POST'); assert.equal(url, 'https://api.cloudinary.com/v1_1/test/image/upload'); }
        send(form: FormData) { this.form = form; }
        abort() { this.onabort?.(); }
    }
    globalThis.XMLHttpRequest = XHR as unknown as typeof XMLHttpRequest;
    const signature: UploadSignature = { id: 'upload', uploadUrl: 'https://api.cloudinary.com/v1_1/test/image/upload', fields: { signature: 'signed', api_key: 'public-key', type: 'authenticated' }, maxBytes: 1000, finalizeWithinSeconds: 900 };
    try {
        const controller = new AbortController();
        let progress = 0;
        const pending = uploadAnnouncementFile(signature, new File(['image'], 'photo.png', { type: 'image/png' }), controller.signal, value => { progress = value; });
        const last = instances[0]!;
        last.upload.onprogress!({ loaded: 4, total: 10, lengthComputable: true });
        assert.equal(progress, 40);
        assert.equal(last.form?.get('type'), 'authenticated');
        controller.abort();
        await assert.rejects(pending, { name: 'AbortError' });
    } finally { globalThis.XMLHttpRequest = original; }
});
test('share uses a canonical URL and falls back to copying', async () => {
    const oldNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
    let shared = '';
    let copied = '';
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { origin: 'https://orbix.test' } } });
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { share: async ({ url }: { url: string }) => { shared = url; }, clipboard: { writeText: async (url: string) => { copied = url; } } } });
    try {
        assert.equal(await shareAnnouncement('post-id'), 'shared');
        assert.equal(shared, 'https://orbix.test/announcements/post-id');
        Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { writeText: async (url: string) => { copied = url; } } } });
        assert.equal(await shareAnnouncement('post-id'), 'copied');
        assert.equal(copied, 'https://orbix.test/announcements/post-id');
    } finally {
        if (oldNavigator) Object.defineProperty(globalThis, 'navigator', oldNavigator); else Reflect.deleteProperty(globalThis, 'navigator');
        if (oldWindow) Object.defineProperty(globalThis, 'window', oldWindow); else Reflect.deleteProperty(globalThis, 'window');
    }
});
test.after(() => { if (initialWindow) Object.defineProperty(globalThis, 'window', initialWindow); else Reflect.deleteProperty(globalThis, 'window'); if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage); else Reflect.deleteProperty(globalThis, 'localStorage'); });
