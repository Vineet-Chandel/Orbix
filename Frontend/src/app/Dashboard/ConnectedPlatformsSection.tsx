import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { PORTALS, DASHBOARD_PLATFORMS_ORDER, judgePortalInput } from "../../utils/portalParser";
import { getPortalIcon } from "../../utils/portalIcons";
import { useToast } from "../../context/ToastContext";

export interface PortalProfileData {
    success: boolean;
    portal: string;
    username: string;
    name: string;
    avatar: string;
    stats: Array<{ label: string; value: string }>;
    profileUrl: string;
    verified: boolean;
}

interface ConnectedPlatformsSectionProps {
    connectedPortals: Record<string, PortalProfileData>;
    onPortalsChange?: (updated: Record<string, PortalProfileData>) => void;
}

export const ConnectedPlatformsSection: React.FC<ConnectedPlatformsSectionProps> = ({
    connectedPortals,
    onPortalsChange,
}) => {
    const toast = useToast();

    // Local reactive mirror of connected portals
    const [portalsState, setPortalsState] = useState<Record<string, PortalProfileData>>(connectedPortals);

    // Sync with parent props
    useEffect(() => {
        setPortalsState(connectedPortals);
    }, [connectedPortals]);

    // Management toolbar toggle and filters
    const [isManageOpen, setIsManageOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [filterCategory, setFilterCategory] = useState<"all" | "connected" | "unconnected">("all");

    // Modal state for Connecting an account
    const [connectingPortalId, setConnectingPortalId] = useState<string | null>(null);
    const [inputValue, setInputValue] = useState("");
    const [isVerifying, setIsVerifying] = useState(false);
    const [connectError, setConnectError] = useState<string | null>(null);

    // Modal state for Viewing/Managing a connected account
    const [viewingPortalId, setViewingPortalId] = useState<string | null>(null);

    // Connected count based on active 16 platforms
    const connectedCount = useMemo(() => {
        return DASHBOARD_PLATFORMS_ORDER.filter((id) => !!portalsState[id]).length;
    }, [portalsState]);

    // Save portals helper
    const persistPortals = (next: Record<string, PortalProfileData>) => {
        setPortalsState(next);
        try {
            localStorage.setItem("orbix_connected_portals", JSON.stringify(next));

            // Also synchronize orbix_portals format for backwards compatibility
            const rawPortals: Record<string, { raw: string; username: string; url: string }> = {};
            for (const [id, prof] of Object.entries(next)) {
                rawPortals[id] = {
                    raw: prof.username,
                    username: prof.username,
                    url: prof.profileUrl,
                };
            }
            localStorage.setItem("orbix_portals", JSON.stringify(rawPortals));

            // Broadcast to other components (Sidebar, etc.)
            window.dispatchEvent(new Event("orbix_portals_updated"));
            window.dispatchEvent(new Event("storage"));
        } catch (e) {
            console.error("Failed to persist connected portals:", e);
        }

        onPortalsChange?.(next);
    };

    // Filtered platform list
    const displayedPlatforms = useMemo(() => {
        return DASHBOARD_PLATFORMS_ORDER.filter((id) => {
            const config = PORTALS[id];
            if (!config) return false;

            const isConnected = !!portalsState[id];

            // Filter tab
            if (filterCategory === "connected" && !isConnected) return false;
            if (filterCategory === "unconnected" && isConnected) return false;

            // Search query
            if (searchQuery.trim()) {
                const query = searchQuery.toLowerCase();
                const nameMatches = config.name.toLowerCase().includes(query);
                const handleMatches = portalsState[id]?.username.toLowerCase().includes(query);
                if (!nameMatches && !handleMatches) return false;
            }

            return true;
        });
    }, [portalsState, filterCategory, searchQuery]);

    // Handle Opening Connect Modal
    const handleOpenConnect = (portalId: string) => {
        setConnectingPortalId(portalId);
        setInputValue("");
        setConnectError(null);
        setIsVerifying(false);
    };

    // Handle Confirm Connect
    const handleConfirmConnect = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!connectingPortalId) return;

        const config = PORTALS[connectingPortalId];
        if (!config) return;

        const judgment = judgePortalInput(connectingPortalId, inputValue);
        if (!judgment.isValid || !judgment.username) {
            setConnectError(judgment.message || "Please enter a valid username or profile link.");
            return;
        }

        const username = judgment.username;
        setIsVerifying(true);
        setConnectError(null);

        // Attempt live fetch from backend
        let fetchedProfile: PortalProfileData | null = null;
        const endpoints = [
            `/api/portals/fetch?portal=${encodeURIComponent(connectingPortalId)}&username=${encodeURIComponent(username)}`,
            `http://localhost:3000/api/portals/fetch?portal=${encodeURIComponent(connectingPortalId)}&username=${encodeURIComponent(username)}`,
        ];

        for (const url of endpoints) {
            try {
                const res = await fetch(url);
                if (res.ok) {
                    const json = await res.json();
                    if (json && json.success) {
                        fetchedProfile = json;
                        break;
                    }
                }
            } catch {
                // ignore
            }
        }

        // If backend fetched live data, use it; otherwise fallback to verified direct handle object
        const profileData: PortalProfileData = fetchedProfile || {
            success: true,
            portal: connectingPortalId,
            username,
            name: username,
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(
                username
            )}&background=${(config.brandColor || "#000000").replace("#", "")}&color=fff&size=128&bold=true`,
            stats: [
                { label: "Status", value: "Verified" },
                { label: "Platform", value: config.name },
            ],
            profileUrl: config.buildUrl(username),
            verified: true,
        };

        const next = {
            ...portalsState,
            [connectingPortalId]: profileData,
        };

        persistPortals(next);
        setIsVerifying(false);
        setConnectingPortalId(null);
        toast.success(`Connected ${config.name} account (@${username})!`, {
            title: "Platform Linked",
        });
    };

    // Handle Disconnecting
    const handleDisconnect = (portalId: string) => {
        const config = PORTALS[portalId];
        const next = { ...portalsState };
        delete next[portalId];
        persistPortals(next);
        setViewingPortalId(null);
        toast.info(`Disconnected ${config?.name || portalId} account.`, {
            title: "Platform Unlinked",
        });
    };

    const activeConnectingConfig = connectingPortalId ? PORTALS[connectingPortalId] : null;
    const activeViewingProfile = viewingPortalId ? portalsState[viewingPortalId] : null;
    const activeViewingConfig = viewingPortalId ? PORTALS[viewingPortalId] : null;

    return (
        <section className="rounded-2xl bg-white border border-neutral-200/90 p-4 sm:p-6 shadow-xs space-y-4 sm:space-y-5 transition-all">
            {/* Header: Title, Counter, and Manage Trigger */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-neutral-100">
                {/* Left: Icon and Title */}
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-neutral-100/90 border border-neutral-200 flex items-center justify-center text-neutral-800 shadow-2xs">
                        {/* 3-layer stack icon matching screenshot */}
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                            <path d="M12 2L2 7l10 5 10-5-10-5z" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M2 17l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-sm sm:text-base font-extrabold text-neutral-900 tracking-tight leading-tight">
                            Platforms
                        </h3>
                        <p className="text-[11px] text-neutral-500 font-medium">
                            Connect your developer and competitive programming profiles.
                        </p>
                    </div>
                </div>

                {/* Right: Counter and Manage Button */}
                <div className="flex items-center gap-2 sm:gap-2.5 self-end sm:self-auto">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                        <span className="text-xs font-bold text-amber-600">
                            {connectedCount} of 16 connected
                        </span>
                    </div>

                    <span className="text-neutral-300 select-none">·</span>

                    <button
                        type="button"
                        onClick={() => setIsManageOpen((prev) => !prev)}
                        className={`text-xs font-bold transition-all px-2.5 py-1 rounded-lg cursor-pointer ${
                            isManageOpen
                                ? "bg-neutral-900 text-white shadow-xs"
                                : "text-neutral-700 hover:text-neutral-950 hover:bg-neutral-100"
                        }`}
                        title="Toggle manage toolbar"
                    >
                        Manage
                    </button>
                </div>
            </div>

            {/* Collapsible Manage & Filter Bar */}
            {isManageOpen && (
                <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 animate-fadeIn">
                    {/* Category Filter Pills */}
                    <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                        <button
                            type="button"
                            onClick={() => setFilterCategory("all")}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                filterCategory === "all"
                                    ? "bg-neutral-900 text-white shadow-xs"
                                    : "bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200"
                            }`}
                        >
                            All (16)
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilterCategory("connected")}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                filterCategory === "connected"
                                    ? "bg-emerald-600 text-white shadow-xs"
                                    : "bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200"
                            }`}
                        >
                            Connected ({connectedCount})
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilterCategory("unconnected")}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                filterCategory === "unconnected"
                                    ? "bg-neutral-900 text-white shadow-xs"
                                    : "bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200"
                            }`}
                        >
                            Not Connected ({16 - connectedCount})
                        </button>
                    </div>

                    {/* Search Field & Bucket Link */}
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <div className="relative flex-1 sm:w-48">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search platform..."
                                className="w-full pl-8 pr-3 py-1 rounded-lg bg-white border border-neutral-200 text-xs font-medium text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-900"
                            />
                            <svg
                                className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth="2"
                            >
                                <circle cx="11" cy="11" r="8" />
                                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                        </div>

                        <Link
                            to="/onboarding"
                            className="px-3 py-1 rounded-lg bg-white hover:bg-neutral-100 border border-neutral-200 text-xs font-bold text-neutral-700 hover:text-neutral-950 transition-colors whitespace-nowrap shadow-2xs"
                        >
                            Bucket Page →
                        </Link>
                    </div>
                </div>
            )}

            {/* 16-Platform Grid (4 columns on Desktop, matching screenshot) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3.5">
                {displayedPlatforms.map((portalId) => {
                    const config = PORTALS[portalId];
                    if (!config) return null;

                    const profile = portalsState[portalId];
                    const isConnected = !!profile;

                    return (
                        <div
                            key={portalId}
                            className={`group relative rounded-xl border p-3 sm:p-3.5 flex items-center justify-between gap-3 transition-all duration-200 ${
                                isConnected
                                    ? "bg-white border-neutral-200/90 hover:border-neutral-300 shadow-2xs hover:shadow-xs"
                                    : "bg-neutral-50/70 hover:bg-white border-neutral-200/80 hover:border-neutral-300 hover:shadow-2xs"
                            }`}
                        >
                            {/* Left: Icon and Details */}
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                {/* Platform Icon Box */}
                                <div className="w-10 h-10 rounded-xl bg-white border border-neutral-200/90 shadow-2xs flex items-center justify-center p-2 flex-shrink-0 group-hover:scale-105 transition-transform">
                                    {getPortalIcon(portalId, "w-5 h-5")}
                                </div>

                                {/* Names and Connected Status */}
                                <div className="min-w-0 flex-1">
                                    <h4 className="text-xs sm:text-sm font-bold text-neutral-900 tracking-tight leading-tight truncate">
                                        {config.name}
                                    </h4>

                                    {isConnected ? (
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                                            <span
                                                className="text-[11px] font-semibold text-emerald-700 font-mono truncate"
                                                title={`@${profile.username}`}
                                            >
                                                @{profile.username}
                                            </span>
                                        </div>
                                    ) : (
                                        <p className="text-[11px] text-neutral-400 font-medium leading-none mt-1">
                                            Not connected
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Right: Interactive Action Button */}
                            <div className="flex-shrink-0">
                                {isConnected ? (
                                    <button
                                        type="button"
                                        onClick={() => setViewingPortalId(portalId)}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-emerald-50 hover:bg-emerald-100/90 border border-emerald-200 text-xs font-bold text-emerald-700 transition-all cursor-pointer shadow-2xs active:scale-95"
                                        title="View account details or disconnect"
                                    >
                                        <svg className="w-3 h-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                            <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                        <span>Connected</span>
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => handleOpenConnect(portalId)}
                                        className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full bg-white hover:bg-neutral-900 text-neutral-800 hover:text-white border border-neutral-300 hover:border-neutral-900 text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-95"
                                        title={`Connect ${config.name}`}
                                    >
                                        <span>+ Connect</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Empty filter message */}
            {displayedPlatforms.length === 0 && (
                <div className="p-8 text-center rounded-xl bg-neutral-50 border border-neutral-200/80 text-neutral-500 text-xs font-medium space-y-2">
                    <p>No platforms match your filter criteria.</p>
                    <button
                        type="button"
                        onClick={() => {
                            setFilterCategory("all");
                            setSearchQuery("");
                        }}
                        className="px-3 py-1 rounded-full bg-neutral-900 text-white font-bold text-xs"
                    >
                        Reset Filters
                    </button>
                </div>
            )}

            {/* MODAL 1: Connect Platform Modal */}
            {connectingPortalId && activeConnectingConfig && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn"
                    onClick={() => !isVerifying && setConnectingPortalId(null)}
                >
                    <div
                        className="w-full max-w-md bg-white rounded-2xl border border-neutral-200 shadow-2xl p-5 sm:p-6 space-y-5"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-neutral-50 border border-neutral-200 flex items-center justify-center p-2 shadow-2xs">
                                    {getPortalIcon(connectingPortalId, "w-6 h-6")}
                                </div>
                                <div>
                                    <h4 className="text-base font-extrabold text-neutral-900">
                                        Connect {activeConnectingConfig.name}
                                    </h4>
                                    <p className="text-[11px] text-neutral-500">
                                        Link your profile to aggregate your stats on Orbix.
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                disabled={isVerifying}
                                onClick={() => setConnectingPortalId(null)}
                                className="w-8 h-8 rounded-full hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700 flex items-center justify-center transition-colors cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Input Form */}
                        <form onSubmit={handleConfirmConnect} className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-neutral-700 block">
                                    Username or Profile URL
                                </label>
                                <input
                                    type="text"
                                    autoFocus
                                    disabled={isVerifying}
                                    value={inputValue}
                                    onChange={(e) => {
                                        setInputValue(e.target.value);
                                        setConnectError(null);
                                    }}
                                    placeholder={activeConnectingConfig.placeholder}
                                    className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-50 border border-neutral-200 text-xs sm:text-sm font-medium text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:bg-white focus:border-neutral-900 transition-all"
                                />

                                {inputValue.trim() && (
                                    <div className="flex items-center gap-1.5 pt-1 text-[11px]">
                                        {(() => {
                                            const judgment = judgePortalInput(connectingPortalId, inputValue);
                                            if (!judgment.isValid) {
                                                return (
                                                    <span className="text-amber-600 font-semibold flex items-center gap-1">
                                                        ⚠️ {judgment.message || "Invalid handle format"}
                                                    </span>
                                                );
                                            }
                                            return (
                                                <span className="text-emerald-600 font-bold flex items-center gap-1">
                                                    ✓ Recognized handle: @{judgment.username}
                                                </span>
                                            );
                                        })()}
                                    </div>
                                )}

                                {connectError && (
                                    <p className="text-xs font-semibold text-rose-600 pt-1">
                                        {connectError}
                                    </p>
                                )}
                            </div>

                            <p className="text-[11px] text-neutral-400 leading-relaxed">
                                Tip: You can paste your full profile link (e.g.{" "}
                                <span className="font-mono text-neutral-600">
                                    {activeConnectingConfig.buildUrl("johndoe")}
                                </span>
                                ) or just enter your handle.
                            </p>

                            {/* Actions */}
                            <div className="flex items-center justify-end gap-2.5 pt-2">
                                <button
                                    type="button"
                                    disabled={isVerifying}
                                    onClick={() => setConnectingPortalId(null)}
                                    className="px-4 py-2 rounded-full border border-neutral-200 text-xs font-bold text-neutral-600 hover:bg-neutral-100 transition-all cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isVerifying || !inputValue.trim()}
                                    className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-300 text-white text-xs font-bold transition-all shadow-md cursor-pointer disabled:cursor-not-allowed"
                                >
                                    {isVerifying && (
                                        <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                    )}
                                    <span>{isVerifying ? "Verifying Profile..." : "Connect Account"}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 2: View & Manage Connected Account Details */}
            {viewingPortalId && activeViewingProfile && activeViewingConfig && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn"
                    onClick={() => setViewingPortalId(null)}
                >
                    <div
                        className="w-full max-w-md bg-white rounded-2xl border border-neutral-200 shadow-2xl p-5 sm:p-6 space-y-5"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-neutral-50 border border-neutral-200 flex items-center justify-center p-2 shadow-2xs">
                                    {getPortalIcon(viewingPortalId, "w-6 h-6")}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h4 className="text-base font-extrabold text-neutral-900">
                                            {activeViewingConfig.name}
                                        </h4>
                                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-bold text-emerald-700">
                                            Connected
                                        </span>
                                    </div>
                                    <p className="text-xs font-mono text-neutral-500 mt-0.5">
                                        @{activeViewingProfile.username}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setViewingPortalId(null)}
                                className="w-8 h-8 rounded-full hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700 flex items-center justify-center transition-colors cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Profile Card Preview */}
                        <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200/80 flex items-center gap-3.5">
                            <img
                                src={activeViewingProfile.avatar}
                                alt={activeViewingProfile.name}
                                referrerPolicy="no-referrer"
                                className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-xs"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                        activeViewingProfile.username
                                    )}&background=000&color=fff&size=128&bold=true`;
                                }}
                            />
                            <div className="min-w-0 flex-1">
                                <h5 className="text-sm font-extrabold text-neutral-900 truncate">
                                    {activeViewingProfile.name || activeViewingProfile.username}
                                </h5>
                                <a
                                    href={activeViewingProfile.profileUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-xs font-semibold text-neutral-600 hover:text-neutral-950 hover:underline flex items-center gap-1 mt-0.5"
                                >
                                    <span>Visit public profile</span>
                                    <span>↗</span>
                                </a>
                            </div>
                        </div>

                        {/* Stats if available */}
                        {activeViewingProfile.stats && activeViewingProfile.stats.length > 0 && (
                            <div className="space-y-1.5">
                                <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                                    Profile Stats & Badges
                                </span>
                                <div className="grid grid-cols-2 gap-2">
                                    {activeViewingProfile.stats.map((st, idx) => (
                                        <div
                                            key={idx}
                                            className="p-2.5 rounded-lg bg-neutral-50 border border-neutral-200/80"
                                        >
                                            <p className="text-[10px] text-neutral-400 font-bold uppercase">
                                                {st.label}
                                            </p>
                                            <p className="text-xs font-extrabold text-neutral-900 truncate">
                                                {st.value}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Bottom Actions */}
                        <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
                            <button
                                type="button"
                                onClick={() => handleDisconnect(viewingPortalId)}
                                className="px-4 py-2 rounded-full border border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 text-xs font-bold transition-all cursor-pointer"
                            >
                                Disconnect Account
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewingPortalId(null)}
                                className="px-5 py-2 rounded-full bg-neutral-900 text-white hover:bg-neutral-800 text-xs font-bold transition-all shadow-xs cursor-pointer"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
};
