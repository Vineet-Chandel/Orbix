import { useEffect, useRef, useState } from 'react';
import { Download, ExternalLink, FileText, X } from 'lucide-react';
import type { AnnouncementAttachment } from '../../../api/clubAnnouncementsApi';
export function AnnouncementMedia({ attachments }: { attachments: AnnouncementAttachment[] }) {
    const [openDocuments, setOpenDocuments] = useState<Set<string>>(() => new Set());
    const [viewing, setViewing] = useState<AnnouncementAttachment | null>(null);
    const dialog = useRef<HTMLDialogElement>(null);
    useEffect(() => {
        const element = dialog.current;
        if (viewing && element && !element.open) element.showModal();
        return () => { if (element?.open) element.close(); };
    }, [viewing]);
    const images = attachments.filter(item => item.mediaType === 'image');
    return <div className="space-y-3">
        {!!images.length && <div className={`grid gap-2 ${images.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>{images.map(item => <button key={item.id} type="button" aria-label={`Expand ${item.filename}`} onClick={() => setViewing(item)} className="overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2"><img src={item.url} srcSet={item.srcSet} alt={item.filename} width={item.width || undefined} height={item.height || undefined} loading="lazy" decoding="async" className={`w-full object-contain ${images.length === 1 ? 'max-h-[540px]' : 'h-48 sm:h-64'}`} sizes={images.length === 1 ? '(max-width: 768px) 100vw, 720px' : '(max-width: 768px) 50vw, 360px'} /></button>)}</div>}
        {attachments.filter(item => item.mediaType !== 'image').map(item => <div key={item.id} className="overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50">
            {item.mediaType === 'video' && <video src={item.url} poster={item.thumbnailUrl || undefined} controls playsInline preload="none" aria-label={item.filename} className="max-h-[540px] w-full bg-black" style={{ aspectRatio: item.width && item.height ? `${item.width}/${item.height}` : undefined }}><a href={item.url}>Open {item.filename}</a></video>}
            {item.mediaType === 'audio' && <div className="space-y-3 p-4"><p className="break-words text-sm font-bold">{item.filename}</p><audio src={item.url} controls preload="metadata" aria-label={item.filename} className="w-full">Your browser does not support audio playback.</audio>{item.duration != null && <p className="text-xs text-neutral-500">{Math.floor(item.duration / 60)}:{String(Math.floor(item.duration % 60)).padStart(2, '0')} duration</p>}</div>}
            {item.mediaType === 'pdf' && <div className="p-4"><div className="flex items-center gap-3"><FileText className="shrink-0" size={28} /><div className="min-w-0 flex-1"><p className="break-words text-sm font-black">{item.filename}</p><p className="text-xs text-neutral-500">PDF document · {(item.bytes / 1024 / 1024).toFixed(2)} MB</p></div><a href={item.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${item.filename}`} className="rounded-lg border border-black bg-white p-2"><ExternalLink size={17} /></a></div><details className="mt-3" onToggle={event => { const open = event.currentTarget.open; setOpenDocuments(previous => { const next = new Set(previous); if (open) next.add(item.id); else next.delete(item.id); return next; }); }}><summary className="cursor-pointer text-xs font-bold">Preview document</summary>{openDocuments.has(item.id) && <object data={item.url} type="application/pdf" aria-label={item.filename} className="mt-3 h-96 w-full"><a href={item.url} target="_blank" rel="noopener noreferrer">Open document in a new tab</a></object>}</details></div>}
            {item.mediaType !== 'pdf' && <a href={item.downloadUrl || item.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-neutral-600"><Download size={13} /> Open original file</a>}
        </div>)}
        <dialog ref={dialog} aria-label="Full-screen image preview" onCancel={() => setViewing(null)} onClick={event => { if (event.target === event.currentTarget) setViewing(null); }} className="announcement-lightbox"><button autoFocus type="button" aria-label="Close image preview" onClick={() => setViewing(null)} className="mb-4 ml-auto flex h-11 w-11 items-center justify-center rounded-full border border-white"><X size={23} /></button>{viewing && <img src={viewing.downloadUrl || viewing.url} alt={viewing.filename} />}</dialog>
    </div>;
}
