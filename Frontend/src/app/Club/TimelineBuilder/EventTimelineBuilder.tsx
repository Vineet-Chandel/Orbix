import React, { useState } from "react";
import {
    Plus,
    Calendar,
    Clock,
    Trash2,
    Copy,
    ChevronUp,
    ChevronDown,
    AlertCircle,
    Shield,
    Sparkles,
    FileCheck,
    Layers,
    X,
} from "lucide-react";
import type { ConfiguredStage, StageType, StageEligibility, StageActionType } from "./types";
import { STAGE_TEMPLATES, type StageTemplateDefinition } from "./StageTemplates";
import { NeoSelect, type NeoSelectOption } from "../../../components/NeoSelect";
import { NeoDateTimePicker } from "../../../components/NeoDateTimePicker";
import { NeoCheckbox } from "../../../components/NeoCheckbox";
import {
    validateStageTiming,
    formatDateTimeDisplay,
    formatDateToInput,
} from "../eventWizardNavigationGuard";

const STAGE_CATEGORY_OPTIONS: NeoSelectOption[] = [
    { value: "registration", label: "Registration" },
    { value: "team_formation", label: "Team Formation" },
    { value: "submission", label: "Submission Round" },
    { value: "screening", label: "Screening & Review" },
    { value: "evaluation", label: "Evaluation Round" },
    { value: "development", label: "Development Sprint" },
    { value: "presentation", label: "Presentation / Pitch" },
    { value: "offline_finale", label: "Offline Finale" },
    { value: "results", label: "Results Announcement" },
    { value: "certificates", label: "Certificate Distribution" },
    { value: "custom", label: "Custom Stage" },
];

const STAGE_ELIGIBILITY_OPTIONS: NeoSelectOption[] = [
    { value: "all_registered", label: "All Registered Participants" },
    { value: "accepted_only", label: "Accepted / Approved Only" },
    { value: "shortlisted_only", label: "Shortlisted From Previous Round" },
    { value: "selected_teams_only", label: "Selected Teams Only" },
];

const STAGE_ACTION_OPTIONS: NeoSelectOption[] = [
    { value: "registration", label: "Initial Registration" },
    { value: "submit_idea", label: "Submit Project / Idea" },
    { value: "upload_docs", label: "Upload Pitch Deck / Document" },
    { value: "submit_project", label: "Submit Code & Demo Links" },
    { value: "attend_live", label: "Attend Presentation / Finale" },
    { value: "view_results", label: "View Verified Results" },
    { value: "internal_review", label: "Internal Organizer / Judge Only" },
    { value: "none", label: "No Action Required" },
];

interface EventTimelineBuilderProps {
    stages: ConfiguredStage[];
    onChange: (stages: ConfiguredStage[]) => void;
    eventStartsAt?: string;
    eventEndsAt?: string;
    isTeamEvent?: boolean;
}

export const EventTimelineBuilder: React.FC<EventTimelineBuilderProps> = ({
    stages,
    onChange,
    eventStartsAt,
    eventEndsAt,
    isTeamEvent,
}) => {
    const [selectedStageId, setSelectedStageId] = useState<string | null>(stages[0]?.id || null);
    const [showTemplatePicker, setShowTemplatePicker] = useState(false);

    const activeStage = stages.find((s) => s.id === selectedStageId) || stages[0];

    // Helper to calculate smart default dates for a newly added stage strictly inside boundaries
    const computeNextStageDates = (durationHours = 24) => {
        const now = new Date();
        let baseStart: Date;
        if (stages.length > 0) {
            const lastStage = stages[stages.length - 1];
            const lastEnd = lastStage.endsAt ? new Date(lastStage.endsAt) : null;
            baseStart = lastEnd && !isNaN(lastEnd.getTime()) ? lastEnd : (eventStartsAt ? new Date(eventStartsAt) : now);
        } else if (eventStartsAt) {
            baseStart = new Date(eventStartsAt);
        } else {
            baseStart = now;
        }

        // Never start before eventStartsAt
        if (eventStartsAt) {
            const eStart = new Date(eventStartsAt);
            if (!isNaN(eStart.getTime()) && baseStart < eStart) {
                baseStart = eStart;
            }
        }

        let baseEnd = new Date(baseStart.getTime() + durationHours * 3600 * 1000);

        // Never exceed eventEndsAt if eventEndsAt is specified
        if (eventEndsAt) {
            const eEnd = new Date(eventEndsAt);
            if (!isNaN(eEnd.getTime())) {
                if (baseStart >= eEnd) {
                    baseStart = new Date(Math.max(eEnd.getTime() - Math.min(durationHours * 3600 * 1000, 3600 * 1000), eventStartsAt ? new Date(eventStartsAt).getTime() : 0));
                }
                if (baseEnd > eEnd) {
                    baseEnd = eEnd;
                }
            }
        }

        return {
            startsAt: formatDateToInput(baseStart),
            endsAt: formatDateToInput(baseEnd),
        };
    };

    // Auto-fit all stages proportionally into event timeline if out-of-bounds
    const handleAutoFitStages = () => {
        if (!eventStartsAt || stages.length === 0) return;
        const sDate = new Date(eventStartsAt);
        const hasEnd = Boolean(eventEndsAt && !isNaN(new Date(eventEndsAt).getTime()) && new Date(eventEndsAt).getTime() > sDate.getTime());
        const eDate = hasEnd ? new Date(eventEndsAt!) : new Date(sDate.getTime() + stages.length * 86400000);
        const totalMs = Math.max(eDate.getTime() - sDate.getTime(), stages.length * 3600 * 1000);

        const segmentMs = Math.floor(totalMs / stages.length);
        const updated = stages.map((st, idx) => {
            const stStart = new Date(sDate.getTime() + idx * segmentMs);
            const stEnd = idx === stages.length - 1 ? eDate : new Date(sDate.getTime() + (idx + 1) * segmentMs);
            return {
                ...st,
                startsAt: formatDateToInput(stStart),
                endsAt: formatDateToInput(stEnd),
            };
        });
        onChange(updated);
    };

    // Add stage from a template
    const handleAddFromTemplate = (template: StageTemplateDefinition) => {
        const { startsAt, endsAt } = computeNextStageDates(template.defaultDurationHours);
        const newStage: ConfiguredStage = {
            id: `stage_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            name: template.name,
            type: template.type,
            description: template.description,
            instructions: template.instructions,
            stageOrder: stages.length + 1,
            startsAt,
            endsAt,
            timezone: "Asia/Kolkata",
            eligibilityType: template.eligibilityType,
            actionType: template.actionType,
            requirements: {
                allowResubmission: template.defaultRequirements?.allowResubmission ?? true,
                maxSubmissions: template.defaultRequirements?.maxSubmissions ?? 1,
                teamSubmissionOnly: template.defaultRequirements?.teamSubmissionOnly ?? (isTeamEvent || false),
                leaderOnlySubmit: template.defaultRequirements?.leaderOnlySubmit ?? true,
                allMembersCanView: template.defaultRequirements?.allMembersCanView ?? true,
                lateSubmissionPolicy: template.defaultRequirements?.lateSubmissionPolicy ?? "disallow",
                requireApprovalToAdvance: template.defaultRequirements?.requireApprovalToAdvance ?? false,
            },
            formConfig: template.defaultFields
                ? {
                      title: `${template.name} Requirements`,
                      description: template.instructions,
                      fields: template.defaultFields,
                      allowedFileTypes: ["pdf", "pptx", "png", "zip"],
                      maxFileSizeBytes: 26214400,
                      maxFiles: 5,
                  }
                : undefined,
        };

        const updated = [...stages, newStage];
        onChange(updated);
        setSelectedStageId(newStage.id);
        setShowTemplatePicker(false);
    };

    // Add blank custom stage
    const handleAddCustomStage = () => {
        const { startsAt, endsAt } = computeNextStageDates(24);
        const newStage: ConfiguredStage = {
            id: `stage_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            name: `Round ${stages.length + 1}`,
            type: "custom",
            description: "Custom stage description.",
            instructions: "Participant guidelines for this stage.",
            stageOrder: stages.length + 1,
            startsAt,
            endsAt,
            timezone: "Asia/Kolkata",
            eligibilityType: stages.length === 0 ? "all_registered" : "shortlisted_only",
            actionType: "submit_idea",
            requirements: {
                allowResubmission: true,
                maxSubmissions: 1,
                teamSubmissionOnly: isTeamEvent || false,
                leaderOnlySubmit: true,
                allMembersCanView: true,
                lateSubmissionPolicy: "disallow",
                requireApprovalToAdvance: false,
            },
        };

        const updated = [...stages, newStage];
        onChange(updated);
        setSelectedStageId(newStage.id);
    };

    // Update active stage
    const handleUpdateActiveStage = (field: keyof ConfiguredStage, value: any) => {
        if (!activeStage) return;
        const updated = stages.map((s) => (s.id === activeStage.id ? { ...s, [field]: value } : s));
        onChange(updated);
    };

    // Update requirements
    const handleUpdateRequirement = (field: keyof ConfiguredStage["requirements"], value: any) => {
        if (!activeStage) return;
        const updatedRequirements = { ...activeStage.requirements, [field]: value };
        handleUpdateActiveStage("requirements", updatedRequirements);
    };

    // Duplicate stage
    const handleDuplicateStage = (stageToDup: ConfiguredStage) => {
        const newStage: ConfiguredStage = {
            ...stageToDup,
            id: `stage_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            name: `${stageToDup.name} (Copy)`,
            stageOrder: stages.length + 1,
        };
        const updated = [...stages, newStage];
        onChange(updated);
        setSelectedStageId(newStage.id);
    };

    // Delete stage
    const handleDeleteStage = (stageId: string) => {
        if (stages.length <= 1) {
            alert("An event must have at least one stage (e.g. Registration).");
            return;
        }
        const updated = stages.filter((s) => s.id !== stageId).map((s, idx) => ({ ...s, stageOrder: idx + 1 }));
        onChange(updated);
        if (selectedStageId === stageId) {
            setSelectedStageId(updated[0]?.id || null);
        }
    };

    // Move stage up / down
    const handleMoveStage = (index: number, direction: "up" | "down") => {
        const targetIndex = direction === "up" ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= stages.length) return;

        const updated = [...stages];
        const [moved] = updated.splice(index, 1);
        updated.splice(targetIndex, 0, moved);

        const reordered = updated.map((s, idx) => ({ ...s, stageOrder: idx + 1 }));
        onChange(reordered);
    };

    const hasAnyStageErrors = stages.some((s) => validateStageTiming(s, eventStartsAt, eventEndsAt).hasError);
    const hasAnyOutOfBounds = stages.some((s) => validateStageTiming(s, eventStartsAt, eventEndsAt).isOutOfBounds);
    const activeValidation = activeStage
        ? validateStageTiming(activeStage, eventStartsAt, eventEndsAt)
        : { hasError: false, isOutOfBounds: false, startsAtError: undefined, endsAtError: undefined, summaryError: undefined };

    return (
        <div className="space-y-6">
            {/* Header Ribbon & Quick Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000]">
                <div>
                    <h3 className="font-black text-base sm:text-lg text-black flex items-center gap-2">
                        <Layers className="w-5 h-5 text-indigo-600" />
                        <span>Interactive Event Timeline & Rounds Engine</span>
                    </h3>
                    <p className="text-xs font-bold text-neutral-600">
                        Configure rounds, submission windows, judging criteria, and participant eligibility.
                    </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        type="button"
                        onClick={() => setShowTemplatePicker(!showTemplatePicker)}
                        className="px-3 py-1.5 rounded-xl border-2 border-black bg-[#FFE566] hover:bg-[#fedd33] font-black text-xs shadow-[2px_2px_0px_#000] cursor-pointer flex items-center gap-1.5"
                    >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Add from Template</span>
                    </button>
                    <button
                        type="button"
                        onClick={handleAddCustomStage}
                        className="px-3 py-1.5 rounded-xl border-2 border-black bg-black text-[#a2ff86] hover:bg-neutral-800 font-black text-xs shadow-[2px_2px_0px_#000] cursor-pointer flex items-center gap-1.5"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Custom Round</span>
                    </button>
                </div>
            </div>

            {/* Event Timeline Boundaries Ribbon Banner */}
            {eventStartsAt && (
                <div
                    className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl border-2 transition-all ${
                        hasAnyOutOfBounds
                            ? "bg-rose-50 border-rose-600 shadow-[3px_3px_0px_#e11d48]"
                            : "bg-[#FAF6EE] border-black shadow-[2px_2px_0px_#000]"
                    }`}
                >
                    <div className="flex items-center gap-2.5 text-xs font-bold text-black min-w-0">
                        <Calendar className="w-4 h-4 text-black shrink-0" />
                        <span className="text-neutral-700 shrink-0">Main Event Timeline:</span>
                        <span className="font-black text-black truncate">
                            {formatDateTimeDisplay(eventStartsAt)}
                            {eventEndsAt ? ` → ${formatDateTimeDisplay(eventEndsAt)}` : " onwards (No end date set)"}
                        </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        {hasAnyOutOfBounds ? (
                            <>
                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-rose-600 text-white flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" />
                                    Boundary Violation
                                </span>
                                <button
                                    type="button"
                                    onClick={handleAutoFitStages}
                                    className="px-2.5 py-1 rounded-lg border-2 border-black bg-[#FFE566] hover:bg-[#fedd33] font-black text-[11px] shadow-[1.5px_1.5px_0px_#000] cursor-pointer flex items-center gap-1 transition-all active:translate-x-[0.5px] active:translate-y-[0.5px]"
                                    title="Automatically adjust round dates to fit inside the event timeline"
                                >
                                    <Sparkles className="w-3 h-3" />
                                    <span>Auto-Fit Rounds</span>
                                </button>
                            </>
                        ) : hasAnyStageErrors ? (
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 border border-rose-300 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                Review Stages
                            </span>
                        ) : (
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-black text-[#a2ff86]">
                                Timeline Enforced
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* Template Selector Drawer */}
            {showTemplatePicker && (
                <div className="p-4 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[4px_4px_0px_#000] space-y-3 animate-in fade-in">
                    <div className="flex items-center justify-between pb-2 border-b-2 border-black/10">
                        <span className="text-xs font-black uppercase text-neutral-800">
                            Select Stage Template (HackCulture & Unstop Architecture)
                        </span>
                        <button
                            type="button"
                            onClick={() => setShowTemplatePicker(false)}
                            className="text-xs font-black text-neutral-500 hover:text-black cursor-pointer inline-flex items-center gap-1"
                        >
                            <X className="w-3.5 h-3.5" />
                            <span>Close</span>
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {STAGE_TEMPLATES.map((tpl) => (
                            <div
                                key={tpl.id}
                                onClick={() => handleAddFromTemplate(tpl)}
                                className="p-3 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000] hover:-translate-y-0.5 cursor-pointer transition-all space-y-1"
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-black text-black">{tpl.name}</span>
                                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-black/5 text-neutral-600 uppercase">
                                        {tpl.category}
                                    </span>
                                </div>
                                <p className="text-[11px] font-medium text-neutral-600 line-clamp-2">
                                    {tpl.description}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Split View: Left Timeline Flow + Right Stage Detail Configurator */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* LEFT: Chronological Timeline Pipeline (5 cols) */}
                <div className="lg:col-span-5 space-y-3">
                    <div className="p-3 bg-white rounded-xl border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-between">
                        <span className="text-xs font-black uppercase text-black">
                            Timeline Pipeline ({stages.length} Stages)
                        </span>
                        <span className="text-[10px] font-black text-neutral-500">
                            Chronological Sequence
                        </span>
                    </div>

                    <div className="space-y-2.5">
                        {stages.map((stage, index) => {
                            const isSelected = stage.id === selectedStageId;
                            const stageVal = validateStageTiming(stage, eventStartsAt, eventEndsAt);
                            const datesValid = !stageVal.hasError;

                            return (
                                <div
                                    key={stage.id}
                                    onClick={() => setSelectedStageId(stage.id)}
                                    className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer relative ${
                                        !datesValid
                                            ? isSelected
                                                ? "bg-rose-50/70 border-rose-600 ring-2 ring-rose-500 shadow-[4px_4px_0px_#e11d48] translate-x-1"
                                                : "bg-white border-rose-400 hover:border-rose-600 shadow-[2px_2px_0px_#e11d48]"
                                            : isSelected
                                            ? "bg-[#FAF6EE] border-black shadow-[4px_4px_0px_#000] translate-x-1"
                                            : "bg-white border-black/30 hover:border-black shadow-[2px_2px_0px_#000]"
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span
                                                className={`w-5 h-5 rounded-lg font-black text-xs flex items-center justify-center shrink-0 ${
                                                    !datesValid
                                                        ? "bg-rose-600 text-white"
                                                        : "bg-black text-[#a2ff86]"
                                                }`}
                                            >
                                                {stage.stageOrder}
                                            </span>
                                            <div className="min-w-0">
                                                <h4 className="font-black text-sm text-black truncate leading-tight">
                                                    {stage.name}
                                                </h4>
                                                <span className="text-[10px] font-black uppercase px-1.5 py-0.2 rounded bg-neutral-200 text-neutral-700">
                                                    {stage.type.replace("_", " ")}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Stage Reorder & Actions */}
                                        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                                            <button
                                                type="button"
                                                disabled={index === 0}
                                                onClick={() => handleMoveStage(index, "up")}
                                                className="p-1 rounded hover:bg-neutral-200 disabled:opacity-30 cursor-pointer"
                                                title="Move Up"
                                            >
                                                <ChevronUp className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                type="button"
                                                disabled={index === stages.length - 1}
                                                onClick={() => handleMoveStage(index, "down")}
                                                className="p-1 rounded hover:bg-neutral-200 disabled:opacity-30 cursor-pointer"
                                                title="Move Down"
                                            >
                                                <ChevronDown className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Date range chip */}
                                    <div className="mt-2 pt-2 border-t border-black/10 flex items-center justify-between text-[11px] font-bold">
                                        <div className="flex items-center gap-1 text-neutral-600 truncate">
                                            <Clock className="w-3 h-3 text-neutral-500 shrink-0" />
                                            <span className="truncate">
                                                {stage.startsAt ? new Date(stage.startsAt).toLocaleDateString("en-IN", { month: "short", day: "numeric" }) : "Start"}
                                                {" — "}
                                                {stage.endsAt ? new Date(stage.endsAt).toLocaleDateString("en-IN", { month: "short", day: "numeric" }) : "End"}
                                            </span>
                                        </div>

                                        {!datesValid ? (
                                            <span className="text-[10px] font-black text-rose-700 bg-rose-100 border border-rose-300 px-1.5 py-0.5 rounded-md flex items-center gap-1 shrink-0">
                                                <AlertCircle className="w-3 h-3 text-rose-600 shrink-0" />
                                                <span>{stageVal.isOutOfBounds ? "Outside Schedule" : "Invalid Dates"}</span>
                                            </span>
                                        ) : (
                                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md shrink-0">
                                                Valid
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* RIGHT: Active Stage Configuration Panel (7 cols) */}
                <div className="lg:col-span-7">
                    {activeStage ? (
                        <div className="p-5 sm:p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-5">
                            {/* Panel Header */}
                            <div className="flex items-center justify-between pb-3 border-b-2 border-black/10">
                                <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 rounded-md bg-[#FFE566] text-black border border-black text-xs font-black">
                                        Round {activeStage.stageOrder}
                                    </span>
                                    <h4 className="text-base font-black text-black">Stage Configuration</h4>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handleDuplicateStage(activeStage)}
                                        className="p-1.5 rounded-lg border border-black hover:bg-neutral-100 shadow-[1px_1px_0px_#000] text-xs font-black cursor-pointer flex items-center gap-1"
                                        title="Duplicate Stage"
                                    >
                                        <Copy className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleDeleteStage(activeStage.id)}
                                        className="p-1.5 rounded-lg border border-rose-500 text-rose-600 hover:bg-rose-50 text-xs font-black cursor-pointer flex items-center gap-1"
                                        title="Delete Stage"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>

                            {/* Basic Stage Information */}
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                    <div className="space-y-1">
                                        <label className="text-xs font-black text-black block">Stage Name *</label>
                                        <input
                                            type="text"
                                            value={activeStage.name}
                                            onChange={(e) => handleUpdateActiveStage("name", e.target.value)}
                                            placeholder="e.g. Idea Submission Round"
                                            className="w-full px-3 py-2 text-xs font-bold bg-[#FAF6EE] border-2 border-black rounded-xl shadow-[2px_2px_0px_#000] focus:outline-hidden focus:bg-white"
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-xs font-black text-black block">Stage Category / Type</label>
                                        <NeoSelect
                                            value={activeStage.type}
                                            onChange={(val) => handleUpdateActiveStage("type", val as StageType)}
                                            options={STAGE_CATEGORY_OPTIONS}
                                            size="sm"
                                            className="w-full"
                                            triggerClassName="font-bold bg-[#FAF6EE] text-xs"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-black text-black block">Stage Description</label>
                                    <input
                                        type="text"
                                        value={activeStage.description}
                                        onChange={(e) => handleUpdateActiveStage("description", e.target.value)}
                                        placeholder="Brief objective of this stage for public event listings..."
                                        className="w-full px-3 py-2 text-xs font-medium bg-[#FAF6EE] border-2 border-black rounded-xl shadow-[2px_2px_0px_#000] focus:outline-hidden focus:bg-white"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-black text-black block">Participant Guidelines & Instructions</label>
                                    <textarea
                                        rows={2}
                                        value={activeStage.instructions}
                                        onChange={(e) => handleUpdateActiveStage("instructions", e.target.value)}
                                        placeholder="Specific instructions shown to participants when submitting..."
                                        className="w-full px-3 py-2 text-xs font-medium bg-[#FAF6EE] border-2 border-black rounded-xl shadow-[2px_2px_0px_#000] focus:outline-hidden focus:bg-white resize-none"
                                    />
                                </div>
                            </div>

                            {/* Schedule & Timing Configuration */}
                            <div className="p-4 rounded-xl bg-[#FAF6EE] border border-black/30 space-y-3 relative z-20">
                                <div className="flex items-center justify-between flex-wrap gap-1">
                                    <span className="text-[11px] font-black uppercase text-black flex items-center gap-1.5">
                                        <Calendar className="w-3.5 h-3.5" />
                                        <span>Schedule & Deadlines (IST - Asia/Kolkata)</span>
                                    </span>
                                    {eventStartsAt && (
                                        <span className="text-[10px] font-bold text-neutral-600 bg-white/70 px-2 py-0.5 rounded-md border border-black/10">
                                            Limit: {new Date(eventStartsAt).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                                            {eventEndsAt ? ` – ${new Date(eventEndsAt).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}` : ""}
                                        </span>
                                    )}
                                </div>

                                {activeValidation.hasError && (
                                    <div className="p-3 rounded-xl bg-rose-50 border-2 border-rose-500 shadow-[2px_2px_0px_#e11d48] flex items-start gap-2.5 text-rose-950 animate-in fade-in">
                                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                                        <div className="text-xs font-bold leading-tight">
                                            <span className="font-black block text-rose-800">
                                                {activeValidation.isOutOfBounds ? "Timeline Boundary Violation" : "Invalid Round Schedule"}
                                            </span>
                                            <span className="text-rose-700 text-[11px]">
                                                {activeValidation.summaryError || "Please adjust round start and deadline dates to stay within the event schedule."}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <NeoDateTimePicker
                                            label="Round Starts At *"
                                            required
                                            value={activeStage.startsAt}
                                            onChange={(val) => handleUpdateActiveStage("startsAt", val)}
                                            error={activeValidation.startsAtError}
                                            minDate={eventStartsAt}
                                            maxDate={eventEndsAt}
                                            placeholder="Pick round start date & time"
                                            mode="datetime"
                                        />
                                    </div>

                                    <div>
                                        <NeoDateTimePicker
                                            label="Submission Deadline (Ends At) *"
                                            required
                                            value={activeStage.endsAt}
                                            onChange={(val) => handleUpdateActiveStage("endsAt", val)}
                                            error={activeValidation.endsAtError}
                                            minDate={activeStage.startsAt || eventStartsAt}
                                            maxDate={eventEndsAt}
                                            placeholder="Pick submission deadline"
                                            mode="datetime"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Eligibility & Participant Action Rules */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                <div className="space-y-1">
                                    <label className="text-xs font-black text-black flex items-center gap-1 mb-1">
                                        <Shield className="w-3.5 h-3.5" />
                                        <span>Round Eligibility</span>
                                    </label>
                                    <NeoSelect
                                        value={activeStage.eligibilityType}
                                        onChange={(val) => handleUpdateActiveStage("eligibilityType", val as StageEligibility)}
                                        options={STAGE_ELIGIBILITY_OPTIONS}
                                        size="sm"
                                        className="w-full"
                                        triggerClassName="font-bold bg-[#FAF6EE] text-xs"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-black text-black flex items-center gap-1 mb-1">
                                        <FileCheck className="w-3.5 h-3.5" />
                                        <span>Participant Action</span>
                                    </label>
                                    <NeoSelect
                                        value={activeStage.actionType}
                                        onChange={(val) => handleUpdateActiveStage("actionType", val as StageActionType)}
                                        options={STAGE_ACTION_OPTIONS}
                                        size="sm"
                                        className="w-full"
                                        triggerClassName="font-bold bg-[#FAF6EE] text-xs"
                                    />
                                </div>
                            </div>

                            {/* Submission Policies & Team Rules */}
                            <div className="p-3.5 rounded-xl border border-black/20 bg-white space-y-2.5">
                                <span className="text-[11px] font-black uppercase text-neutral-800 block">
                                    Submission Policies & Controls
                                </span>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-bold">
                                    <NeoCheckbox
                                        size="sm"
                                        colorScheme="green"
                                        checked={activeStage.requirements.allowResubmission}
                                        onCheckedChange={(checked) => handleUpdateRequirement("allowResubmission", checked)}
                                        label="Allow Resubmissions before Deadline"
                                    />

                                    {isTeamEvent && (
                                        <NeoCheckbox
                                            size="sm"
                                            colorScheme="yellow"
                                            checked={activeStage.requirements.leaderOnlySubmit}
                                            onCheckedChange={(checked) => handleUpdateRequirement("leaderOnlySubmit", checked)}
                                            label="Team Leader Only can Submit"
                                        />
                                    )}

                                    <NeoCheckbox
                                        size="sm"
                                        colorScheme="cyan"
                                        checked={activeStage.requirements.requireApprovalToAdvance}
                                        onCheckedChange={(checked) => handleUpdateRequirement("requireApprovalToAdvance", checked)}
                                        label="Organizer Approval Required to Advance"
                                    />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="p-8 text-center bg-white rounded-2xl border-2 border-black text-neutral-500 font-bold">
                            Select a stage from the timeline on the left to configure.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
