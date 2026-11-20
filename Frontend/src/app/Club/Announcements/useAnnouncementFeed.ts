import { useCallback, useEffect, useRef, useState } from 'react';
import { announcementApi, type Announcement } from '../../../api/clubAnnouncementsApi';
import { mergeAnnouncements } from '../../../../../shared/announcements';
import { useAppSelector } from '../../../store';
interface FeedState { key: string; items: Announcement[]; nextCursor: string | null; hasMore: boolean; error: string; moreError: string }
export function useAnnouncementFeed(clubId: string | undefined, scope: 'mine' | 'campus') {
    const userId = useAppSelector(state => state.user.user?.id);
    const [revision, setRevision] = useState(0);
    const key = `${userId || ''}:${clubId || ''}:${scope}:${revision}`;
    const [state, setState] = useState<FeedState | null>(null);
    const [pendingKey, setPendingKey] = useState<string | null>(null);
    const request = useRef<AbortController | null>(null);
    const nextRequest = useRef<AbortController | null>(null);
    const lock = useRef<string | null>(null);
    useEffect(() => {
        const controller = new AbortController();
        request.current = controller;
        nextRequest.current?.abort();
        lock.current = null;
        if (clubId) {
            announcementApi.page(clubId, scope, null, controller.signal).then(page => {
                if (!controller.signal.aborted) setState({ key, items: mergeAnnouncements([], page.announcements), ...page.pagination, error: '', moreError: '' });
            }).catch(cause => {
                if (!controller.signal.aborted) setState({ key, items: [], nextCursor: null, hasMore: false, error: cause instanceof Error ? cause.message : 'Unable to load announcements.', moreError: '' });
            }).finally(() => { if (request.current === controller) request.current = null; });
        }
        return () => { controller.abort(); nextRequest.current?.abort(); };
    }, [key, clubId, scope]);
    const loadMore = useCallback(async () => {
        if (!clubId || (request.current && !request.current.signal.aborted) || state?.key !== key || !state.hasMore || !state.nextCursor || lock.current === key) return;
        const controller = new AbortController();
        nextRequest.current = controller;
        lock.current = key;
        setPendingKey(key);
        setState(previous => previous?.key === key ? { ...previous, moreError: '' } : previous);
        try {
            const page = await announcementApi.page(clubId, scope, state.nextCursor, controller.signal);
            if (!controller.signal.aborted) setState(previous => previous?.key === key ? { ...previous, items: mergeAnnouncements(previous.items, page.announcements), ...page.pagination } : previous);
        } catch (cause) {
            if (!controller.signal.aborted) setState(previous => previous?.key === key ? { ...previous, moreError: cause instanceof Error ? cause.message : 'Could not load more announcements.' } : previous);
        } finally {
            if (lock.current === key) lock.current = null;
            if (!controller.signal.aborted) setPendingKey(null);
        }
    }, [clubId, key, scope, state]);
    const refresh = useCallback(() => { request.current?.abort(); nextRequest.current?.abort(); setRevision(value => value + 1); }, []);
    const remove = (id: string) => setState(previous => previous?.key === key ? { ...previous, items: previous.items.filter(item => item.id !== id) } : previous);
    const replace = (item: Announcement) => setState(previous => previous?.key === key ? { ...previous, items: previous.items.map(old => old.id === item.id ? item : old) } : previous);
    const current = state?.key === key ? state : null;
    return { items: current?.items || [], loading: !!clubId && !current, loadingMore: pendingKey === key, hasMore: !!current?.hasMore,
        error: current?.error || '', moreError: current?.moreError || '', loadMore, refresh, remove, replace };
}
