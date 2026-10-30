import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAppSelector } from "../../../store";
import { useToast } from "../../../context/ToastContext";

export interface BlogLikesState {
    likeCount: number;
    likedByViewer: boolean;
    loading: boolean;
    isToggling: boolean;
    toggleLike: () => Promise<void>;
}

// In-memory cache to share like state across chapter navigation and components
const publicationStateCache = new Map<string, { likeCount: number; likedByViewer: boolean; timestamp: number }>();
const stateListeners = new Map<string, Set<(state: { likeCount: number; likedByViewer: boolean }) => void>>();

function getCacheKey(hoster: string, blogName: string): string {
    return `${String(hoster || "").trim().toLowerCase()}::${String(blogName || "").trim().toLowerCase()}`;
}

function notifyListeners(key: string, state: { likeCount: number; likedByViewer: boolean }) {
    publicationStateCache.set(key, { ...state, timestamp: Date.now() });
    const listeners = stateListeners.get(key);
    if (listeners) {
        listeners.forEach((listener) => listener(state));
    }
}

export function useBlogLikes(hoster: string, blogName: string): BlogLikesState {
    const navigate = useNavigate();
    const toast = useToast();
    const { user, isAuthenticated } = useAppSelector((state) => state.user);

    const cleanHoster = String(hoster || "").trim().toLowerCase();
    const cleanBlogName = String(blogName || "").trim().toLowerCase();
    const cacheKey = getCacheKey(cleanHoster, cleanBlogName);

    const cached = publicationStateCache.get(cacheKey);

    const [likeCount, setLikeCount] = useState<number>(cached ? cached.likeCount : 0);
    const [likedByViewer, setLikedByViewer] = useState<boolean>(cached ? cached.likedByViewer : false);
    const [loading, setLoading] = useState<boolean>(!cached);
    const [isToggling, setIsToggling] = useState<boolean>(false);

    const isTogglingRef = useRef(false);
    const hasProcessedPendingRef = useRef(false);

    // Keep state in sync across multiple mounted components (e.g. Card and Header)
    useEffect(() => {
        if (!stateListeners.has(cacheKey)) {
            stateListeners.set(cacheKey, new Set());
        }
        const setForKey = stateListeners.get(cacheKey)!;
        const updateListener = (newState: { likeCount: number; likedByViewer: boolean }) => {
            setLikeCount(newState.likeCount);
            setLikedByViewer(newState.likedByViewer);
        };
        setForKey.add(updateListener);

        return () => {
            setForKey.delete(updateListener);
            if (setForKey.size === 0) {
                stateListeners.delete(cacheKey);
            }
        };
    }, [cacheKey]);

    // Fetch authoritative like information from backend
    const fetchLikes = useCallback(async () => {
        if (!cleanHoster || !cleanBlogName) return;

        try {
            const token = typeof window !== "undefined" ? localStorage.getItem("orbix_token") : null;
            const headers: Record<string, string> = {
                "Content-Type": "application/json",
            };
            if (token) {
                headers["Authorization"] = `Bearer ${token}`;
            }

            const response = await fetch(`/api/blogs/${encodeURIComponent(cleanHoster)}/${encodeURIComponent(cleanBlogName)}/likes`, {
                method: "GET",
                headers,
                credentials: "include",
            });

            if (response.ok) {
                const data = await response.json();
                if (data?.data) {
                    // Do not allow an in-flight mutation to be overwritten by a stale background GET
                    if (isTogglingRef.current) return;

                    const authoritativeLiked =
                        data.data.likedByViewer !== undefined
                            ? Boolean(data.data.likedByViewer)
                            : Boolean(data.data.liked);

                    const freshState = {
                        likeCount: Number(data.data.likeCount) || 0,
                        likedByViewer: authoritativeLiked,
                    };
                    setLikeCount(freshState.likeCount);
                    setLikedByViewer(freshState.likedByViewer);
                    publicationStateCache.set(cacheKey, { ...freshState, timestamp: Date.now() });
                    notifyListeners(cacheKey, freshState);
                }
            }
        } catch (err) {
            console.warn("[useBlogLikes] Failed to fetch publication likes:", err);
        } finally {
            setLoading(false);
        }
    }, [cleanHoster, cleanBlogName, cacheKey]);

    useEffect(() => {
        fetchLikes();
    }, [fetchLikes, isAuthenticated]);

    // Core Like Mutation Execution
    const executeLikeMutation = useCallback(
        async (shouldLike: boolean) => {
            if (isTogglingRef.current) return;
            isTogglingRef.current = true;
            setIsToggling(true);

            // Optimistic update
            const previousLiked = likedByViewer;
            const previousCount = likeCount;

            const nextLiked = shouldLike;
            const nextCount = shouldLike ? previousCount + 1 : Math.max(0, previousCount - 1);

            setLikedByViewer(nextLiked);
            setLikeCount(nextCount);
            notifyListeners(cacheKey, { likeCount: nextCount, likedByViewer: nextLiked });

            try {
                const token = typeof window !== "undefined" ? localStorage.getItem("orbix_token") : null;
                const headers: Record<string, string> = {
                    "Content-Type": "application/json",
                };
                if (token) {
                    headers["Authorization"] = `Bearer ${token}`;
                }

                const endpoint = `/api/blogs/${encodeURIComponent(cleanHoster)}/${encodeURIComponent(cleanBlogName)}/likes`;
                const method = shouldLike ? "POST" : "DELETE";

                const response = await fetch(endpoint, {
                    method,
                    headers,
                    credentials: "include",
                });

                if (!response.ok) {
                    if (response.status === 401) {
                        throw new Error("Authentication required to like blogs.");
                    }
                    const errorData = await response.json().catch(() => null);
                    throw new Error(errorData?.message || "Failed to update like status.");
                }

                const result = await response.json();
                if (result?.data) {
                    const authoritativeLiked =
                        result.data.likedByViewer !== undefined
                            ? Boolean(result.data.likedByViewer)
                            : result.data.liked !== undefined
                            ? Boolean(result.data.liked)
                            : shouldLike;

                    const serverState = {
                        likeCount: Number(result.data.likeCount) || 0,
                        likedByViewer: authoritativeLiked,
                    };
                    setLikeCount(serverState.likeCount);
                    setLikedByViewer(serverState.likedByViewer);
                    notifyListeners(cacheKey, serverState);
                }
            } catch (err: any) {
                // Rollback on failure
                console.error("[useBlogLikes] Like toggle failed, rolling back:", err);
                setLikedByViewer(previousLiked);
                setLikeCount(previousCount);
                notifyListeners(cacheKey, { likeCount: previousCount, likedByViewer: previousLiked });
                toast.error(err.message || "Failed to update like. Please try again.");
            } finally {
                isTogglingRef.current = false;
                setIsToggling(false);
            }
        },
        [likedByViewer, likeCount, cacheKey, cleanHoster, cleanBlogName, toast]
    );

    // Auto-execute pending like action after returning from successful login
    useEffect(() => {
        if (!isAuthenticated || !user || hasProcessedPendingRef.current) return;

        try {
            const rawPending = sessionStorage.getItem("orbix_pending_like");
            if (!rawPending) return;

            const pending = JSON.parse(rawPending);
            const isMatch =
                pending?.hoster?.toLowerCase() === cleanHoster &&
                pending?.blogName?.toLowerCase() === cleanBlogName;

            const isFresh = pending?.timestamp && Date.now() - pending.timestamp < 5 * 60 * 1000; // 5 min validity

            if (isMatch && isFresh) {
                hasProcessedPendingRef.current = true;
                // Delete immediately from sessionStorage to guarantee exactly-once execution
                sessionStorage.removeItem("orbix_pending_like");
                toast.success("Welcome back! Adding your like...", { title: "Signed In" });
                executeLikeMutation(true);
            }
        } catch (err) {
            console.warn("[useBlogLikes] Could not parse pending like action:", err);
            sessionStorage.removeItem("orbix_pending_like");
        }
    }, [isAuthenticated, user, cleanHoster, cleanBlogName, executeLikeMutation, toast]);

    // User-triggered toggle click handler
    const toggleLike = useCallback(async () => {
        if (isTogglingRef.current) return;

        // Guest user interaction: preserve intent and redirect to sign in
        if (!isAuthenticated || !user) {
            try {
                const currentPath = window.location.pathname + window.location.search;
                sessionStorage.setItem(
                    "orbix_pending_like",
                    JSON.stringify({
                        hoster: cleanHoster,
                        blogName: cleanBlogName,
                        returnUrl: currentPath,
                        timestamp: Date.now(),
                    })
                );
            } catch {
                // Ignore storage quota errors
            }
            toast.info("Please sign in to like this publication.", { title: "Authentication Required" });
            navigate(`/auth/signin?returnUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`);
            return;
        }

        // Authenticated user interaction: toggle state
        await executeLikeMutation(!likedByViewer);
    }, [isAuthenticated, user, cleanHoster, cleanBlogName, likedByViewer, executeLikeMutation, navigate, toast]);

    return {
        likeCount,
        likedByViewer,
        loading,
        isToggling,
        toggleLike,
    };
}

