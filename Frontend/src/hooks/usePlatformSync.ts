import { useState, useEffect, useCallback, useRef } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "../store";
import { useToast } from "../context/ToastContext";
import { PORTALS } from "../utils/portalParser";

export interface ResyncResultItem {
    portal: string;
    username: string;
    status: "valid" | "broken" | "error";
    verified: boolean;
    message?: string;
    profileData?: any;
    lastSyncAt: string;
}

export interface UsePlatformSyncReturn {
    isSyncing: boolean;
    lastSyncTime: string | null;
    summary: { total: number; valid: number; broken: number; error: number } | null;
    brokenPortals: string[];
    resyncAll: (options?: { silent?: boolean; force?: boolean }) => Promise<void>;
}

export function usePlatformSync(): UsePlatformSyncReturn {
    const user = useSelector((state: RootState) => state.user.user);
    const toast = useToast();

    const [isSyncing, setIsSyncing] = useState<boolean>(false);
    const [lastSyncTime, setLastSyncTime] = useState<string | null>(() => {
        try {
            return localStorage.getItem("orbix_last_sync_time") || null;
        } catch {
            return null;
        }
    });
    const [summary, setSummary] = useState<{
        total: number;
        valid: number;
        broken: number;
        error: number;
    } | null>(null);
    const [brokenPortals, setBrokenPortals] = useState<string[]>([]);

    const hasRunInitialSyncRef = useRef<boolean>(false);

    const resyncAll = useCallback(
        async (options: { silent?: boolean; force?: boolean } = {}) => {
            const { silent = false } = options;

            // 1. Get current stored portals
            let currentPortals: Record<string, any> = {};
            try {
                const raw = localStorage.getItem("orbix_connected_portals");
                if (raw) currentPortals = JSON.parse(raw);
            } catch {
                currentPortals = {};
            }

            const portalKeys = Object.keys(currentPortals);
            if (portalKeys.length === 0) {
                return;
            }

            setIsSyncing(true);

            // Prepare list for re-verification
            const portalsPayload = portalKeys.map((k) => ({
                portal: currentPortals[k]?.portal || k,
                username: currentPortals[k]?.username,
            })).filter((p) => p.portal && p.username);

            const userIdentifier = user?.username || user?.gmail || "";
            const token = (() => {
                try {
                    return localStorage.getItem("orbix_token") || "";
                } catch {
                    return "";
                }
            })();

            const endpoints = [
                "/api/portals/resync",
                "http://localhost:3000/api/portals/resync",
            ];

            let resData: any = null;

            for (const url of endpoints) {
                try {
                    const headers: Record<string, string> = {
                        "Content-Type": "application/json",
                    };
                    if (token) {
                        headers["Authorization"] = `Bearer ${token}`;
                    }

                    const res = await fetch(url, {
                        method: "POST",
                        headers,
                        credentials: "include",
                        body: JSON.stringify({
                            username: userIdentifier,
                            portals: portalsPayload,
                        }),
                    });

                    if (res.ok) {
                        resData = await res.json();
                        if (resData && resData.success) {
                            break;
                        }
                    }
                } catch {
                    // Try next endpoint fallback
                    continue;
                }
            }

            if (!resData || !Array.isArray(resData.results)) {
                setIsSyncing(false);
                if (!silent) {
                    toast.error("Could not complete platform health sync. Will retry shortly.", {
                        title: "Re-Sync Incomplete",
                    });
                }
                return;
            }

            const results: ResyncResultItem[] = resData.results;
            const updatedPortals = { ...currentPortals };
            const detectedBroken: string[] = [];

            for (const r of results) {
                const key = r.portal.toLowerCase();
                if (!updatedPortals[key]) continue;

                if (r.status === "broken") {
                    detectedBroken.push(r.portal);
                    updatedPortals[key] = {
                        ...updatedPortals[key],
                        verified: false,
                        syncStatus: "broken",
                        syncError: r.message || `Account '@${r.username}' no longer exists on ${PORTALS[key]?.name || key}`,
                        lastSyncAt: r.lastSyncAt,
                    };
                } else if (r.status === "valid") {
                    updatedPortals[key] = {
                        ...updatedPortals[key],
                        ...(r.profileData || {}),
                        username: r.username,
                        verified: true,
                        syncStatus: "valid",
                        syncError: undefined,
                        lastSyncAt: r.lastSyncAt,
                    };
                } else {
                    // error
                    updatedPortals[key] = {
                        ...updatedPortals[key],
                        syncStatus: "error",
                        syncError: r.message || "Temporary API issue",
                        lastSyncAt: r.lastSyncAt,
                    };
                }
            }

            // Persist back to local storage
            try {
                localStorage.setItem("orbix_connected_portals", JSON.stringify(updatedPortals));
                const nowTime = new Date().toISOString();
                localStorage.setItem("orbix_last_sync_time", nowTime);
                setLastSyncTime(nowTime);

                // Broadcast change
                window.dispatchEvent(new Event("orbix_portals_updated"));
                window.dispatchEvent(new Event("storage"));
            } catch (err) {
                console.error("Failed to store resynced portals:", err);
            }

            setSummary(resData.summary || null);
            setBrokenPortals(detectedBroken);
            setIsSyncing(false);

            // User notifications
            if (detectedBroken.length > 0) {
                const brokenNames = detectedBroken
                    .map((p) => PORTALS[p.toLowerCase()]?.name || p)
                    .join(", ");
                toast.warning(
                    `Connection broken for: ${brokenNames}. The username may have changed. Please reconnect.`,
                    {
                        title: "Platform Broken",
                        duration: 8000,
                    }
                );
            } else if (!silent) {
                toast.success("All connected platform accounts are active and verified!", {
                    title: "Platform Sync Complete",
                    duration: 3500,
                });
            }
        },
        [user, toast]
    );

    // Run automatically once on mount if authenticated or portals exist
    useEffect(() => {
        if (hasRunInitialSyncRef.current) return;
        hasRunInitialSyncRef.current = true;

        // Small delay to ensure smooth initial dashboard page render first
        const timer = setTimeout(() => {
            resyncAll({ silent: true });
        }, 800);

        return () => clearTimeout(timer);
    }, [resyncAll]);

    return {
        isSyncing,
        lastSyncTime,
        summary,
        brokenPortals,
        resyncAll,
    };
}
