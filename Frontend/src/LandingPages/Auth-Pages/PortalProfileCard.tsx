import { useState, useEffect } from "react";
import { getPortalIcon } from "../../utils/portalIcons";
import { PORTALS } from "../../utils/portalParser";

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

interface PortalProfileCardProps {
    portalId: string;
    username: string;
    isConnected: boolean;
    initialProfile?: PortalProfileData | null;
    onConnect: (data: PortalProfileData) => void;
    onDisconnect: () => void;
    onFetchStateChange?: (state: {
        loading: boolean;
        error: string | null;
        profile: PortalProfileData | null;
    }) => void;
}

export const PortalProfileCard = ({
    portalId,
    username,
    isConnected,
    initialProfile,
    onConnect,
    onDisconnect,
    onFetchStateChange,
}: PortalProfileCardProps) => {
    const config = PORTALS[portalId];
    const [profile, setProfile] = useState<PortalProfileData | null>(initialProfile || null);
    const [loading, setLoading] = useState(false);
    const [fetchError, setFetchError] = useState<string | null>(null);

    useEffect(() => {
        if (!username || username.trim().length < 2) {
            setProfile(null);
            setLoading(false);
            setFetchError(null);
            onFetchStateChange?.({ loading: false, error: null, profile: null });
            return;
        }

        // If we already have a valid profile matching the handle, reuse it immediately
        if (
            initialProfile &&
            (initialProfile.username?.toLowerCase() === username.toLowerCase() ||
             initialProfile.portal?.toLowerCase() === portalId.toLowerCase())
        ) {
            setProfile(initialProfile);
            setLoading(false);
            setFetchError(null);
            onFetchStateChange?.({ loading: false, error: null, profile: initialProfile });
            return;
        }

        let isMounted = true;
        const controller = new AbortController();

        const fetchDetails = async () => {
            setLoading(true);
            setFetchError(null);
            onFetchStateChange?.({ loading: true, error: null, profile: null });

            const endpoints = [
                `/api/portals/fetch?portal=${encodeURIComponent(portalId)}&username=${encodeURIComponent(username)}`,
                `http://localhost:3000/api/portals/fetch?portal=${encodeURIComponent(portalId)}&username=${encodeURIComponent(username)}`,
            ];

            let data: PortalProfileData | null = null;
            let errorMessage: string | null = null;

            for (const url of endpoints) {
                try {
                    const res = await fetch(url, {
                        signal: controller.signal,
                    });
                    if (res.ok) {
                        const json = await res.json();
                        if (json && json.success) {
                            data = json;
                            break;
                        }
                    } else if (res.status === 404) {
                        const errJson = await res.json().catch(() => ({}));
                        errorMessage = errJson.message || `Account not found on ${config?.name || portalId}`;
                        break;
                    }
                } catch {
                    continue;
                }
            }

            if (!isMounted) return;

            if (data && data.success) {
                setProfile(data);
                setFetchError(null);
                onFetchStateChange?.({ loading: false, error: null, profile: data });
            } else {
                const finalErr = errorMessage || `Account not found on ${config?.name || portalId}`;
                setProfile(null);
                setFetchError(finalErr);
                onFetchStateChange?.({ loading: false, error: finalErr, profile: null });
            }
            setLoading(false);
        };

        // Debounce fetch slightly to wait for typing pause
        const timer = setTimeout(fetchDetails, 450);

        return () => {
            isMounted = false;
            clearTimeout(timer);
            controller.abort();
        };
    }, [portalId, username, config?.name]);

    if (!username || username.trim().length < 2) {
        return null;
    }

    // Loading State
    if (loading) {
        return (
            <div className="mt-2.5 rounded-2xl border border-neutral-800 bg-[#0c101c] p-4 text-white shadow-xl animate-pulse">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                        <div className="h-12 w-12 rounded-full bg-neutral-800" />
                        <div className="space-y-2">
                            <div className="h-3.5 w-32 rounded-md bg-neutral-800" />
                            <div className="h-2.5 w-24 rounded-md bg-neutral-800" />
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-neutral-400">
                        <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        <span>Verifying account...</span>
                    </div>
                </div>
            </div>
        );
    }

    // If fetch failed or user does not exist on platform, DO NOT SHOW THE CARD AT ALL
    if (fetchError || !profile || !profile.success) {
        return null;
    }

    const brandColor = config?.brandColor || "#FFA116";

    return (
        <div className="mt-2.5 rounded-2xl border border-neutral-800 bg-[#0b0f19] p-4 text-white shadow-2xl transition-all duration-300 animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
                {/* Left: Avatar with Portal Badge + User Details + Stats */}
                <div className="flex items-center gap-3.5 min-w-0">
                    {/* Avatar with Platform Mini Badge at bottom-right */}
                    <div className="relative flex-shrink-0">
                        <img
                            src={profile.avatar}
                            alt={profile.name}
                            referrerPolicy="no-referrer"
                            className="h-12 w-12 sm:h-14 sm:w-14 rounded-full object-cover border-2 p-0.5 bg-neutral-900 shadow-md"
                            style={{ borderColor: brandColor }}
                            onError={(e) => {
                                (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                    profile.name || username
                                )}&background=${brandColor.replace("#", "")}&color=fff&size=128&bold=true`;
                            }}
                        />
                        {/* Mini portal badge in the bottom-right corner matching user screenshot */}
                        <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white p-0.5 shadow-md">
                            {getPortalIcon(portalId, "h-3.5 w-3.5")}
                        </div>
                    </div>

                    {/* Info and Stats Pills */}
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="truncate text-sm sm:text-base font-bold text-white tracking-tight leading-tight">
                                {profile.name}
                            </h4>
                            <span className="text-xs font-mono text-neutral-400 truncate">
                                @{profile.username}
                            </span>
                        </div>

                        {/* Stats Tags Row */}
                        <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                            {profile.stats.map((st, idx) => (
                                <span
                                    key={idx}
                                    className="inline-flex items-center rounded-md bg-neutral-800/90 px-2.5 py-0.5 text-[11px] sm:text-xs font-medium text-neutral-200 border border-neutral-700/60 shadow-xs"
                                >
                                    {st.value}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right: Confirmation Prompt & Action Button */}
                <div className="flex items-center justify-end gap-2.5 sm:gap-3 flex-shrink-0 pt-2 sm:pt-0 border-t border-neutral-800/80 sm:border-t-0">
                    {!isConnected ? (
                        <>
                            <span className="text-xs font-medium text-neutral-400 hidden sm:inline-block">
                                Is this you?
                            </span>
                            <button
                                type="button"
                                onClick={() => onConnect(profile)}
                                className="flex items-center gap-1.5 rounded-full px-4 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-bold text-white shadow-md transition-all hover:scale-105 active:scale-95 cursor-pointer"
                                style={{ backgroundColor: brandColor }}
                            >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                                <span>Yes, connect</span>
                            </button>
                        </>
                    ) : (
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 px-3 py-1.5 text-xs font-semibold text-emerald-400">
                                <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                                <span>Connected</span>
                            </div>
                            <button
                                type="button"
                                onClick={onDisconnect}
                                className="text-xs text-neutral-400 hover:text-rose-400 transition-colors p-1"
                                title="Disconnect account"
                            >
                                Disconnect
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
