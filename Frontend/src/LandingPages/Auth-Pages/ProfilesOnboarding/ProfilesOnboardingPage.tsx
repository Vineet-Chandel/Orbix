import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { PORTALS, judgePortalInput, type JudgmentResult } from "../../../utils/portalParser";
import { PortalProfileInput } from "../PortalProfileInput";
import type { PortalProfileData } from "../PortalProfileCard";
import { useAppDispatch, useAppSelector, setPortalProfiles } from "../../../store";
import { useToast } from "../../../context/ToastContext";
import { Sidebar } from "../../../app/Dashboard/Sidebar";

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

    const handleInputChange = (portalId: string, raw: string, judgment: JudgmentResult) => {
        setPortalValues((prev) => ({ ...prev, [portalId]: raw }));
        setJudgments((prev) => ({ ...prev, [portalId]: judgment }));
    };

    // When the user taps "Yes, connect":
    // 1. Move the profile into the Connected Bucket
    // 2. Cache its profile data and retain its input link/username
    // 3. Remove from the available portal list below
    const handleConnectProfile = (portalId: string, data: PortalProfileData) => {
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
    // 1. Remove from connectedProfiles (bucket)
    // 2. Return to the list below in the "disconnect stage" (with username/link shown and preview card with "Yes, connect" button)
    // 3. The field DOES NOT vanish!
    const handleDisconnectProfile = (portalId: string) => {
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

    // Available portals: Portals that are NOT yet in the bucket (connected portals are removed from this list!)
    const availablePortalList = useMemo(() => {
        return portalList.filter((portal) => !connectedProfiles[portal.id]);
    }, [portalList, connectedProfiles]);

    // Count of verified connected profiles
    const connectedCount = useMemo(() => {
        return Object.keys(connectedProfiles).length;
    }, [connectedProfiles]);

    const handleSave = async () => {
        setIsSaving(true);
        const resolvedProfiles: Record<string, { raw: string; username: string; url: string }> = {};

        // Merge connected profiles and valid inputs
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

        // Persist to Backend API with correct user_id, username, and auth headers
        try {
            const activeUser = user || (() => {
                try {
                    const stored = localStorage.getItem("orbix_user");
                    return stored ? JSON.parse(stored) : null;
                } catch {
                    return null;
                }
            })();

            const authToken = (() => {
                try {
                    return localStorage.getItem("orbix_token") || "";
                } catch {
                    return "";
                }
            })();

            const savePayload = {
                user_id: activeUser?.id,
                userId: activeUser?.id,
                username: activeUser?.username,
                portals: resolvedProfiles,
                connectedProfiles,
            };

            const headers: Record<string, string> = {
                "Content-Type": "application/json",
            };
            if (authToken) {
                headers["Authorization"] = `Bearer ${authToken}`;
            }

            const endpoints = [
                "/api/portals/save",
                "/api/profile/save",
                "http://localhost:3000/api/portals/save",
                "http://localhost:3000/api/profile/save",
            ];

            await Promise.allSettled(
                endpoints.map((url) =>
                    fetch(url, {
                        method: "POST",
                        headers,
                        credentials: "include",
                        body: JSON.stringify(savePayload),
                    })
                )
            );
        } catch {
            // Non-fatal if offline
        }

        toast.success(
            connectedCount > 0
                ? `${connectedCount} coding profiles saved! Redirecting to workspace...`
                : "Profile setup completed! Redirecting to workspace...",
            { title: "Profiles Connected" }
        );

        setTimeout(() => {
            navigate("/dashboard");
        }, 600);
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
                {/* Top Header Bar (No Orbix home button, No Skip button) */}
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
                                <span className="h-2 w-2 rounded-full bg-black animate-pulse" />
                            ) : (
                                <span className="h-2 w-2 rounded-full bg-neutral-400" />
                            )}
                            <span>{connectedCount} of 13 connected</span>
                            {connectedCount > 0 && <span className="text-[10px] sm:hidden">▾</span>}
                        </button>
                    </div>
                </header>

                {/* Main Scrollable Content Card */}
                <div className="flex-1 w-full bg-white rounded-2xl border border-neutral-200/90 shadow-xs p-4 sm:p-6 lg:p-8 overflow-y-auto">
                    {/* Central Form Container matching user screenshot aesthetic */}
                    <div className="mx-auto w-full max-w-2xl my-2">
                {/* Header */}
                <div className="text-center mb-6">
                    <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-neutral-950">
                        Connect your coding profiles
                    </h1>
                    <p className="mt-2 text-xs sm:text-sm text-neutral-500 leading-relaxed max-w-md mx-auto">
                        {user?.firstName ? `Hi ${user.firstName}! ` : ""}
                        Paste your profile link or handle. As soon as you tap connect, profiles are gathered in your bucket ready to save to your dashboard.
                    </p>
                </div>

                {/* Connected Accounts Bucket Section (Desktop / Tablet View) */}
                <div className="mb-6 rounded-2xl border border-neutral-200/90 bg-neutral-50/80 p-4 transition-all">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-neutral-900 text-white shadow-xs">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-xs sm:text-sm font-bold text-neutral-900 flex items-center gap-2">
                                    <span>Connected Accounts Bucket</span>
                                    <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100/70 border border-emerald-300 px-2 py-0.5 rounded-full">
                                        {connectedCount} {connectedCount === 1 ? "account" : "accounts"}
                                    </span>
                                </h3>
                                <p className="text-[11px] text-neutral-500 hidden sm:block">
                                    Accounts added here will be saved when you click "Save & Continue to Dashboard".
                                </p>
                            </div>
                        </div>

                        {/* Mobile quick view button */}
                        {connectedCount > 0 && (
                            <button
                                type="button"
                                onClick={() => setIsMobileBucketOpen(true)}
                                className="sm:hidden text-xs font-semibold text-neutral-900 bg-white border border-neutral-300 px-2.5 py-1 rounded-full shadow-xs active:scale-95 transition-all cursor-pointer"
                            >
                                View Bucket ({connectedCount}) ▾
                            </button>
                        )}
                    </div>

                    {connectedCount > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                            {Object.entries(connectedProfiles).map(([pId, profile]) => {
                                const portalConf = PORTALS[pId];
                                const brandColor = portalConf?.brandColor || "#0D8BD9";
                                return (
                                    <div
                                        key={pId}
                                        className="flex items-center justify-between gap-2.5 p-2.5 rounded-xl border border-neutral-200/80 bg-white shadow-xs hover:shadow-md transition-all group"
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className="relative flex-shrink-0">
                                                <img
                                                    src={profile.avatar}
                                                    alt={profile.name}
                                                    referrerPolicy="no-referrer"
                                                    className="h-9 w-9 rounded-full object-cover border-2 p-0.5 bg-neutral-50 shadow-xs"
                                                    style={{ borderColor: brandColor }}
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                                            profile.name || profile.username
                                                        )}&background=${brandColor.replace("#", "")}&color=fff&size=80&bold=true`;
                                                    }}
                                                />
                                                <span
                                                    className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white"
                                                    style={{ backgroundColor: brandColor }}
                                                />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[11px] font-bold text-neutral-900 truncate">
                                                        {portalConf?.name || pId}
                                                    </span>
                                                    <span className="text-[10px] text-emerald-600 font-semibold">✓</span>
                                                </div>
                                                <p className="text-[11px] text-neutral-500 font-mono truncate">
                                                    @{profile.username}
                                                </p>
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => handleDisconnectProfile(pId)}
                                            className="p-1 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                            title={`Disconnect ${portalConf?.name || pId}`}
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
                        <div className="py-3 px-2 text-center text-xs text-neutral-400 border border-dashed border-neutral-200 rounded-xl bg-white/60">
                            Your bucket is empty. Type your handle below and click "Yes, connect" to add accounts here.
                        </div>
                    )}
                </div>

                {/* Filter and Search Bar */}
                <div className="space-y-3 mb-6">
                    {/* Category Tabs */}
                    <div className="flex flex-wrap items-center justify-center gap-1.5 p-1 bg-neutral-100/80 rounded-full max-w-md mx-auto text-xs font-medium">
                        <button
                            type="button"
                            onClick={() => setActiveCategory("all")}
                            className={`px-3 py-1.5 rounded-full transition-all cursor-pointer ${
                                activeCategory === "all"
                                    ? "bg-white text-neutral-950 font-bold shadow-xs"
                                    : "text-neutral-500 hover:text-neutral-800"
                            }`}
                        >
                            All (13)
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveCategory("cp")}
                            className={`px-3 py-1.5 rounded-full transition-all cursor-pointer ${
                                activeCategory === "cp"
                                    ? "bg-white text-neutral-950 font-bold shadow-xs"
                                    : "text-neutral-500 hover:text-neutral-800"
                            }`}
                        >
                            Competitive (6)
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveCategory("practice")}
                            className={`px-3 py-1.5 rounded-full transition-all cursor-pointer ${
                                activeCategory === "practice"
                                    ? "bg-white text-neutral-950 font-bold shadow-xs"
                                    : "text-neutral-500 hover:text-neutral-800"
                            }`}
                        >
                            Practice (6)
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveCategory("dev")}
                            className={`px-3 py-1.5 rounded-full transition-all cursor-pointer ${
                                activeCategory === "dev"
                                    ? "bg-white text-neutral-950 font-bold shadow-xs"
                                    : "text-neutral-500 hover:text-neutral-800"
                            }`}
                        >
                            Dev (1)
                        </button>
                    </div>

                    {/* Quick search input */}
                    <div className="relative max-w-md mx-auto">
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
                            placeholder="Filter platforms by name..."
                            className="w-full pl-10 pr-4 py-2 bg-neutral-50 hover:bg-neutral-100/60 focus:bg-white text-xs rounded-full border border-neutral-200 focus:outline-none focus:border-neutral-900 transition-colors"
                        />
                    </div>
                </div>

                {/* Portal Inputs List - shows only unconnected portals */}
                <div className="space-y-5 bg-white rounded-2xl p-2 sm:p-4">
                    {availablePortalList.map((portal) => (
                        <PortalProfileInput
                            key={portal.id}
                            portalId={portal.id}
                            value={portalValues[portal.id] || ""}
                            isConnected={false}
                            connectedProfile={null}
                            recentProfile={recentProfilesHistory[portal.id] || null}
                            onChange={handleInputChange}
                            onConnectProfile={handleConnectProfile}
                            onDisconnectProfile={handleDisconnectProfile}
                        />
                    ))}

                    {availablePortalList.length === 0 && (
                        <div className="py-10 text-center space-y-3 bg-neutral-50/70 border border-dashed border-neutral-200 rounded-2xl p-6 animate-fadeIn">
                            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200 shadow-xs">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                            </div>
                            <h4 className="text-sm font-bold text-neutral-900">
                                {connectedCount > 0 ? "All Selected Platforms Connected!" : "No Platforms Match Your Filter"}
                            </h4>
                            <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                                {connectedCount > 0
                                    ? `You have connected ${connectedCount} ${connectedCount === 1 ? "platform" : "platforms"} in your bucket above. Tap "Save & Continue" to persist to your workspace.`
                                    : `Try adjusting your category filter or search query "${searchQuery}".`}
                            </p>
                        </div>
                    )}
                </div>

                {/* Actions: Save button matching screenshot design */}
                <div className="mt-8 space-y-3 max-w-md mx-auto">
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={isSaving}
                        className="w-full h-12 rounded-full bg-neutral-900 hover:bg-neutral-800 active:scale-[0.99] text-white font-semibold text-sm transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                    >
                        {isSaving ? (
                            <>
                                <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                <span>Saving Profiles...</span>
                            </>
                        ) : (
                            <span>Save & Continue to Dashboard</span>
                        )}
                    </button>
                </div>

                {/* Bottom Footer Info */}
                <div className="mt-8 text-center py-4 text-xs text-neutral-400 border-t border-neutral-100">
                    You can edit or update your public profile handles anytime from your Orbix Dashboard settings.
                </div>
            </div>
        </div>

            {/* Mobile Floating Bucket Trigger Button for small screens */}
            {connectedCount > 0 && (
                <div className="fixed bottom-5 right-4 z-40 sm:hidden animate-fadeIn">
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
                        <div className="overflow-y-auto py-3 space-y-3 flex-1 pr-1">
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
        </div>
    );
}
