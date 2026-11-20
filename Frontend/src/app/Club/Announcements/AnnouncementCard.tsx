import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ExternalLink, Heart, Loader2, Pencil, RefreshCw, Share2, Trash2 } from 'lucide-react';
import { announcementApi, shareAnnouncement, type Announcement } from '../../../api/clubAnnouncementsApi';
import { useToast } from '../../../context/ToastContext';
import { ConfirmationModal } from '../../../components/ConfirmationModal';
import { AnnouncementRichText } from './AnnouncementRichText';
import { AnnouncementMedia } from './AnnouncementMedia';
export function AnnouncementCard({ item, onEdit, onDeleted, onUpdated }: { item: Announcement; onEdit?: (item: Announcement) => void; onDeleted: (id: string) => void; onUpdated: (item: Announcement) => void }) {
    const toast = useToast();
    const [engagement, setEngagement] = useState({ liked: item.liked, likeCount: item.likeCount });
    const [liking, setLiking] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [busy, setBusy] = useState(false);
    const [sharing, setSharing] = useState(false);
    const likeLock = useRef(false);
    const deleteLock = useRef(false);
    const shareLock = useRef(false);
    const like = async () => {
        if (likeLock.current) return;
        likeLock.current = true;
        const previous = engagement;
        const liked = !previous.liked;
        setLiking(true);
        setEngagement({ liked, likeCount: Math.max(0, previous.likeCount + (liked ? 1 : -1)) });
        try { setEngagement(await announcementApi.like(item.id, liked)); }
        catch (cause) { setEngagement(previous); toast.error(cause instanceof Error ? cause.message : 'Unable to update like.'); }
        finally { likeLock.current = false; setLiking(false); }
    };
    const share = async () => {
        if (shareLock.current) return;
        shareLock.current = true;
        setSharing(true);
        try { const result = await shareAnnouncement(item.id); if (result === 'copied') toast.success('Announcement link copied.'); }
        catch (cause) { toast.error((cause as Error).message); }
        finally { shareLock.current = false; setSharing(false); }
    };
    const remove = async () => {
        if (deleteLock.current) return;
        deleteLock.current = true;
        setBusy(true);
        try { await announcementApi.remove(item.id); setDeleting(false); onDeleted(item.id); toast.success('Announcement deleted.'); }
        catch (cause) { toast.error((cause as Error).message); }
        finally { deleteLock.current = false; setBusy(false); }
    };
    const refreshMedia = async () => {
        if (busy) return;
        setBusy(true);
        try { const refreshed = await announcementApi.one(item.id); onUpdated(refreshed); setEngagement({ liked: refreshed.liked, likeCount: refreshed.likeCount }); toast.success('Media links refreshed.'); }
        catch (cause) { toast.error((cause as Error).message); }
        finally { setBusy(false); }
    };
    const long = item.plainText.length > 650 || (item.content.content?.length || 0) > 8;
    return <article id={`announcement-${item.id}`} aria-label={`Announcement by ${item.clubName}`} className="overflow-hidden rounded-2xl border-2 border-black bg-white shadow-[3px_3px_0px_#000]">
        <div className="flex items-start gap-3 px-4 pt-4 sm:px-5 sm:pt-5"><Link to={`/clubs/${item.clubSlug}`} className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-black bg-[#e9ddff] font-black" aria-label={`View ${item.clubName}`}>{item.clubLogo ? <img src={item.clubLogo} alt="" loading="lazy" className="h-full w-full object-cover" /> : item.clubName.charAt(0)}</Link><div className="min-w-0 flex-1"><Link to={`/clubs/${item.clubSlug}`} className="inline-flex max-w-full items-center gap-1.5 text-sm font-black"><span className="truncate">{item.clubName}</span><CheckCircle2 size={14} aria-label="Verified club" className="shrink-0 text-green-800" /></Link><p className="mt-0.5 text-[11px] text-neutral-500"><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</time>{item.updatedAt !== item.createdAt && ' · Edited'}{item.status !== 'published' && <span className="ml-2 rounded bg-[#FFE566] px-1.5 py-0.5 font-black uppercase">{item.status}</span>}</p></div>{item.canManage && <div className="flex gap-1">{onEdit && <button type="button" title="Edit announcement" aria-label="Edit announcement" disabled={busy} onClick={() => onEdit(item)} className="rounded-lg p-2 hover:bg-neutral-100"><Pencil size={16} /></button>}<button type="button" title="Delete announcement" aria-label="Delete announcement" disabled={busy} onClick={() => setDeleting(true)} className="rounded-lg p-2 text-red-700 hover:bg-red-50"><Trash2 size={16} /></button></div>}</div>
        <div className="space-y-4 p-4 sm:p-5"><div id={`content-${item.id}`} className={long && !expanded ? 'relative max-h-64 overflow-hidden' : ''}><AnnouncementRichText content={item.content} />{long && !expanded && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white to-transparent" />}</div>{long && <button type="button" aria-expanded={expanded} aria-controls={`content-${item.id}`} className="text-xs font-black underline underline-offset-4" onClick={() => setExpanded(value => !value)}>{expanded ? 'Show less' : 'Read more'}</button>}
            {!!item.attachments.length && <AnnouncementMedia attachments={item.attachments} />}
            {!!item.attachments.length && <button type="button" disabled={busy} onClick={() => void refreshMedia()} className="inline-flex items-center gap-1.5 text-[10px] font-bold text-neutral-500"><RefreshCw size={11} />Media expired or unavailable? Refresh links</button>}
        </div>
        {item.status === 'published' && <><div className="flex items-center justify-between border-t border-neutral-100 px-4 py-2 text-xs text-neutral-500 sm:px-5"><span aria-live="polite">{engagement.likeCount.toLocaleString()} {engagement.likeCount === 1 ? 'like' : 'likes'}</span><Link to={`/announcements/${item.id}`} className="inline-flex items-center gap-1 text-[11px] font-bold">Open post<ExternalLink size={11} /></Link></div><div className="grid grid-cols-2 border-t border-neutral-100"><button type="button" aria-pressed={engagement.liked} aria-label={engagement.liked ? 'Unlike announcement' : 'Like announcement'} disabled={liking || busy} onClick={() => void like()} className={`flex min-h-12 items-center justify-center gap-2 text-sm font-bold hover:bg-neutral-50 disabled:opacity-60 ${engagement.liked ? 'text-rose-700' : 'text-neutral-600'}`}><Heart size={18} fill={engagement.liked ? 'currentColor' : 'none'} />{engagement.liked ? 'Liked' : 'Like'}</button><button type="button" disabled={sharing} onClick={() => void share()} className="flex min-h-12 items-center justify-center gap-2 border-l border-neutral-100 text-sm font-bold text-neutral-600 hover:bg-neutral-50 disabled:opacity-60">{sharing ? <Loader2 size={18} className="animate-spin" /> : <Share2 size={18} />}Share</button></div></>}
        <ConfirmationModal isOpen={deleting} title="Delete this announcement?" description="It will be removed from the feed and shared links will no longer open it." confirmText="Delete announcement" isLoading={busy} onClose={() => setDeleting(false)} onConfirm={remove} />
    </article>;
}
