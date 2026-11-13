import React, { useEffect, useState } from "react";
import {
    Layers,
    Clock,
    Play,
    Pause,
    ExternalLink,
    Sparkles,
    RefreshCw,
    Edit3,
    X,
} from "lucide-react";
import { eventLifecycleApi } from "../../../api/eventLifecycleApi";
import type { ConfiguredStage } from "../TimelineBuilder/types";
import { useToast } from "../../../context/ToastContext";

const GithubIcon: React.FC<{ className?: string }> = ({ className = "w-3.5 h-3.5" }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
);

interface ClubEventStagesConsoleProps {
    eventId: string;
    clubId: string;
    onEditStagesInWizard?: () => void;
}

export const ClubEventStagesConsole: React.FC<ClubEventStagesConsoleProps> = ({
    eventId,
    clubId: _clubId,
    onEditStagesInWizard,
}) => {
    const toast = useToast();
    const [stages, setStages] = useState<ConfiguredStage[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedStageId, setSelectedStageId] = useState<string | null>(null);

    // Submissions for selected stage
    const [submissions, setSubmissions] = useState<any[]>([]);
    const [loadingSubmissions, setLoadingSubmissions] = useState(false);
    const [submissionFilter, setSubmissionFilter] = useState("");

    // Criteria & judging state
    const [criteria, setCriteria] = useState<any[]>([]);
    const [judges, setJudges] = useState<any[]>([]);
    const [activeSubTab, setActiveSubTab] = useState<"submissions" | "criteria" | "advancements">("submissions");

    // Override modal
    const [overrideAction, setOverrideAction] = useState<"pause" | "resume" | "extend" | "close" | "reopen" | null>(null);
    const [overrideNote, setOverrideNote] = useState("");
    const [newEndsAt, setNewEndsAt] = useState("");
    const [isActionExecuting, setIsActionExecuting] = useState(false);

    const loadStages = async () => {
        setLoading(true);
        try {
            const data = await eventLifecycleApi.getStages(eventId);
            setStages(data);
            if (data.length > 0 && !selectedStageId) {
                setSelectedStageId(data[0].id);
            }
        } catch (err: any) {
            console.error("Error loading stages:", err);
            toast.error(err.message || "Failed to load stages.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (eventId) {
            loadStages();
        }
    }, [eventId]);

    // When selected stage changes, load its submissions, criteria, and judges
    useEffect(() => {
        if (!selectedStageId || !eventId) return;

        setLoadingSubmissions(true);
        Promise.all([
            eventLifecycleApi.getStageSubmissions(eventId, selectedStageId).catch(() => []),
            eventLifecycleApi.getJudgingCriteria(eventId, selectedStageId).catch(() => []),
            eventLifecycleApi.getAssignedJudges(eventId, selectedStageId).catch(() => []),
        ])
            .then(([subs, crits, jds]) => {
                setSubmissions(subs);
                setCriteria(crits);
                setJudges(jds);
            })
            .finally(() => setLoadingSubmissions(false));
    }, [selectedStageId, eventId]);

    const activeStage = stages.find((s) => s.id === selectedStageId) || stages[0];

    // Handle Manual Stage Override (pause, resume, extend, close, reopen)
    const handleExecuteOverride = async () => {
        if (!overrideAction || !activeStage) return;
        setIsActionExecuting(true);
        try {
            await eventLifecycleApi.manualStageOverride(eventId, activeStage.id, overrideAction, {
                newEndsAt: overrideAction === "extend" ? new Date(newEndsAt).toISOString() : undefined,
                note: overrideNote.trim() || undefined,
            });
            toast.success(`Stage ${overrideAction} completed successfully!`, { title: "Stage Updated" });
            setOverrideAction(null);
            setOverrideNote("");
            setNewEndsAt("");
            loadStages();
        } catch (err: any) {
            toast.error(err.message || `Failed to ${overrideAction} stage.`);
        } finally {
            setIsActionExecuting(false);
        }
    };

    const filteredSubmissions = submissions.filter((s) => {
        if (!submissionFilter) return true;
        const q = submissionFilter.toLowerCase();
        return (
            (s.submission_title && s.submission_title.toLowerCase().includes(q)) ||
            (s.participant_name && s.participant_name.toLowerCase().includes(q)) ||
            (s.team_name && s.team_name.toLowerCase().includes(q))
        );
    });

    if (loading) {
        return (
            <div className="p-8 text-center bg-white rounded-3xl border-2 border-black shadow-[4px_4px_0px_#000] space-y-2">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-black" />
                <p className="text-xs font-black uppercase text-neutral-600">Loading Stage Console...</p>
            </div>
        );
    }

    if (stages.length === 0) {
        return (
            <div className="p-10 text-center bg-white rounded-3xl border-3 border-black shadow-[6px_6px_0px_#000] space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-amber-100 border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center mx-auto text-amber-900">
                    <Layers className="w-8 h-8 stroke-[2.2]" />
                </div>
                <h3 className="text-lg font-black text-black">No Multi-Stage Timeline Configured</h3>
                <p className="text-xs text-neutral-600 font-bold max-w-md mx-auto">
                    This event is currently set up as a single-session event. You can add stages (registration, ideation, dev round, presentation, winner declaration) anytime.
                </p>
                {onEditStagesInWizard && (
                    <button
                        type="button"
                        onClick={onEditStagesInWizard}
                        className="px-5 py-2.5 rounded-xl bg-[#FFE566] hover:bg-[#ebd04e] text-black text-xs font-black border-2 border-black shadow-[3px_3px_0px_#000] cursor-pointer inline-flex items-center gap-2"
                    >
                        <Edit3 className="w-4 h-4 stroke-[2.5]" />
                        <span>Launch Timeline Architecture Builder</span>
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Top Pipeline Overview */}
            <div className="p-5 sm:p-6 rounded-3xl bg-white border-3 border-black shadow-[6px_6px_0px_#000] space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b-2 border-black/10">
                    <div>
                        <div className="flex items-center gap-2">
                            <Layers className="w-5 h-5 text-black" />
                            <h3 className="text-base sm:text-lg font-black text-black tracking-tight">
                                Event Stage Pipeline & Execution Engine
                            </h3>
                        </div>
                        <p className="text-xs text-neutral-600 font-medium mt-0.5">
                            Automated lifecycle orchestration: real-time submissions, deadline enforcement, judging rubric, and stage advancements.
                        </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        {onEditStagesInWizard && (
                            <button
                                type="button"
                                onClick={onEditStagesInWizard}
                                className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-neutral-100 border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] cursor-pointer flex items-center gap-1.5"
                            >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>Edit Timeline</span>
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={loadStages}
                            className="p-1.5 rounded-xl bg-white hover:bg-neutral-100 border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer"
                            title="Refresh Stages"
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Stage Tabs Navigation Strip */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {stages.map((stage, idx) => {
                        const isSelected = stage.id === selectedStageId;
                        const now = new Date();
                        const sDate = new Date(stage.startsAt);
                        const eDate = new Date(stage.endsAt);
                        const isActive = now >= sDate && now <= eDate;
                        const isPast = now > eDate;

                        return (
                            <div
                                key={stage.id}
                                onClick={() => setSelectedStageId(stage.id)}
                                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                                    isSelected
                                        ? "bg-[#FAF6EE] border-black shadow-[4px_4px_0px_#000] ring-3 ring-black"
                                        : "bg-white border-black/50 hover:border-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000]"
                                }`}
                            >
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="w-5 h-5 rounded-full bg-black text-white font-black text-[10px] flex items-center justify-center">
                                        {idx + 1}
                                    </span>
                                    <span
                                        className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                                            isActive
                                                ? "bg-emerald-300 text-black border-black shadow-[1px_1px_0px_#000]"
                                                : isPast
                                                ? "bg-neutral-200 text-neutral-800 border-neutral-400"
                                                : "bg-amber-100 text-amber-900 border-amber-300"
                                        }`}
                                    >
                                        {isActive ? "Active Now" : isPast ? "Completed" : "Scheduled"}
                                    </span>
                                </div>

                                <h4 className="text-xs font-black text-black truncate">{stage.name}</h4>
                                <p className="text-[10px] text-neutral-600 font-bold truncate mt-0.5">
                                    {sDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })} –{" "}
                                    {eDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                                </p>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Active Stage Management Console */}
            {activeStage && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Left 4 Cols: Active Stage Details & Operational Controls */}
                    <div className="lg:col-span-4 space-y-4">
                        <div className="p-5 rounded-2xl bg-white border-3 border-black shadow-[4px_4px_0px_#000] space-y-4">
                            <div className="pb-3 border-b-2 border-black/10">
                                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                                    Round Controls
                                </span>
                                <h3 className="text-base font-black text-black">{activeStage.name}</h3>
                                <p className="text-xs text-neutral-600 font-medium mt-0.5">
                                    {activeStage.description || "No specific instructions provided."}
                                </p>
                            </div>

                            <div className="space-y-2.5 text-xs font-bold">
                                <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#FAF6EE] border border-black">
                                    <span className="text-neutral-600">Start Time:</span>
                                    <span className="text-black font-black">
                                        {new Date(activeStage.startsAt).toLocaleString(undefined, {
                                            month: "short",
                                            day: "numeric",
                                            hour: "2-digit",
                                            minute: "2-digit",
                                        })}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#FAF6EE] border border-black">
                                    <span className="text-neutral-600">Deadline:</span>
                                    <span className="text-black font-black">
                                        {new Date(activeStage.endsAt).toLocaleString(undefined, {
                                            month: "short",
                                            day: "numeric",
                                            hour: "2-digit",
                                            minute: "2-digit",
                                        })}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#FAF6EE] border border-black">
                                    <span className="text-neutral-600">Action Mode:</span>
                                    <span className="text-black font-black uppercase">
                                        {activeStage.actionType.replace("_", " ")}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#FAF6EE] border border-black">
                                    <span className="text-neutral-600">Submissions:</span>
                                    <span className="text-black font-black">{submissions.length} Total</span>
                                </div>
                            </div>

                            {/* Lifecycle Operational Overrides */}
                            <div className="pt-2 border-t-2 border-black/10 space-y-2">
                                <span className="text-[10px] font-black uppercase text-neutral-500 block">
                                    Manual Overrides & Overtime
                                </span>

                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setOverrideAction("extend")}
                                        className="p-2 rounded-xl bg-white hover:bg-neutral-100 border-2 border-black text-[11px] font-black shadow-[2px_2px_0px_#000] cursor-pointer flex items-center justify-center gap-1.5"
                                    >
                                        <Clock className="w-3.5 h-3.5" />
                                        <span>Extend Time</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setOverrideAction("close")}
                                        className="p-2 rounded-xl bg-white hover:bg-neutral-100 border-2 border-black text-[11px] font-black shadow-[2px_2px_0px_#000] cursor-pointer flex items-center justify-center gap-1.5 text-rose-700"
                                    >
                                        <Pause className="w-3.5 h-3.5" />
                                        <span>Close Stage</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setOverrideAction("reopen")}
                                        className="p-2 rounded-xl bg-white hover:bg-neutral-100 border-2 border-black text-[11px] font-black shadow-[2px_2px_0px_#000] cursor-pointer flex items-center justify-center gap-1.5 text-emerald-700 col-span-2"
                                    >
                                        <Play className="w-3.5 h-3.5" />
                                        <span>Re-Open Stage Submissions</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right 8 Cols: Submissions Table, Rubric Criteria, & Advancements */}
                    <div className="lg:col-span-8 space-y-4">
                        <div className="p-5 sm:p-6 rounded-2xl bg-white border-3 border-black shadow-[4px_4px_0px_#000] space-y-4">
                            {/* Inner Sub-Navigation */}
                            <div className="flex items-center justify-between pb-3 border-b-2 border-black/10 flex-wrap gap-2">
                                <div className="flex items-center bg-[#FAF6EE] p-1 rounded-2xl border-2 border-black shadow-[1.5px_1.5px_0px_#000] gap-1">
                                    <button
                                        type="button"
                                        onClick={() => setActiveSubTab("submissions")}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-black cursor-pointer transition-all ${
                                            activeSubTab === "submissions"
                                                ? "bg-[#38BDF8] text-black border-2 border-black shadow-[2px_2px_0px_#000]"
                                                : "text-neutral-700 hover:text-black"
                                        }`}
                                    >
                                        Submissions ({submissions.length})
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setActiveSubTab("criteria")}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-black cursor-pointer transition-all ${
                                            activeSubTab === "criteria"
                                                ? "bg-[#FFE566] text-black border-2 border-black shadow-[2px_2px_0px_#000]"
                                                : "text-neutral-700 hover:text-black"
                                        }`}
                                    >
                                        Rubric & Criteria ({criteria.length})
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setActiveSubTab("advancements")}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-black cursor-pointer transition-all ${
                                            activeSubTab === "advancements"
                                                ? "bg-[#A2FF86] text-black border-2 border-black shadow-[2px_2px_0px_#000]"
                                                : "text-neutral-700 hover:text-black"
                                        }`}
                                    >
                                        Advancements & Shortlist
                                    </button>
                                </div>

                                {activeSubTab === "submissions" && (
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={submissionFilter}
                                            onChange={(e) => setSubmissionFilter(e.target.value)}
                                            placeholder="Search deliverables..."
                                            className="px-3 py-1.5 rounded-xl bg-white border-2 border-black text-xs font-bold text-black shadow-[2px_2px_0px_#000] focus:outline-hidden"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* SUB-TAB 1: SUBMISSIONS TABLE */}
                            {activeSubTab === "submissions" && (
                                <div className="space-y-3">
                                    {loadingSubmissions ? (
                                        <div className="py-12 text-center text-xs font-bold text-neutral-500">
                                            Loading deliverables and participant artifacts...
                                        </div>
                                    ) : filteredSubmissions.length === 0 ? (
                                        <div className="p-8 text-center bg-[#FAF6EE] rounded-xl border-2 border-dashed border-black/30 space-y-1">
                                            <p className="text-xs font-bold text-neutral-600">
                                                No deliverables submitted for this stage yet.
                                            </p>
                                            <p className="text-[11px] text-neutral-500">
                                                Submissions submitted by students or teams will appear here with live preview links.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="divide-y-2 divide-black/10">
                                            {filteredSubmissions.map((sub) => (
                                                <div key={sub.id} className="py-3.5 space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-black text-xs text-black">
                                                                    {sub.submission_title || "Untitled Project Deliverable"}
                                                                </span>
                                                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-950 border border-emerald-300 text-[10px] font-black">
                                                                    v{sub.submission_version}
                                                                </span>
                                                            </div>
                                                            <p className="text-[11px] text-neutral-600 font-bold mt-0.5">
                                                                by {sub.participant_name || sub.participant_username || "Participant"}{" "}
                                                                {sub.team_name ? `· Team ${sub.team_name}` : ""} ·{" "}
                                                                {new Date(sub.submitted_at).toLocaleTimeString(undefined, {
                                                                    hour: "2-digit",
                                                                    minute: "2-digit",
                                                                })}
                                                            </p>
                                                        </div>

                                                        <div className="flex items-center gap-2">
                                                            {sub.github_repo_url && (
                                                                <a
                                                                    href={sub.github_repo_url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="p-1.5 rounded-lg border border-black bg-white hover:bg-neutral-100 shadow-[1px_1px_0px_#000]"
                                                                    title="View GitHub Repository"
                                                                >
                                                                    <GithubIcon className="w-3.5 h-3.5" />
                                                                </a>
                                                            )}
                                                            {sub.live_demo_url && (
                                                                <a
                                                                    href={sub.live_demo_url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="p-1.5 rounded-lg border border-black bg-white hover:bg-neutral-100 shadow-[1px_1px_0px_#000]"
                                                                    title="Open Live Preview"
                                                                >
                                                                    <ExternalLink className="w-3.5 h-3.5" />
                                                                </a>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {sub.submission_summary && (
                                                        <p className="text-xs text-neutral-700 font-medium leading-relaxed bg-[#FAF6EE] p-2.5 rounded-xl border border-black/20">
                                                            {sub.submission_summary}
                                                        </p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* SUB-TAB 2: RUBRIC CRITERIA */}
                            {activeSubTab === "criteria" && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between pb-2 border-b border-black/10">
                                        <span className="text-xs font-black uppercase text-black">
                                            Evaluation Rubric & Weight Percentages
                                        </span>
                                    </div>

                                    {criteria.length === 0 ? (
                                        <div className="p-6 text-center bg-[#FAF6EE] rounded-xl border border-dashed border-black/30">
                                            <p className="text-xs font-bold text-neutral-600">
                                                No scoring criteria configured for this stage.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {criteria.map((c, i) => (
                                                <div
                                                    key={c.id || i}
                                                    className="p-3 rounded-xl bg-[#FAF6EE] border-2 border-black flex items-center justify-between shadow-[2px_2px_0px_#000]"
                                                >
                                                    <div>
                                                        <span className="font-black text-xs text-black block">{c.title}</span>
                                                        <span className="text-[10px] text-neutral-600 font-bold">
                                                            Max Score: {c.max_score || 10} pts
                                                        </span>
                                                    </div>
                                                    <span className="px-2.5 py-1 rounded-xl bg-[#FFE566] text-black border border-black text-xs font-black">
                                                        {c.weight_percent}% Weight
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Assigned Judges */}
                                    <div className="pt-3 border-t border-black/10">
                                        <span className="text-[10px] font-black uppercase text-neutral-500 block mb-2">
                                            Assigned Judges & Evaluators ({judges.length})
                                        </span>
                                        {judges.length === 0 ? (
                                            <p className="text-[11px] text-neutral-500 italic">No external judges assigned to this round yet.</p>
                                        ) : (
                                            <div className="flex flex-wrap gap-2">
                                                {judges.map((j, idx) => (
                                                    <span key={idx} className="px-2.5 py-1 rounded-xl bg-white border border-black text-xs font-bold text-black shadow-[1px_1px_0px_#000]">
                                                        {j.judge_name || j.email || `Judge ${idx + 1}`}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* SUB-TAB 3: ADVANCEMENTS */}
                            {activeSubTab === "advancements" && (
                                <div className="p-6 text-center bg-[#FAF6EE] rounded-2xl border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                                    <Sparkles className="w-7 h-7 mx-auto text-amber-500" />
                                    <h4 className="text-sm font-black text-black">Shortlisting & Stage Advancement</h4>
                                    <p className="text-xs text-neutral-600 font-bold max-w-md mx-auto">
                                        Select and advance top scorers directly into subsequent rounds without duplicating user records or altering their admission passes.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Override Action Dialog Modal */}
            {overrideAction && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
                    <div className="w-full max-w-md bg-white rounded-3xl border-3 border-black shadow-[6px_6px_0px_#000] p-6 space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b-2 border-black/10">
                            <div>
                                <span className="text-[10px] font-black uppercase text-neutral-500">
                                    Stage Lifecycle Action
                                </span>
                                <h3 className="text-base font-black text-black capitalize">
                                    {overrideAction} Stage
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setOverrideAction(null)}
                                className="p-1.5 rounded-lg border-2 border-black bg-white hover:bg-neutral-100 shadow-[1.5px_1.5px_0px_#000] cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="space-y-3 text-xs font-bold">
                            {overrideAction === "extend" && (
                                <div>
                                    <label className="block uppercase text-[10px] font-black text-black mb-1">
                                        New Deadline Date & Time *
                                    </label>
                                    <input
                                        type="datetime-local"
                                        value={newEndsAt}
                                        onChange={(e) => setNewEndsAt(e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl bg-white border-2 border-black font-bold text-xs shadow-[2px_2px_0px_#000] focus:outline-hidden"
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block uppercase text-[10px] font-black text-black mb-1">
                                    Reason / Audit Note (Optional)
                                </label>
                                <input
                                    type="text"
                                    value={overrideNote}
                                    onChange={(e) => setOverrideNote(e.target.value)}
                                    placeholder="e.g. Granted 2-hour technical buffer for submissions"
                                    className="w-full px-3 py-2 rounded-xl bg-white border-2 border-black font-bold text-xs shadow-[2px_2px_0px_#000] focus:outline-hidden"
                                />
                            </div>

                            <div className="pt-3 border-t-2 border-black/10 flex items-center justify-between">
                                <button
                                    type="button"
                                    onClick={() => setOverrideAction(null)}
                                    className="px-4 py-2 rounded-xl bg-white hover:bg-neutral-100 text-black border-2 border-black font-bold text-xs shadow-[2px_2px_0px_#000] cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    disabled={isActionExecuting || (overrideAction === "extend" && !newEndsAt)}
                                    onClick={handleExecuteOverride}
                                    className="px-6 py-2 rounded-xl bg-[#A2FF86] hover:bg-[#86ef6b] text-black border-2 border-black font-black text-xs shadow-[2px_2px_0px_#000] cursor-pointer disabled:opacity-50"
                                >
                                    {isActionExecuting ? "Executing..." : "Confirm Action"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
