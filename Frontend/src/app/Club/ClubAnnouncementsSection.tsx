import { Suspense, useEffect, useRef, useState } from 'react';
import { lazyWithRetry } from '../../utils/lazyWithRetry';
import { CheckCircle2, Loader2, Plus, RefreshCw, ShieldCheck } from 'lucide-react';
import { announcementApi, type Announcement, type AnnouncementClub, type MediaKind } from '../../api/clubAnnouncementsApi';
import { useAppSelector } from '../../store';
import { NeoSelect } from '../../components/NeoSelect';
const AnnouncementComposer = lazyWithRetry(() => import('./Announcements/AnnouncementComposer').then(module => ({ default: module.AnnouncementComposer })));
import { AnnouncementCard } from './Announcements/AnnouncementCard';
import { useAnnouncementFeed } from './Announcements/useAnnouncementFeed';
import './Announcements/announcements.css';
export function AnnouncementSkeleton() {
    return <div role="status" aria-label="Loading announcements" className="space-y-4">{[0, 1].map(index => <div key={index} className="space-y-4 rounded-2xl border-2 border-black bg-white p-5"><div className="flex gap-3"><div className="h-11 w-11 animate-pulse rounded-xl bg-neutral-200" /><div className="flex-1 space-y-2"><div className="h-4 w-36 animate-pulse rounded bg-neutral-200" /><div className="h-3 w-20 animate-pulse rounded bg-neutral-100" /></div></div><div className="h-20 animate-pulse rounded-xl bg-neutral-100" /><div className="h-8 animate-pulse rounded-lg bg-neutral-100" /></div>)}</div>;
}
export function ClubAnnouncementsSection({ clubId }: { clubId?: string; clubName?: string }) {
    const userId = useAppSelector(state => state.user.user?.id);
    const contextKey = `${userId || ''}:${clubId || ''}`;
    const [contextRevision, setContextRevision] = useState(0);
    const [context, setContext] = useState<{ key: string; clubs: AnnouncementClub[]; limits: Partial<Record<MediaKind, number>>; error: string } | null>(null);
    const [selected, setSelected] = useState<string>('');
    const [scope, setScope] = useState<'mine' | 'campus'>('campus');
    const [editing, setEditing] = useState<Announcement | null | undefined>(undefined);
    const [composerVersion, setComposerVersion] = useState(0);
    const sentinel = useRef<HTMLDivElement>(null);
    const composer = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const controller = new AbortController();
        announcementApi.context(controller.signal).then(data => {
            if (!controller.signal.aborted) setContext({ key: contextKey, clubs: data.clubs, limits: data.mediaLimits, error: '' });
        }).catch(cause => {
            if (!controller.signal.aborted) setContext({ key: contextKey, clubs: [], limits: {}, error: cause instanceof Error ? cause.message : 'Unable to verify club membership.' });
        });
        return () => controller.abort();
    }, [contextKey, contextRevision]);
    const currentContext = context?.key === contextKey ? context : null;
    const clubs = currentContext?.clubs || [];
    const club = clubs.find(item => item.id === (clubId || selected)) || (!clubId ? clubs[0] : undefined);
    const feed = useAnnouncementFeed(club?.id, scope);
    const composing = editing !== undefined;
    const { hasMore, loadingMore, moreError, loadMore } = feed;
    useEffect(() => { if (composing) composer.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [composing]);
    useEffect(() => {
        const target = sentinel.current;
        if (!target || !hasMore || loadingMore || moreError || !('IntersectionObserver' in window)) return;
        const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) void loadMore(); }, { rootMargin: '600px 0px' });
        observer.observe(target);
        return () => observer.disconnect();
    }, [hasMore, loadingMore, moreError, loadMore]);
    if (!currentContext) return <AnnouncementSkeleton />;
    if (currentContext.error) return <div role="alert" className="rounded-2xl border-2 border-black bg-white p-8 text-center"><p className="font-bold">{currentContext.error}</p><button type="button" className="mt-4 rounded-xl border-2 border-black px-4 py-2 text-sm font-black" onClick={() => setContextRevision(value => value + 1)}>Try again</button></div>;
    if (!club) return <div role="status" className="rounded-2xl border-2 border-black bg-white p-10 text-center"><ShieldCheck size={32} className="mx-auto mb-4" /><h2 className="text-lg font-black">Active club membership required</h2><p className="mt-2 text-sm text-neutral-500">Join a club or ask a club administrator to activate your membership to publish and read announcements.</p></div>;
    const composerClub = editing ? clubs.find(candidate => candidate.id === editing.clubId) || club : club;
    const saved = (item: Announcement) => { setEditing(undefined); setComposerVersion(value => value + 1); if (item.status !== 'published') setScope('mine'); feed.refresh(); };
    return <div className="announcement-feed w-full space-y-6">
        <main className="w-full space-y-5">
            {!clubId && clubs.length > 1 && <div className="max-w-xs"><NeoSelect label="Publishing as" value={club.id} disabled={composing} onChange={value => setSelected(value)} options={clubs.map(item => ({ value: item.id, label: item.name }))} size="md" portal={true} /></div>}
            <div ref={composer} className="scroll-mt-6">{composing ? <Suspense fallback={<div role="status" className="rounded-2xl border-2 border-black bg-white p-8 text-sm font-bold">Loading editor…</div>}><AnnouncementComposer key={`${composerClub.id}:${editing?.id || 'new'}:${composerVersion}`} club={composerClub} initial={editing || undefined} limits={currentContext.limits} onSaved={saved} onClose={() => setEditing(undefined)} /></Suspense> : <div className="rounded-2xl border-2 border-black bg-white p-4 shadow-[3px_3px_0px_#000] sm:p-5"><div className="flex items-center gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-black bg-[#a2ff86] font-black">{club.logoUrl ? <img src={club.logoUrl} alt="" className="h-full w-full object-cover" /> : club.name.charAt(0)}</div><button type="button" onClick={() => setEditing(null)} className="min-h-12 flex-1 rounded-full border border-neutral-300 bg-neutral-50 px-4 text-left text-xs font-bold text-neutral-500 hover:border-black sm:text-sm">Share an announcement with your community…</button></div><div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-3"><p className="text-[11px] text-neutral-500">Text, photos, video, audio, and documents.</p><button type="button" onClick={() => setEditing(null)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border-2 border-black bg-[#a2ff86] px-3 text-xs font-black"><Plus size={15} />Create post</button></div></div>}</div>
            <div className="flex items-center justify-between gap-3"><div className="flex gap-1 rounded-xl border-2 border-black bg-white p-1">{(['campus', 'mine'] as const).map(value => <button type="button" key={value} aria-pressed={scope === value} onClick={() => setScope(value)} className={`min-h-10 rounded-lg px-3 text-xs font-black transition sm:px-4 ${scope === value ? 'bg-black text-white' : 'text-neutral-500 hover:bg-neutral-100'}`}>{value === 'campus' ? 'Campus feed' : 'My club'}</button>)}</div><button type="button" aria-label="Refresh feed" title="Refresh feed" disabled={feed.loading} onClick={feed.refresh} className="rounded-xl border-2 border-black bg-white p-2.5 disabled:opacity-40"><RefreshCw size={16} className={feed.loading ? 'animate-spin' : ''} /></button></div>
            {feed.loading ? <AnnouncementSkeleton /> : feed.error ? <div role="alert" className="space-y-4 rounded-2xl border-2 border-black bg-white p-8 text-center"><p className="text-sm font-bold">{feed.error}</p><button type="button" onClick={feed.refresh} className="rounded-xl border-2 border-black px-4 py-2 text-xs font-black">Retry feed</button></div> : !feed.items.length ? <div className="rounded-2xl border-2 border-black bg-white p-10 text-center"><h3 className="text-lg font-black">Be the first to share something.</h3><p className="mx-auto mt-2 max-w-sm text-sm text-neutral-500">An important update, an open opportunity, or a win worth celebrating. Your next announcement starts here.</p><button type="button" disabled={composing} onClick={() => setEditing(null)} className="mt-5 rounded-xl border-2 border-black bg-[#a2ff86] px-4 py-2.5 text-sm font-black disabled:opacity-40">Write an announcement</button></div> : <div className="space-y-5">{feed.items.map(item => <AnnouncementCard key={`${item.id}:${item.updatedAt}`} item={item} onEdit={composing ? undefined : setEditing} onDeleted={feed.remove} onUpdated={feed.replace} />)}</div>}
            <div ref={sentinel} className="flex min-h-14 items-center justify-center text-xs font-bold text-neutral-500">{feed.loadingMore ? <span role="status" className="inline-flex items-center gap-2"><Loader2 size={16} className="animate-spin" />Loading more announcements…</span> : feed.moreError ? <div role="alert" className="space-y-2 text-center"><p>{feed.moreError}</p><button type="button" onClick={() => void feed.loadMore()} className="rounded-xl border-2 border-black bg-white px-4 py-2 text-black">Retry loading more</button></div> : feed.hasMore ? <button type="button" onClick={() => void feed.loadMore()} className="rounded-xl border-2 border-black bg-white px-4 py-2 text-black">Load more announcements</button> : !feed.loading && !feed.error && feed.items.length > 0 ? <span className="inline-flex items-center gap-2"><CheckCircle2 size={16} />You’re all caught up.</span> : null}</div>
        </main>
    </div>;
}
export default ClubAnnouncementsSection;
