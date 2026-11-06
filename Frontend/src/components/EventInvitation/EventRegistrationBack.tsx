import React from "react";
import {
    QrCode,
    GraduationCap,
    Calendar,
    MapPin,
    Building2,
    Ticket,
    Sparkles,
} from "lucide-react";
import { OrbixCardQR } from "../../app/Profile/CardStudio/OrbixCardQR";
import { OrbixLogo } from "../OrbixLogo";
import type { EventInvitationData, InvitationFormat } from "./types";
import {
    formatEventSchedule,
    buildEventRegistrationUrl,
} from "./eventScheduleHelper";

interface EventRegistrationBackProps {
    event: EventInvitationData;
    format?: InvitationFormat;
    className?: string;
    qrSize?: number;
}

export const EventRegistrationBack: React.FC<EventRegistrationBackProps> = ({
    event,
    format = "portrait",
    className = "",
    qrSize,
}) => {
    const {
        title,
        startsAt,
        endsAt,
        timezone = "Asia/Kolkata",
        venueOrLocation,
        locationType = "in_person",
        registrationUrl: explicitRegUrl,
        status = "published",
        clubName,
        clubLogoUrl,
        collegeName,
        eventId,
        slug,
    } = event;

    const schedule = formatEventSchedule(startsAt, endsAt, timezone, status);
    const directRegistrationUrl = buildEventRegistrationUrl(
        eventId,
        slug,
        collegeName,
        explicitRegUrl
    );

    const isVirtual = locationType === "virtual" || locationType === "online";
    const modeLabel = isVirtual
        ? "Online Session Link"
        : locationType === "hybrid"
        ? "Hybrid (Campus & Online)"
        : venueOrLocation?.trim() || "Main Auditorium / Campus Block";

    // -------------------------------------------------------------------------
    // LANDSCAPE LAYOUT (Split 2-Column Registration Pass)
    // -------------------------------------------------------------------------
    if (format === "landscape") {
        const computedQrSize = qrSize || 155;

        return (
            <div
                className={`w-full h-full rounded-2xl bg-[#FAF6EE] border-4 border-black shadow-[4px_4px_0px_#000] overflow-hidden flex flex-col justify-between text-black select-none ${className}`}
            >
                {/* Top Pass Header */}
                <div className="px-4 py-2.5 bg-white border-b-4 border-black flex items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-1.5 rounded-lg bg-[#FFE566] border-2 border-black shrink-0 shadow-[1px_1px_0px_#000]">
                            <Sparkles className="w-4 h-4 text-black stroke-[2.5]" />
                        </div>
                        <div className="min-w-0">
                            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block leading-tight">
                                Orbix Registration Pass
                            </span>
                            <p className="text-xs font-black text-black truncate leading-tight">
                                Scan to Register & RSVP
                            </p>
                        </div>
                    </div>

                    <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-lg bg-[#A2FF86] text-black border-2 border-black shadow-[1px_1px_0px_#000] shrink-0">
                        Official Pass
                    </span>
                </div>

                {/* Split Body */}
                <div className="grid grid-cols-12 flex-1 min-h-0 bg-[#FAF6EE]">
                    {/* Left 7 Cols: Event Metadata & Exclusivity */}
                    <div className="col-span-7 p-4 flex flex-col justify-between border-r-4 border-black">
                        <div className="space-y-2.5">
                            <div>
                                <span className="text-[9px] font-black uppercase tracking-wider text-neutral-500 block">
                                    Event Session
                                </span>
                                <h3 className="text-sm font-black text-black line-clamp-1 leading-tight">
                                    {title?.trim() || "Campus Event"}
                                </h3>
                            </div>

                            {/* College Exclusivity Pill */}
                            <div className="p-2 rounded-xl bg-[#FFE566] border-2 border-black shadow-[1.5px_1.5px_0px_#000] flex items-center gap-2 text-[10px] font-black text-black">
                                <GraduationCap className="w-3.5 h-3.5 shrink-0 stroke-[2.5]" />
                                <span className="truncate">
                                    {collegeName
                                        ? `Exclusively for students of ${collegeName}`
                                        : "Open to all verified college students"}
                                </span>
                            </div>

                            {/* 2x2 Specs Matrix */}
                            <div className="grid grid-cols-2 gap-2 text-left">
                                <div className="p-2 rounded-xl bg-white border-2 border-black shadow-[1px_1px_0px_#000]">
                                    <span className="text-[9px] font-black uppercase tracking-wider text-neutral-500 block flex items-center gap-1">
                                        <Calendar className="w-2.5 h-2.5" />
                                        Date & Time
                                    </span>
                                    <p className="text-[10px] font-bold text-black truncate mt-0.5">
                                        {schedule.fullFormatted}
                                    </p>
                                </div>
                                <div className="p-2 rounded-xl bg-white border-2 border-black shadow-[1px_1px_0px_#000]">
                                    <span className="text-[9px] font-black uppercase tracking-wider text-neutral-500 block flex items-center gap-1">
                                        <Building2 className="w-2.5 h-2.5" />
                                        Host Society
                                    </span>
                                    <p className="text-[10px] font-bold text-black truncate mt-0.5">
                                        {clubName || "Student Chapter"}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="pt-2 text-[9px] font-bold text-neutral-600 flex items-center gap-1">
                            <Ticket className="w-3 h-3 text-neutral-500 shrink-0 stroke-[2]" />
                            <span className="truncate">Instant digital ticket generation with campus ID validation</span>
                        </div>
                    </div>

                    {/* Right 5 Cols: QR Centerpiece */}
                    <div className="col-span-5 p-3 flex flex-col items-center justify-center bg-white">
                        <div className="p-2.5 bg-white rounded-xl border-3 border-black shadow-[3px_3px_0px_#000] flex flex-col items-center">
                            <OrbixCardQR
                                value={directRegistrationUrl}
                                size={computedQrSize}
                                showLogo={true}
                                noShadow={true}
                                className="p-1"
                            />
                            <span className="text-[9px] font-black uppercase tracking-wider text-black mt-1.5 flex items-center gap-1">
                                <QrCode className="w-3 h-3 stroke-[2.5]" />
                                Scan with Camera
                            </span>
                        </div>
                    </div>
                </div>

                {/* Bottom Pass Strip */}
                <div className="px-4 py-2 bg-white border-t-4 border-black flex items-center justify-between text-[10px] font-black text-black shrink-0">
                    <span className="text-neutral-700 font-bold truncate">
                        Scan with camera or Orbix app to RSVP
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                        <OrbixLogo className="w-3.5 h-3.5 text-black" color="black" strokeColor="black" />
                        <span className="uppercase tracking-wider font-mono text-neutral-500">
                            Orbix Campus
                        </span>
                    </div>
                </div>
            </div>
        );
    }

    // -------------------------------------------------------------------------
    // PORTRAIT & STORY LAYOUTS
    // -------------------------------------------------------------------------
    const isStory = format === "story";
    const defaultQrSize = isStory ? (qrSize || 180) : (qrSize || 160);

    return (
        <div
            className={`w-full h-full rounded-2xl bg-[#FAF6EE] border-4 border-black shadow-[4px_4px_0px_#000] overflow-hidden flex flex-col justify-between text-black select-none ${className}`}
        >
            {/* Top Pass Header */}
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
                        <div className="p-2 rounded-xl bg-[#FFE566] border-2 border-black shrink-0 shadow-[1px_1px_0px_#000]">
                            <Sparkles className="w-4 h-4 text-black stroke-[2.5]" />
                        </div>
                    )}
                    <div className="min-w-0">
                        <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block leading-tight">
                            Orbix Event Invitation
                        </span>
                        <p className="text-xs font-black text-black truncate leading-tight">
                            Scan to Register & RSVP
                        </p>
                    </div>
                </div>

                <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-lg bg-[#A2FF86] text-black border-2 border-black shadow-[1.5px_1.5px_0px_#000] shrink-0">
                    Official Pass
                </span>
            </div>

            {/* Main Pass Centerpiece */}
            <div className={`p-4 sm:p-5 flex-1 flex flex-col items-center justify-center ${isStory ? "space-y-4" : "space-y-3"}`}>
                {/* Event Heading Context */}
                <div className="text-center w-full px-2">
                    <span className="text-[9px] font-black uppercase tracking-widest text-neutral-500 block mb-0.5">
                        {clubName || "Student Society"} Presents
                    </span>
                    <h3 className="text-sm sm:text-base font-black text-black tracking-tight line-clamp-1">
                        {title?.trim() || "Campus Event"}
                    </h3>
                </div>

                {/* QR Code Card Frame (Crisp Solid Border & Drop Shadow) */}
                <div className="p-3.5 sm:p-4 bg-white rounded-2xl border-4 border-black shadow-[4px_4px_0px_#000] flex flex-col items-center">
                    <OrbixCardQR
                        value={directRegistrationUrl}
                        size={defaultQrSize}
                        showLogo={true}
                        noShadow={true}
                        className="p-1"
                    />
                    <span className="text-[10px] font-black uppercase tracking-wider text-black mt-2.5 flex items-center gap-1.5">
                        <QrCode className="w-3.5 h-3.5 stroke-[2.5]" />
                        Scan with Phone Camera
                    </span>
                </div>

                {/* College Exclusivity Pill Banner */}
                <div className="w-full p-2.5 rounded-xl bg-[#FFE566] border-2 border-black shadow-[2px_2px_0px_#000] flex items-center gap-2 text-xs font-black text-black">
                    <GraduationCap className="w-4 h-4 shrink-0 stroke-[2.5]" />
                    <span className="truncate">
                        {collegeName
                            ? `Exclusively for students of ${collegeName}`
                            : "Open to all verified college students"}
                    </span>
                </div>

                {/* Structured Specs Mini-Table */}
                <div className="w-full grid grid-cols-2 gap-2 text-left">
                    <div className="p-2 sm:p-2.5 rounded-xl bg-white border-2 border-black shadow-[1.5px_1.5px_0px_#000]">
                        <span className="text-[9px] font-black uppercase tracking-wider text-neutral-500 block flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-neutral-600" />
                            Event Schedule
                        </span>
                        <p className="text-[11px] font-bold text-black truncate mt-0.5">
                            {schedule.dateBadgeText}
                        </p>
                    </div>

                    <div className="p-2 sm:p-2.5 rounded-xl bg-white border-2 border-black shadow-[1.5px_1.5px_0px_#000]">
                        <span className="text-[9px] font-black uppercase tracking-wider text-neutral-500 block flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-neutral-600" />
                            Location / Venue
                        </span>
                        <p className="text-[11px] font-bold text-black truncate mt-0.5">
                            {modeLabel}
                        </p>
                    </div>
                </div>
            </div>

            {/* Bottom Pass Strip */}
            <div className="px-4 py-2.5 bg-white border-t-4 border-black flex items-center justify-between text-[11px] font-black text-black shrink-0">
                <span className="text-neutral-700 font-bold truncate">
                    Scan with camera or Orbix app to RSVP
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                    <OrbixLogo className="w-3.5 h-3.5 text-black" color="black" strokeColor="black" />
                    <span className="text-[10px] uppercase tracking-wider font-mono text-neutral-500">
                        Orbix Campus
                    </span>
                </div>
            </div>
        </div>
    );
};
