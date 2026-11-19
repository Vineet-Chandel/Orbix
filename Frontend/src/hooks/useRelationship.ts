// Frontend/src/hooks/useRelationship.ts
import { useState, useEffect, useCallback, useRef } from "react";
import {
    fetchRelationshipState,
    sendConnectionRequest,
    acceptConnectionRequest,
    declineConnectionRequest,
    cancelConnectionRequest,
    removeActiveConnection,
    blockTargetUser,
    unblockTargetUser,
    type RelationshipState,
    type RelationshipStatePayload,
} from "../api/relationshipApi";
import { useToast } from "../context/ToastContext";

export interface UseRelationshipReturn {
    state: RelationshipState;
    loading: boolean;
    mutating: boolean;
    error: string | null;
    relationshipData: RelationshipStatePayload | null;
    request: () => Promise<boolean>;
    accept: () => Promise<boolean>;
    decline: () => Promise<boolean>;
    cancel: () => Promise<boolean>;
    remove: () => Promise<boolean>;
    block: (reason?: string) => Promise<boolean>;
    unblock: () => Promise<boolean>;
    refresh: () => Promise<void>;
}

export function useRelationship(
    targetUserId: string | null | undefined,
    initialState?: RelationshipState,
    initialPayload?: RelationshipStatePayload | null
): UseRelationshipReturn {
    const toast = useToast();
    const [state, setState] = useState<RelationshipState>(initialState || "none");
    const [loading, setLoading] = useState<boolean>(!initialState && !!targetUserId);
    const [mutating, setMutating] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [relationshipData, setRelationshipData] = useState<RelationshipStatePayload | null>(initialPayload || null);

    const isMountedRef = useRef(true);
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    // Synchronize if parent supplies or updates initial state
    useEffect(() => {
        if (initialState) {
            setState(initialState);
            setLoading(false);
        }
        if (initialPayload) {
            setRelationshipData(initialPayload);
        }
    }, [initialState, initialPayload]);

    // Load authoritative state from server
    const loadState = useCallback(async () => {
        if (!targetUserId) return;
        setLoading(true);
        setError(null);
        try {
            const data = await fetchRelationshipState(targetUserId);
            if (isMountedRef.current) {
                setState(data.state);
                setRelationshipData(data);
            }
        } catch (err: any) {
            if (isMountedRef.current) {
                setError(err.message || "Failed to load relationship state");
            }
        } finally {
            if (isMountedRef.current) {
                setLoading(false);
            }
        }
    }, [targetUserId]);

    // Initial load when targetUserId changes - ONLY when initialState is NOT pre-provided
    useEffect(() => {
        if (targetUserId && !initialState) {
            loadState();
        }
    }, [targetUserId, initialState, loadState]);

    // Listen for broadcast events from other components/views
    useEffect(() => {
        if (!targetUserId || typeof window === "undefined") return;

        const handleSync = (e: Event) => {
            const customEvent = e as CustomEvent<{ targetUserId: string; state: RelationshipState }>;
            if (
                customEvent.detail &&
                customEvent.detail.targetUserId &&
                (customEvent.detail.targetUserId === targetUserId ||
                    customEvent.detail.targetUserId.toLowerCase() === targetUserId.toLowerCase())
            ) {
                setState(customEvent.detail.state);
            }
        };

        window.addEventListener("orbix_relationship_changed", handleSync);
        return () => {
            window.removeEventListener("orbix_relationship_changed", handleSync);
        };
    }, [targetUserId]);

    // Action: Request Connection
    const request = useCallback(async (): Promise<boolean> => {
        if (!targetUserId || mutating) return false;
        const prevState = state;
        setState("outgoing_pending");
        setMutating(true);
        try {
            const res = await sendConnectionRequest(targetUserId);
            if (res.success) {
                setState(res.state);
                toast.success(res.message || "Connection request sent!");
                return true;
            } else {
                setState(prevState);
                toast.error(res.message || "Could not send connection request.");
                return false;
            }
        } catch (err: any) {
            setState(prevState);
            toast.error(err.message || "Network error sending request.");
            return false;
        } finally {
            setMutating(false);
        }
    }, [targetUserId, mutating, state, toast]);

    // Action: Accept Connection
    const accept = useCallback(async (): Promise<boolean> => {
        if (!targetUserId || mutating) return false;
        const prevState = state;
        setState("connected");
        setMutating(true);
        try {
            const res = await acceptConnectionRequest(targetUserId);
            if (res.success) {
                setState(res.state);
                toast.success(res.message || "Connection accepted!");
                return true;
            } else {
                setState(prevState);
                toast.error(res.message || "Could not accept connection.");
                return false;
            }
        } catch (err: any) {
            setState(prevState);
            toast.error(err.message || "Network error accepting connection.");
            return false;
        } finally {
            setMutating(false);
        }
    }, [targetUserId, mutating, state, toast]);

    // Action: Decline Connection
    const decline = useCallback(async (): Promise<boolean> => {
        if (!targetUserId || mutating) return false;
        const prevState = state;
        setState("none");
        setMutating(true);
        try {
            const res = await declineConnectionRequest(targetUserId);
            if (res.success) {
                setState(res.state);
                toast.info("Connection request declined.");
                return true;
            } else {
                setState(prevState);
                toast.error(res.message || "Could not decline request.");
                return false;
            }
        } catch (err: any) {
            setState(prevState);
            toast.error(err.message || "Network error declining request.");
            return false;
        } finally {
            setMutating(false);
        }
    }, [targetUserId, mutating, state, toast]);

    // Action: Cancel Outgoing Request
    const cancel = useCallback(async (): Promise<boolean> => {
        if (!targetUserId || mutating) return false;
        const prevState = state;
        setState("none");
        setMutating(true);
        try {
            const res = await cancelConnectionRequest(targetUserId);
            if (res.success) {
                setState(res.state);
                toast.info("Connection request withdrawn.");
                return true;
            } else {
                setState(prevState);
                toast.error(res.message || "Could not cancel request.");
                return false;
            }
        } catch (err: any) {
            setState(prevState);
            toast.error(err.message || "Network error cancelling request.");
            return false;
        } finally {
            setMutating(false);
        }
    }, [targetUserId, mutating, state, toast]);

    // Action: Remove Connection
    const remove = useCallback(async (): Promise<boolean> => {
        if (!targetUserId || mutating) return false;
        const prevState = state;
        setState("none");
        setMutating(true);
        try {
            const res = await removeActiveConnection(targetUserId);
            if (res.success) {
                setState(res.state);
                toast.info("Connection removed.");
                return true;
            } else {
                setState(prevState);
                toast.error(res.message || "Could not remove connection.");
                return false;
            }
        } catch (err: any) {
            setState(prevState);
            toast.error(err.message || "Network error removing connection.");
            return false;
        } finally {
            setMutating(false);
        }
    }, [targetUserId, mutating, state, toast]);

    // Action: Block User
    const block = useCallback(async (reason?: string): Promise<boolean> => {
        if (!targetUserId || mutating) return false;
        const prevState = state;
        setState("blocked_by_me");
        setMutating(true);
        try {
            const res = await blockTargetUser(targetUserId, reason);
            if (res.success) {
                toast.info("User blocked.");
                return true;
            } else {
                setState(prevState);
                toast.error(res.message || "Could not block user.");
                return false;
            }
        } catch (err: any) {
            setState(prevState);
            toast.error(err.message || "Network error blocking user.");
            return false;
        } finally {
            setMutating(false);
        }
    }, [targetUserId, mutating, state, toast]);

    // Action: Unblock User
    const unblock = useCallback(async (): Promise<boolean> => {
        if (!targetUserId || mutating) return false;
        const prevState = state;
        setState("none");
        setMutating(true);
        try {
            const res = await unblockTargetUser(targetUserId);
            if (res.success) {
                toast.success("User unblocked.");
                return true;
            } else {
                setState(prevState);
                toast.error(res.message || "Could not unblock user.");
                return false;
            }
        } catch (err: any) {
            setState(prevState);
            toast.error(err.message || "Network error unblocking user.");
            return false;
        } finally {
            setMutating(false);
        }
    }, [targetUserId, mutating, state, toast]);

    return {
        state,
        loading,
        mutating,
        error,
        relationshipData,
        request,
        accept,
        decline,
        cancel,
        remove,
        block,
        unblock,
        refresh: loadState,
    };
}
