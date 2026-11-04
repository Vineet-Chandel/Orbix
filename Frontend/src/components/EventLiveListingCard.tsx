import React, { useState, useMemo, useRef } from "react";
import {
    Calendar,
    MapPin,
    Building2,
    GraduationCap,
    QrCode,
    Image as ImageIcon,
    Download,
    Sparkles,
} from "lucide-react";
import { toPng } from "html-to-image";
import { useToast } from "../context/ToastContext";
import { OrbixCardQR } from "../app/Profile/CardStudio/OrbixCardQR";

export interface EventLiveListingCardProps {
    title: string;
    summary?: string;
    description?: string;
    startsAt: string;
    endsAt?: string;
    venueOrLocation?: string;
    locationType?: "in_person" | "virtual" | "hybrid";
    registrationUrl?: string;
    coverImageUrl?: string;
    status?: "published" | "completed" | "draft" | "cancelled";
    clubName: string;
    clubLogoUrl?: string | null;
    collegeName: string;
    eventId?: string;
    slug?: string;
}

export const EventLiveListingCard: React.FC<EventLiveListingCardProps> = ({
    title,
    summary,
    description,
    startsAt,
    endsAt: _endsAt,
    venueOrLocation,
    locationType = "in_person",
    registrationUrl,
    coverImageUrl,
    status = "published",
    clubName,
    clubLogoUrl,
    collegeName,
    eventId,
    slug,
}) => {
    const toast = useToast();
    const [face, setFace] = useState<"front" | "back">("front");
    const [isExporting, setIsExporting] = useState(false);
    const [exportingSide, setExportingSide] = useState<"front" | "back" | null>(null);

    const frontExportRef = useRef<HTMLDivElement>(null);
    const backExportRef = useRef<HTMLDivElement>(null);

    // Format start date and time
    const formattedStartDate = useMemo(() => {
        if (!startsAt) return "Date & time to be announced";
        const d = new Date(startsAt);
        if (isNaN(d.getTime())) return startsAt;
        return (
            d.toLocaleDateString("en-IN", {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
                timeZone: "Asia/Kolkata",
            }) + " IST"
        );
    }, [startsAt]);

    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const directRegistrationUrl = `${origin}/events?tab=college-events&eventId=${encodeURIComponent(
        eventId || slug || "preview"
    )}&college=${encodeURIComponent(collegeName || "campus")}`;

    const handleFlip = () => {
        setFace((prev) => (prev === "front" ? "back" : "front"));
    };

    // Download Handler using 2x retina export (identical to personal account profile section)
    const handleDownload = async (side: "front" | "back") => {
        if (isExporting) return;
        setIsExporting(true);
        setExportingSide(side);

        try {
            await new Promise((r) => setTimeout(r, 160));

            const targetNode = side === "front" ? frontExportRef.current : backExportRef.current;
            if (!targetNode) {
                throw new Error("Export card element not ready");
            }

            const dataUrl = await toPng(targetNode, {
                quality: 0.98,
                pixelRatio: 2, // 2x crisp retina export
                cacheBust: true,
                backgroundColor: "#FAF6EE",
            });

            const link = document.createElement("a");
            const sanitizedTitle = (title || "event-invite")
                .toLowerCase()
                .replace(/[^a-z0-9_-]/gi, "-")
                .replace(/-+/g, "-")
                .slice(0, 35);
            link.download = `orbix-invite-${sanitizedTitle}-${side}.png`;
            link.href = dataUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            toast.success(
                `Downloaded Event Invitation Card (${side === "front" ? "Front Cover" : "Back QR"})!`,
                { title: "Export Complete" }
            );
        } catch (err: any) {
            console.error("Export error:", err);
            toast.error(err?.message || "Failed to download card image. Please try again.", {
                title: "Download Failed",
            });
        } finally {
            setIsExporting(false);
            setExportingSide(null);
        }
    };

    return (
        <div className="w-full space-y-3">
            {/* View Selector Controls (Only Front/Back Tabs, No Flip button) */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="inline-flex p-1 bg-white border-2 border-black rounded-xl shadow-[2px_2px_0px_#000]">
                    <button
                        type="button"
                        onClick={() => setFace("front")}
                        className={`px-3 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                            face === "front"
                                ? "bg-black text-white shadow-[1px_1px_0px_#000]"
                                : "bg-transparent text-neutral-600 hover:text-black"
                        }`}
                    >
                        <ImageIcon className="w-3.5 h-3.5" />
                        <span>Front (Cover)</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setFace("back")}
                        className={`px-3 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                            face === "back"
                                ? "bg-black text-white shadow-[1px_1px_0px_#000]"
                                : "bg-transparent text-neutral-600 hover:text-black"
                        }`}
                    >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>Back (QR Invite)</span>
                    </button>
                </div>
            </div>

            {/* 3D Interactive Card Preview Container (Clicking card flips it) */}
            <div className="w-full [perspective:1400px]">
                <div
                    onClick={handleFlip}
                    className="relative w-full transition-transform duration-500 [transform-style:preserve-3d] cursor-pointer"
                    style={{
                        transform: face === "back" ? "rotateY(180deg)" : "rotateY(0deg)",
                    }}
                >
                    {/* ==================== FRONT FACE (Uniform 4-side thick black border) ==================== */}
                    <div
                        className={`w-full rounded-2xl bg-[#FAF6EE] border-4 border-black shadow-[4px_4px_0px_#000] overflow-hidden flex flex-col justify-between transition-all [backface-visibility:hidden] ${
                            face === "back" ? "pointer-events-none" : ""
                        }`}
                    >
                        {/* Club & College Top Header Strip (NO verified badge or logo) */}
                        <div className="p-3.5 sm:p-4 bg-white border-b-4 border-black flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                                {clubLogoUrl ? (
                                    <img
                                        src={clubLogoUrl}
                                        alt={clubName}
                                        className="w-9 h-9 rounded-xl border-2 border-black object-cover shrink-0 shadow-[1px_1px_0px_#000]"
                                    />
                                ) : (
                                    <div className="w-9 h-9 rounded-xl border-2 border-black bg-[#FFE566] flex items-center justify-center shrink-0 shadow-[1px_1px_0px_#000]">
                                        <Building2 className="w-4 h-4 text-black stroke-[2.5]" />
                                    </div>
                                )}
                                <div className="min-w-0">
                                    <p className="text-xs sm:text-sm font-black text-black truncate">
                                        {clubName || "Student Club Chapter"}
                                    </p>
                                    <p className="text-[10px] font-bold text-neutral-500 truncate flex items-center gap-1">
                                        <GraduationCap className="w-3 h-3 text-neutral-600 shrink-0" />
                                        <span>{collegeName || "College Campus"}</span>
                                    </p>
                                </div>
                            </div>

                            {/* Status Badge */}
                            <span
                                className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border-2 border-black shrink-0 ${
                                    status === "published"
                                        ? "bg-[#a2ff86] text-black shadow-[1.5px_1.5px_0px_#000]"
                                        : status === "completed"
                                        ? "bg-sky-200 text-black shadow-[1.5px_1.5px_0px_#000]"
                                        : status === "draft"
                                        ? "bg-[#FFE566] text-black shadow-[1.5px_1.5px_0px_#000]"
                                        : "bg-rose-300 text-black shadow-[1.5px_1.5px_0px_#000]"
                                }`}
                            >
                                {status === "published"
                                    ? "● Live"
                                    : status === "completed"
                                    ? "✓ Completed"
                                    : status === "draft"
                                    ? "Draft"
                                    : "Cancelled"}
                            </span>
                        </div>

                        {/* Event Cover Banner */}
                        <div className="w-full aspect-[16/9] max-h-56 bg-neutral-900 border-b-4 border-black relative overflow-hidden flex items-center justify-center">
                            {coverImageUrl ? (
                                <img
                                    src={coverImageUrl}
                                    alt="Event Banner"
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.5px,transparent_1.5px)] [background-size:16px_16px] flex flex-col items-center justify-center p-4 text-neutral-400 gap-2">
                                    <div className="w-12 h-12 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center text-black">
                                        <ImageIcon className="w-6 h-6 stroke-[2]" />
                                    </div>
                                    <span className="text-xs font-black text-neutral-700">
                                        No Cover Banner Attached Yet
                                    </span>
                                    <span className="text-[10px] font-bold text-neutral-500">
                                        Upload a 16:9 banner to render live
                                    </span>
                                </div>
                            )}

                            {/* Floating Format / Location Pill */}
                            <div className="absolute top-3 left-3">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FFE566] text-black border-2 border-black text-[10px] font-black uppercase tracking-wider shadow-[2px_2px_0px_#000]">
                                    <MapPin className="w-3 h-3 stroke-[2.5]" />
                                    <span>
                                        {locationType === "virtual"
                                            ? "Virtual Stream"
                                            : locationType === "hybrid"
                                            ? "Hybrid Session"
                                            : "In-Person (Campus)"}
                                    </span>
                                </span>
                            </div>
                        </div>

                        {/* Event Information Body */}
                        <div className="p-4 sm:p-5 space-y-3">
                            {/* Schedule Pill */}
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-black border-2 border-black text-xs font-black shadow-[1.5px_1.5px_0px_#000]">
                                <Calendar className="w-3.5 h-3.5 stroke-[2.5] text-neutral-800" />
                                <span>{formattedStartDate}</span>
                            </div>

                            {/* Title */}
                            <h3 className="text-lg sm:text-xl font-black text-black tracking-tight line-clamp-2">
                                {title.trim() || "Untitled Event Session"}
                            </h3>

                            {/* Summary / Description */}
                            <p className="text-xs text-neutral-700 font-medium leading-relaxed line-clamp-3">
                                {summary?.trim() ||
                                    description?.trim() ||
                                    "Provide event agenda, speaker highlights, and prerequisites to display in student campus directory."}
                            </p>

                            {/* Venue Row */}
                            <div className="pt-2 border-t-2 border-black/10 flex items-center justify-between gap-3 text-xs font-bold text-neutral-800">
                                <div className="flex items-center gap-1.5 truncate">
                                    <MapPin className="w-3.5 h-3.5 text-neutral-700 shrink-0" />
                                    <span className="truncate">
                                        {venueOrLocation?.trim() ||
                                            (locationType === "virtual"
                                                ? "Online Session Link"
                                                : "Main Auditorium / Campus Block")}
                                    </span>
                                </div>

                                {registrationUrl?.trim() && (
                                    <span className="text-emerald-700 font-black shrink-0">
                                        RSVP Open
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Card Bottom Strip (Clean, No buttons, No verified tags) */}
                        <div className="px-4 py-2.5 bg-white border-t-4 border-black flex items-center justify-between text-[11px] font-black text-black">
                            <span className="flex items-center gap-1.5 text-neutral-700 truncate">
                                <GraduationCap className="w-3.5 h-3.5 text-black shrink-0 stroke-[2.5]" />
                                <span className="truncate">{collegeName || "Campus Event"}</span>
                            </span>
                            <span className="text-[10px] uppercase tracking-wider font-mono text-neutral-500 shrink-0">
                                Orbix Event Invite
                            </span>
                        </div>
                    </div>

                    {/* ==================== BACK FACE (Invitation & QR Code) ==================== */}
                    <div
                        className={`w-full rounded-2xl bg-[#FAF6EE] border-4 border-black shadow-[4px_4px_0px_#000] overflow-hidden flex flex-col justify-between transition-all [transform:rotateY(180deg)] [backface-visibility:hidden] absolute inset-0 ${
                            face === "front" ? "pointer-events-none" : ""
                        }`}
                    >
                        {/* Back Face Header Strip (NO pass badges or verified logos) */}
                        <div className="p-3.5 sm:p-4 bg-white border-b-4 border-black flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div className="p-2 rounded-xl bg-[#FFE566] border-2 border-black shrink-0 shadow-[1px_1px_0px_#000]">
                                    <Sparkles className="w-4 h-4 text-black stroke-[2.5]" />
                                </div>
                                <div className="min-w-0">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block">
                                        Orbix Event Invitation
                                    </span>
                                    <p className="text-xs font-black text-black truncate">
                                        Scan to Register & RSVP
                                    </p>
                                </div>
                            </div>

                            <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-lg bg-[#FAF6EE] text-black border-2 border-black shadow-[1px_1px_0px_#000] shrink-0">
                                Event Invite
                            </span>
                        </div>

                        {/* QR Code Centerpiece (Thick 4-side solid black border) */}
                        <div className="p-4 sm:p-5 flex flex-col items-center justify-center space-y-3.5 flex-1">
                            <div className="p-3.5 sm:p-4 bg-white rounded-2xl border-4 border-black shadow-[4px_4px_0px_#000] flex flex-col items-center">
                                <OrbixCardQR
                                    value={directRegistrationUrl}
                                    size={160}
                                    showLogo={true}
                                    noShadow={true}
                                    className="p-1"
                                />
                                <span className="text-[10px] font-black uppercase tracking-wider text-black mt-2.5 flex items-center gap-1.5">
                                    <QrCode className="w-3.5 h-3.5 stroke-[2.5]" />
                                    Scan with Phone Camera
                                </span>
                            </div>

                            {/* College Exclusivity Banner (NO verified text) */}
                            <div className="w-full p-2.5 rounded-xl bg-[#FFE566] border-2 border-black shadow-[2px_2px_0px_#000] flex items-center gap-2 text-xs font-black text-black">
                                <GraduationCap className="w-4 h-4 shrink-0 stroke-[2.5]" />
                                <span className="truncate">
                                    Exclusively for students of {collegeName}
                                </span>
                            </div>

                            {/* Event Specs Mini-Table */}
                            <div className="w-full grid grid-cols-2 gap-2 text-left">
                                <div className="p-2 rounded-xl bg-white border-2 border-black shadow-[1.5px_1.5px_0px_#000]">
                                    <span className="text-[9px] font-black uppercase tracking-wider text-neutral-500 block">
                                        Event Date
                                    </span>
                                    <p className="text-[11px] font-bold text-black truncate">
                                        {startsAt ? new Date(startsAt).toLocaleDateString() : "TBA"}
                                    </p>
                                </div>
                                <div className="p-2 rounded-xl bg-white border-2 border-black shadow-[1.5px_1.5px_0px_#000]">
                                    <span className="text-[9px] font-black uppercase tracking-wider text-neutral-500 block">
                                        Host Society
                                    </span>
                                    <p className="text-[11px] font-bold text-black truncate">
                                        {clubName}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Back Bottom Strip (Clean, No Back to Front button, No verified tag) */}
                        <div className="px-4 py-2.5 bg-white border-t-4 border-black flex items-center justify-between text-[11px] font-black text-black">
                            <span className="text-neutral-700 font-bold truncate">
                                Scan with camera or Orbix app to RSVP
                            </span>
                            <span className="text-[10px] uppercase tracking-wider font-mono text-neutral-500 shrink-0">
                                Orbix Campus
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Download Buttons Section — Matched directly to personal account profile section */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <button
                    type="button"
                    onClick={() => handleDownload("front")}
                    disabled={isExporting}
                    className="h-11 flex items-center justify-center gap-2 px-4 rounded-xl bg-white hover:bg-neutral-100 text-black text-xs font-black uppercase tracking-wider transition-all border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-[1px_1px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] cursor-pointer disabled:opacity-50"
                >
                    {isExporting && exportingSide === "front" ? (
                        <>
                            <svg className="w-4 h-4 animate-spin text-black" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                            </svg>
                            <span>Rendering Front PNG...</span>
                        </>
                    ) : (
                        <>
                            <Download className="w-4 h-4 stroke-[2.5]" />
                            <span>Download Front Card</span>
                        </>
                    )}
                </button>

                <button
                    type="button"
                    onClick={() => handleDownload("back")}
                    disabled={isExporting}
                    className="h-11 flex items-center justify-center gap-2 px-4 rounded-xl bg-[#a2ff86] hover:bg-[#8ee673] text-black text-xs font-black uppercase tracking-wider transition-all border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-[1px_1px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] cursor-pointer disabled:opacity-50"
                >
                    {isExporting && exportingSide === "back" ? (
                        <>
                            <svg className="w-4 h-4 animate-spin text-black" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                            </svg>
                            <span>Rendering Back PNG...</span>
                        </>
                    ) : (
                        <>
                            <Download className="w-4 h-4 stroke-[2.5]" />
                            <span>Download Back (QR)</span>
                        </>
                    )}
                </button>
            </div>

            {/* Hidden Off-Screen Unscaled Nodes for Exact Native Pixel-Perfect 2x Export */}
            <div className="fixed -left-[9999px] -top-[9999px] pointer-events-none opacity-0 select-none">
                {/* Clean Front Node */}
                <div
                    ref={frontExportRef}
                    style={{ width: 500 }}
                    className="rounded-2xl bg-[#FAF6EE] border-4 border-black overflow-hidden flex flex-col justify-between"
                >
                    {/* Club Header */}
                    <div className="p-4 bg-white border-b-4 border-black flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                            {clubLogoUrl ? (
                                <img
                                    src={clubLogoUrl}
                                    alt={clubName}
                                    className="w-10 h-10 rounded-xl border-2 border-black object-cover shrink-0 shadow-[1px_1px_0px_#000]"
                                />
                            ) : (
                                <div className="w-10 h-10 rounded-xl border-2 border-black bg-[#FFE566] flex items-center justify-center shrink-0 shadow-[1px_1px_0px_#000]">
                                    <Building2 className="w-5 h-5 text-black stroke-[2.5]" />
                                </div>
                            )}
                            <div className="min-w-0">
                                <p className="text-sm font-black text-black truncate">
                                    {clubName || "Student Club Chapter"}
                                </p>
                                <p className="text-xs font-bold text-neutral-500 truncate flex items-center gap-1">
                                    <GraduationCap className="w-3.5 h-3.5 text-neutral-600 shrink-0" />
                                    <span>{collegeName || "College Campus"}</span>
                                </p>
                            </div>
                        </div>

                        <span className="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider border-2 border-black bg-[#a2ff86] text-black">
                            ● Live Event
                        </span>
                    </div>

                    {/* Banner */}
                    <div className="w-full aspect-[16/9] bg-neutral-900 border-b-4 border-black relative overflow-hidden flex items-center justify-center">
                        {coverImageUrl ? (
                            <img
                                src={coverImageUrl}
                                alt="Event Banner"
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full bg-[#FAF6EE] flex flex-col items-center justify-center p-4 text-neutral-500 gap-2">
                                <ImageIcon className="w-8 h-8 stroke-[2]" />
                                <span className="text-xs font-black text-neutral-700">
                                    Event Invitation Banner
                                </span>
                            </div>
                        )}

                        <div className="absolute top-3 left-3">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#FFE566] text-black border-2 border-black text-xs font-black uppercase tracking-wider">
                                <MapPin className="w-3.5 h-3.5 stroke-[2.5]" />
                                <span>
                                    {locationType === "virtual"
                                        ? "Virtual Stream"
                                        : locationType === "hybrid"
                                        ? "Hybrid Session"
                                        : "In-Person (Campus)"}
                                </span>
                            </span>
                        </div>
                    </div>

                    {/* Body */}
                    <div className="p-5 space-y-3">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-black border-2 border-black text-xs font-black">
                            <Calendar className="w-3.5 h-3.5 stroke-[2.5] text-neutral-800" />
                            <span>{formattedStartDate}</span>
                        </div>

                        <h3 className="text-xl font-black text-black tracking-tight line-clamp-2">
                            {title.trim() || "Untitled Event Session"}
                        </h3>

                        <p className="text-xs text-neutral-700 font-medium leading-relaxed">
                            {summary?.trim() ||
                                description?.trim() ||
                                "Join us for this campus event organized on Orbix."}
                        </p>

                        <div className="pt-2 border-t-2 border-black/10 flex items-center justify-between gap-3 text-xs font-bold text-neutral-800">
                            <div className="flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5 text-neutral-700 shrink-0" />
                                <span>
                                    {venueOrLocation?.trim() ||
                                        (locationType === "virtual"
                                            ? "Online Session Link"
                                            : "Main Auditorium / Campus Block")}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Strip */}
                    <div className="px-5 py-3 bg-white border-t-4 border-black flex items-center justify-between text-xs font-black text-black">
                        <span className="flex items-center gap-1.5 text-neutral-700">
                            <GraduationCap className="w-4 h-4 text-black shrink-0 stroke-[2.5]" />
                            <span>{collegeName || "Campus Event"}</span>
                        </span>
                        <span className="text-[11px] uppercase tracking-wider font-mono text-neutral-500">
                            Orbix Event Invite
                        </span>
                    </div>
                </div>

                {/* Clean Back Node */}
                <div
                    ref={backExportRef}
                    style={{ width: 500 }}
                    className="rounded-2xl bg-[#FAF6EE] border-4 border-black overflow-hidden flex flex-col justify-between"
                >
                    {/* Header */}
                    <div className="p-4 bg-white border-b-4 border-black flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-xl bg-[#FFE566] border-2 border-black shrink-0">
                                <Sparkles className="w-5 h-5 text-black stroke-[2.5]" />
                            </div>
                            <div>
                                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block">
                                    Orbix Event Invitation
                                </span>
                                <p className="text-sm font-black text-black">
                                    Scan to Register & RSVP
                                </p>
                            </div>
                        </div>

                        <span className="text-xs font-black uppercase px-3 py-1 rounded-lg bg-[#FAF6EE] text-black border-2 border-black">
                            Event Invite
                        </span>
                    </div>

                    {/* QR Code Centerpiece (Export) */}
                    <div className="p-6 flex flex-col items-center justify-center space-y-4">
                        <div className="p-4 bg-white rounded-2xl border-4 border-black shadow-[4px_4px_0px_#000] flex flex-col items-center">
                            <OrbixCardQR
                                value={directRegistrationUrl}
                                size={190}
                                showLogo={true}
                                noShadow={true}
                                className="p-1.5"
                            />
                            <span className="text-xs font-black uppercase tracking-wider text-black mt-2.5 flex items-center gap-1.5">
                                <QrCode className="w-4 h-4 stroke-[2.5]" />
                                Scan with Phone Camera
                            </span>
                        </div>

                        {/* College Exclusivity */}
                        <div className="w-full p-3 rounded-xl bg-[#FFE566] border-2 border-black flex items-center gap-2 text-xs font-black text-black">
                            <GraduationCap className="w-4 h-4 shrink-0 stroke-[2.5]" />
                            <span className="truncate">
                                Exclusively for students of {collegeName}
                            </span>
                        </div>

                        {/* Event Specs */}
                        <div className="w-full grid grid-cols-2 gap-3 text-left">
                            <div className="p-2.5 rounded-xl bg-white border-2 border-black">
                                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block">
                                    Event Date
                                </span>
                                <p className="text-xs font-bold text-black truncate">
                                    {startsAt ? new Date(startsAt).toLocaleDateString() : "TBA"}
                                </p>
                            </div>
                            <div className="p-2.5 rounded-xl bg-white border-2 border-black">
                                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block">
                                    Host Society
                                </span>
                                <p className="text-xs font-bold text-black truncate">
                                    {clubName}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Strip */}
                    <div className="px-5 py-3 bg-white border-t-4 border-black flex items-center justify-between text-xs font-black text-black">
                        <span className="text-neutral-700 font-bold">
                            Scan with camera or Orbix app to RSVP
                        </span>
                        <span className="text-[11px] uppercase tracking-wider font-mono text-neutral-500">
                            Orbix Campus
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};
