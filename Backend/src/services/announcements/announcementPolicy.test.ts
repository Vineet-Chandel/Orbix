import test from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_DOCUMENT, MAX_TEXT_LENGTH, validateDocument, validateSelectedFile, safeLink } from '../../../../shared/announcements.js';
import { encodeCursor, parseCursor, pageLimit, validatePublication } from './announcementPolicy.js';
const id = '00000000-0000-4000-8000-000000000001';
const document = (text: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });
test('publishes text without a title or category and normalizes search text', () => {
    assert.equal(validatePublication({ content: document('An important  update'), assetIds: [] }).plainText, 'An important update');
});
test('accepts media-only and mixed-media posts, rejects empty and duplicate attachments', () => {
    assert.equal(validatePublication({ content: EMPTY_DOCUMENT, assetIds: [id] }).assetIds.length, 1);
    assert.equal(validatePublication({ content: document('Media'), assetIds: [id] }).assetIds.length, 1);
    assert.throws(() => validatePublication({ content: EMPTY_DOCUMENT, assetIds: [] }));
    assert.throws(() => validatePublication({ content: document('Media'), assetIds: [id, id] }));
    assert.throws(() => validatePublication({ content: document('Media'), assetIds: ['not-an-id'] }));
});
test('rich text survives validation with inline formatting and headings', () => {
    const input = { type: 'doc', content: [{ type: 'heading', attrs: { level: 2, textAlign: 'center' }, content: [{ type: 'text', text: 'Welcome', marks: [{ type: 'bold' }, { type: 'underline' }, { type: 'textStyle', attrs: { color: '#1d4ed8', fontSize: '18px' } }] }] }] };
    assert.deepEqual(validateDocument(input).content, input);
    assert.equal(validateDocument(input).plainText, 'Welcome');
});
test('rejects unsafe links, unsupported nodes, CSS payloads and excessive content', () => {
    for (const value of ['javascript:alert(1)', 'data:text/html,x', 'vbscript:msgbox(1)', 'https://a.test/\nscript']) assert.equal(safeLink(value), null);
    for (const value of ['https://example.org/path', 'mailto:club@example.org', 'tel:+911234567890']) assert.ok(safeLink(value));
    assert.throws(() => validateDocument({ type: 'doc', content: [{ type: 'iframe' }] }));
    assert.throws(() => validateDocument({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] }] }));
    assert.throws(() => validateDocument({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x', marks: [{ type: 'textStyle', attrs: { color: 'url(https://evil.test)' } }] }] }] }));
    assert.throws(() => validateDocument(document('x'.repeat(MAX_TEXT_LENGTH + 1))));
    assert.throws(() => validateDocument({ type: 'doc', content: Array.from({ length: 4001 }, () => ({ type: 'paragraph' })) }));
});
test('keyset cursors preserve PostgreSQL microseconds and do not depend on a surviving cursor row', () => {
    const time = '2026-11-20 12:34:56.123456+00';
    assert.deepEqual(parseCursor(encodeCursor(time, id)), { time, id });
    assert.equal(parseCursor(undefined), null);
    assert.throws(() => parseCursor('not-json'));
    assert.throws(() => parseCursor(Buffer.from(JSON.stringify({ time: 'invalid', id })).toString('base64url')));
    assert.equal(pageLimit(undefined), 10);
    assert.equal(pageLimit('30'), 30);
    for (const limit of [0, 31, 'NaN', 1.5]) assert.throws(() => pageLimit(limit));
});
test('rejects disguised and oversized media before upload', () => {
    assert.doesNotThrow(() => validateSelectedFile({ name: 'photo.png', type: 'image/png', size: 1024 }, 'image'));
    assert.throws(() => validateSelectedFile({ name: 'photo.svg', type: 'image/svg+xml', size: 1024 }, 'image'));
    assert.throws(() => validateSelectedFile({ name: 'document.exe', type: 'application/pdf', size: 1024 }, 'pdf'));
    assert.throws(() => validateSelectedFile({ name: 'movie.mp4', type: 'video/mp4', size: 101 * 1024 * 1024 }, 'video'));
});
