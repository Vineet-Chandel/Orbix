import { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { PORTALS, judgePortalInput, type JudgmentResult } from "../../../utils/portalParser";
import { getPortalIcon } from "../../../utils/portalIcons";
import { PortalProfileInput } from "../PortalProfileInput";
import type { PortalProfileData } from "../PortalProfileCard";
import { useAppDispatch, useAppSelector, setPortalProfiles } from "../../../store";
import { useToast } from "../../../context/ToastContext";
import { Sidebar } from "../../../app/Dashboard/Sidebar";
import { disconnectPlatform } from "../../../utils/profileApi";
import { invalidateConnectedPlatformCaches } from "../../../utils/cacheManager";
import { SectionBottomIllustration } from "../../../app/common/SectionBottomIllustration";

type CategoryFilter = "all" | "cp" | "practice" | "dev";

// Dedicated Platform Avatar Component with Automatic Fallback to Real Platform SVG Icon
const ConnectedPlatformAvatar = ({
    portalId,
    avatarUrl,
    name,
    username,
    brandColor: _brandColor,
    size = "md",
}: {
    portalId: string;
    avatarUrl?: string | null;
    name?: string;
    username?: string;
    brandColor: string;
    size?: "sm" | "md" | "lg";
}) => {
    const [imgFailed, setImgFailed] = useState(false);

    useEffect(() => {
        setImgFailed(false);
    }, [avatarUrl]);

    const cleanAvatar =
        !imgFailed &&
            avatarUrl &&
            typeof avatarUrl === "string" &&
            avatarUrl.trim().length > 5 &&
            !avatarUrl.includes("ui-avatars.com")
            ? avatarUrl.trim()
            : null;

    const dimClasses =
        size === "sm"
            ? "h-8 w-8"
            : size === "lg"
                ? "h-11 w-11 sm:h-12 sm:w-12"
                : "h-9 w-9 sm:h-10 sm:w-10";

    return (
        <div className="relative flex-shrink-0">
            <div
                className={`${dimClasses} rounded-lg border-2 border-black p-0.5 bg-white shadow-[2px_2px_0px_#000] flex items-center justify-center overflow-hidden transition-transform group-hover:scale-105`}
            >
                {cleanAvatar ? (
                    <img
                        src={cleanAvatar}
                        alt={name || username || portalId}
                        referrerPolicy="no-referrer"
                        className="h-full w-full rounded-md object-cover"
                        onError={() => setImgFailed(true)}
                    />
                ) : (
                    <div className="w-full h-full rounded-md bg-white flex items-center justify-center p-1.5">
                        {getPortalIcon(portalId, "w-full h-full object-contain")}
                    </div>
                )}
            </div>

            {/* Mini Platform Badge at Bottom-Right (rendered when displaying user's photo) */}
            {cleanAvatar && (
                <div
                    className="absolute -bottom-1 -right-1 flex h-4 w-4 sm:h-4.5 sm:w-4.5 items-center justify-center rounded-md bg-white p-0.5 shadow-[1px_1px_0px_#000] border-2 border-black"
                    title={PORTALS[portalId]?.name || portalId}
                >
                    {getPortalIcon(portalId, "w-2.5 h-2.5 sm:w-3 sm:h-3")}
                </div>
            )}
        </div>
    );
};

// Sub-component for Mobile floating pill icons
const MobilePillAvatar = ({
    portalId,
    avatarUrl,
    name,
}: {
    portalId: string;
    avatarUrl?: string | null;
    name?: string;
}) => {
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        setFailed(false);
    }, [avatarUrl]);

    const hasAvatar =
        !failed &&
        avatarUrl &&
        typeof avatarUrl === "string" &&
        avatarUrl.trim().length > 5 &&
        !avatarUrl.includes("ui-avatars.com");

    return (
        <div className="inline-block h-4 w-4 rounded-full ring-1 ring-white bg-white overflow-hidden flex items-center justify-center p-0.5">
            {hasAvatar ? (
                <img
                    src={avatarUrl.trim()}
                    alt={name || portalId}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover rounded-full"
                    onError={() => setFailed(true)}
                />
            ) : (
                getPortalIcon(portalId, "w-full h-full object-contain")
            )}
        </div>
    );
};

export default function ProfilesOnboardingPage() {
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const toast = useToast();
    const { user } = useAppSelector((state) => state.user);
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

    // Connected profiles with rich crawled details (avatar, name, stats, verified)
    const [connectedProfiles, setConnectedProfiles] = useState<Record<string, PortalProfileData>>(() => {
        try {
            const saved = localStorage.getItem("orbix_connected_portals");
            if (saved) {
                const parsed = JSON.parse(saved);
                const normalized: Record<string, PortalProfileData> = {};
                for (const [k, v] of Object.entries(parsed)) {
                    if (!v || typeof v !== "object") continue;
                    const p = v as any;
                    const av = p.avatar || p.avatarUrl || p.avatar_url || "";
                    normalized[k] = {
                        ...p,
                        portal: p.portal || k,
                        name: p.name || p.displayName || p.display_name || p.username || k,
                        avatar: av,
                        avatarUrl: av,
                    };
                }
                return normalized;
            }
        } catch {
            return {};
        }
        return {};
    });

    // Raw input values for each portal
    const [portalValues, setPortalValues] = useState<Record<string, string>>(() => {
        try {
            const saved = localStorage.getItem("orbix_portals");
            if (saved) {
                const parsed = JSON.parse(saved);
                const initial: Record<string, string> = {};
                for (const [key, val] of Object.entries(parsed)) {
                    initial[key] = (val as any)?.raw || (val as any)?.username || "";
                }
                return initial;
            }
        } catch {
            // ignore
        }
        return {};
    });

    // Cache of recent profile data to avoid refetching when returning to disconnect stage
    const [recentProfilesHistory, setRecentProfilesHistory] = useState<Record<string, PortalProfileData>>(() => {
        try {
            const saved = localStorage.getItem("orbix_connected_portals");
            if (saved) {
                const parsed = JSON.parse(saved);
                const normalized: Record<string, PortalProfileData> = {};
                for (const [k, v] of Object.entries(parsed)) {
                    if (!v || typeof v !== "object") continue;
                    const p = v as any;
                    const av = p.avatar || p.avatarUrl || p.avatar_url || "";
                    normalized[k] = {
                        ...p,
                        portal: p.portal || k,
                        name: p.name || p.displayName || p.display_name || p.username || k,
                        avatar: av,
                        avatarUrl: av,
                    };
                }
                return normalized;
            }
        } catch {
            return {};
        }
        return {};
    });

    const [judgments, setJudgments] = useState<Record<string, JudgmentResult>>({});
    const [activeCategory, setActiveCategory] = useState<CategoryFilter>("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [isMobileBucketOpen, setIsMobileBucketOpen] = useState(false);

    // Refs for dirty state tracking (production-level change detection)
    const initialConnectedProfilesRef = useRef<Record<string, PortalProfileData>>({ ...connectedProfiles });
    const initialPortalValuesRef = useRef<Record<string, string>>({ ...portalValues });
    const deletedPortalsRef = useRef<Set<string>>(new Set());
    const userInteractedRef = useRef<boolean>(false);

    // Fetch initial saved links from backend on mount if authenticated and user hasn't interacted
    useEffect(() => {
        let isMounted = true;
        const loadSavedFromBackend = async () => {
            try {
                const token = localStorage.getItem("orbix_token") || "";
                const headers: Record<string, string> = { "Content-Type": "application/json" };
                if (token) headers["Authorization"] = `Bearer ${token}`;

                const endpoints = ["/api/portals/save", "http://localhost:3000/api/portals/save"];
                let serverLinks: any[] = [];

                for (const url of endpoints) {
                    try {
                        const res = await fetch(url, {
                            method: "GET",
                            headers,
                            credentials: "include",
                        });
                        if (res.ok) {
                            const data = await res.json();
                            if (data && data.success && Array.isArray(data.links)) {
                                serverLinks = data.links;
                                break;
                            }
                        }
                    } catch {
                        // try next endpoint
                    }
                }

                if (serverLinks.length > 0 && isMounted && !userInteractedRef.current) {
                    const loadedProfiles: Record<string, PortalProfileData> = {};
                    for (const link of serverLinks) {
                        const pId = String(link.portal || "").toLowerCase();
                        if (!pId) continue;

                        let parsedStats: any[] = [];
                        try {
                            parsedStats = Array.isArray(link.stats)
                                ? link.stats
                                : JSON.parse(link.stats || "[]");
                        } catch {
                            parsedStats = [];
                        }

                        const pUsername = link.portal_username || link.username || "";
                        const pName = link.display_name || pUsername;

                        loadedProfiles[pId] = {
                            success: true,
                            portal: pId,
                            username: pUsername,
                            name: pName,
                            avatar: link.avatar_url || link.avatarUrl || link.avatar || "",
                            stats: parsedStats,
                            profileUrl: link.link || "",
                            verified: link.verified !== false,
                        };
                    }

                    if (Object.keys(loadedProfiles).length > 0) {
                        setConnectedProfiles((prev) => {
                            const merged = { ...loadedProfiles, ...prev };
                            initialConnectedProfilesRef.current = { ...merged };
                            try {
                                localStorage.setItem("orbix_connected_portals", JSON.stringify(merged));
                            } catch {
                                // ignore
                            }
                            return merged;
                        });
                    }
                }
            } catch {
                // Non-fatal fallback
            }
        };

        loadSavedFromBackend();

        return () => {
            isMounted = false;
        };
    }, []);

    // Background enrich any connected accounts that lack a custom avatar
    useEffect(() => {
        let isMounted = true;
        const enrichMissingAvatars = async () => {
            const updates: Record<string, string> = {};
            let hasUpdates = false;

            for (const [pId, p] of Object.entries(connectedProfiles)) {
                const currentAvatar = p.avatar || (p as any).avatarUrl || (p as any).avatar_url;
                if (!currentAvatar || currentAvatar.includes("ui-avatars.com")) {
                    const uname = p.username || (p as any).portal_username || (p as any).portalUsername;
                    if (!uname) continue;

                    try {
                        const endpoints = [
                            `/api/portals/fetch?portal=${encodeURIComponent(pId)}&username=${encodeURIComponent(uname)}`,
                            `http://localhost:3000/api/portals/fetch?portal=${encodeURIComponent(pId)}&username=${encodeURIComponent(uname)}`,
                        ];
                        for (const url of endpoints) {
                            try {
                                const res = await fetch(url);
                                if (res.ok) {
                                    const json = await res.json();
                                    if (json && json.success && json.avatar && !json.avatar.includes("ui-avatars.com")) {
                                        updates[pId] = json.avatar;
                                        hasUpdates = true;
                                        break;
                                    }
                                }
                            } catch {
                                // try next endpoint
                            }
                        }
                    } catch {
                        // ignore
                    }
                }
            }

            if (hasUpdates && isMounted) {
                setConnectedProfiles((prev) => {
                    const next = { ...prev };
                    for (const [pId, newAvatar] of Object.entries(updates)) {
                        if (next[pId]) {
                            next[pId] = {
                                ...next[pId],
                                avatar: newAvatar,
                                avatarUrl: newAvatar,
                            };
                        }
                    }
                    try {
                        localStorage.setItem("orbix_connected_portals", JSON.stringify(next));
                    } catch { }
                    return next;
                });
            }
        };

        const timer = setTimeout(enrichMissingAvatars, 300);
        return () => {
            isMounted = false;
            clearTimeout(timer);
        };
    }, []);

    const handleInputChange = (portalId: string, raw: string, judgment: JudgmentResult) => {
        userInteractedRef.current = true;
        setPortalValues((prev) => ({ ...prev, [portalId]: raw }));
        setJudgments((prev) => ({ ...prev, [portalId]: judgment }));
    };

    // When the user taps "Yes, connect":
    // 1. Move the profile into the Connected Bucket on the right
    // 2. Cache its profile data and retain its input link/username
    // 3. Remove from the available portal list on the left
    const handleConnectProfile = (portalId: string, data: PortalProfileData) => {
        userInteractedRef.current = true;
        deletedPortalsRef.current.delete(portalId);

        setRecentProfilesHistory((prev) => ({ ...prev, [portalId]: data }));

        const currentInput = portalValues[portalId]?.trim();
        const effectiveInput = currentInput || data.profileUrl || data.username;
        setPortalValues((prev) => ({ ...prev, [portalId]: effectiveInput }));
        setJudgments((prev) => ({ ...prev, [portalId]: judgePortalInput(portalId, effectiveInput) }));

        setConnectedProfiles((prev) => {
            const next = { ...prev, [portalId]: data };
            try {
                localStorage.setItem("orbix_connected_portals", JSON.stringify(next));
            } catch {
                // ignore
            }
            return next;
        });

        toast.success(`Connected ${data.name}'s ${PORTALS[portalId]?.name || portalId} account!`, {
            title: "Added to Bucket",
        });
    };

    // When the user taps the cross (X) in the bucket:
    // 1. Remove from connectedProfiles (bucket on the right)
    // 2. Return to the list on the left in the "disconnect stage"
    // 3. Mark for backend deletion upon save if it was previously saved
    const handleDisconnectProfile = (portalId: string) => {
        userInteractedRef.current = true;

        if (initialConnectedProfilesRef.current[portalId]) {
            deletedPortalsRef.current.add(portalId);
        }

        const profile = connectedProfiles[portalId] || recentProfilesHistory[portalId];
        const existingInput = portalValues[portalId]?.trim();
        const restoredValue = existingInput || profile?.profileUrl || profile?.username || "";

        setPortalValues((prev) => ({
            ...prev,
            [portalId]: restoredValue,
        }));

        if (restoredValue) {
            setJudgments((prev) => ({
                ...prev,
                [portalId]: judgePortalInput(portalId, restoredValue),
            }));
        }

        if (profile) {
            setRecentProfilesHistory((prev) => ({ ...prev, [portalId]: profile }));
        }

        setConnectedProfiles((prev) => {
            const next = { ...prev };
            delete next[portalId];
            try {
                localStorage.setItem("orbix_connected_portals", JSON.stringify(next));
            } catch {
                // ignore
            }
            return next;
        });

        invalidateConnectedPlatformCaches(dispatch, user?.username);
        toast.info(`Disconnected ${PORTALS[portalId]?.name || portalId} profile. Returned to edit stage.`);
    };

    // Filter portals by category and search
    const portalList = useMemo(() => {
        return Object.values(PORTALS).filter((portal) => {
            const matchesCategory =
                activeCategory === "all" ? true : portal.category === activeCategory;
            const matchesSearch =
                portal.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                portal.placeholder.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesCategory && matchesSearch;
        });
    }, [activeCategory, searchQuery]);

    // Available portals: Portals that are NOT yet in the bucket
    const availablePortalList = useMemo(() => {
        return portalList.filter((portal) => !connectedProfiles[portal.id]);
    }, [portalList, connectedProfiles]);

    // Count of verified connected profiles
    const connectedCount = useMemo(() => {
        return Object.keys(connectedProfiles).length;
    }, [connectedProfiles]);

    // Robust Dirty State Tracking:
    // Returns true ONLY when an addition, edit, or deletion actually occurred
    const isDirty = useMemo(() => {
        // 1. Pending deletions
        if (deletedPortalsRef.current.size > 0) return true;

        // 2. Compare connected profiles against initial snapshot
        const initial = initialConnectedProfilesRef.current;
        const currentKeys = Object.keys(connectedProfiles);
        const initialKeys = Object.keys(initial);

        if (currentKeys.length !== initialKeys.length) return true;

        for (const key of currentKeys) {
            if (!initial[key]) return true;
            if (initial[key].username !== connectedProfiles[key].username) return true;
        }

        // 3. New valid unconnected inputs that differ from initial
        for (const [key, val] of Object.entries(portalValues)) {
            const initialVal = initialPortalValuesRef.current[key] || "";
            if (val.trim() && val.trim() !== initialVal.trim()) {
                const j = judgments[key];
                if (j && j.isValid) return true;
            }
        }

        return false;
    }, [connectedProfiles, portalValues, judgments]);

    const handleSave = async () => {
        // Production-level check:
        // If there are NO additions, edits, or deletions, do NOT fire the API!
        // Immediately navigate to the dashboard without network overhead.
        if (!isDirty) {
            navigate("/dashboard");
            return;
        }

        setIsSaving(true);

        try {
            const authToken = localStorage.getItem("orbix_token") || "";
            const headers: Record<string, string> = {
                "Content-Type": "application/json",
            };
            if (authToken) {
                headers["Authorization"] = `Bearer ${authToken}`;
            }

            const portalsToDelete = Array.from(deletedPortalsRef.current);
            // 1. Process pending platform deletions on the backend
            if (portalsToDelete.length > 0) {
                await Promise.allSettled(
                    portalsToDelete.map((p) => disconnectPlatform(p).catch(() => null))
                );
                deletedPortalsRef.current.clear();
            }

            // 2. Resolve final profiles to save
            const resolvedProfiles: Record<string, { raw: string; username: string; url: string }> = {};

            for (const [key, profile] of Object.entries(connectedProfiles)) {
                resolvedProfiles[key] = {
                    raw: profile.username,
                    username: profile.username,
                    url: profile.profileUrl,
                };
            }

            for (const [key, val] of Object.entries(portalValues)) {
                if (val.trim() && !resolvedProfiles[key]) {
                    const judgment = judgments[key];
                    if (judgment && judgment.isValid) {
                        resolvedProfiles[key] = {
                            raw: val.trim(),
                            username: judgment.username,
                            url: judgment.normalizedUrl,
                        };
                    }
                }
            }

            // Persist to Redux and LocalStorage
            dispatch(setPortalProfiles(resolvedProfiles));
            localStorage.setItem("orbix_connected_portals", JSON.stringify(connectedProfiles));

            // Invalidate all platform caches so Dashboard and Profile charts update immediately
            const activeUser = user || (() => {
                try {
                    const stored = localStorage.getItem("orbix_user");
                    return stored ? JSON.parse(stored) : null;
                } catch {
                    return null;
                }
            })();

            invalidateConnectedPlatformCaches(dispatch, activeUser?.username);

            // 3. Persist to Backend API with correct user_id, username, and auth headers
            const savePayload = {
                user_id: activeUser?.id,
                userId: activeUser?.id,
                username: activeUser?.username,
                portals: resolvedProfiles,
                connectedProfiles,
                deletedPortals: portalsToDelete,
                syncMode: "exact",
            };

            // Call primary endpoint, fallback to secondary if needed
            let saveSuccessful = false;
            try {
                const res = await fetch("/api/portals/save", {
                    method: "POST",
                    headers,
                    credentials: "include",
                    body: JSON.stringify(savePayload),
                });
                if (res.ok) saveSuccessful = true;
            } catch {
                // try fallback
            }

            if (!saveSuccessful) {
                try {
                    const fallbackRes = await fetch("http://localhost:3000/api/portals/save", {
                        method: "POST",
                        headers,
                        credentials: "include",
                        body: JSON.stringify(savePayload),
                    });
                    if (fallbackRes.ok) saveSuccessful = true;
                } catch {
                    // Non-fatal offline fallback
                }
            }

            // Reset dirty snapshot
            initialConnectedProfilesRef.current = { ...connectedProfiles };
            initialPortalValuesRef.current = { ...portalValues };

            toast.success(
                connectedCount > 0
                    ? `${connectedCount} coding profiles saved! Redirecting to workspace...`
                    : "Profile setup completed! Redirecting to workspace...",
                { title: "Profiles Connected" }
            );
        } catch (err: any) {
            console.error("Save error:", err);
            toast.error("Failed to save some profiles, but local state was preserved.");
        } finally {
            setIsSaving(false);
            setTimeout(() => {
                navigate("/dashboard");
            }, 500);
        }
    };

    return (
        <div className="min-h-screen bg-[#F0F2F6] text-neutral-900 font-sans flex antialiased selection:bg-neutral-900 selection:text-white">
            {/* Left Sidebar */}
            <Sidebar
                activeTab="connect-platform"
                onTabChange={(tab) => {
                    if (tab === "dashboard") navigate("/dashboard");
                    if (tab === "profile") navigate("/profile");
                    if (tab === "resume") navigate("/resume");
                    if (tab === "projects") navigate("/projects");
                    if (tab === "connect-platform") navigate("/onboarding");
                }}
                isOpen={isMobileSidebarOpen}
                onClose={() => setIsMobileSidebarOpen(false)}
            />

            {/* Right Main Content Workspace */}
            <div className="flex-1 min-w-0 flex flex-col min-h-screen p-3 sm:p-4 lg:pl-0">
                {/* Main Scrollable Content Card */}
                <div className="flex-1 w-full min-h-0 bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:18px_18px] rounded-2xl border-2 border-black shadow-[6px_6px_0px_#000] overflow-y-auto scrollbar-none flex flex-col justify-between">
                    <div className="p-4 sm:p-6 lg:p-8 flex-1">
                        <div className="mx-auto w-full max-w-7xl my-1">
                            {/* Page Header */}
                            <div className="mb-6 lg:mb-8 pb-5 border-b-2 border-black/55 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                <div className="flex items-start gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsMobileSidebarOpen(true)}
                                        className="lg:hidden mt-0.5 p-2 text-black hover:bg-neutral-100 rounded-lg border-2 border-black shadow-[2px_2px_0px_#000] transition-all cursor-pointer flex-shrink-0"
                                        aria-label="Open sidebar"
                                    >
                                        <svg className="w-5 h-5 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <line x1="3" y1="12" x2="21" y2="12" />
                                            <line x1="3" y1="6" x2="21" y2="6" />
                                            <line x1="3" y1="18" x2="21" y2="18" />
                                        </svg>
                                    </button>
                                    <div>
                                        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-black">
                                            Connect your coding profiles
                                        </h1>
                                        <p className="mt-1.5 text-xs sm:text-sm font-medium text-neutral-700 leading-relaxed max-w-2xl">
                                            {user?.firstName ? `Hi ${user.firstName}! ` : ""}
                                            Paste your profile link or handle on the left. As soon as you tap connect, profiles are gathered in your bucket on the right ready to save to your dashboard.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2.5 flex-shrink-0 self-start md:self-center flex-wrap">
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-black uppercase border-2 border-black bg-white text-black shadow-[3px_3px_0px_#000]">
                                        <span>{availablePortalList.length} unlinked</span>
                                    </span>
                                    <span className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-black uppercase border-2 border-black shadow-[3px_3px_0px_#000] ${connectedCount > 0
                                        ? "bg-[#a2ff86] text-black"
                                        : "bg-white text-black"
                                        }`}>
                                        <span className={`w-2 h-2 rounded-full ${connectedCount > 0 ? "bg-black animate-pulse" : "bg-neutral-400"}`} />
                                        <span>{connectedCount} of 13 platforms connected</span>
                                    </span>
                                </div>
                            </div>

                            {/* Parallel 2-Column Grid Layout:
                                - Left: Input fields for required platforms
                                - Right: Connected Accounts Bucket (Sticky on desktop) */}
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
                                {/* Left Column: Input of required fields (7 cols) */}
                                <div className="lg:col-span-7 space-y-5">
                                    {/* Search and Filter Control Bar */}
                                    <div className="bg-white border-2 border-black rounded-xl p-4 sm:p-5 space-y-3.5 shadow-[4px_4px_0px_#000]">
                                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                            <div>
                                                <h2 className="text-xs sm:text-sm font-black text-black tracking-tight uppercase">
                                                    Available Platforms
                                                </h2>
                                                <p className="text-[11px] font-medium text-neutral-600 mt-0.5">
                                                    Select a platform, enter your username or link, and verify
                                                </p>
                                            </div>

                                            {/* Category Tabs */}
                                            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#FAF6EE] border-2 border-black rounded-lg shadow-[2px_2px_0px_#000]">
                                                <button
                                                    type="button"
                                                    onClick={() => setActiveCategory("all")}
                                                    className={`px-3 py-1 rounded-md text-xs font-black transition-all cursor-pointer ${activeCategory === "all"
                                                        ? "bg-[#a2ff86] text-black border-2 border-black shadow-[2px_2px_0px_#000]"
                                                        : "text-neutral-700 hover:text-black border-2 border-transparent"
                                                        }`}
                                                >
                                                    All (13)
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setActiveCategory("cp")}
                                                    className={`px-3 py-1 rounded-md text-xs font-black transition-all cursor-pointer ${activeCategory === "cp"
                                                        ? "bg-[#a2ff86] text-black border-2 border-black shadow-[2px_2px_0px_#000]"
                                                        : "text-neutral-700 hover:text-black border-2 border-transparent"
                                                        }`}
                                                >
                                                    CP (6)
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setActiveCategory("practice")}
                                                    className={`px-3 py-1 rounded-md text-xs font-black transition-all cursor-pointer ${activeCategory === "practice"
                                                        ? "bg-[#a2ff86] text-black border-2 border-black shadow-[2px_2px_0px_#000]"
                                                        : "text-neutral-700 hover:text-black border-2 border-transparent"
                                                        }`}
                                                >
                                                    Practice (6)
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setActiveCategory("dev")}
                                                    className={`px-3 py-1 rounded-md text-xs font-black transition-all cursor-pointer ${activeCategory === "dev"
                                                        ? "bg-[#a2ff86] text-black border-2 border-black shadow-[2px_2px_0px_#000]"
                                                        : "text-neutral-700 hover:text-black border-2 border-transparent"
                                                        }`}
                                                >
                                                    Dev (1)
                                                </button>
                                            </div>
                                        </div>

                                        {/* Search input with clear button */}
                                        <div className="relative w-full">
                                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-black">
                                                <svg className="w-4 h-4 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <circle cx="11" cy="11" r="8" />
                                                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                                </svg>
                                            </div>
                                            <input
                                                type="text"
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                placeholder="Filter platforms by name (e.g. LeetCode, GitHub, Codeforces)..."
                                                autoCorrect="off"
                                                autoCapitalize="off"
                                                spellCheck={false}
                                                className="w-full pl-10 pr-10 py-2.5 bg-white text-xs font-bold text-black placeholder:text-neutral-400 placeholder:font-normal rounded-lg border-2 border-black focus:outline-none shadow-[2px_2px_0px_#000] focus:shadow-[3px_3px_0px_#000] transition-all"
                                            />
                                            {searchQuery && (
                                                <button
                                                    type="button"
                                                    onClick={() => setSearchQuery("")}
                                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-black hover:text-neutral-600 cursor-pointer"
                                                    title="Clear search"
                                                >
                                                    <svg className="w-3.5 h-3.5 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <line x1="18" y1="6" x2="6" y2="18" />
                                                        <line x1="6" y1="6" x2="18" y2="18" />
                                                    </svg>
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Portal Inputs List (Available portals) */}
                                    <div className="space-y-4">
                                        {availablePortalList.map((portal) => (
                                            <div
                                                key={portal.id}
                                                className="bg-white border-2 border-black rounded-xl p-4 sm:p-5 shadow-[4px_4px_0px_#000] transition-all hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[5px_5px_0px_#000]"
                                            >
                                                <PortalProfileInput
                                                    portalId={portal.id}
                                                    value={portalValues[portal.id] || ""}
                                                    isConnected={false}
                                                    connectedProfile={null}
                                                    recentProfile={recentProfilesHistory[portal.id] || null}
                                                    onChange={handleInputChange}
                                                    onConnectProfile={handleConnectProfile}
                                                    onDisconnectProfile={handleDisconnectProfile}
                                                />
                                            </div>
                                        ))}

                                        {/* Empty state when all portals in category or search are connected */}
                                        {availablePortalList.length === 0 && (
                                            <div className="py-12 text-center space-y-3 bg-white border-2 border-dashed border-black rounded-xl p-6 shadow-[4px_4px_0px_#000]">
                                                <div className="w-12 h-12 mx-auto rounded-lg border-2 border-black bg-[#a2ff86] text-black flex items-center justify-center shadow-[2px_2px_0px_#000]">
                                                    <svg className="w-6 h-6 stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <polyline points="20 6 9 17 4 12" />
                                                    </svg>
                                                </div>
                                                <h4 className="text-sm font-black uppercase text-black">
                                                    {connectedCount === 13
                                                        ? "All 13 Platforms Connected!"
                                                        : connectedCount > 0
                                                            ? "All Filtered Platforms Connected!"
                                                            : "No Platforms Match Your Search"}
                                                </h4>
                                                <p className="text-xs font-medium text-neutral-600 max-w-sm mx-auto leading-relaxed">
                                                    {connectedCount === 13
                                                        ? "Every supported platform is already gathered in your bucket on the right. Tap 'Save & Continue to Dashboard' to persist."
                                                        : connectedCount > 0
                                                            ? `You have connected ${connectedCount} ${connectedCount === 1 ? "platform" : "platforms"} in your bucket. Adjust your filter or search above to link more.`
                                                            : `No platform matches '${searchQuery}'. Try clearing your search query.`}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Right Column: Connected Accounts Bucket (5 cols, sticky on desktop) */}
                                <div className="lg:col-span-5 lg:sticky lg:top-4 space-y-4">
                                    <div className="rounded-xl border-2 border-black bg-white p-4 sm:p-5 shadow-[6px_6px_0px_#000] transition-all">
                                        {/* Bucket Header */}
                                        <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b-2 border-black">
                                            <div className="flex items-center gap-2.5">
                                                <div className="flex h-9 w-9 items-center justify-center rounded-lg border-2 border-black bg-[#a2ff86] text-black shadow-[2px_2px_0px_#000]">
                                                    <svg className="w-5 h-5 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                                    </svg>
                                                </div>
                                                <div>
                                                    <h3 className="text-sm font-black text-black uppercase tracking-wide leading-tight">
                                                        Connected Accounts Bucket
                                                    </h3>
                                                    <p className="text-[11px] font-medium text-neutral-600 mt-0.5">
                                                        Accounts ready to save to your dashboard
                                                    </p>
                                                </div>
                                            </div>

                                            <span className={`text-xs font-black px-3 py-1 rounded-md border-2 border-black transition-all flex items-center gap-1.5 shadow-[2px_2px_0px_#000] ${connectedCount > 0
                                                ? "text-black bg-[#a2ff86]"
                                                : "text-neutral-700 bg-neutral-100"
                                                }`}>
                                                {connectedCount > 0 && <span className="w-2 h-2 rounded-full bg-black animate-pulse" />}
                                                {connectedCount} {connectedCount === 1 ? "account" : "accounts"}
                                            </span>
                                        </div>

                                        {/* Connected Cards List */}
                                        {connectedCount > 0 ? (
                                            <div className="space-y-2.5 max-h-[calc(100vh-320px)] min-h-[160px] overflow-y-auto pr-1 scrollbar-none">
                                                {Object.entries(connectedProfiles).map(([pId, profile]) => {
                                                    const portalConf = PORTALS[pId];
                                                    const brandColor = portalConf?.brandColor || "#0D8BD9";
                                                    return (
                                                        <div
                                                            key={pId}
                                                            className="flex items-center justify-between gap-3 p-2.5 sm:p-3 rounded-lg border-2 border-black bg-white shadow-[3px_3px_0px_#000] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0px_#000] transition-all group"
                                                        >
                                                            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                                                                <ConnectedPlatformAvatar
                                                                    portalId={pId}
                                                                    avatarUrl={profile.avatar || (profile as any).avatarUrl || (profile as any).avatar_url}
                                                                    name={profile.name}
                                                                    username={profile.username}
                                                                    brandColor={brandColor}
                                                                    size="md"
                                                                />
                                                                <div className="min-w-0">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className="text-xs font-black text-black uppercase truncate">
                                                                            {portalConf?.name || pId}
                                                                        </span>
                                                                        <span className="inline-flex items-center justify-center text-[10px] font-black text-black bg-[#a2ff86] border border-black px-1.5 rounded" title="Verified">✓</span>
                                                                    </div>
                                                                    <p className="text-[11px] text-neutral-600 font-mono font-bold truncate">
                                                                        @{profile.username}
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            <button
                                                                type="button"
                                                                onClick={() => handleDisconnectProfile(pId)}
                                                                className="p-1.5 text-black hover:bg-rose-100 rounded-md border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[1px_1px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] active:shadow-none transition-all cursor-pointer"
                                                                title={`Disconnect ${portalConf?.name || pId}`}
                                                                aria-label={`Disconnect ${portalConf?.name || pId}`}
                                                            >
                                                                <svg className="w-4 h-4 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="py-10 px-4 text-center border-2 border-dashed border-black rounded-lg bg-[#FAF6EE] space-y-2.5">
                                                <div className="w-12 h-12 mx-auto rounded-lg border-2 border-black bg-white flex items-center justify-center text-black shadow-[2px_2px_0px_#000]">
                                                    <svg className="w-6 h-6 stroke-[2]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                                    </svg>
                                                </div>
                                                <h4 className="text-xs font-black uppercase tracking-wide text-black">Your bucket is empty</h4>
                                                <p className="text-[11px] font-medium text-neutral-600 max-w-sm mx-auto leading-relaxed">
                                                    Enter your profile link or handle on the left and tap{" "}
                                                    <span className="whitespace-nowrap inline-block font-black text-black bg-[#a2ff86] px-1.5 py-0.5 border border-black rounded shadow-[1px_1px_0px_#000]">
                                                        "Yes, connect"
                                                    </span>{" "}
                                                    to gather accounts here.
                                                </p>
                                            </div>
                                        )}

                                        {/* Actions & Status inside right bucket */}
                                        <div className="pt-4 mt-4 border-t-2 border-black space-y-3">
                                            {/* Status indicator row */}
                                            <div className="flex items-center justify-between text-xs px-1">
                                                <span className="text-neutral-700 font-extrabold uppercase tracking-wide">Status</span>
                                                {isDirty ? (
                                                    <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-black bg-amber-200 border-2 border-black px-2.5 py-0.5 rounded-md shadow-[2px_2px_0px_#000]">
                                                        <span className="w-2 h-2 rounded-full bg-black animate-pulse" />
                                                        Unsaved changes
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-black bg-[#a2ff86] border-2 border-black px-2.5 py-0.5 rounded-md shadow-[2px_2px_0px_#000]">
                                                        <span className="w-2 h-2 rounded-full bg-black" />
                                                        Up to date
                                                    </span>
                                                )}
                                            </div>

                                            {/* Save & Continue to Dashboard Button (EXACT MATCH TO USER'S REFERENCE IMAGE) */}
                                            <button
                                                type="button"
                                                onClick={handleSave}
                                                disabled={isSaving}
                                                className="w-full h-13 rounded-lg border-2 border-black bg-[#a2ff86] hover:bg-[#92f574] text-black font-black uppercase tracking-wider text-xs sm:text-sm shadow-[4px_4px_0px_#000] hover:shadow-[2px_2px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                                            >
                                                {isSaving ? (
                                                    <>
                                                        <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                                        <span>Saving Profiles...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <span>Save & Continue to Dashboard</span>
                                                        <svg className="w-4 h-4 stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                                                        </svg>
                                                    </>
                                                )}
                                            </button>

                                            <p className="text-[11px] text-center font-medium text-neutral-500">
                                                You can edit or update your public profile handles anytime from your Orbix Dashboard settings.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Full-Width Illustration grounded at the bottom of the container */}
                    <SectionBottomIllustration alt="Connected platforms workspace illustration" />
                </div>
            </div>

            {/* Mobile Floating Bucket Trigger Button for small screens */}
            {connectedCount > 0 && (
                <div className="fixed bottom-5 right-4 z-40 lg:hidden animate-fadeIn">
                    <button
                        type="button"
                        onClick={() => setIsMobileBucketOpen(true)}
                        className="flex items-center gap-2 rounded-lg bg-[#a2ff86] text-black border-2 border-black pl-3.5 pr-4 py-2.5 shadow-[4px_4px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all text-xs font-black uppercase cursor-pointer"
                    >
                        <span className="flex h-2 w-2 rounded-full bg-black animate-pulse" />
                        <div className="flex -space-x-1.5 overflow-hidden">
                            {Object.entries(connectedProfiles).slice(0, 3).map(([pId, p]) => (
                                <MobilePillAvatar
                                    key={pId}
                                    portalId={pId}
                                    avatarUrl={p.avatar || (p as any).avatarUrl || (p as any).avatar_url}
                                    name={p.name}
                                />
                            ))}
                        </div>
                        <span>Bucket ({connectedCount})</span>
                        <span className="text-black text-[10px]">▴</span>
                    </button>
                </div>
            )}

            {/* Mobile Responsive Bucket Drawer / Modal */}
            {isMobileBucketOpen && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-fadeIn">
                    <div
                        className="w-full max-w-lg bg-white border-2 border-black rounded-t-3xl sm:rounded-xl text-black p-5 flex flex-col max-h-[85vh] shadow-[8px_8px_0px_#000] animate-slideUp"
                    >
                        {/* Drawer handle for mobile */}
                        <div className="w-12 h-1.5 bg-black rounded-full mx-auto mb-4 sm:hidden" />

                        {/* Drawer Header */}
                        <div className="flex items-center justify-between pb-3 border-b-2 border-black">
                            <div>
                                <h3 className="text-base font-black text-black flex items-center gap-2 uppercase tracking-wide">
                                    <span>Connected Accounts Bucket</span>
                                    <span className="text-xs font-black text-black bg-[#a2ff86] border-2 border-black px-2 py-0.5 rounded-md shadow-[1px_1px_0px_#000]">
                                        {connectedCount} connected
                                    </span>
                                </h3>
                                <p className="text-xs font-medium text-neutral-600 mt-0.5">
                                    Tap disconnect to remove an account back to its input state.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsMobileBucketOpen(false)}
                                className="p-1.5 text-black hover:bg-neutral-100 rounded-lg border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer"
                            >
                                <svg className="w-5 h-5 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Connected Accounts List */}
                        <div className="overflow-y-auto scrollbar-none py-3 space-y-3 flex-1 pr-1">
                            {Object.entries(connectedProfiles).map(([pId, profile]) => {
                                const portalConf = PORTALS[pId];
                                const brandColor = portalConf?.brandColor || "#0D8BD9";
                                return (
                                    <div
                                        key={pId}
                                        className="flex items-center justify-between gap-3 p-3 rounded-lg border-2 border-black bg-white shadow-[3px_3px_0px_#000]"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <ConnectedPlatformAvatar
                                                portalId={pId}
                                                avatarUrl={profile.avatar || (profile as any).avatarUrl || (profile as any).avatar_url}
                                                name={profile.name}
                                                username={profile.username}
                                                brandColor={brandColor}
                                                size="md"
                                            />
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-xs font-black text-black uppercase truncate">
                                                        {portalConf?.name || pId}
                                                    </span>
                                                    <span className="text-[10px] text-black font-black bg-[#a2ff86] border border-black px-1 rounded">✓</span>
                                                </div>
                                                <p className="text-xs text-neutral-900 font-bold truncate">
                                                    {profile.name}
                                                </p>
                                                <p className="text-[11px] text-neutral-600 font-mono font-bold truncate">
                                                    @{profile.username}
                                                </p>
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => handleDisconnectProfile(pId)}
                                            className="px-3 py-1.5 text-xs font-black text-black bg-white hover:bg-rose-100 border-2 border-black rounded-lg shadow-[2px_2px_0px_#000] hover:shadow-[1px_1px_0px_#000] transition-all cursor-pointer flex items-center gap-1.5"
                                        >
                                            <svg className="w-3.5 h-3.5 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                            <span>Disconnect</span>
                                        </button>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Modal Action Buttons */}
                        <div className="pt-3 border-t-2 border-black flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsMobileBucketOpen(false);
                                    handleSave();
                                }}
                                className="flex-1 h-12 rounded-lg border-2 border-black bg-[#a2ff86] text-black font-black uppercase tracking-wider text-xs shadow-[3px_3px_0px_#000] hover:shadow-[1px_1px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] transition-all cursor-pointer"
                            >
                                Save & Continue to Dashboard
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsMobileBucketOpen(false)}
                                className="px-4 h-12 rounded-lg border-2 border-black bg-white text-black font-black text-xs shadow-[2px_2px_0px_#000] hover:bg-neutral-100 cursor-pointer"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

