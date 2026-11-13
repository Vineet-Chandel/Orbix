import React from "react";
import {
    CheckCircle2,
    AlertCircle,
    Calendar,
    MapPin,
    Users,
} from "lucide-react";
import type { ConfiguredStage } from "./types";
import type { FormQuestion } from "../../../api/clubEventFormApi";
import type { ClubEventStatus } from "../../../store/clubEventsSlice";

interface EventWizardReviewStepProps {
    form: {
        title: string;
        summary: string;
        description: string;
        startsAt: string;
        endsAt: string;
        timezone: string;
        locationType: "in_person" | "virtual" | "hybrid";
        venueOrLocation: string;
        registrationUrl: string;
        coverImageUrl: string;
        status: ClubEventStatus;
        scope: "PAN_INDIA" | "CAMPUS";
        isTeamEvent: boolean;
        minTeamSize: number;
        maxTeamSize: number;
    };
    stages: ConfiguredStage[];
    formQuestions: FormQuestion[];
    collegeName?: string;
    onJumpToStep: (stepNumber: 1 | 2 | 3 | 4) => void;
}

export const EventWizardReviewStep: React.FC<EventWizardReviewStepProps> = ({
    form,
    stages,
    formQuestions,
    collegeName,
    onJumpToStep,
}) => {
    // Validation checks
    const hasTitle = Boolean(form.title.trim());
    const hasValidEventDates = Boolean(form.startsAt && (!form.endsAt || new Date(form.endsAt) >= new Date(form.startsAt)));
    const hasStages = stages.length > 0;
    const stagesValid = stages.every((s) => new Date(s.endsAt) >= new Date(s.startsAt));

    const isFullyReady = hasTitle && hasValidEventDates && hasStages && stagesValid;

    return (
        <div className="space-y-6">
            {/* Readiness Banner */}
            <div
                className={`p-5 rounded-2xl border-3 border-black shadow-[4px_4px_0px_#000] flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    isFullyReady ? "bg-[#a2ff86]" : "bg-[#FFE566]"
                }`}
            >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000] shrink-0">
                        {isFullyReady ? (
                            <CheckCircle2 className="w-6 h-6 text-emerald-600 stroke-[3]" />
                        ) : (
                            <AlertCircle className="w-6 h-6 text-amber-600 stroke-[3]" />
                        )}
                    </div>
                    <div>
                        <h3 className="font-black text-base sm:text-lg text-black">
                            {isFullyReady ? "Ready to Launch & Publish Event!" : "Review Required Before Publishing"}
                        </h3>
                        <p className="text-xs font-bold text-neutral-800">
                            {isFullyReady
                                ? "All timeline stages, eligibility rules, and forms have been verified."
                                : "Please address remaining items or validation issues before publishing."}
                        </p>
                    </div>
                </div>

                <span className="px-3 py-1 rounded-full bg-black text-white text-xs font-black uppercase tracking-wider shrink-0 text-center">
                    Publication State: {form.status}
                </span>
            </div>

            {/* Grid Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* Left: Summary Cards (7 cols) */}
                <div className="lg:col-span-7 space-y-4">
                    {/* Event Scope & Identity */}
                    <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-black uppercase text-neutral-500">Event Overview</span>
                            <button
                                type="button"
                                onClick={() => onJumpToStep(1)}
                                className="text-xs font-black text-indigo-700 hover:underline cursor-pointer"
                            >
                                Edit Info &rarr;
                            </button>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border border-black bg-[#FFE566] text-black">
                                {form.scope === "PAN_INDIA" ? "Pan India Flagship" : "Campus Exclusive"}
                            </span>
                            <span className="text-xs font-bold text-neutral-600">
                                {collegeName || "Campus Event"}
                            </span>
                        </div>

                        <h2 className="text-xl font-black text-black">{form.title || "Untitled Event"}</h2>
                        {form.summary && <p className="text-xs font-medium text-neutral-700">{form.summary}</p>}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-black/10 text-xs font-bold">
                            <div className="flex items-center gap-1.5 text-neutral-800">
                                <Calendar className="w-3.5 h-3.5 text-neutral-500" />
                                <span>{form.startsAt ? new Date(form.startsAt).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "Unscheduled"}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-neutral-800">
                                <MapPin className="w-3.5 h-3.5 text-neutral-500" />
                                <span>{form.venueOrLocation || (form.locationType === "virtual" ? "Virtual Online" : "Campus Hall")}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-neutral-800">
                                <Users className="w-3.5 h-3.5 text-neutral-500" />
                                <span>{form.isTeamEvent ? `Team Event (${form.minTeamSize}-${form.maxTeamSize} members)` : "Solo Participation"}</span>
                            </div>
                        </div>
                    </div>

                    {/* Timeline Stages Summary */}
                    <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-black uppercase text-neutral-500">
                                Configured Timeline ({stages.length} Stages)
                            </span>
                            <button
                                type="button"
                                onClick={() => onJumpToStep(2)}
                                className="text-xs font-black text-indigo-700 hover:underline cursor-pointer"
                            >
                                Edit Timeline &rarr;
                            </button>
                        </div>

                        <div className="space-y-2">
                            {stages.map((stage) => (
                                <div
                                    key={stage.id}
                                    className="p-3 rounded-xl bg-[#FAF6EE] border border-black/20 flex items-center justify-between text-xs font-bold"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="w-5 h-5 rounded-md bg-black text-[#a2ff86] font-black text-[10px] flex items-center justify-center">
                                            {stage.stageOrder}
                                        </span>
                                        <div>
                                            <span className="text-black font-black block">{stage.name}</span>
                                            <span className="text-[10px] text-neutral-500 uppercase">{stage.type}</span>
                                        </div>
                                    </div>

                                    <div className="text-right text-[11px] text-neutral-600">
                                        <span>{stage.startsAt ? new Date(stage.startsAt).toLocaleDateString("en-IN", { month: "short", day: "numeric" }) : ""}</span>
                                        {" — "}
                                        <span>{stage.endsAt ? new Date(stage.endsAt).toLocaleDateString("en-IN", { month: "short", day: "numeric" }) : ""}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right: Validation Checklist & Banner (5 cols) */}
                <div className="lg:col-span-5 space-y-4">
                    {/* Cover Banner Preview */}
                    <div className="p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-black uppercase text-neutral-500">Cover Banner</span>
                            <button
                                type="button"
                                onClick={() => onJumpToStep(4)}
                                className="text-xs font-black text-indigo-700 hover:underline cursor-pointer"
                            >
                                Change Banner &rarr;
                            </button>
                        </div>

                        {form.coverImageUrl ? (
                            <div className="w-full aspect-[2.4/1] rounded-xl border-2 border-black overflow-hidden bg-neutral-950 shadow-[2px_2px_0px_#000]">
                                <img src={form.coverImageUrl} alt="Banner" className="w-full h-full object-cover" />
                            </div>
                        ) : (
                            <div className="w-full aspect-[2.4/1] rounded-xl border-2 border-dashed border-black/40 flex items-center justify-center text-xs font-bold text-neutral-500 bg-neutral-100">
                                No banner selected (Default will be used)
                            </div>
                        )}
                    </div>

                    {/* Pre-flight Checklist */}
                    <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-3">
                        <span className="text-xs font-black uppercase text-black block">Pre-Flight Verification</span>

                        <div className="space-y-2 text-xs font-bold">
                            <div className="flex items-center justify-between">
                                <span className="text-neutral-700">Event Title & Basic Info</span>
                                {hasTitle ? (
                                    <span className="text-emerald-700 flex items-center gap-1 font-black">
                                        <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                                    </span>
                                ) : (
                                    <span className="text-rose-600 flex items-center gap-1 font-black">
                                        <AlertCircle className="w-3.5 h-3.5" /> Title Required
                                    </span>
                                )}
                            </div>

                            <div className="flex items-center justify-between">
                                <span className="text-neutral-700">Timeline & Stages Configured</span>
                                {hasStages ? (
                                    <span className="text-emerald-700 flex items-center gap-1 font-black">
                                        <CheckCircle2 className="w-3.5 h-3.5" /> {stages.length} Stages Armed
                                    </span>
                                ) : (
                                    <span className="text-amber-600 flex items-center gap-1 font-black">
                                        <AlertCircle className="w-3.5 h-3.5" /> No Stages
                                    </span>
                                )}
                            </div>

                            <div className="flex items-center justify-between">
                                <span className="text-neutral-700">Registration Form Fields</span>
                                <span className="text-emerald-700 flex items-center gap-1 font-black">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> {formQuestions.length} Fields Active
                                </span>
                            </div>

                            <div className="flex items-center justify-between">
                                <span className="text-neutral-700">Email Notification Automation</span>
                                <span className="text-emerald-700 flex items-center gap-1 font-black">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Idempotent Outbox Ready
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
