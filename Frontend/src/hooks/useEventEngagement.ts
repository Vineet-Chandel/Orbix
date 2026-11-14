import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAppSelector } from "../store";
import { useToast } from "../context/ToastContext";

export interface InternalShareResponse {
    success: boolean;
    deliveredCount: number;
    sharesCount?: number;
    publicCountIncremented?: boolean;
    error?: string;
}

export interface EventEngagementState {
    likeCount: number;
    likedByViewer: boolean;
    shareCount: number;
    loading: boolean;
    isLiking: boolean;
    isSharing: boolean;
    toggleLike: () => Promise<void>;
    shareEvent: () => Promise<boolean>;
    copyEventLink: () => Promise<boolean>;
    shareEventInternally: (recipientUserIds: string | string[], note?: string) => Promise<InternalShareResponse>;
}

export interface CachedEventState {
    likeCount: number;
    likedByViewer: boolean;
    shareCount: number;
    timestamp: number;
}

// In-memory cache shared across mounted cards, detail modals, and navigation
const eventEngagementCache = new Map<string, CachedEventState>();
const eventStateListeners = new Map<string, Set<(state: { likeCount: number; likedByViewer: boolean; shareCount: number }) => void>>();

function getStorageKey(eventId: string): string {
    return `orbix_event_engagement_${String(eventId || "").trim().toLowerCase()}`;
}

function getStoredState(eventId: string): CachedEventState | null {
    if (typeof window === "undefined" || !eventId) return null;
    try {
        const raw = sessionStorage.getItem(getStorageKey(eventId));
        if (raw) {
            const parsed = JSON.parse(raw);
            if (
                typeof parsed?.likeCount === "number" &&
                typeof parsed?.likedByViewer === "boolean" &&
                typeof parsed?.shareCount === "number"
            ) {
                return parsed;
            }
        }
    } catch {
        // Safe to ignore storage errors
    }
    return null;
}

function persistState(eventId: string, state: { likeCount: number; likedByViewer: boolean; shareCount: number }) {
    if (typeof window === "undefined" || !eventId) return;
    try {
        sessionStorage.setItem(
            getStorageKey(eventId),
            JSON.stringify({ ...state, timestamp: Date.now() })
        );
    } catch {
        // Safe to ignore storage errors
    }
}

function notifyListeners(
    eventId: string,
    state: { likeCount: number; likedByViewer: boolean; shareCount: number }
) {
    const cleanId = String(eventId || "").trim().toLowerCase();
    eventEngagementCache.set(cleanId, { ...state, timestamp: Date.now() });
    persistState(cleanId, state);

    const listeners = eventStateListeners.get(cleanId);
    if (listeners) {
        listeners.forEach((listener) => listener(state));
    }
}

/**
 * Primes the engagement cache with known counts (e.g. from listing queries).
 * Avoids any cold loading indicators when events are fetched in batch.
 */
export function primeEventEngagementCache(events: Array<{ id: string; likesCount?: number; hasLiked?: boolean; sharesCount?: number }>) {
    if (!Array.isArray(events)) return;
    for (const ev of events) {
        if (!ev?.id) continue;
        const cleanId = ev.id.trim().toLowerCase();
        const existing = eventEngagementCache.get(cleanId);
        // Only prime if not already in memory with a newer timestamp
        if (!existing) {
            const primedState = {
                likeCount: typeof ev.likesCount === "number" ? ev.likesCount : 0,
                likedByViewer: Boolean(ev.hasLiked),
                shareCount: typeof ev.sharesCount === "number" ? ev.sharesCount : 0,
            };
            eventEngagementCache.set(cleanId, { ...primedState, timestamp: Date.now() });
            persistState(cleanId, primedState);
        }
    }
}

export function useEventEngagement(
    eventId: string,
    options?: {
        eventTitle?: string;
        eventSummary?: string;
        initialLikeCount?: number;
        initialLiked?: boolean;
        initialShareCount?: number;
    }
): EventEngagementState {
    const navigate = useNavigate();
    const toast = useToast();
    const { user, isAuthenticated } = useAppSelector((state) => state.user);

    const cleanId = String(eventId || "").trim().toLowerCase();

    // Stale-While-Revalidate: check in-memory cache, then sessionStorage, then initial props
    const getInitialState = (): { likeCount: number; likedByViewer: boolean; shareCount: number; hasCachedData: boolean } => {
        const fromMem = eventEngagementCache.get(cleanId);
        if (fromMem) {
            return { likeCount: fromMem.likeCount, likedByViewer: fromMem.likedByViewer, shareCount: fromMem.shareCount, hasCachedData: true };
        }
        const fromStorage = getStoredState(cleanId);
        if (fromStorage) {
            eventEngagementCache.set(cleanId, fromStorage);
            return { likeCount: fromStorage.likeCount, likedByViewer: fromStorage.likedByViewer, shareCount: fromStorage.shareCount, hasCachedData: true };
        }
        if (options?.initialLikeCount !== undefined || options?.initialShareCount !== undefined) {
            const fallbackState = {
                likeCount: options.initialLikeCount ?? 0,
                likedByViewer: Boolean(options.initialLiked),
                shareCount: options.initialShareCount ?? 0,
            };
            eventEngagementCache.set(cleanId, { ...fallbackState, timestamp: Date.now() });
            persistState(cleanId, fallbackState);
            return { ...fallbackState, hasCachedData: true };
        }
        return { likeCount: 0, likedByViewer: false, shareCount: 0, hasCachedData: false };
    };

    const initial = getInitialState();
    const [likeCount, setLikeCount] = useState<number>(initial.likeCount);
    const [likedByViewer, setLikedByViewer] = useState<boolean>(initial.likedByViewer);
    const [shareCount, setShareCount] = useState<number>(initial.shareCount);
    // If cached data exists, loading starts as false so counts render instantly with zero layout shift
    const [loading, setLoading] = useState<boolean>(!initial.hasCachedData);
    const [isLiking, setIsLiking] = useState<boolean>(false);
    const [isSharing, setIsSharing] = useState<boolean>(false);

    const isLikingRef = useRef(false);
    const hasProcessedPendingRef = useRef(false);

    // Multi-instance synchronization (cards, modals, headers)
    useEffect(() => {
        if (!cleanId) return;
        if (!eventStateListeners.has(cleanId)) {
            eventStateListeners.set(cleanId, new Set());
        }
        const setForId = eventStateListeners.get(cleanId)!;
        const updateListener = (newState: { likeCount: number; likedByViewer: boolean; shareCount: number }) => {
            setLikeCount(newState.likeCount);
            setLikedByViewer(newState.likedByViewer);
            setShareCount(newState.shareCount);
        };
        setForId.add(updateListener);

        return () => {
            setForId.delete(updateListener);
            if (setForId.size === 0) {
                eventStateListeners.delete(cleanId);
            }
        };
    }, [cleanId]);

    // Fetch authoritative state from backend
    const fetchEngagement = useCallback(async () => {
        if (!cleanId) return;

        try {
            const token = typeof window !== "undefined" ? localStorage.getItem("orbix_token") : null;
            const headers: Record<string, string> = {
                "Content-Type": "application/json",
            };
            if (token) {
                headers["Authorization"] = `Bearer ${token}`;
            }

            const response = await fetch(`/api/events/${encodeURIComponent(cleanId)}/engagement`, {
                method: "GET",
                headers,
                credentials: "include",
            });

            if (response.ok) {
                const json = await response.json();
                if (json?.data) {
                    // Do not allow an in-flight like mutation to be clobbered by background GET
                    if (isLikingRef.current) return;

                    const freshState = {
                        likeCount: Number(json.data.likeCount) || 0,
                        likedByViewer: Boolean(json.data.likedByViewer),
                        shareCount: Number(json.data.shareCount) || 0,
                    };
                    setLikeCount(freshState.likeCount);
                    setLikedByViewer(freshState.likedByViewer);
                    setShareCount(freshState.shareCount);
                    notifyListeners(cleanId, freshState);
                }
            }
        } catch (err) {
            console.warn("[useEventEngagement] Failed to fetch engagement:", err);
        } finally {
            setLoading(false);
        }
    }, [cleanId]);

    useEffect(() => {
        fetchEngagement();
    }, [fetchEngagement, isAuthenticated]);

    // Core Like Mutation Execution
    const executeLikeMutation = useCallback(
        async (shouldLike: boolean) => {
            if (isLikingRef.current || !cleanId) return;
            isLikingRef.current = true;
            setIsLiking(true);

            // Optimistic update
            const prevLiked = likedByViewer;
            const prevCount = likeCount;

            const nextLiked = shouldLike;
            const nextCount = shouldLike ? prevCount + 1 : Math.max(0, prevCount - 1);

            setLikedByViewer(nextLiked);
            setLikeCount(nextCount);
            notifyListeners(cleanId, { likeCount: nextCount, likedByViewer: nextLiked, shareCount });

            try {
                const token = typeof window !== "undefined" ? localStorage.getItem("orbix_token") : null;
                const headers: Record<string, string> = {
                    "Content-Type": "application/json",
                };
                if (token) {
                    headers["Authorization"] = `Bearer ${token}`;
                }

                const endpoint = `/api/events/${encodeURIComponent(cleanId)}/likes`;
                const method = shouldLike ? "POST" : "DELETE";

                const res = await fetch(endpoint, {
                    method,
                    headers,
                    credentials: "include",
                });

                if (!res.ok) {
                    if (res.status === 401) {
                        throw new Error("Authentication required to like events.");
                    }
                    const errData = await res.json().catch(() => null);
                    throw new Error(errData?.message || "Failed to update like status.");
                }

                const result = await res.json();
                if (result?.data) {
                    const serverState = {
                        likeCount: Number(result.data.likeCount) || nextCount,
                        likedByViewer: Boolean(result.data.likedByViewer ?? shouldLike),
                        shareCount: Number(result.data.shareCount) || shareCount,
                    };
                    setLikeCount(serverState.likeCount);
                    setLikedByViewer(serverState.likedByViewer);
                    notifyListeners(cleanId, serverState);
                }
            } catch (err: any) {
                console.error("[useEventEngagement] Like toggle failed, rolling back:", err);
                setLikedByViewer(prevLiked);
                setLikeCount(prevCount);
                notifyListeners(cleanId, { likeCount: prevCount, likedByViewer: prevLiked, shareCount });
                toast.error(err.message || "Failed to update like. Please try again.");
            } finally {
                isLikingRef.current = false;
                setIsLiking(false);
            }
        },
        [cleanId, likedByViewer, likeCount, shareCount, toast]
    );

    // Auto-execute pending like after successful login return
    useEffect(() => {
        if (!isAuthenticated || !user || hasProcessedPendingRef.current || !cleanId) return;

        try {
            const rawPending = sessionStorage.getItem("orbix_pending_event_like");
            if (!rawPending) return;

            const pending = JSON.parse(rawPending);
            const isMatch = pending?.eventId?.toLowerCase() === cleanId;
            const isFresh = pending?.timestamp && Date.now() - pending.timestamp < 5 * 60 * 1000;

            if (isMatch && isFresh) {
                hasProcessedPendingRef.current = true;
                sessionStorage.removeItem("orbix_pending_event_like");
                toast.success("Welcome back! Adding your like...", { title: "Signed In" });
                executeLikeMutation(true);
            }
        } catch {
            sessionStorage.removeItem("orbix_pending_event_like");
        }
    }, [isAuthenticated, user, cleanId, executeLikeMutation, toast]);

    // User-triggered like click
    const toggleLike = useCallback(async () => {
        if (isLikingRef.current || !cleanId) return;

        // Guest user: save intent & redirect to sign in
        if (!isAuthenticated || !user) {
            try {
                const currentPath = window.location.pathname + window.location.search;
                sessionStorage.setItem(
                    "orbix_pending_event_like",
                    JSON.stringify({
                        eventId: cleanId,
                        returnUrl: currentPath,
                        timestamp: Date.now(),
                    })
                );
            } catch {}
            toast.info("Please sign in to appreciate this event.", { title: "Authentication Required" });
            navigate(`/auth/signin?returnUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`);
            return;
        }

        await executeLikeMutation(!likedByViewer);
    }, [isAuthenticated, user, cleanId, likedByViewer, executeLikeMutation, navigate, toast]);

    // User-triggered external share click (with cancellation protection & clipboard fallback)
    const shareEvent = useCallback(async (): Promise<boolean> => {
        if (!cleanId || isSharing) return false;
        setIsSharing(true);

        const canonicalUrl = `${window.location.origin}/college-events?event=${encodeURIComponent(cleanId)}`;
        const shareData: ShareData = {
            title: options?.eventTitle ? `${options.eventTitle} | Orbix` : "Orbix Campus Event",
            text: options?.eventSummary || "Check out this upcoming event on Orbix!",
            url: canonicalUrl,
        };

        const generateIdempotencyKey = (prefix = "share") =>
            `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

        // Backend record helper: only external shares increment public count; link copies do NOT!
        const recordShareToServer = async (
            shareType: "external" | "copy_link",
            platform: string
        ): Promise<{ success: boolean; publicCountIncremented: boolean }> => {
            const idempotencyKey = generateIdempotencyKey(shareType === "external" ? "ext" : "copy");

            const isClubUser = user?.accountType === "club";

            // ONLY optimistically increment for verified external shares by normal/guest users!
            // Club account shares never increment the public share count!
            if (shareType === "external" && !isClubUser) {
                const nextShareCount = shareCount + 1;
                setShareCount(nextShareCount);
                notifyListeners(cleanId, { likeCount, likedByViewer, shareCount: nextShareCount });
            }

            try {
                const token = typeof window !== "undefined" ? localStorage.getItem("orbix_token") : null;
                const headers: Record<string, string> = { "Content-Type": "application/json" };
                if (token) headers["Authorization"] = `Bearer ${token}`;

                const res = await fetch(`/api/events/${encodeURIComponent(cleanId)}/shares`, {
                    method: "POST",
                    headers,
                    credentials: "include",
                    body: JSON.stringify({ idempotencyKey, shareType, platform }),
                });

                if (res.ok) {
                    const data = await res.json();
                    if (data?.sharesCount !== undefined) {
                        const serverCount = Number(data.sharesCount);
                        setShareCount(serverCount);
                        notifyListeners(cleanId, { likeCount, likedByViewer, shareCount: serverCount });
                    }
                    const publicCountIncremented = Boolean(
                        data?.publicCountIncremented ?? data?.data?.publicCountIncremented
                    );
                    return { success: true, publicCountIncremented };
                }
                return { success: false, publicCountIncremented: false };
            } catch (err) {
                console.warn("[useEventEngagement] Failed to record share action:", err);
                if (shareType === "external" && !isClubUser) {
                    setShareCount(shareCount);
                    notifyListeners(cleanId, { likeCount, likedByViewer, shareCount });
                }
                return { success: false, publicCountIncremented: false };
            }
        };

        try {
            // 1. Try Native Web Share API if supported
            if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
                try {
                    await navigator.share(shareData);
                    // Successfully completed native external share
                    const recordResult = await recordShareToServer("external", "web_share");
                    // Display success toast ONLY if public count was actually incremented!
                    if (recordResult.publicCountIncremented) {
                        toast.success("Event shared successfully!");
                    }
                    return true;
                } catch (shareErr: any) {
                    // User cancelled/dismissed or share aborted:
                    // DO NOT record anything, DO NOT increment count, DO NOT fall through to copy link!
                    const isUserCancel =
                        shareErr?.name === "AbortError" ||
                        shareErr?.name === "NotAllowedError" ||
                        String(shareErr?.message || "").toLowerCase().includes("abort") ||
                        String(shareErr?.message || "").toLowerCase().includes("cancel");

                    if (isUserCancel) {
                        return false;
                    }
                    // For genuine API invocation failures (not user dismissals), safely fall through to clipboard
                }
            }

            // 2. Clipboard API Fallback (Desktop / unsupported native share)
            if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(canonicalUrl);
                // Link copies must NOT increment public share count!
                await recordShareToServer("copy_link", "clipboard");
                toast.success("Event link copied to clipboard!");
                return true;
            } else {
                // Fallback for older browsers
                const textarea = document.createElement("textarea");
                textarea.value = canonicalUrl;
                textarea.style.position = "fixed";
                textarea.style.opacity = "0";
                document.body.appendChild(textarea);
                textarea.select();
                const successful = document.execCommand("copy");
                document.body.removeChild(textarea);

                if (successful) {
                    await recordShareToServer("copy_link", "clipboard");
                    toast.success("Event link copied to clipboard!");
                    return true;
                }
                throw new Error("Clipboard copy unsupported");
            }
        } catch (err: any) {
            console.error("[useEventEngagement] Share failed:", err);
            toast.error("Failed to share event link. Please try again.");
            return false;
        } finally {
            setIsSharing(false);
        }
    }, [cleanId, isSharing, options?.eventTitle, options?.eventSummary, shareCount, likeCount, likedByViewer, toast]);

    // User-triggered direct copy link action (tracked separately, NEVER increments public count)
    const copyEventLink = useCallback(async (): Promise<boolean> => {
        if (!cleanId) return false;
        const canonicalUrl = `${window.location.origin}/college-events?event=${encodeURIComponent(cleanId)}`;

        try {
            if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(canonicalUrl);
            } else {
                const textarea = document.createElement("textarea");
                textarea.value = canonicalUrl;
                textarea.style.position = "fixed";
                textarea.style.opacity = "0";
                document.body.appendChild(textarea);
                textarea.select();
                const successful = document.execCommand("copy");
                document.body.removeChild(textarea);
                if (!successful) throw new Error("Clipboard copy unsupported");
            }

            // Record link copy separately in background without affecting public share count
            const idempotencyKey = `copy-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
            const token = typeof window !== "undefined" ? localStorage.getItem("orbix_token") : null;
            const headers: Record<string, string> = { "Content-Type": "application/json" };
            if (token) headers["Authorization"] = `Bearer ${token}`;

            fetch(`/api/events/${encodeURIComponent(cleanId)}/shares`, {
                method: "POST",
                headers,
                credentials: "include",
                body: JSON.stringify({ idempotencyKey, shareType: "copy_link", platform: "clipboard" }),
            }).catch((err) => console.warn("[useEventEngagement] Failed to record link copy:", err));

            toast.success("Event link copied to clipboard!");
            return true;
        } catch (err: any) {
            console.error("[useEventEngagement] Copy link failed:", err);
            toast.error("Failed to copy event link.");
            return false;
        }
    }, [cleanId, toast]);

    // User-triggered internal Orbix share to peer(s)
    const shareEventInternally = useCallback(
        async (
            recipientUserIds: string | string[],
            note?: string
        ): Promise<InternalShareResponse> => {
            if (!cleanId) return { success: false, deliveredCount: 0, error: "Missing event identifier" };

            const targetList = Array.isArray(recipientUserIds)
                ? recipientUserIds.filter(Boolean)
                : (recipientUserIds ? [recipientUserIds] : []);

            if (targetList.length === 0) {
                return { success: false, deliveredCount: 0, error: "Please select at least one recipient" };
            }

            if (!isAuthenticated || !user) {
                toast.info("Please sign in to share events with peers.", { title: "Authentication Required" });
                return { success: false, deliveredCount: 0, error: "Authentication required" };
            }

            if (user?.accountType === "club") {
                return { success: false, deliveredCount: 0, error: "Club accounts are restricted to external sharing only" };
            }

            const idempotencyKey = `int-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

            try {
                const token = typeof window !== "undefined" ? localStorage.getItem("orbix_token") : null;
                const headers: Record<string, string> = { "Content-Type": "application/json" };
                if (token) headers["Authorization"] = `Bearer ${token}`;

                const res = await fetch(`/api/events/${encodeURIComponent(cleanId)}/shares`, {
                    method: "POST",
                    headers,
                    credentials: "include",
                    body: JSON.stringify({
                        idempotencyKey,
                        shareType: "internal",
                        platform: "orbix_peer",
                        recipientUserIds: targetList,
                        note: note || undefined,
                    }),
                });

                if (!res.ok) {
                    const errData = await res.json().catch(() => null);
                    throw new Error(errData?.message || "Failed to share event internally.");
                }

                const data = await res.json();
                const serverCount = data?.sharesCount !== undefined ? Number(data.sharesCount) : shareCount;
                const deliveredCount = Number(data?.data?.successfulDeliveries ?? targetList.length);
                const publicCountIncremented = Boolean(
                    data?.publicCountIncremented ?? data?.data?.publicCountIncremented
                );

                setShareCount(serverCount);
                notifyListeners(cleanId, { likeCount, likedByViewer, shareCount: serverCount });

                return { success: true, deliveredCount, sharesCount: serverCount, publicCountIncremented };
            } catch (err: any) {
                console.error("[useEventEngagement] Internal share failed:", err);
                return { success: false, deliveredCount: 0, error: err.message || "Failed to share event with peer." };
            }
        },
        [cleanId, isAuthenticated, user, shareCount, likeCount, likedByViewer, toast]
    );

    return {
        likeCount,
        likedByViewer,
        shareCount,
        loading,
        isLiking,
        isSharing,
        toggleLike,
        shareEvent,
        copyEventLink,
        shareEventInternally,
    };
}
