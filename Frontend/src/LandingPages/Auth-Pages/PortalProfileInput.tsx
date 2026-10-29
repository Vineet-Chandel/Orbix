import { useState, useId } from "react";
import { AlertCircle } from "lucide-react";
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
    brandColor: _brandColor,
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
                className="h-12 w-12 sm:h-13 sm:w-13 rounded-lg border-2 border-black p-0.5 bg-white shadow-[2px_2px_0px_#000] flex items-center justify-center overflow-hidden"
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
                    <div className="w-full h-full rounded-md bg-white flex items-center justify-center p-2 text-black">
                        {getPortalIcon(portalId, "w-full h-full object-contain")}
                    </div>
                )}
            </div>

            {/* Platform badge at bottom-right (only when displaying custom photo) */}
            {cleanAvatar && (
                <div
                    className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-md bg-white p-0.5 shadow-[1px_1px_0px_#000] border-2 border-black"
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
            <div className="w-full rounded-xl border-2 border-black bg-[#FAF6EE] p-4 text-black shadow-[4px_4px_0px_#000] transition-all duration-200 animate-fadeIn">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
                    {/* Left: Avatar + User info + Stats */}
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
                                <span className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full border border-black bg-black" />
                                    {config.name}
                                </span>
                                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-black bg-[#a2ff86] border-2 border-black px-2 py-0.5 rounded-md shadow-[1px_1px_0px_#000]">
                                    <svg className="w-2.5 h-2.5 stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                    Connected
                                </span>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap mt-0.5">
                                <h4 className="truncate text-sm sm:text-base font-black text-black tracking-tight">
                                    {displayName}
                                </h4>
                                <span className="text-xs font-mono font-bold text-neutral-600 truncate">
                                    @{connectedProfile.username}
                                </span>
                            </div>

                            {/* Live Stats */}
                            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                {connectedProfile.stats.map((st, idx) => (
                                    <span
                                        key={idx}
                                        className="inline-flex items-center rounded-md bg-white px-2 py-0.5 text-[10px] sm:text-xs font-bold text-black border-2 border-black shadow-[1px_1px_0px_#000]"
                                    >
                                        {st.value}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right: Disconnect Action Button */}
                    <div className="flex items-center justify-end gap-2 flex-shrink-0 pt-2 sm:pt-0 border-t-2 border-black/10 sm:border-t-0">
                        <button
                            type="button"
                            onClick={() => onDisconnectProfile?.(portalId)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 border-black bg-white hover:bg-rose-100 text-xs font-bold text-black shadow-[2px_2px_0px_#000] hover:shadow-[1px_1px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] active:shadow-none transition-all cursor-pointer group"
                            title={`Disconnect ${config.name} profile`}
                        >
                            <svg className="w-3.5 h-3.5 text-black stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
            {/* Label Row with Real Portal Logo */}
            <div className="flex items-center justify-between px-0.5">
                <label
                    htmlFor={inputId}
                    className="flex items-center gap-2.5 text-xs font-black text-black cursor-pointer uppercase tracking-wide"
                >
                    <div className="flex h-6 w-6 items-center justify-center flex-shrink-0">
                        {getPortalIcon(portalId, "w-6 h-6")}
                    </div>
                    <span className="text-sm font-black text-black">{config.name}</span>
                </label>

                {/* Live Status Indicator Pill */}
                {judgment.type !== "empty" && (
                    <div className="flex items-center gap-1.5 animate-fadeIn">
                        {fetchState.loading ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-black uppercase bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] animate-pulse">
                                <span className="w-2.5 h-2.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                Verifying...
                            </span>
                        ) : fetchState.error ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-black uppercase bg-rose-100 text-rose-900 border-2 border-black shadow-[2px_2px_0px_#000]">
                                <AlertCircle className="w-3 h-3 stroke-[2.5]" />
                                Account Not Found
                            </span>
                        ) : judgment.badgeVariant === "error" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-black uppercase bg-rose-100 text-rose-900 border-2 border-black shadow-[2px_2px_0px_#000]">
                                <AlertCircle className="w-3 h-3 stroke-[2.5]" />
                                {judgment.badgeLabel}
                            </span>
                        ) : judgment.badgeVariant === "username" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-black uppercase bg-[#a2ff86] text-black border-2 border-black shadow-[2px_2px_0px_#000]">
                                <svg className="w-3 h-3 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                Username detected
                            </span>
                        ) : judgment.badgeVariant === "link" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-black uppercase bg-sky-200 text-black border-2 border-black shadow-[2px_2px_0px_#000]">
                                <svg className="w-3 h-3 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                </svg>
                                Full Link detected
                            </span>
                        ) : null}
                    </div>
                )}
            </div>

            {/* Neo-brutalist Input Container */}
            <div
                className={`relative flex items-center rounded-lg border-2 border-black transition-all px-4 bg-white ${
                    hasError
                        ? "border-rose-600 bg-rose-50/40 shadow-[3px_3px_0px_#dc2626]"
                        : isFocused
                        ? "shadow-[4px_4px_0px_#000] translate-x-[-1px] translate-y-[-1px]"
                        : "shadow-[3px_3px_0px_#000] hover:shadow-[4px_4px_0px_#000]"
                }`}
            >
                {/* Search prefix icon */}
                <div className="mr-2.5 flex-shrink-0 text-black">
                    <svg className="w-4 h-4 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    className="h-12 w-full bg-transparent text-sm text-black font-semibold placeholder:text-neutral-400 placeholder:font-normal focus:outline-none pr-2"
                />

                {/* Action buttons on the right: Clear & External Link */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                    {value && (
                        <button
                            type="button"
                            onClick={handleClear}
                            className="p-1 text-black hover:bg-neutral-100 rounded-md transition-colors cursor-pointer"
                            aria-label="Clear input"
                            title="Clear"
                        >
                            <svg className="w-3.5 h-3.5 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
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
                            className="p-1 text-black hover:bg-[#a2ff86] rounded-md border border-black/20 hover:border-black transition-colors"
                            title={`Open ${judgment.normalizedUrl}`}
                        >
                            <svg className="w-3.5 h-3.5 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
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
                <div className="px-1 pt-1">
                    {fetchState.error ? (
                        <p className="text-[11px] text-rose-700 font-bold flex items-center gap-1.5 animate-fadeIn">
                            <AlertCircle className="w-3.5 h-3.5 stroke-[2.5] flex-shrink-0" />
                            <span>{fetchState.error}</span>
                        </p>
                    ) : judgment.message ? (
                        judgment.isValid ? (
                            <p className="text-[11px] text-neutral-800 font-bold flex items-center gap-1">
                                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#a2ff86] border border-black text-black text-[10px] font-black">✓</span>
                                <span>{judgment.message}</span>
                            </p>
                        ) : (
                            <p className="text-[11px] text-rose-700 font-bold flex items-center gap-1.5 animate-fadeIn">
                                <AlertCircle className="w-3.5 h-3.5 stroke-[2.5] flex-shrink-0" />
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
