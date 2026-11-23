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
    if (unavailable || !data?.clubs || data.clubs.length === 0) {
        return null;
    }

    return <section className="mx-auto max-w-6xl px-5 py-8 space-y-6" aria-label="Campus clubs directory">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {data.clubs.map(club => (
                <article className="min-w-0 border-2 border-black rounded-2xl bg-white p-5 space-y-3 shadow-[3px_3px_0px_#000]" key={club.path}>
                    <h3 className="font-bold break-words">
                        <Link className="underline hover:text-neutral-700" to={club.path}>{club.title}</Link>
                    </h3>
                    <p className="text-sm text-neutral-600 font-medium">{club.description}</p>
                </article>
            ))}
        </div>
        <nav aria-label="Club directory pages" className="flex gap-5">
            {page > 1 && <Link className="text-sm font-bold underline" rel="prev" to={page === 2 ? '/clubs' : `/clubs?page=${page - 1}`}>Previous clubs</Link>}
            {data?.hasNext && <Link className="text-sm font-bold underline" rel="next" to={`/clubs?page=${page + 1}`}>More clubs</Link>}
        </nav>
    </section>;
}
