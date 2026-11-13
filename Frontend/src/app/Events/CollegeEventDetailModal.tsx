import React, { useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import {
    X,
    Calendar,
    Clock,
    MapPin,
    Users,
    Heart,
    Share2,
    CheckCircle2,
    ExternalLink,
    Building2,
    BookOpen,
    Copy,
    Check,
    Video,
    ShieldCheck,
    ShieldAlert,
    ArrowRight,
    Globe2,
    GraduationCap,
    Lock,
} from "lucide-react";
import { useToast } from "../../context/ToastContext";
import type { CollegeEventItem } from "../../api/collegeEventsApi";
import { ClubMarkdownRenderer } from "../Club/Profile/ClubMarkdownRenderer";

interface CollegeEventDetailModalProps {
    event: CollegeEventItem | null;
    isOpen: boolean;
    onClose: () => void;
    onApply: (event: CollegeEventItem) => void;
    onToggleHeart?: (event: CollegeEventItem) => void;
}

export const CollegeEventDetailModal: React.FC<CollegeEventDetailModalProps> = ({
    event,
    isOpen,
    onClose,
    onApply,
    onToggleHeart,
}) => {
    const toast = useToast();
    const [copiedCode, setCopiedCode] = useState(false);
    const [copiedShareLink, setCopiedShareLink] = useState(false);

    if (!isOpen || !event) return null;

    const formattedStartDate = new Date(event.startsAt).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
    });

    const formattedStartTime = new Date(event.startsAt).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    });

    const formattedEndTime = event.endsAt
        ? new Date(event.endsAt).toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
          })
        : null;

    const isCompleted = event.status === "completed" || new Date(event.endsAt || event.startsAt).getTime() < Date.now();
    const isLiveNow =
        !isCompleted &&
        new Date(event.startsAt).getTime() <= Date.now() &&
        (event.endsAt ? new Date(event.endsAt).getTime() >= Date.now() : true);

    const handleCopyTicket = () => {
        if (!event.ticketCode) return;
        navigator.clipboard.writeText(event.ticketCode);
        setCopiedCode(true);
        toast.success("Pass code copied to clipboard!");
        setTimeout(() => setCopiedCode(false), 2000);
    };

    const handleCopyShareLink = () => {
        const url = `${window.location.origin}/college-events?event=${event.id}`;
        navigator.clipboard.writeText(url);
        setCopiedShareLink(true);
        toast.success("Event link copied to clipboard!");
        setTimeout(() => setCopiedShareLink(false), 2000);
    };

    if (typeof document === "undefined") return null;

    return createPortal(
        <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen z-[120] flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-sm overflow-y-auto">
            <div className="relative w-full max-w-5xl bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:18px_18px] rounded-2xl border-4 border-black shadow-[10px_10px_0px_#000] overflow-hidden my-auto flex flex-col max-h-[92vh]">
                {/* Modal Top Bar */}
                <div className="px-5 py-3.5 bg-white border-b-3 border-black flex items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-2 min-w-0">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border border-black shadow-[1px_1px_0px_#000] shrink-0 inline-flex items-center gap-1 ${
                            event.scope === "PAN_INDIA" ? "bg-[#FF9933] text-black" : "bg-[#a2ff86] text-black"
                        }`}>
                            {event.scope === "PAN_INDIA" ? (
                                <>
                                    <Globe2 className="w-3 h-3" />
                                    <span>Pan-India Flagship</span>
                                </>
                            ) : (
                                <>
                                    <GraduationCap className="w-3 h-3" />
                                    <span>Campus Session</span>
                                </>
                            )}
                        </span>
                        <span className="text-xs font-bold text-neutral-600 truncate hidden sm:inline">
                            {event.collegeName || "Verified College Event"}
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 shadow-[2px_2px_0px_#000] transition-transform active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
                            aria-label="Close modal"
                        >
                            <X className="w-4 h-4 text-black" />
                        </button>
                    </div>
                </div>

                {/* Main Scrollable Body */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                    {/* Hero Header Card */}
                    <div className="p-5 sm:p-6 rounded-2xl bg-white border-3 border-black shadow-[4px_4px_0px_#000] space-y-4">
                        {/* Cover Image Banner (100% full view, never cropped) */}
                        {event.coverImageUrl && (
                            <div className="relative w-full aspect-[2.4/1] rounded-xl border-2 border-black overflow-hidden shadow-[2px_2px_0px_#000] bg-neutral-950 flex items-center justify-center">
                                <img
                                    src={event.coverImageUrl}
                                    alt={event.title}
                                    className="w-full h-full object-contain"
                                />
                                <div className="absolute top-3 left-3 flex items-center gap-2">
                                    <span
                                        className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_#000] ${
                                            isCompleted
                                                ? "bg-neutral-200 text-neutral-800"
                                                : isLiveNow
                                                ? "bg-emerald-300 text-black animate-pulse"
                                                : "bg-[#a2ff86] text-black"
                                        }`}
                                    >
                                        {isCompleted ? "Completed" : isLiveNow ? "Live Now" : "Upcoming"}
                                    </span>
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                                <h1 className="text-2xl sm:text-3xl font-black text-black tracking-tight leading-tight flex-1">
                                    {event.title}
                                </h1>
                                <div className="flex items-center gap-2 shrink-0 pt-0.5">
                                    {onToggleHeart && (
                                        <button
                                            type="button"
                                            onClick={() => onToggleHeart(event)}
                                            className={`px-3 py-1.5 rounded-xl border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 transition-transform active:scale-95 cursor-pointer ${
                                                event.hasLiked
                                                    ? "bg-rose-100 text-rose-700"
                                                    : "bg-white hover:bg-neutral-100 text-neutral-800"
                                            }`}
                                            title={event.hasLiked ? "Remove heart" : "Appreciate event"}
                                        >
                                            <Heart
                                                className={`w-3.5 h-3.5 ${
                                                    event.hasLiked ? "fill-rose-600 text-rose-600" : "text-black"
                                                }`}
                                            />
                                            <span>{event.likesCount || 0}</span>
                                        </button>
                                    )}

                                    <button
                                        type="button"
                                        onClick={handleCopyShareLink}
                                        className="px-3 py-1.5 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 transition-transform active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
                                        title="Share event link"
                                    >
                                        {copiedShareLink ? <Check className="w-3.5 h-3.5 text-green-700" /> : <Share2 className="w-3.5 h-3.5" />}
                                        <span className="hidden sm:inline">{copiedShareLink ? "Copied" : "Share"}</span>
                                    </button>
                                </div>
                            </div>
                            {event.summary && (
                                <p className="text-sm sm:text-base font-semibold text-neutral-700 leading-relaxed">
                                    {event.summary}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* TWO-COLUMN SPLIT: Left Details | Right Full Description & Agenda */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                        {/* LEFT COLUMN: Other Details & Logistics (5 cols) */}
                        <div className="lg:col-span-5 space-y-4">
                            {/* 1. Hosting Club Information Card */}
                            <div className="p-4 sm:p-5 rounded-2xl bg-white border-3 border-black shadow-[4px_4px_0px_#000] space-y-3">
                                <div className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                                    Organized & Hosted By
                                </div>

                                <div className="flex items-center gap-3">
                                    {event.clubLogoUrl ? (
                                        <img
                                            src={event.clubLogoUrl}
                                            alt={event.clubName}
                                            className="w-12 h-12 rounded-xl border-2 border-black object-cover shadow-[2px_2px_0px_#000]"
                                        />
                                    ) : (
                                        <div className="w-12 h-12 rounded-xl border-2 border-black bg-[#a2ff86] flex items-center justify-center font-black text-base shadow-[2px_2px_0px_#000]">
                                            {event.clubName.slice(0, 2).toUpperCase()}
                                        </div>
                                    )}

                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5">
                                            <h3 className="font-black text-base text-black truncate leading-tight">
                                                {event.clubName}
                                            </h3>
                                            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                                        </div>
                                        <p className="text-xs font-bold text-neutral-600 flex items-center gap-1 truncate mt-0.5">
                                            <Building2 className="w-3.5 h-3.5 shrink-0" />
                                            <span className="truncate">{event.collegeName || "Campus Club"}</span>
                                        </p>
                                    </div>
                                </div>

                                <Link
                                    to={`/clubs/${event.clubSlug}`}
                                    className="w-full py-2 px-3 rounded-xl border-2 border-black bg-[#FAF6EE] hover:bg-neutral-100 text-xs font-black shadow-[2px_2px_0px_#000] flex items-center justify-center gap-1.5 transition-transform active:translate-x-0.5 active:translate-y-0.5"
                                >
                                    <span>Visit Club Showcase</span>
                                    <ArrowRight className="w-3.5 h-3.5" />
                                </Link>
                            </div>

                            {/* 2. Schedule & Venue Logistics Card */}
                            <div className="p-4 sm:p-5 rounded-2xl bg-white border-3 border-black shadow-[4px_4px_0px_#000] space-y-3">
                                <div className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                                    Date, Time & Venue
                                </div>

                                <div className="space-y-2.5 text-xs font-bold">
                                    {/* Date */}
                                    <div className="flex items-center gap-2.5 text-black">
                                        <div className="w-7 h-7 rounded-lg border-2 border-black bg-[#FAF6EE] flex items-center justify-center shrink-0">
                                            <Calendar className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <div className="font-black">{formattedStartDate}</div>
                                            <div className="text-[11px] text-neutral-500 font-medium">Session Date</div>
                                        </div>
                                    </div>

                                    {/* Time */}
                                    <div className="flex items-center gap-2.5 text-black">
                                        <div className="w-7 h-7 rounded-lg border-2 border-black bg-[#FAF6EE] flex items-center justify-center shrink-0">
                                            <Clock className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <div className="font-black">
                                                {formattedStartTime} {formattedEndTime ? `– ${formattedEndTime}` : ""}
                                                {event.timezone ? ` (${event.timezone})` : ""}
                                            </div>
                                            <div className="text-[11px] text-neutral-500 font-medium">Session Timing</div>
                                        </div>
                                    </div>

                                    {/* Venue / Location */}
                                    <div className="flex items-center gap-2.5 text-black">
                                        <div className="w-7 h-7 rounded-lg border-2 border-black bg-[#FAF6EE] flex items-center justify-center shrink-0">
                                            {event.locationType === "virtual" ? (
                                                <Video className="w-4 h-4" />
                                            ) : (
                                                <MapPin className="w-4 h-4" />
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="font-black truncate">
                                                {event.venueOrLocation ||
                                                    (event.locationType === "virtual"
                                                        ? "Virtual Session (Online Link)"
                                                        : event.locationType === "hybrid"
                                                        ? "Hybrid Campus & Online"
                                                        : "Campus Hall")}
                                            </div>
                                            <div className="text-[11px] text-neutral-500 font-medium">
                                                Mode: <span className="capitalize">{event.locationType || "In-Person"}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 3. Registration & Action Card */}
                            <div className="p-4 sm:p-5 rounded-2xl bg-white border-3 border-black shadow-[4px_4px_0px_#000] space-y-3.5">
                                <div className="flex items-center justify-between pb-2 border-b-2 border-black/10">
                                    <div className="text-[11px] font-black uppercase tracking-wider text-black">
                                        Registration Status
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs font-black text-neutral-800 bg-[#FAF6EE] px-2.5 py-0.5 rounded-full border border-black/20">
                                        <Users className="w-3.5 h-3.5 text-neutral-600" />
                                        <span>{event.registrationsCount || 0} registered</span>
                                    </div>
                                </div>

                                {event.isTeamEvent && (
                                    <div className="p-3 rounded-xl bg-[#a2ff86]/25 border-l-4 border-emerald-600 space-y-1">
                                        <div className="flex items-center gap-1.5 font-black text-black text-xs">
                                            <Users className="w-4 h-4 text-emerald-800 shrink-0" />
                                            <span>Team Registration Event ({event.minTeamSize || 1} to {event.maxTeamSize || 4} Members)</span>
                                        </div>
                                        <p className="text-[11px] text-neutral-700 font-medium leading-relaxed">
                                            Register as a Team Leader to invite members via @username, or join an existing squad with their 6-character team code before the event starts.
                                        </p>
                                    </div>
                                )}

                                {event.scope === "PAN_INDIA" && (
                                    <div className="p-3 rounded-xl bg-amber-500/10 border-l-4 border-amber-500 space-y-1.5">
                                        <div className="flex items-center gap-1.5 font-black text-black text-xs">
                                            <Globe2 className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                                            <span>Pan-India Live Notification Shield</span>
                                        </div>
                                        <div className="flex items-start gap-2 text-[11px] leading-relaxed">
                                            {event.isRegistered || event.registrationStatus === "registered" ? (
                                                <>
                                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                                                    <span className="font-semibold text-emerald-950">
                                                        Live tracking active: Start countdown, pass synchronization, and critical organizer updates are enabled for this national event.
                                                    </span>
                                                </>
                                            ) : (
                                                <>
                                                    <Lock className="w-3.5 h-3.5 text-amber-800 shrink-0 mt-0.5" />
                                                    <span className="font-medium text-neutral-700">
                                                        Non-registered students do not receive start reminders or tracking notifications. Register below to activate live entry tracking, deadline alerts, and verified pass sync.
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {event.registrationStatus === "registered" || event.registrationStatus === "attended" || (event.isRegistered && event.registrationStatus !== "pending") ? (
                                    <div className="p-3.5 rounded-xl bg-emerald-50 border-2 border-emerald-600 space-y-2.5">
                                        <div className="flex items-center gap-2 text-emerald-950 font-black text-xs">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                                            <span>Application Accepted · Your Pass is Active!</span>
                                        </div>
                                        {event.ticketCode && (
                                            <div className="flex items-center justify-between bg-white border border-emerald-700 px-3 py-2 rounded-lg text-xs font-mono">
                                                <span className="font-bold text-neutral-600">Ticket Pass:</span>
                                                <div className="flex items-center gap-2 font-black text-black">
                                                    <span>{event.ticketCode}</span>
                                                    <button
                                                        type="button"
                                                        onClick={handleCopyTicket}
                                                        className="p-1 hover:bg-neutral-100 rounded cursor-pointer"
                                                        title="Copy Ticket Code"
                                                    >
                                                        {copiedCode ? <Check className="w-3.5 h-3.5 text-green-700" /> : <Copy className="w-3.5 h-3.5" />}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : event.registrationStatus === "pending" || event.isPending ? (
                                    <div className="p-3.5 rounded-xl bg-amber-50 border-2 border-amber-600 space-y-1 text-center">
                                        <div className="flex items-center justify-center gap-2 text-amber-950 font-black text-xs">
                                            <Clock className="w-4 h-4 text-amber-700" />
                                            <span>Application Submitted · Pending Review</span>
                                        </div>
                                        <p className="text-[11px] font-bold text-amber-800 leading-relaxed">
                                            The {event.clubName} team is reviewing your profile. Once approved, your session ticket pass will be activated automatically.
                                        </p>
                                    </div>
                                ) : event.registrationStatus === "rejected" ? (
                                    <div className="p-3.5 rounded-xl bg-rose-50 border-2 border-rose-600 space-y-2 text-center">
                                        <div className="flex items-center justify-center gap-2 text-rose-950 font-black text-xs">
                                            <ShieldAlert className="w-4 h-4 text-rose-700" />
                                            <span>Application Not Selected</span>
                                        </div>
                                        <p className="text-[11px] font-bold text-rose-800 leading-relaxed">
                                            Your application was not selected by {event.clubName}. You may update your information and re-apply.
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                onClose();
                                                onApply(event);
                                            }}
                                            className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs cursor-pointer shadow-[2px_2px_0px_#000]"
                                        >
                                            Re-Submit Application
                                        </button>
                                    </div>
                                ) : isCompleted ? (
                                    <div className="p-3 rounded-xl bg-neutral-100 border border-neutral-300 text-center text-xs font-bold text-neutral-600">
                                        This event session has concluded.
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onClose();
                                            onApply(event);
                                        }}
                                        className="w-full py-3 rounded-xl bg-[#a2ff86] hover:bg-[#8cee70] text-black border-2 border-black font-black text-sm shadow-[3px_3px_0px_#000] cursor-pointer transition-transform active:translate-x-0.5 active:translate-y-0.5 flex items-center justify-center gap-2"
                                    >
                                        <span>Apply</span>
                                        <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                                    </button>
                                )}

                                {event.registrationUrl && (
                                    <a
                                        href={event.registrationUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-full py-2.5 px-3 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 text-xs font-black shadow-[2px_2px_0px_#000] flex items-center justify-center gap-1.5 transition-transform active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
                                    >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                        <span>External RSVP Link</span>
                                    </a>
                                )}
                            </div>
                        </div>

                        {/* RIGHT COLUMN: Full Description & Agenda (7 cols) */}
                        <div className="lg:col-span-7">
                            <div className="p-5 sm:p-6 rounded-2xl bg-white border-3 border-black shadow-[4px_4px_0px_#000] space-y-4">
                                <div className="flex items-center gap-2 border-b-2 border-black/10 pb-3">
                                    <BookOpen className="w-5 h-5 text-black" />
                                    <h2 className="font-black text-base sm:text-lg text-black tracking-tight">
                                        Full Description & Agenda
                                    </h2>
                                </div>

                                {/* Markdown Content */}
                                <div className="text-neutral-900 leading-relaxed min-h-[200px]">
                                    {event.description && event.description.trim() ? (
                                        <ClubMarkdownRenderer content={event.description} />
                                    ) : (
                                        <div className="p-8 text-center bg-[#FAF6EE] rounded-xl border-2 border-dashed border-black/20 space-y-2">
                                            <p className="text-xs font-bold text-neutral-500">
                                                No extended description or agenda has been posted for this session.
                                            </p>
                                            {event.summary && (
                                                <p className="text-xs font-semibold text-neutral-800 italic">
                                                    "{event.summary}"
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};
