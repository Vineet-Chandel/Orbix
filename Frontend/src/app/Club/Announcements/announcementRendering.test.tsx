import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import React, { createElement } from 'react';
(globalThis as any).React = React;
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { mergeAnnouncements, validateDocument, type Announcement, type AnnouncementAttachment } from '../../../../../shared/announcements';
register('data:text/javascript,' + encodeURIComponent(`export async function load(url, context, next) { if (url.endsWith('.css')) return { format: 'module', source: '', shortCircuit: true }; return next(url, context); }`), import.meta.url);
const { AnnouncementRichText } = await import('./AnnouncementRichText');
const { AnnouncementMedia } = await import('./AnnouncementMedia');
const { AnnouncementCard } = await import('./AnnouncementCard');
const { ToastProvider } = await import('../../../context/ToastContext');
const content = validateDocument({ type: 'doc', content: [{ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Campus update', marks: [{ type: 'bold' }, { type: 'underline' }] }] }, { type: 'paragraph', content: [{ type: 'text', text: '<script>alert(1)</script>', marks: [{ type: 'italic' }] }] }] }).content;
const attachment = (kind: AnnouncementAttachment['mediaType']): AnnouncementAttachment => ({ id: kind, mediaType: kind, publicId: `clubs/media/${kind}`, resourceType: kind === 'image' ? 'image' : kind === 'pdf' ? 'raw' : 'video', filename: `${kind}.${kind === 'pdf' ? 'pdf' : 'mp4'}`, mimeType: 'application/octet-stream', bytes: 1024, format: kind === 'pdf' ? 'pdf' : 'mp4', width: 640, height: 480, duration: 65, url: `https://cloudinary.example/${kind}`, thumbnailUrl: null, displayOrder: 0 });
const item: Announcement = { id: 'post', clubId: 'club', authorId: 'user', clubName: 'Orbix club', clubSlug: 'orbix-club', clubLogo: null, content, plainText: 'Campus update', status: 'published', createdAt: '2026-11-20T10:00:00Z', updatedAt: '2026-11-20T10:00:00Z', liked: false, likeCount: 12, canManage: true, attachments: [] };
test('saved rich text renders inline formatting and escapes HTML', () => {
    const html = renderToStaticMarkup(createElement(AnnouncementRichText, { content }));
    for (const tag of ['h2', 'strong', 'u', 'em']) assert.match(html, new RegExp(`<${tag}`));
    assert.ok(html.includes('&lt;script&gt;'));
    assert.ok(!html.includes('<script>'));
});
test('mixed attachments render native players, lazy images and PDF previews', () => {
    const html = renderToStaticMarkup(createElement(AnnouncementMedia, { attachments: ['image', 'video', 'audio', 'pdf'].map(kind => attachment(kind as AnnouncementAttachment['mediaType'])) }));
    assert.ok(!html.includes('<object'), 'PDF bodies should not load until the preview is opened');
    for (const expected of ['loading="lazy"', '<video', '<audio', 'controls', 'PDF document', 'Preview document', 'noopener noreferrer']) assert.ok(html.includes(expected), expected);
});
test('cards expose like/share and management controls without comments', () => {
    const html = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(ToastProvider, null, createElement(AnnouncementCard, { item, onEdit: () => {}, onDeleted: () => {}, onUpdated: () => {} }))));
    assert.match(html, /Like announcement/);
    assert.match(html, />Share</);
    assert.match(html, /12 likes/);
    assert.match(html, /Edit announcement/);
    assert.ok(!/comment|reply|discussion/i.test(html));
});
test('cursor pages append without duplicate posts', () => {
    const result = mergeAnnouncements([item], [item, { ...item, id: 'post-2' }, { ...item, id: 'post-2' }]);
    assert.deepEqual(result.map(value => value.id), ['post', 'post-2']);
});
