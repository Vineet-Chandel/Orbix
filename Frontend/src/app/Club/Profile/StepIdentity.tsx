import React from "react";
import { Building2, ShieldCheck, CheckCircle2, ArrowUpRight } from "lucide-react";
import { NeoSelect } from "../../../components/NeoSelect";
import { Link } from "react-router-dom";

export const CLUB_CATEGORIES = [
    "Technical & Coding",
    "Robotics & Hardware",
    "Design & Creative Arts",
    "Artificial Intelligence & ML",
    "Web3 & Blockchain",
    "Entrepreneurship & Startups",
    "Cultural & Literary",
    "Sports & Fitness",
    "Social Impact & Environment",
    "Academic & Research",
    "Other",
];

interface StepIdentityProps {
    name: string;
    onNameChange: (val: string) => void;
    category: string;
    onCategoryChange: (val: string) => void;
    foundedYear: string;
    onFoundedYearChange: (val: string) => void;
    operatingStatus: "active" | "on_hiatus" | "inactive";
    onOperatingStatusChange: (val: "active" | "on_hiatus" | "inactive") => void;
    collegeName: string;
    collegeCity?: string;
    collegeState?: string;
    collegeCountry?: string;
    isVerified?: boolean;
}

export const StepIdentity: React.FC<StepIdentityProps> = ({
    name,
    onNameChange,
    category,
    onCategoryChange,
    foundedYear,
    onFoundedYearChange,
    operatingStatus,
    onOperatingStatusChange,
    collegeName,
    collegeCity,
    collegeState,
    isVerified = true,
}) => {
    const currentYear = new Date().getFullYear();

    const statuses = [
        {
            value: "active" as const,
            label: "Active",
            description: "Organizing workshops, hosting events, and active chapters.",
            badgeColor: "bg-[#a2ff86]",
        },
        {
            value: "on_hiatus" as const,
            label: "On Hiatus",
            description: "Paused for semester break, exams, or leadership transition.",
            badgeColor: "bg-[#FFE566]",
        },
        {
            value: "inactive" as const,
            label: "Inactive",
            description: "Archived or historical chapter record without current activities.",
            badgeColor: "bg-neutral-200",
        },
    ];

    return (
        <div className="space-y-7">
            {/* Header / Intro */}
            <div className="border-b border-black/10 pb-4">
                <h2 className="text-lg font-black text-black tracking-tight">Club Identity</h2>
                <p className="text-xs text-neutral-600 font-medium mt-1">
                    Establish the primary identity and academic affiliation of your club chapter.
                </p>
            </div>

            {/* Read-Only Verified Affiliated Institution */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[3px_3px_0px_#000] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-white border-2 border-black flex items-center justify-center shrink-0 shadow-[1px_1px_0px_#000]">
                        <Building2 className="w-5 h-5 text-black" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                                Affiliated Institution
                            </span>
                            {isVerified && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-black text-[10px] font-black text-emerald-700 shadow-[1px_1px_0px_#000]">
                                    <ShieldCheck className="w-3 h-3 text-emerald-600 stroke-[2.5]" />
                                    <span>Verified</span>
                                </span>
                            )}
                        </div>
                        <h3 className="text-sm font-black text-black mt-0.5">
                            {collegeName || "Institution Unassigned"}
                        </h3>
                        {(collegeCity || collegeState) && (
                            <p className="text-xs font-medium text-neutral-600">
                                {[collegeCity, collegeState].filter(Boolean).join(", ")}
                            </p>
                        )}
                    </div>
                </div>

                {!isVerified && (
                    <Link
                        to="/club/verification"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FFE566] text-black border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] hover:bg-[#ebd04e] transition-transform active:translate-x-[1px] active:translate-y-[1px] shrink-0"
                    >
                        <span>Start Verification</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                    </Link>
                )}
            </div>

            {/* Two-Column Grid: Club Name & Category */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Official Club Name */}
                <div className="space-y-1.5">
                    <label className="block text-xs font-black uppercase tracking-wider text-black">
                        Official Club Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => onNameChange(e.target.value)}
                        placeholder="e.g. AWS Student Community, Google DSC"
                        maxLength={120}
                        required
                        className="w-full px-4 py-2.5 rounded-xl border-2 border-black bg-white text-xs font-bold text-black placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#FFE566] shadow-[2px_2px_0px_#000]"
                    />
                </div>

                {/* Primary Category */}
                <div className="space-y-1.5">
                    <label className="block text-xs font-black uppercase tracking-wider text-black">
                        Primary Category <span className="text-rose-500">*</span>
                    </label>
                    <NeoSelect
                        value={category}
                        onChange={onCategoryChange}
                        options={CLUB_CATEGORIES.map((cat) => ({ value: cat, label: cat }))}
                        className="w-full text-xs font-bold"
                    />
                </div>
            </div>

            {/* Founded Year */}
            <div className="max-w-xs space-y-1.5">
                <label className="block text-xs font-black uppercase tracking-wider text-black">
                    Founded Year <span className="text-neutral-400 text-[10px] font-bold">(Optional)</span>
                </label>
                <input
                    type="number"
                    min={1800}
                    max={currentYear + 1}
                    value={foundedYear}
                    onChange={(e) => onFoundedYearChange(e.target.value)}
                    placeholder={`e.g. ${currentYear - 2}`}
                    className="w-full px-4 py-2.5 rounded-xl border-2 border-black bg-white text-xs font-bold text-black placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#FFE566] shadow-[2px_2px_0px_#000]"
                />
            </div>

            {/* Operating Status */}
            <div className="space-y-2.5 pt-2">
                <label className="block text-xs font-black uppercase tracking-wider text-black">
                    Operating Status
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                    {statuses.map((item) => {
                        const isSelected = operatingStatus === item.value;
                        return (
                            <button
                                key={item.value}
                                type="button"
                                onClick={() => onOperatingStatusChange(item.value)}
                                className={`p-4 rounded-xl border-2 border-black text-left transition-all cursor-pointer flex flex-col justify-between space-y-2 ${
                                    isSelected
                                        ? "bg-[#a2ff86] text-black shadow-[3px_3px_0px_#000]"
                                        : "bg-white text-black hover:bg-[#FAF6EE] shadow-[2px_2px_0px_#000]"
                                }`}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span
                                        className={`px-2 py-0.5 rounded-md text-[10px] font-black border border-black text-black ${
                                            isSelected ? "bg-white" : item.badgeColor
                                        }`}
                                    >
                                        {item.label}
                                    </span>
                                    {isSelected && <CheckCircle2 className="w-4 h-4 text-black stroke-[2.5]" />}
                                </div>
                                <p
                                    className={`text-[11px] leading-relaxed font-bold ${
                                        isSelected ? "text-neutral-900" : "text-neutral-600"
                                    }`}
                                >
                                    {item.description}
                                </p>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
