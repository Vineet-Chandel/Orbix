import { hasPublicPageData } from "../../../shared/seo/bootstrap";
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { metadataFor, headHtml } from '../../../shared/seo/metadata';
import { routePolicy } from '../../../shared/seo/routes';
import { initialSeoData, publicSite, loadPublicData, discardOtherBootstrap } from './client';
export function RouteSeo() {
    const { pathname, search } = useLocation();
    const navigate = useNavigate();
    useEffect(() => {
        const controller = new AbortController();
        const policy = routePolicy(pathname);
        discardOtherBootstrap(pathname);
        if (policy.redirect) { navigate(policy.redirect, { replace: true }); return () => controller.abort(); }
        const update = (data = initialSeoData(pathname), status = policy.status) => {
            const meta = metadataFor(pathname, publicSite, data, status);
            document.head.querySelectorAll('[data-orbix-seo]').forEach(node => node.remove());
            const template = document.createElement('template'); template.innerHTML = headHtml(meta);
            document.head.append(template.content);
        };
        update();
        const page = Number(new URLSearchParams(search).get('page')) || 1;
        if (hasPublicPageData(initialSeoData(pathname),pathname,page)) return () => controller.abort();
        if (['club', 'event', 'events', 'clubs'].includes(policy.kind)) {
            loadPublicData(pathname, Number(new URLSearchParams(search).get('page')) || 1)
                .then(payload => { if (!controller.signal.aborted) update(payload.data, payload.status); })
                .catch(() => { if (!controller.signal.aborted) update(undefined, 503); });
        }
        return () => controller.abort();
    }, [pathname, search, navigate]);
    return null;
}
