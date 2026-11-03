import React from "react";
import { Plus, Trash2, Globe, ExternalLink, AlertCircle } from "lucide-react";
import { getPlatformIcon } from "../../../utils/platformLinks";
import { NeoSelect } from "../../../components/NeoSelect";
import type { ClubLink } from "../../../utils/clubProfileApi";

interface DynamicLinksManagerProps {
    links: ClubLink[];
    onChange: (updatedLinks: ClubLink[]) => void;
}

export const PLATFORM_OPTIONS = [
    { value: "website", label: "Official Website", placeholder: "https://yourclub.org" },
    { value: "github", label: "GitHub Organization", placeholder: "https://github.com/your-club" },
    { value: "linkedin", label: "LinkedIn Page", placeholder: "https://linkedin.com/company/your-club" },
    { value: "instagram", label: "Instagram Handle", placeholder: "https://instagram.com/yourclub" },
    { value: "x", label: "X (Twitter)", placeholder: "https://x.com/yourclub" },
    { value: "discord", label: "Discord Server", placeholder: "https://discord.gg/yourinvite" },
    { value: "youtube", label: "YouTube Channel", placeholder: "https://youtube.com/@yourclub" },
    { value: "other", label: "Custom Link", placeholder: "https://..." },
];

const SINGLE_PLATFORMS = new Set(["website", "github", "linkedin", "instagram", "x", "discord", "youtube"]);

export const DynamicLinksManager: React.FC<DynamicLinksManagerProps> = ({ links, onChange }) => {
    const handleAddLink = () => {
        // Find first unused single-platform or default to "other"
        const existingPlatforms = new Set(links.map((l) => l.platform.toLowerCase()));
        const nextOption = PLATFORM_OPTIONS.find(
            (opt) => opt.value !== "other" && !existingPlatforms.has(opt.value)
        );
        const platform = nextOption ? nextOption.value : "other";

        const newLink: ClubLink = {
            id: `link-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            platform,
            url: "",
            displayOrder: links.length,
        };
        onChange([...links, newLink]);
    };

    const handleUpdateLink = (index: number, updates: Partial<ClubLink>) => {
        const next = [...links];
        if (updates.url !== undefined) {
            // Sanitize whitespace and prevent unsafe schemes
            updates.url = updates.url.replace(/[\r\n\t]/g, "").trimStart();
        }
        next[index] = { ...next[index], ...updates };
        onChange(next);
    };

    const handleRemoveLink = (index: number) => {
        const next = links.filter((_, i) => i !== index).map((l, i) => ({ ...l, displayOrder: i }));
        onChange(next);
    };

    const getPlaceholder = (platform: string) => {
        const opt = PLATFORM_OPTIONS.find((p) => p.value === platform);
        return opt?.placeholder || "https://...";
    };

    // Check for duplicates
    const counts = links.reduce((acc, curr) => {
        const p = curr.platform.toLowerCase();
        acc[p] = (acc[p] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-black">
                        Online Presence & Social Links
                    </h3>
                    <p className="text-[11px] text-neutral-500 font-medium mt-0.5">
                        Connect your GitHub organization, community Discord, and social media handles.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={handleAddLink}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#a2ff86] text-black text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#8ee673] transition-transform active:translate-x-[1px] active:translate-y-[1px] cursor-pointer self-start sm:self-auto shrink-0"
                >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Link</span>
                </button>
            </div>

            {links.length === 0 ? (
                <div className="p-8 rounded-2xl bg-[#FAF6EE] border-2 border-dashed border-black/30 text-center space-y-2.5">
                    <div className="w-10 h-10 rounded-full bg-white border border-black flex items-center justify-center mx-auto shadow-[1px_1px_0px_#000]">
                        <Globe className="w-5 h-5 text-neutral-400" />
                    </div>
                    <p className="text-xs font-bold text-neutral-700">No links connected yet.</p>
                    <p className="text-[11px] text-neutral-500 max-w-sm mx-auto">
                        Connect external platforms to build your chapter's web presence across student networks.
                    </p>
                    <button
                        type="button"
                        onClick={handleAddLink}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white border border-black text-xs font-black text-black shadow-[1px_1px_0px_#000] hover:bg-neutral-100 cursor-pointer"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add First Link</span>
                    </button>
                </div>
            ) : (
                <div className="space-y-3">
                    {links.map((link, index) => {
                        const isDuplicate = SINGLE_PLATFORMS.has(link.platform.toLowerCase()) && counts[link.platform.toLowerCase()] > 1;
                        const isUrlInvalid = link.url.trim().length > 0 && !/^https?:\/\/.+/i.test(link.url.trim());

                        return (
                            <div
                                key={link.id || index}
                                className="p-3 sm:p-4 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_#000] flex flex-col sm:flex-row items-start sm:items-center gap-3 transition-all"
                            >
                                {/* Platform Selector with NeoSelect */}
                                <div className="w-full sm:w-56 shrink-0">
                                    <NeoSelect
                                        value={link.platform}
                                        onChange={(val) => handleUpdateLink(index, { platform: val })}
                                        options={PLATFORM_OPTIONS.map((opt) => ({
                                            value: opt.value,
                                            label: opt.label,
                                            icon: getPlatformIcon(opt.value, "w-4 h-4 text-black"),
                                        }))}
                                        size="sm"
                                        triggerClassName="py-2 rounded-xl text-xs font-black"
                                    />
                                </div>

                                {/* URL Input */}
                                <div className="flex-1 w-full space-y-1">
                                    <div className="relative">
                                        <input
                                            type="url"
                                            value={link.url}
                                            onChange={(e) => handleUpdateLink(index, { url: e.target.value })}
                                            placeholder={getPlaceholder(link.platform)}
                                            className={`w-full px-3 py-1.5 rounded-lg border text-xs font-bold text-black placeholder:text-neutral-400 focus:outline-none ${
                                                isUrlInvalid || isDuplicate
                                                    ? "border-rose-500 bg-rose-50/50"
                                                    : "border-black/30 focus:border-black bg-white"
                                            }`}
                                        />
                                        {link.url.trim() && /^https?:\/\/.+/i.test(link.url.trim()) && (
                                            <a
                                                href={link.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-black"
                                                title="Open Link"
                                            >
                                                <ExternalLink className="w-3.5 h-3.5" />
                                            </a>
                                        )}
                                    </div>
                                    {isDuplicate && (
                                        <p className="text-[10px] text-rose-600 font-bold flex items-center gap-1">
                                            <AlertCircle className="w-3 h-3" />
                                            <span>Duplicate platform entry detected.</span>
                                        </p>
                                    )}
                                    {isUrlInvalid && (
                                        <p className="text-[10px] text-rose-600 font-bold">
                                            Must be a valid web address starting with https://
                                        </p>
                                    )}
                                </div>

                                {/* Remove Action */}
                                <button
                                    type="button"
                                    onClick={() => handleRemoveLink(index)}
                                    className="p-2 rounded-lg bg-white text-rose-600 hover:bg-rose-50 border border-black/20 hover:border-black transition-colors cursor-pointer self-end sm:self-center"
                                    title="Remove link"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
