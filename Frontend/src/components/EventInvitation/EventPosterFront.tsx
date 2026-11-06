import React from "react";
import {
    Calendar,
    MapPin,
    Building2,
    GraduationCap,
    ArrowRight,
    Video,
    Sparkles,
} from "lucide-react";
import { OrbixLogo } from "../OrbixLogo";
import type { EventInvitationData, InvitationFormat } from "./types";
import { formatEventSchedule, sanitizeEventText } from "./eventScheduleHelper";

interface EventPosterFrontProps {
    event: EventInvitationData;
    format?: InvitationFormat;
    className?: string;
    showFlipHint?: boolean;
}

export const EventPosterFront: React.FC<EventPosterFrontProps> = ({
    event,
    format = "portrait",
    className = "",
    showFlipHint = true,
}) => {
    const {
        title,
        summary,
        description,
        startsAt,
        endsAt,
        timezone = "Asia/Kolkata",
        venueOrLocation,
        locationType = "in_person",
        coverImageUrl,
        status = "published",
        clubName,
        clubLogoUrl,
        collegeName,
    } = event;

    const schedule = formatEventSchedule(startsAt, endsAt, timezone, status);
    const cleanSummary = sanitizeEventText(summary) || sanitizeEventText(description);

    // Dynamic title typography size based on character count
    const titleLength = (title || "").trim().length;
    const titleSizeClass =
        titleLength > 65
            ? "text-base sm:text-lg leading-tight"
            : titleLength > 35
            ? "text-lg sm:text-xl md:text-2xl leading-tight"
            : "text-xl sm:text-2xl md:text-3xl leading-none";

    // Mode label & icon
    const isVirtual = locationType === "virtual" || locationType === "online";
    const isHybrid = locationType === "hybrid";

    const modeLabel = isVirtual
        ? "Virtual Stream"
        : isHybrid
        ? "Hybrid Session"
        : "Campus In-Person";

    // -------------------------------------------------------------------------
    // LANDSCAPE / BANNER LAYOUT (Sequential Stacked Composition: Banner -> Details)
    // -------------------------------------------------------------------------
    if (format === "landscape") {
        return (
            <div
                className={`w-full h-full rounded-2xl bg-[#FAF6EE] border-4 border-black shadow-[4px_4px_0px_#000] overflow-hidden flex flex-col justify-between text-black select-none ${className}`}
            >
                {/* Top Society Strip */}
                <div className="px-4 py-2.5 bg-white border-b-4 border-black flex items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                        {clubLogoUrl ? (
                            <img
                                src={clubLogoUrl}
                                alt={clubName}
                                className="w-8 h-8 rounded-lg border-2 border-black object-cover shrink-0 shadow-[1px_1px_0px_#000]"
                                crossOrigin="anonymous"
                            />
                        ) : (
                            <div className="w-8 h-8 rounded-lg border-2 border-black bg-[#FFE566] flex items-center justify-center shrink-0 shadow-[1px_1px_0px_#000]">
                                <Building2 className="w-4 h-4 text-black stroke-[2.5]" />
                            </div>
                        )}
                        <div className="min-w-0">
                            <p className="text-xs font-black text-black truncate leading-tight">
                                {clubName || "Student Club Chapter"}
                            </p>
                            <p className="text-[10px] font-bold text-neutral-500 truncate flex items-center gap-1">
                                <GraduationCap className="w-3 h-3 text-neutral-600 shrink-0" />
                                <span>{collegeName || "Campus Event"}</span>
                            </p>
                        </div>
                    </div>

                    <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border-2 border-black shrink-0 ${schedule.statusColor.bg} ${schedule.statusColor.text} shadow-[1px_1px_0px_#000]`}
                    >
                        {schedule.statusLabel}
                    </span>
                </div>

                {/* Banner Container: Full width, aspect 2.4/1, object-contain so NO clipping */}
                <div className="w-full aspect-[2.4/1] bg-neutral-950 border-b-4 border-black relative overflow-hidden flex items-center justify-center shrink-0">
                    {coverImageUrl ? (
                        <img
                            src={coverImageUrl}
                            alt={title || "Event Banner"}
                            className="w-full h-full object-contain"
                            crossOrigin="anonymous"
                        />
                    ) : (
                        <div className="w-full h-full bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.5px,transparent_1.5px)] [background-size:14px_14px] flex flex-col items-center justify-center p-3 text-center">
                            <div className="p-2 rounded-xl bg-[#FFE566] border-2 border-black shadow-[2px_2px_0px_#000] mb-1">
                                <Sparkles className="w-5 h-5 text-black stroke-[2.5]" />
                            </div>
                            <span className="text-xs font-black uppercase tracking-wider text-black">
                                Orbix Campus Session
                            </span>
                            <span className="text-[10px] font-bold text-neutral-500">
                                {collegeName || "Official Student Event"}
                            </span>
                        </div>
                    )}

                    <div className="absolute top-2.5 left-2.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#FFE566] text-black border-2 border-black text-[9px] font-black uppercase tracking-wider shadow-[1px_1px_0px_#000]">
                            {isVirtual ? (
                                <Video className="w-3 h-3 stroke-[2.5]" />
                            ) : (
                                <MapPin className="w-3 h-3 stroke-[2.5]" />
                            )}
                            <span>{modeLabel}</span>
                        </span>
                    </div>
                </div>

                {/* Details Section Stacked Below Banner */}
                <div className="p-3 sm:p-4 flex-1 flex flex-col justify-between overflow-hidden bg-[#FAF6EE]">
                    <div className="space-y-1.5">
                        {/* Schedule Pill */}
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white text-black border-2 border-black text-[10px] font-black shadow-[1px_1px_0px_#000]">
                            <Calendar className="w-3 h-3 stroke-[2.5] text-neutral-800" />
                            <span className="truncate">{schedule.dateBadgeText}</span>
                        </div>

                        {/* Headline */}
                        <h2
                            className="font-black text-black tracking-tight line-clamp-1 text-base sm:text-lg"
                        >
                            {title?.trim() || "Untitled Campus Event"}
                        </h2>

                        {/* Summary Excerpt */}
                        {cleanSummary && (
                            <p className="text-[11px] text-neutral-700 font-medium leading-snug line-clamp-2">
                                {cleanSummary}
                            </p>
                        )}
                    </div>

                    {/* Venue & Callout */}
                    <div className="pt-2 border-t-2 border-black/10 flex items-center justify-between gap-2 text-[10px] font-bold text-neutral-800">
                        <div className="flex items-center gap-1 truncate min-w-0">
                            <MapPin className="w-3 h-3 text-neutral-700 shrink-0 stroke-[2.5]" />
                            <span className="truncate font-black text-[11px]">
                                {venueOrLocation?.trim() || (isVirtual ? "Online Session Link" : "Campus Hall / Auditorium")}
                            </span>
                        </div>

                        {showFlipHint && (
                            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#A2FF86] text-black border-2 border-black text-[9px] font-black uppercase tracking-wider shadow-[1.5px_1.5px_0px_#000] shrink-0">
                                <span>Scan Pass</span>
                                <ArrowRight className="w-3 h-3 stroke-[2.5]" />
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Brand Strip */}
                <div className="px-4 py-2 bg-white border-t-4 border-black flex items-center justify-between text-[10px] font-black text-black shrink-0">
                    <div className="flex items-center gap-1.5">
                        <OrbixLogo className="w-3.5 h-3.5 text-black" color="black" strokeColor="black" />
                        <span className="uppercase tracking-wider font-mono text-neutral-600">
                            Orbix Event Poster
                        </span>
                    </div>
                    <span className="text-[9px] uppercase tracking-wider text-neutral-400 font-mono">
                        Verified Campus
                    </span>
                </div>
            </div>
        );
    }

    // -------------------------------------------------------------------------
    // PORTRAIT & STORY LAYOUTS (Standard High-Impact Vertical Posters)
    // -------------------------------------------------------------------------
    const isStory = format === "story";

    return (
        <div
            className={`w-full h-full rounded-2xl bg-[#FAF6EE] border-4 border-black shadow-[4px_4px_0px_#000] overflow-hidden flex flex-col justify-between text-black select-none ${className}`}
        >
            {/* Top Club & Society Identity Strip */}
            <div className="p-3.5 sm:p-4 bg-white border-b-4 border-black flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                    {clubLogoUrl ? (
                        <img
                            src={clubLogoUrl}
                            alt={clubName}
                            className="w-9 h-9 rounded-xl border-2 border-black object-cover shrink-0 shadow-[1px_1px_0px_#000]"
                            crossOrigin="anonymous"
                        />
                    ) : (
                        <div className="w-9 h-9 rounded-xl border-2 border-black bg-[#FFE566] flex items-center justify-center shrink-0 shadow-[1px_1px_0px_#000]">
                            <Building2 className="w-4 h-4 text-black stroke-[2.5]" />
                        </div>
                    )}
                    <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-black text-black truncate leading-tight">
                            {clubName || "Student Club Chapter"}
                        </p>
                        <p className="text-[10px] font-bold text-neutral-500 truncate flex items-center gap-1">
                            <GraduationCap className="w-3 h-3 text-neutral-600 shrink-0" />
                            <span>{collegeName || "Campus Event"}</span>
                        </p>
                    </div>
                </div>

                {/* Status Badge */}
                <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border-2 border-black shrink-0 ${schedule.statusColor.bg} ${schedule.statusColor.text} shadow-[1.5px_1.5px_0px_#000]`}
                >
                    {schedule.statusLabel}
                </span>
            </div>

            {/* Event Artwork / Banner Container */}
            <div
                className={`w-full bg-neutral-950 border-b-4 border-black relative overflow-hidden flex items-center justify-center shrink-0 ${
                    isStory ? "aspect-[2/1] max-h-64" : "aspect-[2.4/1] max-h-56"
                }`}
            >
                {coverImageUrl ? (
                    <img
                        src={coverImageUrl}
                        alt={title || "Event Banner"}
                        className="w-full h-full object-contain"
                        crossOrigin="anonymous"
                    />
                ) : (
                    <div className="w-full h-full bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.5px,transparent_1.5px)] [background-size:16px_16px] flex flex-col items-center justify-center p-4 text-center">
                        <div className="w-12 h-12 rounded-xl bg-[#FFE566] border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center text-black mb-2">
                            <Sparkles className="w-6 h-6 stroke-[2.5]" />
                        </div>
                        <span className="text-xs font-black uppercase tracking-wider text-black">
                            Orbix Campus Session
                        </span>
                        <span className="text-[10px] font-bold text-neutral-500 mt-0.5">
                            {collegeName || "Official Student Event"}
                        </span>
                    </div>
                )}

                {/* Floating Format Pill */}
                <div className="absolute top-3 left-3">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FFE566] text-black border-2 border-black text-[10px] font-black uppercase tracking-wider shadow-[2px_2px_0px_#000]">
                        {isVirtual ? (
                            <Video className="w-3 h-3 stroke-[2.5]" />
                        ) : (
                            <MapPin className="w-3 h-3 stroke-[2.5]" />
                        )}
                        <span>{modeLabel}</span>
                    </span>
                </div>
            </div>

            {/* Event Typography Body */}
            <div className={`p-4 sm:p-5 flex-1 flex flex-col justify-between ${isStory ? "space-y-4" : "space-y-3"}`}>
                <div className="space-y-2.5">
                    {/* Prominent Schedule Date Pill */}
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-black border-2 border-black text-xs font-black shadow-[1.5px_1.5px_0px_#000]">
                        <Calendar className="w-3.5 h-3.5 stroke-[2.5] text-neutral-800" />
                        <span>{schedule.dateBadgeText}</span>
                    </div>

                    {/* Event Title (Hero Display Typography) */}
                    <h2
                        className={`font-black text-black tracking-tight line-clamp-2 ${titleSizeClass}`}
                    >
                        {title?.trim() || "Untitled Campus Event"}
                    </h2>

                    {/* Event Summary (Sanitized, Only if user provided real text) */}
                    {cleanSummary && (
                        <p className="text-xs text-neutral-700 font-medium leading-relaxed line-clamp-3">
                            {cleanSummary}
                        </p>
                    )}
                </div>

                {/* Venue & Location Row */}
                <div className="pt-2 border-t-2 border-black/10 flex items-center justify-between gap-3 text-xs font-bold text-neutral-800">
                    <div className="flex items-center gap-1.5 truncate min-w-0">
                        <MapPin className="w-3.5 h-3.5 text-neutral-700 shrink-0 stroke-[2.5]" />
                        <span className="truncate font-black">
                            {venueOrLocation?.trim() || (isVirtual ? "Online Session Link" : "Campus Auditorium / Block")}
                        </span>
                    </div>

                    {showFlipHint && (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#A2FF86] text-black border-2 border-black text-[10px] font-black uppercase tracking-wider shadow-[1.5px_1.5px_0px_#000] shrink-0">
                            <span>Scan Pass</span>
                            <ArrowRight className="w-3 h-3 stroke-[2.5]" />
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Brand Bar */}
            <div className="px-4 py-2.5 bg-white border-t-4 border-black flex items-center justify-between text-[11px] font-black text-black shrink-0">
                <span className="flex items-center gap-1.5 text-neutral-700 truncate">
                    <GraduationCap className="w-3.5 h-3.5 text-black shrink-0 stroke-[2.5]" />
                    <span className="truncate">{collegeName || "Campus Event"}</span>
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                    <OrbixLogo className="w-3.5 h-3.5 text-black" color="black" strokeColor="black" />
                    <span className="text-[10px] uppercase tracking-wider font-mono text-neutral-500">
                        Orbix Event Poster
                    </span>
                </div>
            </div>
        </div>
    );
};
