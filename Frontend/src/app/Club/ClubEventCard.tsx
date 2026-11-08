import React from "react";
import {
    Heart,
    Clock,
    MapPin,
    ExternalLink,
    Users,
    UserCheck,
    ArrowRight,
    Globe2,
    GraduationCap,
} from "lucide-react";
import type { ClubEvent } from "../../store/clubEventsSlice";
import { IndiaMapBackdrop, CampusPillarsBackdrop } from "../../components/ScopeBackdrops";

export interface ClubEventCardProps {
    event: ClubEvent;
    onSelect: (eventId: string) => void;
}

export const ClubEventCard: React.FC<ClubEventCardProps> = ({ event: ev, onSelect }) => {
    const isPanIndia = ev.scope === "PAN_INDIA";

    return (
        <div
            onClick={() => onSelect(ev.id)}
            className="relative overflow-hidden p-5 sm:p-6 rounded-3xl bg-white border-4 border-black shadow-[4px_4px_0px_#000] hover:shadow-[7px_7px_0px_#000] hover:-translate-y-1 hover:-translate-x-1 transition-all cursor-pointer flex flex-col justify-between group"
        >
            {/* Scope Architectural SVG Backdrop (India Map for Pan-India, Architectural Pillars for Campus) */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0">
                {isPanIndia ? (
                    <div className="absolute -right-6 -bottom-6 w-56 sm:w-64 h-56 sm:h-64 opacity-[0.06] group-hover:opacity-[0.14] group-hover:scale-105 transition-all duration-300 text-neutral-950">
                        <IndiaMapBackdrop className="w-full h-full object-contain" />
                    </div>
                ) : (
                    <div className="absolute -right-4 -bottom-6 w-48 sm:w-56 h-48 sm:h-56 opacity-[0.07] group-hover:opacity-[0.15] group-hover:scale-105 transition-all duration-300 text-neutral-900">
                        <CampusPillarsBackdrop className="w-full h-full object-contain" />
                    </div>
                )}
            </div>

            <div className="relative z-10 flex flex-col justify-between h-full">
                <div>
                    {/* Cover Banner if attached (100% full view, never cropped) */}
                    {ev.coverImageUrl && (
                        <div className="w-full aspect-[2.4/1] rounded-2xl border-2 border-black overflow-hidden mb-3.5 relative bg-neutral-950 shadow-[2px_2px_0px_#000] flex items-center justify-center">
                            <img
                                src={ev.coverImageUrl}
                                alt={ev.title}
                                className="w-full h-full object-contain group-hover:scale-102 transition-transform duration-300"
                            />
                            {ev.isOptimistic && (
                                <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-white border border-black shadow-[1px_1px_0px_#000] animate-pulse">
                                    Syncing...
                                </span>
                            )}
                            <span className="absolute top-2 right-2 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-white/95 text-rose-700 border-2 border-black shadow-[1.5px_1.5px_0px_#000] flex items-center gap-1">
                                <Heart className="w-3 h-3 fill-rose-600 text-rose-600" />
                                <span>{ev.likesCount || 0}</span>
                            </span>
                        </div>
                    )}

                    <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                            {/* Scope Identifier Pill */}
                            {isPanIndia ? (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#FF9933] text-black border-2 border-black shadow-[1px_1px_0px_#000] flex items-center gap-1">
                                    <Globe2 className="w-3 h-3 stroke-[2.5]" />
                                    <span>National Reach</span>
                                </span>
                            ) : (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#38BDF8] text-black border-2 border-black shadow-[1px_1px_0px_#000] flex items-center gap-1">
                                    <GraduationCap className="w-3 h-3 stroke-[2.5]" />
                                    <span>Campus Exclusive</span>
                                </span>
                            )}

                            {/* Status Pill */}
                            <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border-2 border-black ${
                                    ev.status === "published"
                                        ? "bg-emerald-300 text-black shadow-[1px_1px_0px_#000]"
                                        : ev.status === "completed"
                                        ? "bg-sky-200 text-black shadow-[1px_1px_0px_#000]"
                                        : ev.status === "draft"
                                        ? "bg-amber-200 text-black shadow-[1px_1px_0px_#000]"
                                        : "bg-rose-200 text-black shadow-[1px_1px_0px_#000]"
                                }`}
                            >
                                {ev.status === "published"
                                    ? "Published (Live)"
                                    : ev.status === "completed"
                                    ? "Completed"
                                    : ev.status === "draft"
                                    ? "Draft"
                                    : "Cancelled"}
                            </span>
                            {!ev.coverImageUrl && ev.isOptimistic && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-white border border-black shadow-[1px_1px_0px_#000] animate-pulse">
                                    Syncing...
                                </span>
                            )}
                        </div>
                        <span className="text-xs font-bold text-neutral-500 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {new Date(ev.startsAt).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                            })}
                        </span>
                    </div>

                    <h3 className="text-base sm:text-lg font-black text-neutral-900 line-clamp-1 group-hover:text-black transition-colors">
                        {ev.title}
                    </h3>
                    <p className="text-xs text-neutral-600 line-clamp-2 mt-1.5 leading-relaxed">
                        {ev.summary || ev.description || "No description provided."}
                    </p>

                    <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-neutral-600 font-medium">
                        <span className="flex items-center gap-1 font-bold">
                            <MapPin className="w-3.5 h-3.5 text-neutral-500" />
                            {ev.venueOrLocation ||
                                (ev.locationType === "virtual"
                                    ? "Virtual (Online)"
                                    : ev.locationType === "hybrid"
                                    ? "Hybrid"
                                    : "Campus Hall")}
                        </span>
                        {ev.registrationUrl && (
                            <span className="text-emerald-700 flex items-center gap-1 font-bold">
                                <span>RSVP Enabled</span>
                                <ExternalLink className="w-3 h-3" />
                            </span>
                        )}
                    </div>

                    {/* Event-wise Key Analytics Metrics */}
                    <div className="mt-3 flex items-center gap-2 text-xs font-bold flex-wrap">
                        <span className="inline-flex items-center gap-1 text-sky-950 bg-sky-50 px-2 py-0.5 rounded-md border border-black/20">
                            <Users className="w-3 h-3 text-sky-700 stroke-[2.5]" />
                            <span>{ev.registrationsCount || 0} RSVPs</span>
                        </span>
                        <span className="inline-flex items-center gap-1 text-emerald-950 bg-emerald-50 px-2 py-0.5 rounded-md border border-black/20">
                            <UserCheck className="w-3 h-3 text-emerald-700 stroke-[2.5]" />
                            <span>{ev.attendeesCount || 0} Attended</span>
                        </span>
                        <span className="inline-flex items-center gap-1 text-rose-950 bg-rose-50 px-2 py-0.5 rounded-md border border-black/20">
                            <Heart className="w-3 h-3 text-rose-600 fill-rose-600 stroke-[2.5]" />
                            <span>{ev.likesCount || 0} Likes</span>
                        </span>
                        {(ev.rejectedCount ?? 0) > 0 && (
                            <span className="inline-flex items-center gap-1 text-rose-950 bg-rose-50 px-2 py-0.5 rounded-md border border-black/20">
                                <span>{ev.rejectedCount} Rejected</span>
                            </span>
                        )}
                        {(Number(ev.registrationsCount) || 0) > 0 && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-[#FAF6EE] text-black text-[10px] font-black border border-black/30">
                                {Math.round(
                                    ((Number(ev.attendeesCount) || 0) /
                                        (Number(ev.registrationsCount) || 1)) *
                                        100
                                )}
                                % Turnout
                            </span>
                        )}
                    </div>
                </div>

                {/* Clean Action Footer: clicking navigates to dedicated event console */}
                <div className="mt-5 pt-3.5 border-t-2 border-black/10 flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-neutral-500 group-hover:text-black transition-colors">
                        Manage roster, agenda & analytics
                    </span>

                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#a2ff86] text-black text-xs font-black border-2 border-black shadow-[1.5px_1.5px_0px_#000] group-hover:bg-[#8ee673] group-hover:translate-x-0.5 transition-all shrink-0">
                        <span>Open Event</span>
                        <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
                    </span>
                </div>
            </div>
        </div>
    );
};
