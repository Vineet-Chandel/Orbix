import { useState, useId } from "react";
import { PORTALS, judgePortalInput, type JudgmentResult } from "../../utils/portalParser";
import { getPortalIcon } from "../../utils/portalIcons";
import { PortalProfileCard, type PortalProfileData } from "./PortalProfileCard";

interface PortalProfileInputProps {
    portalId: string;
    value: string;
    isConnected?: boolean;
    connectedProfile?: PortalProfileData | null;
    recentProfile?: PortalProfileData | null;
    onChange: (portalId: string, raw: string, judgment: JudgmentResult) => void;
    onConnectProfile?: (portalId: string, data: PortalProfileData) => void;
    onDisconnectProfile?: (portalId: string) => void;
}

// Sub-component for rendering Connected Profile Avatar with Platform SVG Fallback
const ConnectedInputAvatar = ({
    portalId,
    avatarUrl,
    name,
    username,
    brandColor,
}: {
    portalId: string;
    avatarUrl?: string | null;
    name?: string;
    username?: string;
    brandColor: string;
}) => {
    const [imgFailed, setImgFailed] = useState(false);

    const cleanAvatar =
        !imgFailed &&
        avatarUrl &&
        typeof avatarUrl === "string" &&
        avatarUrl.trim().length > 5 &&
        !avatarUrl.includes("ui-avatars.com")
            ? avatarUrl.trim()
            : null;

    return (
        <div className="relative flex-shrink-0">
            <div
                className="h-12 w-12 sm:h-13 sm:w-13 rounded-full border-2 p-0.5 bg-neutral-900 shadow-md flex items-center justify-center overflow-hidden"
                style={{ borderColor: brandColor }}
            >
                {cleanAvatar ? (
                    <img
                        src={cleanAvatar}
                        alt={name || username || portalId}
                        referrerPolicy="no-referrer"
                        className="h-full w-full rounded-full object-cover"
                        onError={() => setImgFailed(true)}
                    />
                ) : (
                    <div className="w-full h-full rounded-full bg-neutral-800 flex items-center justify-center p-2 text-white">
                        {getPortalIcon(portalId, "w-full h-full object-contain")}
                    </div>
                )}
            </div>

            {/* Platform badge at bottom-right (only when displaying custom photo) */}
            {cleanAvatar && (
                <div
                    className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white p-0.5 shadow-md border"
                    style={{ borderColor: brandColor }}
                >
                    {getPortalIcon(portalId, "h-3.5 w-3.5")}
                </div>
            )}
        </div>
    );
};

export const PortalProfileInput = ({
    portalId,
    value,
    isConnected = false,
    connectedProfile,
    recentProfile,
    onChange,
    onConnectProfile,
    onDisconnectProfile,
}: PortalProfileInputProps) => {
    const inputId = useId();
    const config = PORTALS[portalId];
    const [isFocused, setIsFocused] = useState(false);
    const [fetchState, setFetchState] = useState<{
        loading: boolean;
        error: string | null;
        profile: PortalProfileData | null;
    }>({
        loading: false,
        error: null,
        profile: null,
    });

    if (!config) return null;

    // When the account is connected, REMOVE the input field and display the connected account state
    if (isConnected && connectedProfile) {
        const brandColor = config.brandColor || "#0D8BD9";
        const avatarSrc =
            connectedProfile.avatar ||
            (connectedProfile as any).avatarUrl ||
            (connectedProfile as any).avatar_url;
        const displayName =
            connectedProfile.name ||
            (connectedProfile as any).displayName ||
            (connectedProfile as any).display_name ||
            connectedProfile.username;

        return (
            <div className="w-full rounded-2xl border border-neutral-800 bg-[#0b0f19] p-4 text-white shadow-xl transition-all duration-300 animate-fadeIn">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
                    {/* Left: Avatar with Brand ring & Portal icon badge + User info + Stats */}
                    <div className="flex items-center gap-3.5 min-w-0">
                        <ConnectedInputAvatar
                            portalId={portalId}
                            avatarUrl={avatarSrc}
                            name={displayName}
                            username={connectedProfile.username}
                            brandColor={brandColor}
                        />

                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: brandColor }} />
                                    {config.name}
                                </span>
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                    Connected
                                </span>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap mt-0.5">
                                <h4 className="truncate text-sm sm:text-base font-bold text-white tracking-tight">
                                    {displayName}
                                </h4>
                                <span className="text-xs font-mono text-neutral-400 truncate">
                                    @{connectedProfile.username}
                                </span>
                            </div>

                            {/* Live Stats */}
                            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                {connectedProfile.stats.map((st, idx) => (
                                    <span
                                        key={idx}
                                        className="inline-flex items-center rounded-md bg-neutral-800/90 px-2 py-0.5 text-[10px] sm:text-xs font-medium text-neutral-200 border border-neutral-700/60 shadow-xs"
                                    >
                                        {st.value}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right: Disconnect Action Button */}
                    <div className="flex items-center justify-end gap-2 flex-shrink-0 pt-2 sm:pt-0 border-t border-neutral-800 sm:border-t-0">
                        <button
                            type="button"
                            onClick={() => onDisconnectProfile?.(portalId)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-neutral-700 hover:border-rose-500/60 bg-neutral-900 hover:bg-rose-500/10 text-xs font-medium text-neutral-300 hover:text-rose-300 transition-all cursor-pointer group"
                            title={`Disconnect ${config.name} profile`}
                        >
                            <svg className="w-3.5 h-3.5 text-neutral-400 group-hover:text-rose-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            <span>Disconnect</span>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const judgment = judgePortalInput(portalId, value);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const nextRaw = e.target.value;
        const nextJudgment = judgePortalInput(portalId, nextRaw);
        setFetchState({ loading: false, error: null, profile: null });
        onChange(portalId, nextRaw, nextJudgment);
    };

    const handleClear = () => {
        const nextJudgment = judgePortalInput(portalId, "");
        setFetchState({ loading: false, error: null, profile: null });
        onChange(portalId, "", nextJudgment);
    };

    const hasError = !isConnected && (judgment.badgeVariant === "error" || Boolean(fetchState.error));

    return (
        <div className="w-full space-y-2 transition-all">
            {/* Label Row with Real Portal Logo (Borderless, filling full size) */}
            <div className="flex items-center justify-between px-1">
                <label
                    htmlFor={inputId}
                    className="flex items-center gap-2.5 text-xs font-bold text-neutral-900 cursor-pointer"
                >
                    <div className="flex h-6 w-6 items-center justify-center flex-shrink-0">
                        {getPortalIcon(portalId, "w-6 h-6")}
                    </div>
                    <span className="text-sm font-bold text-neutral-950">{config.name}</span>
                </label>

                {/* Live Status Indicator Pill */}
                {judgment.type !== "empty" && (
                    <div className="flex items-center gap-1.5 animate-fadeIn">
                        {fetchState.loading ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-neutral-100 text-neutral-700 border border-neutral-200 shadow-xs animate-pulse">
                                <span className="w-2.5 h-2.5 border-2 border-neutral-400 border-t-neutral-800 rounded-full animate-spin" />
                                Verifying...
                            </span>
                        ) : fetchState.error ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200/80 shadow-xs">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="12" y1="8" x2="12" y2="12" />
                                    <line x1="12" y1="16" x2="12.01" y2="16" />
                                </svg>
                                Account Not Found
                            </span>
                        ) : judgment.badgeVariant === "error" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200/80 shadow-xs">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="12" y1="8" x2="12" y2="12" />
                                    <line x1="12" y1="16" x2="12.01" y2="16" />
                                </svg>
                                {judgment.badgeLabel}
                            </span>
                        ) : judgment.badgeVariant === "username" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-xs">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                Username detected
                            </span>
                        ) : judgment.badgeVariant === "link" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200/80 shadow-xs">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                </svg>
                                Full Link detected
                            </span>
                        ) : null}
                    </div>
                )}
            </div>

            {/* Pill Input Container */}
            <div
                className={`relative flex items-center rounded-full border transition-all duration-200 px-4 bg-[#f2f6ff]/70 hover:bg-[#eaf1ff] ${
                    hasError
                        ? "border-rose-400 ring-1 ring-rose-400/40 bg-rose-50/20"
                        : isFocused
                        ? "border-neutral-900 ring-1 ring-neutral-900 bg-white"
                        : "border-neutral-300 hover:border-neutral-400"
                }`}
            >
                {/* Search prefix icon */}
                <div className="mr-2.5 flex-shrink-0 text-neutral-400">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                        <circle cx="11" cy="11" r="7" />
                        <line x1="21" y1="21" x2="16.5" y2="16.5" />
                    </svg>
                </div>

                {/* Input element */}
                <input
                    id={inputId}
                    type="text"
                    value={value}
                    onChange={handleChange}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    placeholder={config.placeholder}
                    className="h-12 w-full bg-transparent text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none pr-2 font-normal"
                />

                {/* Action buttons on the right: Clear & External Link */}
                <div className="flex items-center gap-1 flex-shrink-0">
                    {value && (
                        <button
                            type="button"
                            onClick={handleClear}
                            className="p-1 text-neutral-400 hover:text-neutral-700 rounded-full transition-colors cursor-pointer"
                            aria-label="Clear input"
                            title="Clear"
                        >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    )}

                    {judgment.isValid && judgment.normalizedUrl && (
                        <a
                            href={judgment.normalizedUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 text-neutral-400 hover:text-neutral-900 hover:bg-white rounded-full transition-colors"
                            title={`Open ${judgment.normalizedUrl}`}
                        >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                                <polyline points="15 3 21 3 21 9" />
                                <line x1="10" y1="14" x2="21" y2="3" />
                            </svg>
                        </a>
                    )}
                </div>
            </div>

            {/* Helper status text when not connected yet */}
            {!isConnected && (
                <div className="px-2 pt-0.5">
                    {fetchState.error ? (
                        <p className="text-[11px] text-rose-600 font-medium flex items-center gap-1.5 animate-fadeIn">
                            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                            <span>{fetchState.error}</span>
                        </p>
                    ) : judgment.message ? (
                        judgment.isValid ? (
                            <p className="text-[11px] text-neutral-500 flex items-center gap-1">
                                <span className="text-emerald-600 font-bold">✓</span>
                                <span>{judgment.message}</span>
                            </p>
                        ) : (
                            <p className="text-[11px] text-rose-600 font-medium flex items-center gap-1.5 animate-fadeIn">
                                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="12" y1="8" x2="12" y2="12" />
                                    <line x1="12" y1="16" x2="12.01" y2="16" />
                                </svg>
                                <span>{judgment.message}</span>
                            </p>
                        )
                    ) : null}
                </div>
            )}

            {/* Interactive Profile Reaction Card when handle is valid */}
            {judgment.isValid && judgment.username && (
                <PortalProfileCard
                    portalId={portalId}
                    username={judgment.username}
                    isConnected={isConnected}
                    initialProfile={recentProfile}
                    onConnect={(data) => onConnectProfile?.(portalId, data)}
                    onDisconnect={() => onDisconnectProfile?.(portalId)}
                    onFetchStateChange={(state) => setFetchState(state)}
                />
            )}
        </div>
    );
};
