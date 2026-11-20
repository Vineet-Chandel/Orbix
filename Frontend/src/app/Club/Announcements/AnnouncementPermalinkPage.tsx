import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Megaphone } from 'lucide-react';
import { announcementApi, AnnouncementApiError, type Announcement } from '../../../api/clubAnnouncementsApi';
import { AnnouncementCard } from './AnnouncementCard';
import { AnnouncementSkeleton } from '../ClubAnnouncementsSection';
import { useAppSelector } from '../../../store';
export default function AnnouncementPermalinkPage() {
    const { announcementId = '' } = useParams();
    const user = useAppSelector(state => state.user.user);
    const [revision, setRevision] = useState(0);
    const key = `${user?.id || ''}:${announcementId}:${revision}`;
    const [result, setResult] = useState<{ key: string; item: Announcement | null; error: string; status: number } | null>(null);
    useEffect(() => {
        const controller = new AbortController();
        announcementApi.one(announcementId, controller.signal).then(item => { if (!controller.signal.aborted) setResult({ key, item, error: '', status: 200 }); }).catch(cause => {
            if (!controller.signal.aborted) setResult({ key, item: null, error: cause instanceof Error ? cause.message : 'Unable to load this announcement.', status: cause instanceof AnnouncementApiError ? cause.status : 500 });
        });
        return () => controller.abort();
    }, [announcementId, key]);
    const current = result?.key === key ? result : null;
    return <div className="min-h-screen bg-[#faf6ee] px-4 py-7 text-black"><div className="mx-auto max-w-3xl"><nav className="mb-7 flex items-center justify-between gap-4"><Link to={user?.accountType === 'club' ? '/club/announcements' : '/club-announcements'} className="inline-flex items-center gap-2 text-lg font-black"><Megaphone size={22} />Orbix announcements</Link><Link to="/" className="text-xs font-bold underline">Home</Link></nav>{!current ? <AnnouncementSkeleton /> : current.item ? <AnnouncementCard item={current.item} onUpdated={item => setResult({ ...current, item })} onDeleted={() => setResult({ ...current, item: null, error: 'This announcement has been deleted.', status: 404 })} /> : <div role="alert" className="rounded-2xl border-2 border-black bg-white p-8 text-center"><h1 className="text-xl font-black">{current.status === 401 ? 'Sign in to read this announcement' : 'Announcement unavailable'}</h1><p className="mt-3 text-sm text-neutral-500">{current.error}</p>{current.status === 401 ? <Link to={`/auth/signin?redirect=${encodeURIComponent(`/announcements/${announcementId}`)}`} className="mt-5 inline-block rounded-xl border-2 border-black bg-[#a2ff86] px-5 py-2 text-sm font-black">Sign in</Link> : <button type="button" onClick={() => setRevision(value => value + 1)} className="mt-5 rounded-xl border-2 border-black px-5 py-2 text-sm font-black">Try again</button>}</div>}</div></div>;
}
