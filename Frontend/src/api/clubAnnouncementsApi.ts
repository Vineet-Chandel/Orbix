import { apiFetch } from './apiClient';
import type { Announcement, AnnouncementAttachment, MediaKind, RichNode } from '../../../shared/announcements';
export type { Announcement, AnnouncementAttachment, MediaKind, RichNode } from '../../../shared/announcements';
export interface AnnouncementClub { id: string; name: string; slug: string; logoUrl: string | null; collegeId: string | null; isAdmin: boolean; visibility?: string; publicationStatus?: string; profileVisibility?: string }
export interface AnnouncementPage { announcements: Announcement[]; pagination: { hasMore: boolean; nextCursor: string | null } }
export interface UploadSignature { id: string; uploadUrl: string; fields: Record<string, string | number | boolean>; maxBytes: number; finalizeWithinSeconds: number }
export class AnnouncementApiError extends Error {
    status: number;
    constructor(message: string, status: number) { super(message); this.status = status; }
}
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    try {
        const result = await apiFetch<{ success: boolean; data: T; message?: string }>(`/club/announcements${path}`, options);
        if (!result?.success) throw new AnnouncementApiError(result?.message || 'Announcements are temporarily unavailable. Please try again.', 500);
        return result.data;
    } catch (cause) {
        if (cause instanceof AnnouncementApiError) throw cause;
        const status = cause && typeof cause === 'object' && 'status' in cause ? Number(cause.status) || 500 : 500;
        throw new AnnouncementApiError(cause instanceof Error ? cause.message : 'Unable to reach announcements. Please try again.', status);
    }
}
export const announcementApi = {
    context: (signal?: AbortSignal) => request<{ clubs: AnnouncementClub[]; mediaLimits: Record<MediaKind, number> }>('/context', { signal }),
    page: (clubId: string, scope: 'mine' | 'campus', cursor?: string | null, signal?: AbortSignal) => request<AnnouncementPage>(`?${new URLSearchParams({ clubId, scope, limit: '10', ...(cursor ? { cursor } : {}) })}`, { signal }),
    one: (id: string, signal?: AbortSignal) => request<Announcement>(`/${id}`, { signal }),
    save: (input: { clubId: string; content: RichNode; assetIds: string[]; clientRequestId: string; status: Announcement['status'] }, id?: string) => request<Announcement>(id ? `/${id}` : '', { method: id ? 'PATCH' : 'POST', body: JSON.stringify(input) }),
    remove: (id: string) => request<void>(`/${id}`, { method: 'DELETE' }),
    like: (id: string, liked: boolean) => request<{ liked: boolean; likeCount: number }>(`/${id}/like`, { method: liked ? 'PUT' : 'DELETE' }),
    sign: (clubId: string, file: File, mediaType: MediaKind, signal?: AbortSignal) => request<UploadSignature>('/uploads/signature', { method: 'POST', body: JSON.stringify({ clubId, filename: file.name, bytes: file.size, mimeType: file.type, mediaType }), signal }),
    complete: (id: string, signal?: AbortSignal) => request<AnnouncementAttachment>(`/uploads/${id}/complete`, { method: 'POST', signal }),
    discard: (id: string) => request<void>(`/uploads/${id}`, { method: 'DELETE' }),
};
export function uploadAnnouncementFile(signature: UploadSignature, file: File, signal: AbortSignal, onProgress: (percent: number) => void): Promise<void> {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const abort = () => xhr.abort();
        xhr.open('POST', signature.uploadUrl);
        xhr.timeout = 10 * 60 * 1000;
        xhr.upload.onprogress = event => { if (event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 100)); };
        const cleanup = () => signal.removeEventListener('abort', abort);
        xhr.onload = () => { cleanup(); if (xhr.status >= 200 && xhr.status < 300) resolve(); else reject(new Error('Upload failed. Please retry this file.')); };
        xhr.onerror = () => { cleanup(); reject(new Error('Upload interrupted. Check your connection and retry.')); };
        xhr.ontimeout = () => { cleanup(); reject(new Error('Upload timed out. Please retry.')); };
        xhr.onabort = () => { cleanup(); reject(new DOMException('Upload cancelled.', 'AbortError')); };
        signal.addEventListener('abort', abort, { once: true });
        if (signal.aborted) { cleanup(); reject(new DOMException('Upload cancelled.', 'AbortError')); return; }
        const form = new FormData();
        Object.entries(signature.fields).forEach(([name, value]) => form.append(name, String(value)));
        form.append('file', file);
        xhr.send(form);
    });
}
export async function shareAnnouncement(id: string) {
    const url = `${window.location.origin}/announcements/${id}`;
    if (navigator.share) {
        try { await navigator.share({ title: 'Club announcement · Orbix', url }); return 'shared'; }
        catch (error) { if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'; }
    }
    if (!navigator.clipboard?.writeText) throw new Error('Link copying is unavailable in this browser. Open the announcement and copy its address.');
    await navigator.clipboard.writeText(url);
    return 'copied';
}
