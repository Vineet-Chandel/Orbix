import React, { useState } from "react";
import {
    Plus,
    Trash2,
    UploadCloud,
    ExternalLink,
    ArrowLeft,
    ArrowRight,
    Image as ImageIcon,
    Building2,
    Link as LinkIcon,
    FileText,
} from "lucide-react";
import type { EventSponsor } from "../../store/clubEventsSlice";
import { OrbixButton } from "../../components/ui/loader";
import { useToast } from "../../context/ToastContext";
import {
    requestClubUploadSignature,
    uploadClubImageToCloudinary,
} from "../../utils/clubProfileApi";

interface EventSponsorsStepProps {
    sponsors: EventSponsor[];
    onChange: (sponsors: EventSponsor[]) => void;
    clubId?: string;
    onBack: () => void;
    onNext: () => void;
}

export const EventSponsorsStep: React.FC<EventSponsorsStepProps> = ({
    sponsors,
    onChange,
    clubId,
    onBack,
    onNext,
}) => {
    const toast = useToast();
    const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);

    const handleAddSponsor = () => {
        const newSponsor: EventSponsor = {
            id: `sp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            name: "",
            logoUrl: "",
            websiteUrl: "",
            description: "",
        };
        onChange([...sponsors, newSponsor]);
    };

    const handleUpdateSponsor = (index: number, updates: Partial<EventSponsor>) => {
        const updated = [...sponsors];
        updated[index] = { ...updated[index], ...updates };
        onChange(updated);
    };

    const handleRemoveSponsor = (index: number) => {
        const updated = sponsors.filter((_, i) => i !== index);
        onChange(updated);
        toast.info("Sponsor block removed.");
    };

    const handleLogoUpload = async (index: number, file: File) => {
        if (!file) return;
        try {
            setUploadingIndex(index);
            const uploadConfig = await requestClubUploadSignature("logo", clubId);
            const result = await uploadClubImageToCloudinary(uploadConfig, file);
            handleUpdateSponsor(index, {
                logoUrl: result.secureUrl,
                imageUrl: result.secureUrl,
            });
            toast.success("Sponsor logo uploaded successfully!");
        } catch (err: any) {
            console.error("Sponsor logo upload failed:", err);
            toast.error(err.message || "Failed to upload sponsor image.");
        } finally {
            setUploadingIndex(null);
        }
    };

    const ensureValidUrl = (url: string) => {
        const trimmed = url.trim();
        if (!trimmed) return "";
        if (!/^https?:\/\//i.test(trimmed)) {
            return `https://${trimmed}`;
        }
        return trimmed;
    };

    return (
        <div className="w-full rounded-3xl bg-white border-3 border-black shadow-[6px_6px_0px_#000] overflow-hidden p-4 sm:p-6 lg:p-8 space-y-6 bg-[#FAF6EE]/20">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b-2 border-black/10 gap-3">
                <div>
                    <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-neutral-500">
                        Step 5 of 6
                    </span>
                    <h3 className="text-lg sm:text-xl md:text-2xl font-black text-black flex items-center gap-2">
                        <span>Event Sponsors & Partners</span>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-[#FFE566] text-black border border-black shadow-[1px_1px_0px_#000]">
                            {sponsors.length}
                        </span>
                    </h3>
                    <p className="text-xs text-neutral-600 font-medium mt-0.5">
                        Highlight brand sponsors, grant providers, or title partners. Clickable sponsor cards are featured on your public event page.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={handleAddSponsor}
                    className="px-4 py-2.5 rounded-xl bg-[#FFE566] hover:bg-[#FDD835] text-black font-black text-xs border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-center gap-1.5 transition-transform active:translate-x-0.5 active:translate-y-0.5 cursor-pointer shrink-0 self-start sm:self-auto"
                >
                    <Plus className="w-4 h-4 stroke-[3]" />
                    <span>Add Sponsor</span>
                </button>
            </div>

            {/* Empty State */}
            {sponsors.length === 0 ? (
                <div className="p-8 sm:p-12 text-center bg-[#FAF6EE] rounded-2xl border-2 border-dashed border-black/30 space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-[#FFE566] border-2 border-black flex items-center justify-center mx-auto shadow-[3px_3px_0px_#000]">
                        <Building2 className="w-7 h-7 text-black" />
                    </div>
                    <div className="max-w-md mx-auto space-y-1">
                        <h4 className="font-black text-base text-black">No Sponsors Added Yet</h4>
                        <p className="text-xs font-medium text-neutral-600 leading-relaxed">
                            Organizers can feature 10 to 12+ corporate partners, student clubs, or brand sponsors.
                            If your event doesn't have sponsors, you can skip directly to Review.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={handleAddSponsor}
                        className="px-5 py-2.5 rounded-xl bg-black hover:bg-neutral-800 text-white font-black text-xs border-2 border-black shadow-[3px_3px_0px_#FFE566] inline-flex items-center gap-2 cursor-pointer transition-transform active:translate-x-0.5 active:translate-y-0.5"
                    >
                        <Plus className="w-4 h-4 stroke-[3]" />
                        <span>Add First Sponsor</span>
                    </button>
                </div>
            ) : (
                /* Sponsor Cards Grid (Handles 10-12+ seamlessly) */
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
                    {sponsors.map((sponsor, index) => {
                        const sponsorImage = sponsor.logoUrl || sponsor.imageUrl || "";
                        const sponsorLink = sponsor.websiteUrl || sponsor.link || "";

                        return (
                            <div
                                key={sponsor.id || `sp_${index}`}
                                className="p-4 sm:p-5 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-4 flex flex-col justify-between relative group hover:border-black transition-all"
                            >
                                {/* Card Header */}
                                <div className="flex items-center justify-between pb-2 border-b border-black/10">
                                    <div className="flex items-center gap-2">
                                        <span className="w-6 h-6 rounded-lg bg-black text-[#FFE566] font-black text-xs flex items-center justify-center">
                                            #{index + 1}
                                        </span>
                                        <span className="text-xs font-black text-black truncate max-w-[150px]">
                                            {sponsor.name.trim() || `Sponsor ${index + 1}`}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveSponsor(index)}
                                        className="p-1.5 rounded-lg border border-black bg-rose-50 hover:bg-rose-100 text-rose-700 shadow-[1px_1px_0px_#000] cursor-pointer transition-transform active:translate-x-0.5 active:translate-y-0.5"
                                        title="Remove Sponsor"
                                        aria-label="Remove Sponsor"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>

                                <div className="space-y-3.5 flex-1">
                                    {/* Logo / Image Section */}
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-black uppercase tracking-wider text-neutral-700 flex items-center justify-between">
                                            <span className="flex items-center gap-1">
                                                <ImageIcon className="w-3 h-3 text-neutral-500" />
                                                <span>Logo / Image</span>
                                            </span>
                                            {uploadingIndex === index && (
                                                <span className="text-[10px] text-blue-600 font-bold animate-pulse">
                                                    Uploading...
                                                </span>
                                            )}
                                        </label>

                                        <div className="flex items-center gap-3">
                                            {/* Preview Container */}
                                            <div className="w-16 h-16 rounded-xl border-2 border-black bg-[#FAF6EE] overflow-hidden flex items-center justify-center shrink-0 shadow-[2px_2px_0px_#000]">
                                                {sponsorImage ? (
                                                    <img
                                                        src={sponsorImage}
                                                        alt={sponsor.name || "Sponsor Logo"}
                                                        className="w-full h-full object-contain p-1"
                                                    />
                                                ) : (
                                                    <Building2 className="w-6 h-6 text-neutral-400" />
                                                )}
                                            </div>

                                            {/* Upload or URL input */}
                                            <div className="flex-1 space-y-1.5 min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <label className="px-2.5 py-1 rounded-lg border border-black bg-white hover:bg-neutral-100 text-[11px] font-bold shadow-[1px_1px_0px_#000] cursor-pointer flex items-center gap-1 shrink-0">
                                                        <UploadCloud className="w-3 h-3" />
                                                        <span>Upload</span>
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            className="hidden"
                                                            onChange={(e) => {
                                                                const file = e.target.files?.[0];
                                                                if (file) handleLogoUpload(index, file);
                                                            }}
                                                        />
                                                    </label>
                                                    <span className="text-[10px] text-neutral-400 font-medium">or paste URL</span>
                                                </div>

                                                <input
                                                    type="url"
                                                    placeholder="https://.../logo.png"
                                                    value={sponsorImage}
                                                    onChange={(e) =>
                                                        handleUpdateSponsor(index, {
                                                            logoUrl: e.target.value,
                                                            imageUrl: e.target.value,
                                                        })
                                                    }
                                                    className="w-full px-2.5 py-1.5 rounded-lg border border-black bg-[#FAF6EE]/50 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-black"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Name Field */}
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-black uppercase tracking-wider text-neutral-700 flex items-center gap-1">
                                            <Building2 className="w-3 h-3 text-neutral-500" />
                                            <span>Sponsor Name *</span>
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="e.g. Google Cloud, Red Bull, GitHub"
                                            value={sponsor.name}
                                            onChange={(e) => handleUpdateSponsor(index, { name: e.target.value })}
                                            className="w-full px-3 py-2 rounded-xl border-2 border-black bg-[#FAF6EE]/40 text-xs font-bold focus:outline-none focus:bg-white focus:shadow-[2px_2px_0px_#000] transition-all"
                                        />
                                    </div>

                                    {/* Link / URL Field */}
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-black uppercase tracking-wider text-neutral-700 flex items-center justify-between">
                                            <span className="flex items-center gap-1">
                                                <LinkIcon className="w-3 h-3 text-neutral-500" />
                                                <span>Redirect Website / Link *</span>
                                            </span>
                                            {sponsorLink && (
                                                <a
                                                    href={ensureValidUrl(sponsorLink)}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-[10px] font-bold text-indigo-700 hover:underline inline-flex items-center gap-0.5"
                                                >
                                                    <span>Test Link</span>
                                                    <ExternalLink className="w-2.5 h-2.5" />
                                                </a>
                                            )}
                                        </label>
                                        <input
                                            type="url"
                                            placeholder="https://cloud.google.com"
                                            value={sponsorLink}
                                            onChange={(e) =>
                                                handleUpdateSponsor(index, {
                                                    websiteUrl: e.target.value,
                                                    link: e.target.value,
                                                })
                                            }
                                            onBlur={() => {
                                                if (sponsorLink) {
                                                    handleUpdateSponsor(index, {
                                                        websiteUrl: ensureValidUrl(sponsorLink),
                                                        link: ensureValidUrl(sponsorLink),
                                                    });
                                                }
                                            }}
                                            className="w-full px-3 py-2 rounded-xl border-2 border-black bg-[#FAF6EE]/40 text-xs font-bold focus:outline-none focus:bg-white focus:shadow-[2px_2px_0px_#000] transition-all"
                                        />
                                    </div>

                                    {/* Description Field (Optional) */}
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-black uppercase tracking-wider text-neutral-700 flex items-center gap-1">
                                            <FileText className="w-3 h-3 text-neutral-500" />
                                            <span>Description / Tier (Optional)</span>
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="e.g. Official Cloud Partner & API Sponsor"
                                            value={sponsor.description || ""}
                                            onChange={(e) => handleUpdateSponsor(index, { description: e.target.value })}
                                            className="w-full px-3 py-2 rounded-xl border-2 border-black bg-[#FAF6EE]/40 text-xs font-medium focus:outline-none focus:bg-white focus:shadow-[2px_2px_0px_#000] transition-all"
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Step 5 Footer Controls */}
            <div className="pt-4 border-t-2 border-black/10 flex items-center justify-between gap-3">
                <button
                    type="button"
                    onClick={onBack}
                    className="px-4 py-2.5 rounded-xl bg-white hover:bg-neutral-100 border-2 border-black text-xs font-bold shadow-[2px_2px_0px_#000] flex items-center gap-1.5 cursor-pointer transition-transform active:translate-x-0.5 active:translate-y-0.5"
                >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back: Banner Studio</span>
                </button>

                <OrbixButton
                    type="button"
                    onClick={onNext}
                    variant="lime"
                    iconRight={<ArrowRight className="w-4 h-4" />}
                    className="px-6 py-2.5 text-xs font-black shadow-[3px_3px_0px_#000] whitespace-nowrap shrink-0 cursor-pointer"
                >
                    Next: Review & Launch
                </OrbixButton>
            </div>
        </div>
    );
};
