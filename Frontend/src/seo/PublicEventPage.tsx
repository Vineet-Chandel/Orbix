import { hasPublicPageData } from "../../../shared/seo/bootstrap";
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { PageData, PublicEntity } from '../../../shared/seo/metadata';
import { initialSeoData, loadPublicData } from './client';
export function PublicEventPage({ initialData, embedded = false }: { initialData?: PageData; embedded?: boolean }) {
    const { pathname, search } = useLocation();
    const [data, setData] = useState<PageData | undefined>(() => initialData || initialSeoData(pathname));
    const [status, setStatus] = useState(data ? 200 : 0);
    const page = Number(new URLSearchParams(search).get('page')) || 1;
    useEffect(() => {
        const controller = new AbortController();
        if (hasPublicPageData(initialData || initialSeoData(pathname),pathname,page)) return () => controller.abort();
        loadPublicData(pathname,page)
            .then(payload => { if (!controller.signal.aborted) { setStatus(payload.status); setData(payload.data); } })
            .catch(() => { if (!controller.signal.aborted) setStatus(503); });
        return () => controller.abort();
    }, [pathname, page, initialData]);
    const entity = data?.entity;
    const event = (item: PublicEntity) => <article key={item.path} className="rounded-2xl border-2 border-black p-5 space-y-3">
        <h2 className="text-xl font-bold"><Link className="underline" to={item.path}>{item.title}</Link></h2><p>{item.description}</p>
        {item.startsAt && <p>Starts <time dateTime={item.startsAt}>{new Date(item.startsAt).toISOString().replace('T', ' ').slice(0, 16)} UTC</time></p>}
        {item.clubPath && <Link to={item.clubPath}>Organized by {item.clubName}</Link>}
    </article>;
    const Container = embedded ? 'section' : 'main';
    const Heading = embedded ? 'h2' : 'h1';
    return <Container className="max-w-5xl mx-auto px-5 py-12 space-y-7">
        <nav aria-label="Breadcrumb" className="flex gap-3"><Link to="/">Orbix</Link><Link to="/events">Public events</Link>{entity && <span aria-current="page">{entity.title}</span>}</nav>
        <Heading className="text-3xl font-black">{entity?.title || (pathname === '/events' ? 'Public events' : status === 404 ? 'Event unavailable' : 'Event details')}</Heading>
        {status === 503 ? <p>Events are temporarily unavailable. Please try again later.</p> : !status ? <p role="status">Loading public events…</p> : entity ? <>
            {entity.image && <img src={entity.image} alt={`${entity.title} event banner`} width="1200" height="630" fetchPriority="high" className="w-full aspect-[1200/630] object-cover rounded-xl" />}
            <p>{entity.description}</p>{entity.startsAt && <p>Starts <time dateTime={entity.startsAt}>{new Date(entity.startsAt).toISOString().replace('T', ' ').slice(0,16)} UTC</time></p>}
            {entity.venue && <p>Location: {entity.venue}</p>}<Link to={entity.clubPath || '/clubs'}>Organized by {entity.clubName}</Link>
            <p><Link className="inline-block border-2 border-black rounded-xl px-5 py-3 bg-[#a2ff86] font-bold" to={`${entity.path}/register`}>View registration requirements</Link></p>
        </> : status === 404 ? <p>This event is not available publicly.</p> : <>
            <p>Published national events open to all participants. Campus-restricted events are available only in the signed-in application.</p>
            <div className="grid md:grid-cols-2 gap-5">{data?.events?.map(event)}</div>{!data?.events?.length && <p>No public events are listed right now.</p>}
            <nav aria-label="Event pages" className="flex gap-5">{page > 1 && <Link rel="prev" to={page === 2 ? '/events' : `/events?page=${page - 1}`}>Previous events</Link>}{data?.hasNext && <Link rel="next" to={`/events?page=${page + 1}`}>More events</Link>}</nav>
        </>}
    </Container>;
}
export default PublicEventPage;
