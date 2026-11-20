/** The editor, renderer and server share this deliberately small content schema. */
export interface RichNode {
    type: string;
    text?: string;
    attrs?: Record<string, string | number>;
    marks?: Array<{ type: string; attrs?: Record<string, string | number> }>;
    content?: RichNode[];
}
export type MediaKind = 'image' | 'video' | 'audio' | 'pdf';
export interface AnnouncementAttachment {
    id: string;
    publicId: string;
    resourceType: 'image' | 'video' | 'raw';
    mediaType: MediaKind;
    filename: string;
    mimeType: string;
    bytes: number;
    format: string;
    width: number | null;
    height: number | null;
    duration: number | null;
    url: string;
    downloadUrl?: string;
    srcSet?: string;
    thumbnailUrl: string | null;
    displayOrder: number;
}
export interface Announcement {
    id: string;
    clubId: string;
    authorId: string;
    clubName: string;
    clubSlug: string;
    clubLogo: string | null;
    content: RichNode;
    plainText: string;
    status: 'draft' | 'published' | 'archived';
    createdAt: string;
    updatedAt: string;
    likeCount: number;
    liked: boolean;
    canManage: boolean;
    attachments: AnnouncementAttachment[];
}
export const EMPTY_DOCUMENT: RichNode = { type: 'doc', content: [{ type: 'paragraph' }] };
export const TEXT_COLORS = ['#171717', '#1d4ed8', '#166534', '#991b1b', '#6b21a8'] as const;
export const HIGHLIGHT_COLORS = ['#fef08a', '#bbf7d0', '#bfdbfe'] as const;
export const FONT_SIZES = ['12px', '14px', '16px', '18px', '24px', '32px'] as const;
export const MAX_ATTACHMENTS = 8;
export const MAX_TEXT_LENGTH = 20000;
export const MEDIA_RULES: Record<MediaKind, { mimeTypes: string[]; formats: string[]; maxBytes: number; resourceType: 'image' | 'video' | 'raw' }> = {
    image: { mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'], formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'], maxBytes: 10 * 1024 * 1024, resourceType: 'image' },
    video: { mimeTypes: ['video/mp4', 'video/webm', 'video/quicktime'], formats: ['mp4', 'webm', 'mov'], maxBytes: 100 * 1024 * 1024, resourceType: 'video' },
    audio: { mimeTypes: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/ogg'], formats: ['mp3', 'wav', 'm4a', 'aac', 'ogg'], maxBytes: 25 * 1024 * 1024, resourceType: 'video' },
    pdf: { mimeTypes: ['application/pdf'], formats: ['pdf'], maxBytes: 20 * 1024 * 1024, resourceType: 'raw' },
};
export function safeLink(value: unknown): string | null {
    if (typeof value !== 'string' || value.length > 2048 || Array.from(value).some(character => character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127)) return null;
    try {
        const url = new URL(value);
        return ['https:', 'http:', 'mailto:', 'tel:'].includes(url.protocol) ? url.href : null;
    } catch { return null; }
}
const blocks = new Set(['paragraph', 'heading', 'bulletList', 'orderedList', 'blockquote', 'horizontalRule', 'codeBlock']);
const inline = new Set(['text', 'hardBreak']);
const simpleMarks = new Set(['bold', 'italic', 'underline', 'strike', 'code']);
export function validateDocument(input: unknown): { content: RichNode; plainText: string } {
    let count = 0;
    let textLength = 0;
    let linkBudget = 0;
    const walk = (value: unknown, depth: number, parent: string): RichNode => {
        if (++count > 4000 || depth > 16 || !value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid or overly complex announcement content.');
        const node = value as Record<string, unknown>;
        const type = node.type;
        const allowed = parent === '' ? type === 'doc' : parent === 'doc' || parent === 'blockquote' || parent === 'listItem' ? blocks.has(String(type)) : parent === 'bulletList' || parent === 'orderedList' ? type === 'listItem' : inline.has(String(type));
        if (typeof type !== 'string' || !allowed) throw new Error('Unsupported announcement formatting.');
        const result: RichNode = { type };
        if (type === 'text') {
            if (typeof node.text !== 'string' || !node.text.length) throw new Error('Invalid text node.');
            textLength += node.text.length;
            if (textLength > MAX_TEXT_LENGTH) throw new Error('Announcement text exceeds 20,000 characters.');
            result.text = node.text;
        }
        const attrs = (node.attrs || {}) as Record<string, unknown>;
        const supported: Record<string, string | number> = {};
        if (type === 'heading') {
            if (![1, 2, 3].includes(Number(attrs.level))) throw new Error('Only heading levels 1–3 are supported.');
            supported.level = Number(attrs.level);
        }
        if (type === 'paragraph' || type === 'heading') {
            if (attrs.textAlign != null) {
                if (!['left', 'center', 'right'].includes(String(attrs.textAlign))) throw new Error('Invalid text alignment.');
                supported.textAlign = String(attrs.textAlign);
            }
        }
        if (type === 'orderedList' && attrs.start != null) {
            if (!Number.isInteger(attrs.start) || Number(attrs.start) < 1 || Number(attrs.start) > 1000) throw new Error('Invalid list start.');
            supported.start = Number(attrs.start);
        }
        if (Object.keys(supported).length) result.attrs = supported;
        if (node.marks !== undefined) {
            if (type !== 'text' || !Array.isArray(node.marks) || node.marks.length > 10) throw new Error('Invalid formatting marks.');
            result.marks = node.marks.map((mark: unknown) => {
                if (!mark || typeof mark !== 'object') throw new Error('Invalid text formatting.');
                const m = mark as { type: string; attrs?: Record<string, unknown> };
                if (simpleMarks.has(m.type)) return { type: m.type };
                if (m.type === 'link') {
                    const href = safeLink(m.attrs?.href);
                    if (href) linkBudget += href.length;
                    if (linkBudget > 80000) throw new Error('Too many links in this announcement.');
                    if (!href) throw new Error('Use a safe http, https, email, or phone link.');
                    return { type: 'link', attrs: { href } };
                }
                if (m.type === 'textStyle') {
                    const style: Record<string, string> = {};
                    for (const [key, palette] of [['color', TEXT_COLORS], ['fontSize', FONT_SIZES]] as const) {
                        const v = m.attrs?.[key];
                        if (v != null) {
                            if (!(palette as readonly string[]).includes(String(v))) throw new Error('Unsupported text style.');
                            style[key] = String(v);
                        }
                    }
                    return { type: m.type, attrs: style };
                }
                if (m.type === 'highlight') {
                    const color = m.attrs?.color || HIGHLIGHT_COLORS[0];
                    if (!(HIGHLIGHT_COLORS as readonly string[]).includes(String(color))) throw new Error('Unsupported highlight color.');
                    return { type: m.type, attrs: { color: String(color) } };
                }
                throw new Error('Unsupported text formatting.');
            });
        }
        if (node.content !== undefined) {
            if (type === 'text' || type === 'hardBreak' || type === 'horizontalRule' || !Array.isArray(node.content)) throw new Error('Invalid content structure.');
            result.content = node.content.map(child => walk(child, depth + 1, type));
        }
        return result;
    };
    const content = walk(input, 0, '');
    if (JSON.stringify(content).length > 180000) throw new Error('Announcement formatting is too complex. Simplify the formatting and try again.');
    const plain = (node: RichNode): string => node.type === 'text' ? node.text || '' : node.type === 'hardBreak' ? '\n' : (node.content || []).map(plain).join(['doc', 'blockquote', 'bulletList', 'orderedList', 'listItem'].includes(node.type) ? '\n' : '');
    return { content, plainText: plain(content).replace(/[ \t]+/g, ' ').trim() };
}
export function validateSelectedFile(file: { type: string; size: number; name: string }, kind: MediaKind, maximum = MEDIA_RULES[kind].maxBytes) {
    const rule = MEDIA_RULES[kind];
    if (!rule.mimeTypes.includes(file.type) || !rule.formats.includes(file.name.split('.').pop()?.toLowerCase() || '')) throw new Error(`Unsupported ${kind} file format.`);
    if (!Number.isSafeInteger(file.size) || file.size <= 0 || file.size > maximum) throw new Error(`${kind} files must be smaller than ${Math.round(maximum / 1024 / 1024)} MB.`);
}
export function mergeAnnouncements(existing: Announcement[], incoming: Announcement[]) {
    const seen = new Set(existing.map(item => item.id));
    return [...existing, ...incoming.filter(item => !seen.has(item.id) && Boolean(seen.add(item.id)))];
}
