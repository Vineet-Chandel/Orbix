import { useEffect, useRef, useState } from 'react';
import { AudioLines, Check, Eye, FileText, ImagePlus, Link2, Loader2, RotateCcw, Send, Video, X } from 'lucide-react';
import { announcementApi, uploadAnnouncementFile, type Announcement, type AnnouncementAttachment, type AnnouncementClub, type MediaKind, type RichNode, type UploadSignature } from '../../../api/clubAnnouncementsApi';
import { EMPTY_DOCUMENT, MAX_ATTACHMENTS, MAX_TEXT_LENGTH, MEDIA_RULES, validateDocument, validateSelectedFile } from '../../../../../shared/announcements';
import { useToast } from '../../../context/ToastContext';
import { ConfirmationModal } from '../../../components/ConfirmationModal';
import { AnnouncementEditor, type AnnouncementEditorHandle } from './AnnouncementEditor';
import { AnnouncementRichText } from './AnnouncementRichText';
import { AnnouncementMedia } from './AnnouncementMedia';

interface UploadItem {
    key: string;
    kind: MediaKind;
    filename: string;
    file?: File;
    preview?: string;
    status: 'uploading' | 'verifying' | 'ready' | 'error';
    progress: number;
    error?: string;
    asset?: AnnouncementAttachment;
}
interface UploadTask { controller: AbortController; signature?: UploadSignature; uploaded: boolean }
export function AnnouncementComposer({ club, initial, limits, onSaved, onClose }: { club: AnnouncementClub; initial?: Announcement; limits?: Partial<Record<MediaKind, number>>; onSaved: (item: Announcement) => void; onClose?: () => void }) {
    const toast = useToast();
    const [content, setContent] = useState<RichNode>(initial?.content || EMPTY_DOCUMENT);
    const [uploads, setUploads] = useState<UploadItem[]>(() => (initial?.attachments || []).map(asset => ({ key: asset.id, kind: asset.mediaType, filename: asset.filename, status: 'ready', progress: 100, asset })));
    const [busy, setBusy] = useState(false);
    const [preview, setPreview] = useState(false);
    const [error, setError] = useState('');
    const [discarding, setDiscarding] = useState(false);
    const requestId = useRef(crypto.randomUUID());
    const lock = useRef(false);
    const tasks = useRef(new Map<string, UploadTask>());
    const objectUrls = useRef(new Set<string>());
    const uploadCount = useRef(uploads.length);
    const input = useRef<HTMLInputElement>(null);
    const editorRef = useRef<AnnouncementEditorHandle>(null);
    const selectedKind = useRef<MediaKind>('image');
    const mounted = useRef(true);
    useEffect(() => {
        const taskMap = tasks.current;
        const urls = objectUrls.current;
        mounted.current = true;
        return () => { mounted.current = false; taskMap.forEach(task => task.controller.abort()); urls.forEach(url => URL.revokeObjectURL(url)); };
    }, []);
    const patch = (key: string, update: Partial<UploadItem>) => { if (mounted.current) setUploads(items => items.map(item => item.key === key ? { ...item, ...update } : item)); };
    const startUpload = async (item: UploadItem) => {
        if (!item.file) return;
        const prior = tasks.current.get(item.key);
        prior?.controller.abort();
        const task: UploadTask = { controller: new AbortController(), uploaded: !!prior?.uploaded, ...(prior?.uploaded && prior.signature ? { signature: prior.signature } : {}) };
        tasks.current.set(item.key, task);
        patch(item.key, { status: task.uploaded ? 'verifying' : 'uploading', error: '', progress: task.uploaded ? 100 : 0 });
        try {
            if (!task.uploaded) {
                if (prior?.signature) void announcementApi.discard(prior.signature.id).catch(() => {});
                task.signature = await announcementApi.sign(club.id, item.file, item.kind, task.controller.signal);
                await uploadAnnouncementFile(task.signature, item.file, task.controller.signal, progress => patch(item.key, { progress }));
                task.uploaded = true;
            }
            patch(item.key, { status: 'verifying', progress: 100 });
            const asset = await announcementApi.complete(task.signature!.id, task.controller.signal);
            patch(item.key, { status: 'ready', asset, progress: 100 });
        } catch (cause) {
            if (!task.controller.signal.aborted) patch(item.key, { status: 'error', error: cause instanceof Error ? cause.message : 'Upload failed. Please retry.' });
        }
    };
    const addFiles = (files: FileList | null) => {
        if (!files) return;
        const kind = selectedKind.current;
        for (const file of Array.from(files)) {
            if (uploadCount.current >= MAX_ATTACHMENTS) { toast.error('Attach up to eight files per announcement.'); break; }
            try { validateSelectedFile(file, kind, limits?.[kind] || MEDIA_RULES[kind].maxBytes); }
            catch (cause) { toast.error((cause as Error).message); continue; }
            const key = crypto.randomUUID();
            const url = kind === 'pdf' ? undefined : URL.createObjectURL(file);
            if (url) objectUrls.current.add(url);
            const item: UploadItem = { key, kind, filename: file.name, file, preview: url, status: 'uploading', progress: 0 };
            uploadCount.current++;
            setUploads(items => [...items, item]);
            void startUpload(item);
        }
        if (input.current) input.current.value = '';
    };
    const remove = (item: UploadItem) => {
        const task = tasks.current.get(item.key);
        task?.controller.abort();
        if (task?.signature) void announcementApi.discard(task.signature.id).catch(() => {});
        tasks.current.delete(item.key);
        if (item.preview) { URL.revokeObjectURL(item.preview); objectUrls.current.delete(item.preview); }
        uploadCount.current--;
        setUploads(items => items.filter(current => current.key !== item.key));
    };
    const publish = async (status: Announcement['status']) => {
        if (lock.current) return;
        setError('');
        let validated;
        try { validated = validateDocument(content); }
        catch (cause) { setError((cause as Error).message); return; }
        if (uploads.some(item => item.status !== 'ready')) { setError('Finish, retry, or remove incomplete uploads before publishing.'); return; }
        if (!validated.plainText && !uploads.length) { setError('Write an announcement or add a file.'); return; }
        lock.current = true;
        setBusy(true);
        try {
            const saved = await announcementApi.save({ clubId: club.id, content: validated.content, assetIds: uploads.map(item => item.asset!.id), clientRequestId: requestId.current, status }, initial?.id);
            onSaved(saved);
            toast.success(status === 'published' ? 'Announcement published.' : 'Draft saved.');
        } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to publish. Your text and uploads are still here.'); }
        finally { lock.current = false; if (mounted.current) setBusy(false); }
    };
    const ready = uploads.flatMap(item => item.status === 'ready' && item.asset ? [item.asset] : []);
    const uploading = uploads.some(item => item.status === 'uploading' || item.status === 'verifying');
    const toolbar = [ ['image', 'Photo', ImagePlus], ['video', 'Video', Video], ['audio', 'Audio', AudioLines], ['pdf', 'PDF', FileText] ] as const;
    return <section aria-label={initial ? 'Edit announcement' : 'Create announcement'} className="rounded-2xl border-2 border-black bg-white shadow-[4px_4px_0px_#000]">
        <div className="flex items-center gap-3 p-4 sm:p-5"><div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-black bg-[#a2ff86] text-lg font-black">{club.logoUrl ? <img src={club.logoUrl} alt="" className="h-full w-full object-cover" /> : club.name.charAt(0)}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{club.name}</p><p className="text-xs text-neutral-500">{initial ? 'Edit your announcement' : 'Share an announcement with your community'}</p></div>{onClose && <button type="button" disabled={busy} aria-label="Close composer" onClick={() => setDiscarding(true)} className="rounded-lg p-2 hover:bg-neutral-100"><X size={19} /></button>}</div>
        <div className="space-y-4 px-4 pb-4 sm:px-5 sm:pb-5">
            <AnnouncementEditor editorRef={editorRef} initialContent={initial?.content || EMPTY_DOCUMENT} onChange={setContent} disabled={busy} />
            <p className="text-right text-[11px] text-neutral-400">Up to {MAX_TEXT_LENGTH.toLocaleString()} characters · {uploads.length}/{MAX_ATTACHMENTS} attachments</p>
            {uploads.length > 0 && <ul aria-label="Attached files" className="grid gap-3 sm:grid-cols-2">{uploads.map(item => <li key={item.key} className="relative overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                <div className="mb-2 flex items-start justify-between gap-2"><p className="min-w-0 break-words text-xs font-bold">{item.filename}</p><button type="button" aria-label={`Remove ${item.filename}`} disabled={busy} onClick={() => remove(item)} className="shrink-0 rounded-md p-1 hover:bg-neutral-200"><X size={15} /></button></div>
                {item.preview && item.kind === 'image' && <img src={item.preview} alt={`Preview of ${item.filename}`} className="mb-2 h-28 w-full rounded-lg object-contain" />}
                {item.preview && item.kind === 'video' && <video src={item.preview} aria-label={`Preview of ${item.filename}`} controls preload="metadata" className="mb-2 max-h-36 w-full rounded-lg" />}
                {item.preview && item.kind === 'audio' && <audio src={item.preview} aria-label={`Preview of ${item.filename}`} controls preload="metadata" className="mb-2 w-full" />}
                {(item.status === 'uploading' || item.status === 'verifying') && <div role="status"><progress value={item.progress} max={100} aria-label={`Uploading ${item.filename}`} className="h-2 w-full accent-black" /><div className="mt-1 flex items-center justify-between gap-2"><p className="text-[11px] text-neutral-500">{item.status === 'verifying' ? 'Verifying upload…' : `Uploading ${item.progress}%`}</p><button type="button" className="text-xs font-bold underline" onClick={() => remove(item)}>Cancel upload</button></div></div>}
                {item.status === 'ready' && <div className="flex items-center justify-between gap-2"><p className="flex items-center gap-1 text-[11px] font-bold text-green-800"><Check size={13} /> Ready to publish</p>{item.file && <button type="button" disabled={busy} onClick={() => { const task = tasks.current.get(item.key); if (task) task.uploaded = false; void startUpload(item); }} className="text-[11px] font-bold underline">Re-upload</button>}</div>}
                {item.status === 'error' && <div role="alert"><p className="text-xs text-red-700">{item.error}</p><button type="button" onClick={() => void startUpload(item)} className="mt-2 inline-flex items-center gap-1 text-xs font-black"><RotateCcw size={13} /> Retry upload</button></div>}
            </li>)}</ul>}
            <input ref={input} type="file" multiple className="hidden" onChange={event => addFiles(event.target.files)} aria-label="Choose announcement attachments" />
            <div className="flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-3">{toolbar.map(([kind, label, Icon]) => <button type="button" key={kind} disabled={busy || uploads.length >= MAX_ATTACHMENTS} onClick={() => { selectedKind.current = kind; if (input.current) { input.current.accept = MEDIA_RULES[kind].mimeTypes.join(','); input.current.click(); } }} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold hover:bg-neutral-100 disabled:opacity-40"><Icon size={17} />{label}</button>)}<button type="button" disabled={busy} onClick={() => editorRef.current?.openLink()} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold hover:bg-neutral-100"><Link2 size={17} />Link</button><button type="button" disabled={busy} className="ml-auto inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-xs font-bold hover:bg-neutral-100" onClick={() => setPreview(value => !value)} aria-expanded={preview}><Eye size={16} />{preview ? 'Hide preview' : 'Preview'}</button></div>
            {preview && <div className="space-y-4 rounded-xl border-2 border-dashed border-neutral-300 p-4"><p className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Publication preview</p><AnnouncementRichText content={content} /><AnnouncementMedia attachments={ready} /></div>}
            {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
            <div className="flex flex-wrap items-center justify-between gap-3"><p className="max-w-xs text-[11px] text-neutral-500">{club.visibility === 'public' && club.publicationStatus === 'published' && club.profileVisibility === 'public' ? 'Published posts appear in your club and campus feed. Your drafts stay private.' : 'Published posts are visible to your club members. Campus sharing follows your club profile’s visibility.'}</p><div className="flex gap-2"><button type="button" disabled={busy || uploading} onClick={() => void publish('draft')} className="min-h-11 rounded-xl border-2 border-black px-3 text-xs font-black disabled:opacity-40">Save draft</button><button type="button" disabled={busy || uploading || uploads.some(item => item.status === 'error')} onClick={() => void publish('published')} className="inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-black bg-[#a2ff86] px-4 text-sm font-black shadow-[2px_2px_0px_#000] disabled:opacity-40">{busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}{busy ? 'Saving…' : initial?.status === 'published' ? 'Save changes' : 'Publish'}</button></div></div>
        </div>
        <ConfirmationModal isOpen={discarding} title="Discard unsaved changes?" description="Your unsaved text and attachment changes will be discarded." confirmText="Discard changes" onClose={() => setDiscarding(false)} onConfirm={() => { uploads.forEach(item => { const task = tasks.current.get(item.key); if (task?.signature) void announcementApi.discard(task.signature.id).catch(() => {}); }); onClose?.(); }} />
    </section>;
}
