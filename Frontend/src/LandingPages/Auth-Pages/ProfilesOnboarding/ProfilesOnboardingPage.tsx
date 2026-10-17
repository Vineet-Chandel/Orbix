import { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { PORTALS, judgePortalInput, type JudgmentResult } from "../../../utils/portalParser";
import { PortalProfileInput } from "../PortalProfileInput";
import type { PortalProfileData } from "../PortalProfileCard";
import { useAppDispatch, useAppSelector, setPortalProfiles } from "../../../store";
import { useToast } from "../../../context/ToastContext";
import { Sidebar } from "../../../app/Dashboard/Sidebar";
import { disconnectPlatform } from "../../../utils/profileApi";

type CategoryFilter = "all" | "cp" | "practice" | "dev";

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
            return saved ? JSON.parse(saved) : {};
        } catch {
            return {};
        }
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
            return saved ? JSON.parse(saved) : {};
        } catch {
            return {};
        }
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
                            avatar: link.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(pName)}&background=0D8BD9&color=fff&size=80&bold=true`,
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

            // 1. Process pending platform deletions on the backend
            if (deletedPortalsRef.current.size > 0) {
                const portalsToDelete = Array.from(deletedPortalsRef.current);
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
            window.dispatchEvent(new Event("orbix_portals_updated"));

            // 3. Persist to Backend API with correct user_id, username, and auth headers
            const activeUser = user || (() => {
                try {
                    const stored = localStorage.getItem("orbix_user");
                    return stored ? JSON.parse(stored) : null;
                } catch {
                    return null;
                }
            })();

            const savePayload = {
                user_id: activeUser?.id,
                userId: activeUser?.id,
                username: activeUser?.username,
                portals: resolvedProfiles,
                connectedProfiles,
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
                {/* Top Header Bar */}
                <header className="h-16 w-full rounded-2xl bg-white border border-neutral-200/90 shadow-xs px-4 sm:px-6 flex items-center justify-between gap-4 mb-4 flex-shrink-0">
                    {/* Left: Mobile Toggle & Page Title */}
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => setIsMobileSidebarOpen(true)}
                            className="lg:hidden p-2 text-neutral-600 hover:text-neutral-950 rounded-xl hover:bg-neutral-100 transition-colors cursor-pointer"
                            aria-label="Open sidebar"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <line x1="3" y1="12" x2="21" y2="12" />
                                <line x1="3" y1="6" x2="21" y2="6" />
                                <line x1="3" y1="18" x2="21" y2="18" />
                            </svg>
                        </button>
                        <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-black text-white shadow-xs">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                </svg>
                            </div>
                            <div>
                                <h1 className="text-sm sm:text-base font-extrabold text-neutral-900 tracking-tight leading-none">
                                    Connect Coding Platforms
                                </h1>
                                <p className="text-[11px] text-neutral-500 font-medium hidden sm:block mt-0.5">
                                    Link your competitive programming & dev profiles
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Right: Connected count badge & mobile bucket trigger */}
                    <div className="flex items-center gap-2 sm:gap-3">
                        <button
                            type="button"
                            onClick={() => connectedCount > 0 && setIsMobileBucketOpen(true)}
                            className={`text-[11px] font-semibold px-3 py-1.5 rounded-full transition-all flex items-center gap-2 ${
                                connectedCount > 0
                                    ? "text-black bg-neutral-100 border border-neutral-300 hover:bg-neutral-200 cursor-pointer shadow-2xs"
                                    : "text-neutral-500 bg-neutral-100 border border-neutral-200"
                            }`}
                            title={connectedCount > 0 ? "Click to view connected bucket" : ""}
                        >
                            {connectedCount > 0 ? (
                                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                            ) : (
                                <span className="h-2 w-2 rounded-full bg-neutral-400" />
                            )}
                            <span>{connectedCount} of 13 connected</span>
                            {connectedCount > 0 && <span className="text-[10px] sm:hidden">▾</span>}
                        </button>
                    </div>
                </header>

                {/* Main Scrollable Content Card */}
                <div className="flex-1 w-full bg-white rounded-2xl border border-neutral-200/90 shadow-xs p-4 sm:p-6 lg:p-8 overflow-y-auto scrollbar-none">
                    <div className="mx-auto w-full max-w-7xl my-1">
                        {/* Page Header */}
                        <div className="mb-6 lg:mb-8 pb-5 border-b border-neutral-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div>
                                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-neutral-950">
                                    Connect your coding profiles
                                </h1>
                                <p className="mt-1.5 text-xs sm:text-sm text-neutral-500 leading-relaxed max-w-2xl">
                                    {user?.firstName ? `Hi ${user.firstName}! ` : ""}
                                    Paste your profile link or handle on the left. As soon as you tap connect, profiles are gathered in your bucket on the right ready to save to your dashboard.
                                </p>
                            </div>
                            <div className="flex items-center gap-2.5 flex-shrink-0 self-start md:self-center">
                                <span className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold shadow-2xs ${
                                    connectedCount > 0
                                        ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                        : "bg-neutral-100 text-neutral-600 border border-neutral-200"
                                }`}>
                                    <span className={`w-2 h-2 rounded-full ${connectedCount > 0 ? "bg-emerald-500 animate-pulse" : "bg-neutral-400"}`} />
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
                                <div className="bg-neutral-50/80 border border-neutral-200/90 rounded-2xl p-4 sm:p-5 space-y-3.5">
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                        <div>
                                            <h2 className="text-xs sm:text-sm font-bold text-neutral-900 tracking-tight flex items-center gap-2">
                                                <span>Available Platforms</span>
                                                <span className="text-[11px] font-semibold text-neutral-600 bg-white border border-neutral-200 px-2 py-0.5 rounded-full shadow-2xs">
                                                    {availablePortalList.length} unlinked
                                                </span>
                                            </h2>
                                            <p className="text-[11px] text-neutral-500 mt-0.5">
                                                Select a platform, enter your username or link, and verify
                                            </p>
                                        </div>

                                        {/* Category Tabs */}
                                        <div className="flex flex-wrap items-center gap-1 p-1 bg-neutral-200/60 rounded-xl text-xs font-medium self-start sm:self-auto">
                                            <button
                                                type="button"
                                                onClick={() => setActiveCategory("all")}
                                                className={`px-3 py-1 rounded-lg transition-all cursor-pointer text-xs ${
                                                    activeCategory === "all"
                                                        ? "bg-white text-neutral-950 font-bold shadow-xs"
                                                        : "text-neutral-600 hover:text-neutral-900"
                                                }`}
                                            >
                                                All (13)
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setActiveCategory("cp")}
                                                className={`px-3 py-1 rounded-lg transition-all cursor-pointer text-xs ${
                                                    activeCategory === "cp"
                                                        ? "bg-white text-neutral-950 font-bold shadow-xs"
                                                        : "text-neutral-600 hover:text-neutral-900"
                                                }`}
                                            >
                                                CP (6)
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setActiveCategory("practice")}
                                                className={`px-3 py-1 rounded-lg transition-all cursor-pointer text-xs ${
                                                    activeCategory === "practice"
                                                        ? "bg-white text-neutral-950 font-bold shadow-xs"
                                                        : "text-neutral-600 hover:text-neutral-900"
                                                }`}
                                            >
                                                Practice (6)
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setActiveCategory("dev")}
                                                className={`px-3 py-1 rounded-lg transition-all cursor-pointer text-xs ${
                                                    activeCategory === "dev"
                                                        ? "bg-white text-neutral-950 font-bold shadow-xs"
                                                        : "text-neutral-600 hover:text-neutral-900"
                                                }`}
                                            >
                                                Dev (1)
                                            </button>
                                        </div>
                                    </div>

                                    {/* Search input with clear button */}
                                    <div className="relative w-full">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                                <circle cx="11" cy="11" r="8" />
                                                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                            </svg>
                                        </div>
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Filter platforms by name (e.g. LeetCode, GitHub, Codeforces)..."
                                            className="w-full pl-10 pr-10 py-2.5 bg-white text-xs text-neutral-900 placeholder:text-neutral-400 rounded-xl border border-neutral-200 focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition-colors shadow-2xs"
                                        />
                                        {searchQuery && (
                                            <button
                                                type="button"
                                                onClick={() => setSearchQuery("")}
                                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-400 hover:text-neutral-700 cursor-pointer"
                                                title="Clear search"
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
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
                                            className="bg-white border border-neutral-200/90 hover:border-neutral-300 rounded-2xl p-4 sm:p-5 shadow-2xs transition-all"
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
                                        <div className="py-12 text-center space-y-3 bg-neutral-50/70 border border-dashed border-neutral-200 rounded-2xl p-6">
                                            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200 shadow-xs">
                                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                                    <polyline points="20 6 9 17 4 12" />
                                                </svg>
                                            </div>
                                            <h4 className="text-sm font-bold text-neutral-900">
                                                {connectedCount === 13
                                                    ? "All 13 Platforms Connected!"
                                                    : connectedCount > 0
                                                    ? "All Filtered Platforms Connected!"
                                                    : "No Platforms Match Your Search"}
                                            </h4>
                                            <p className="text-xs text-neutral-500 max-w-sm mx-auto leading-relaxed">
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
                                <div className="rounded-2xl border border-neutral-200/90 bg-neutral-50/90 p-4 sm:p-5 shadow-xs transition-all">
                                    {/* Bucket Header */}
                                    <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-neutral-200/80">
                                        <div className="flex items-center gap-2.5">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-neutral-950 text-white shadow-xs">
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                                </svg>
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-bold text-neutral-900 leading-tight">
                                                    Connected Accounts Bucket
                                                </h3>
                                                <p className="text-[11px] text-neutral-500 mt-0.5">
                                                    Accounts ready to save to your dashboard
                                                </p>
                                            </div>
                                        </div>

                                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full border transition-all flex items-center gap-1.5 ${
                                            connectedCount > 0
                                                ? "text-emerald-800 bg-emerald-100/80 border-emerald-300 shadow-2xs"
                                                : "text-neutral-500 bg-neutral-100 border-neutral-200"
                                        }`}>
                                            {connectedCount > 0 && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
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
                                                        className="flex items-center justify-between gap-3 p-2.5 sm:p-3 rounded-xl border border-neutral-200/80 bg-white shadow-2xs hover:shadow-xs hover:border-neutral-300 transition-all group"
                                                    >
                                                        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                                                            <div className="relative flex-shrink-0">
                                                                <img
                                                                    src={profile.avatar}
                                                                    alt={profile.name}
                                                                    referrerPolicy="no-referrer"
                                                                    className="h-9 w-9 sm:h-10 sm:w-10 rounded-full object-cover border-2 p-0.5 bg-neutral-50 shadow-2xs"
                                                                    style={{ borderColor: brandColor }}
                                                                    onError={(e) => {
                                                                        (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                                                            profile.name || profile.username
                                                                        )}&background=${brandColor.replace("#", "")}&color=fff&size=80&bold=true`;
                                                                    }}
                                                                />
                                                                <span
                                                                    className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white shadow-2xs"
                                                                    style={{ backgroundColor: brandColor }}
                                                                />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="text-xs font-bold text-neutral-900 truncate">
                                                                        {portalConf?.name || pId}
                                                                    </span>
                                                                    <span className="text-[11px] text-emerald-600 font-bold" title="Verified">✓</span>
                                                                </div>
                                                                <p className="text-[11px] text-neutral-500 font-mono truncate">
                                                                    @{profile.username}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        <button
                                                            type="button"
                                                            onClick={() => handleDisconnectProfile(pId)}
                                                            className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer group-hover:text-neutral-600"
                                                            title={`Disconnect ${portalConf?.name || pId}`}
                                                            aria-label={`Disconnect ${portalConf?.name || pId}`}
                                                        >
                                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="py-10 px-4 text-center border border-dashed border-neutral-300/80 rounded-xl bg-white/70 space-y-2.5">
                                            <div className="w-10 h-10 mx-auto rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400">
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                                </svg>
                                            </div>
                                            <h4 className="text-xs font-bold text-neutral-800">Your bucket is empty</h4>
                                            <p className="text-[11px] text-neutral-500 max-w-xs mx-auto leading-relaxed">
                                                Enter your profile link or handle on the left and tap <span className="font-semibold text-neutral-800">"Yes, connect"</span> to gather accounts here.
                                            </p>
                                        </div>
                                    )}

                                    {/* Actions & Status inside right bucket */}
                                    <div className="pt-4 mt-4 border-t border-neutral-200/80 space-y-3">
                                        {/* Status indicator row */}
                                        <div className="flex items-center justify-between text-xs px-1">
                                            <span className="text-neutral-500 font-medium">Status</span>
                                            {isDirty ? (
                                                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-full">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                                    Unsaved changes
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                    Up to date
                                                </span>
                                            )}
                                        </div>

                                        {/* Save & Continue to Dashboard Button */}
                                        <button
                                            type="button"
                                            onClick={handleSave}
                                            disabled={isSaving}
                                            className="w-full h-12 rounded-xl bg-neutral-950 hover:bg-neutral-800 active:scale-[0.99] text-white font-semibold text-xs sm:text-sm transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                                        >
                                            {isSaving ? (
                                                <>
                                                    <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                                    <span>Saving Profiles...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <span>Save & Continue to Dashboard</span>
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                                                    </svg>
                                                </>
                                            )}
                                        </button>

                                        <p className="text-[11px] text-center text-neutral-400">
                                            You can edit or update your public profile handles anytime from your Orbix Dashboard settings.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Mobile Floating Bucket Trigger Button for small screens */}
            {connectedCount > 0 && (
                <div className="fixed bottom-5 right-4 z-40 lg:hidden animate-fadeIn">
                    <button
                        type="button"
                        onClick={() => setIsMobileBucketOpen(true)}
                        className="flex items-center gap-2 rounded-full bg-neutral-950 text-white pl-3.5 pr-4 py-2.5 shadow-2xl border border-neutral-700 active:scale-95 transition-all text-xs font-bold cursor-pointer"
                    >
                        <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                        <div className="flex -space-x-1.5 overflow-hidden">
                            {Object.values(connectedProfiles).slice(0, 3).map((p) => (
                                <img
                                    key={p.portal}
                                    src={p.avatar}
                                    alt={p.name}
                                    className="inline-block h-4 w-4 rounded-full ring-1 ring-white object-cover"
                                />
                            ))}
                        </div>
                        <span>Bucket ({connectedCount})</span>
                        <span className="text-neutral-400 text-[10px]">▴</span>
                    </button>
                </div>
            )}

            {/* Mobile Responsive Bucket Drawer / Modal */}
            {isMobileBucketOpen && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-fadeIn">
                    <div
                        className="w-full max-w-lg bg-[#0b0f19] border border-neutral-800 rounded-t-3xl sm:rounded-2xl text-white p-5 flex flex-col max-h-[85vh] shadow-2xl animate-slideUp"
                    >
                        {/* Drawer handle for mobile */}
                        <div className="w-12 h-1 bg-neutral-700 rounded-full mx-auto mb-4 sm:hidden" />

                        {/* Drawer Header */}
                        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
                            <div>
                                <h3 className="text-base font-bold text-white flex items-center gap-2">
                                    <span>Connected Accounts Bucket</span>
                                    <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                                        {connectedCount} connected
                                    </span>
                                </h3>
                                <p className="text-xs text-neutral-400 mt-0.5">
                                    Tap disconnect to remove an account back to its input state.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsMobileBucketOpen(false)}
                                className="p-1.5 text-neutral-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
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
                                        className="flex items-center justify-between gap-3 p-3 rounded-xl border border-neutral-800 bg-neutral-900/80"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="relative flex-shrink-0">
                                                <img
                                                    src={profile.avatar}
                                                    alt={profile.name}
                                                    referrerPolicy="no-referrer"
                                                    className="h-10 w-10 rounded-full object-cover border-2 p-0.5 bg-neutral-950"
                                                    style={{ borderColor: brandColor }}
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                                            profile.name || profile.username
                                                        )}&background=${brandColor.replace("#", "")}&color=fff&size=96&bold=true`;
                                                    }}
                                                />
                                                <span
                                                    className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-neutral-900"
                                                    style={{ backgroundColor: brandColor }}
                                                />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-xs font-bold text-white truncate">
                                                        {portalConf?.name || pId}
                                                    </span>
                                                    <span className="text-[10px] text-emerald-400 font-semibold">✓</span>
                                                </div>
                                                <p className="text-xs text-neutral-300 font-medium truncate">
                                                    {profile.name}
                                                </p>
                                                <p className="text-[11px] text-neutral-400 font-mono truncate">
                                                    @{profile.username}
                                                </p>
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => handleDisconnectProfile(pId)}
                                            className="px-3 py-1.5 text-xs font-medium text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-full transition-colors cursor-pointer flex items-center gap-1.5"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                            <span>Disconnect</span>
                                        </button>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Modal Action Buttons */}
                        <div className="pt-3 border-t border-neutral-800 flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsMobileBucketOpen(false);
                                    handleSave();
                                }}
                                className="flex-1 h-11 rounded-full bg-white text-neutral-950 hover:bg-neutral-200 font-bold text-xs transition-colors cursor-pointer"
                            >
                                Save & Continue to Dashboard
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsMobileBucketOpen(false)}
                                className="px-4 h-11 rounded-full border border-neutral-700 text-neutral-300 hover:text-white text-xs font-semibold cursor-pointer"
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

