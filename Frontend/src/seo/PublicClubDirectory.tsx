import { hasPublicPageData } from "../../../shared/seo/bootstrap";
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { PageData } from '../../../shared/seo/metadata';
import { initialSeoData, loadPublicData } from './client';
export function PublicClubDirectory({ initialData }: { initialData?: PageData }) {
    const { search } = useLocation();
    const page = Math.max(1, Number(new URLSearchParams(search).get('page')) || 1);
    const [data,setData] = useState(() => initialData || initialSeoData('/clubs'));
    const [unavailable,setUnavailable] = useState(false);
    useEffect(() => {
        const controller = new AbortController();
        if (hasPublicPageData(initialData || initialSeoData('/clubs'),'/clubs',page)) return () => controller.abort();
        loadPublicData('/clubs',page).then(payload => {
            if (!controller.signal.aborted) { setData(payload.data); setUnavailable(payload.status !== 200); }
        }).catch(() => { if (!controller.signal.aborted) setUnavailable(true); });
        return () => controller.abort();
    },[page,initialData]);
    return <section className="mx-auto max-w-6xl px-5 py-12 space-y-5" aria-labelledby="public-campus-clubs">
        <h2 id="public-campus-clubs" className="text-2xl font-black">Published campus clubs</h2>
        <p>Explore publicly published organization profiles. Private and unlisted club profiles are excluded from this directory.</p>
        {unavailable ? <p>Club listings are temporarily unavailable.</p> : <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{data?.clubs?.map(club => <article className="min-w-0 border-2 border-black rounded-2xl bg-white p-5 space-y-3" key={club.path}><h3 className="font-bold break-words"><Link className="underline" to={club.path}>{club.title}</Link></h3><p>{club.description}</p></article>)}</div>}
        <nav aria-label="Club directory pages" className="flex gap-5">{page>1 && <Link rel="prev" to={page===2?'/clubs':`/clubs?page=${page-1}`}>Previous clubs</Link>}{data?.hasNext && <Link rel="next" to={`/clubs?page=${page+1}`}>More clubs</Link>}</nav>
    </section>;
}
