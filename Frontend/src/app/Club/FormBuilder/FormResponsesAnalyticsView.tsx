import React, { useEffect, useState } from "react";
import {
    BarChart3,
    Users,
    Download,
    RefreshCw,
    ExternalLink,
    Star,
    Search,
    Paperclip,
    ChevronLeft,
    ChevronRight,
    History,
    RotateCcw,
    User,
    Mail,
    Ticket,
    Award,
} from "lucide-react";
import {
    fetchFormStats,
    fetchFormResponses,
    fetchFormVersions,
    revertFormVersion,
    exportFormResponsesCsv,
    releaseFormQuizGrades,
    type FormStatsResponse,
    type FormVersionRecord,
} from "../../../api/clubEventFormApi";
import { OrbixLoader } from "../../../components/ui/loader";
import { useToast } from "../../../context/ToastContext";

export interface FormResponsesAnalyticsViewProps {
    eventId: string;
    eventTitle?: string;
}

type ResponsesViewMode = "summary" | "individual" | "versions";

export const FormResponsesAnalyticsView: React.FC<FormResponsesAnalyticsViewProps> = ({
    eventId,
    eventTitle: _eventTitle,
}) => {
    const toast = useToast();
    const [viewMode, setViewMode] = useState<ResponsesViewMode>("summary");

    // Stats State
    const [data, setData] = useState<FormStatsResponse["stats"] | null>(null);
    const [loadingStats, setLoadingStats] = useState(true);
    const [searchFilter, setSearchFilter] = useState("");

    // Individual Submissions State
    const [responses, setResponses] = useState<any[]>([]);
    const [totalResponses, setTotalResponses] = useState(0);
    const [currentRespIdx, setCurrentRespIdx] = useState(0);
    const [loadingResponses, setLoadingResponses] = useState(false);

    // Version Snapshots State
    const [versions, setVersions] = useState<FormVersionRecord[]>([]);
    const [loadingVersions, setLoadingVersions] = useState(false);
    const [revertingVersionId, setRevertingVersionId] = useState<string | null>(null);

    // Quiz Grade Release State
    const [isReleasingGrades, setIsReleasingGrades] = useState(false);

    // Release Quiz Grades to Students
    const handleReleaseGrades = async () => {
        try {
            setIsReleasingGrades(true);
            const res = await releaseFormQuizGrades(eventId);
            toast.success(res.message || "Quiz grades released to students!");
            await loadStats();
            await loadIndividualResponses();
        } catch (err: any) {
            toast.error(err.message || "Failed to release quiz grades.");
        } finally {
            setIsReleasingGrades(false);
        }
    };

    // Load Summary Stats
    const loadStats = async () => {
        setLoadingStats(true);
        try {
            const res = await fetchFormStats(eventId);
            setData(res.stats);
        } catch (err: any) {
            toast.error(err.message || "Failed to load response analytics.");
        } finally {
            setLoadingStats(false);
        }
    };

    // Load Individual Responses
    const loadIndividualResponses = async () => {
        setLoadingResponses(true);
        try {
            const res = await fetchFormResponses(eventId, { page: 1, limit: 100 });
            setResponses(res.responses || []);
            setTotalResponses(res.total || 0);
            if (res.responses?.length && currentRespIdx >= res.responses.length) {
                setCurrentRespIdx(0);
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to load individual submissions.");
        } finally {
            setLoadingResponses(false);
        }
    };

    // Load Immutable Form Versions
    const loadVersions = async () => {
        setLoadingVersions(true);
        try {
            const res = await fetchFormVersions(eventId);
            setVersions(res.versions || []);
        } catch (err: any) {
            toast.error(err.message || "Failed to load version snapshots.");
        } finally {
            setLoadingVersions(false);
        }
    };

    useEffect(() => {
        loadStats();
    }, [eventId]);

    useEffect(() => {
        if (viewMode === "individual" && responses.length === 0) {
            loadIndividualResponses();
        } else if (viewMode === "versions" && versions.length === 0) {
            loadVersions();
        }
    }, [viewMode]);

    // Handle CSV Download
    const handleDownloadCsv = async () => {
        try {
            await exportFormResponsesCsv(eventId);
            toast.success("CSV export downloaded successfully!");
        } catch (err: any) {
            toast.error(err.message || "Failed to export CSV.");
        }
    };

    // Handle Version Rollback
    const handleRevertVersion = async (version: FormVersionRecord) => {
        if (!confirm(`Are you sure you want to revert to Version ${version.versionNumber}?`)) {
            return;
        }

        try {
            setRevertingVersionId(version.id);
            await revertFormVersion(eventId, version.id);
            toast.success(`Form draft reverted to Version ${version.versionNumber}!`);
            loadVersions();
        } catch (err: any) {
            toast.error(err.message || "Failed to revert form version.");
        } finally {
            setRevertingVersionId(null);
        }
    };

    if (loadingStats) {
        return (
            <div className="p-12 flex flex-col items-center justify-center space-y-3">
                <OrbixLoader size="md" />
                <span className="text-xs font-black text-neutral-600">Loading form responses & metrics...</span>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="p-8 text-center text-xs font-bold text-neutral-500">
                No response data available.
            </div>
        );
    }

    const questionEntries = Object.values(data.questionStats || {});
    const activeResponse = responses[currentRespIdx] || null;

    return (
        <div className="space-y-6">
            {/* Top Metrics Banner */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000]">
                    <div className="flex items-center justify-between text-neutral-600 mb-2">
                        <span className="text-xs font-black uppercase tracking-wider">Total Submissions</span>
                        <Users className="w-4 h-4 text-black" />
                    </div>
                    <div className="text-3xl font-black text-black">{data.totalResponses}</div>
                    <span className="text-[11px] text-neutral-500 font-medium">Valid student responses</span>
                </div>

                <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000]">
                    <div className="flex items-center justify-between text-neutral-600 mb-2">
                        <span className="text-xs font-black uppercase tracking-wider">Questions Tracked</span>
                        <BarChart3 className="w-4 h-4 text-black" />
                    </div>
                    <div className="text-3xl font-black text-black">{questionEntries.length}</div>
                    <span className="text-[11px] text-neutral-500 font-medium">Active dynamic questions</span>
                </div>

                <div className="p-5 rounded-2xl bg-[#a2ff86] border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col justify-between">
                    <div>
                        <span className="text-xs font-black uppercase tracking-wider text-black block mb-1">
                            Spreadsheet Export
                        </span>
                        <span className="text-[11px] text-neutral-800 font-medium">
                            Download Excel/CSV with all custom dynamic question columns.
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={handleDownloadCsv}
                        className="mt-3 px-3 py-1.5 rounded-xl bg-white hover:bg-neutral-100 text-black font-black text-xs border-2 border-black shadow-[2px_2px_0px_#000] inline-flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                        <Download className="w-3.5 h-3.5" />
                        <span>Export CSV</span>
                    </button>
                </div>
            </div>

            {/* Quiz Performance Banner if this form is a quiz */}
            {data.quizStats && (
                <div className="p-5 sm:p-6 rounded-3xl bg-[#F0FDF4] border-2 border-[#16A34A] shadow-[4px_4px_0px_#16A34A] space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#16A34A]/20 pb-3">
                        <div className="flex items-center gap-3">
                            <span className="p-2.5 rounded-2xl bg-[#22C55E] border-2 border-black shadow-[2px_2px_0px_#000]">
                                <Award className="w-5 h-5 text-black" />
                            </span>
                            <div>
                                <h3 className="text-base font-black text-black">Quiz Evaluation Overview</h3>
                                <p className="text-xs text-neutral-600 font-medium">
                                    Overall respondent performance across graded questions
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={handleReleaseGrades}
                            disabled={isReleasingGrades}
                            className="px-4 py-2 rounded-xl bg-[#22C55E] hover:bg-[#16a34a] text-black hover:text-white font-black text-xs border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer inline-flex items-center gap-2 transition-colors disabled:opacity-50"
                        >
                            <Award className="w-4 h-4" />
                            <span>
                                {isReleasingGrades
                                    ? "Releasing..."
                                    : data.quizStats.releasedCount >= data.quizStats.gradedCount
                                    ? "Re-release Scores"
                                    : `Release Scores (${data.quizStats.gradedCount - (data.quizStats.releasedCount || 0)} Pending)`}
                            </span>
                        </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="p-3 bg-white rounded-2xl border-2 border-black">
                            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block">
                                Average Score
                            </span>
                            <div className="text-xl sm:text-2xl font-black text-[#15803D]">
                                {data.quizStats.average} / {data.quizStats.maxPossiblePoints}
                            </div>
                        </div>

                        <div className="p-3 bg-white rounded-2xl border-2 border-black">
                            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block">
                                Median
                            </span>
                            <div className="text-xl sm:text-2xl font-black text-black">
                                {data.quizStats.median} pts
                            </div>
                        </div>

                        <div className="p-3 bg-white rounded-2xl border-2 border-black">
                            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block">
                                Score Range
                            </span>
                            <div className="text-xl sm:text-2xl font-black text-black">
                                {data.quizStats.min} - {data.quizStats.max} pts
                            </div>
                        </div>

                        <div className="p-3 bg-white rounded-2xl border-2 border-black">
                            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block">
                                Graded Submissions
                            </span>
                            <div className="text-xl sm:text-2xl font-black text-black">
                                {data.quizStats.gradedCount}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Sub-Tabs: Summary | Individual | Versions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-black/10 pb-3">
                <div className="flex items-center p-1 bg-white border-2 border-black rounded-xl shadow-[2px_2px_0px_#000] gap-1">
                    <button
                        type="button"
                        onClick={() => setViewMode("summary")}
                        className={`px-4 py-1.5 rounded-lg text-xs font-black cursor-pointer transition-colors ${
                            viewMode === "summary" ? "bg-black text-white" : "text-black hover:bg-neutral-100"
                        }`}
                    >
                        Summary
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode("individual")}
                        className={`px-4 py-1.5 rounded-lg text-xs font-black cursor-pointer transition-colors ${
                            viewMode === "individual" ? "bg-black text-white" : "text-black hover:bg-neutral-100"
                        }`}
                    >
                        Individual ({data.totalResponses})
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode("versions")}
                        className={`px-4 py-1.5 rounded-lg text-xs font-black cursor-pointer transition-colors flex items-center gap-1.5 ${
                            viewMode === "versions" ? "bg-black text-white" : "text-black hover:bg-neutral-100"
                        }`}
                    >
                        <History className="w-3.5 h-3.5" />
                        <span>Version History</span>
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    {viewMode === "summary" && (
                        <div className="relative">
                            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                value={searchFilter}
                                onChange={(e) => setSearchFilter(e.target.value)}
                                placeholder="Filter questions..."
                                className="pl-8 pr-3 py-1.5 text-xs font-bold border-2 border-black rounded-xl bg-white focus:outline-none"
                            />
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={() => {
                            if (viewMode === "summary") loadStats();
                            else if (viewMode === "individual") loadIndividualResponses();
                            else loadVersions();
                        }}
                        className="p-2 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 shadow-[2px_2px_0px_#000] cursor-pointer"
                        title="Refresh"
                    >
                        <RefreshCw className="w-3.5 h-3.5 text-black" />
                    </button>
                </div>
            </div>

            {/* ---------------------------------------------------------------- */}
            {/* 1. SUMMARY VIEW */}
            {/* ---------------------------------------------------------------- */}
            {viewMode === "summary" && (
                <div className="space-y-4">
                    {questionEntries
                        .filter(
                            (q: any) =>
                                !searchFilter || q.title.toLowerCase().includes(searchFilter.toLowerCase())
                        )
                        .map((q: any, idx: number) => {
                            const answered = q.answeredCount || 0;
                            const responseRate =
                                data.totalResponses > 0
                                    ? Math.round((answered / data.totalResponses) * 100)
                                    : 0;

                            return (
                                <div
                                    key={q.questionId || idx}
                                    className="p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-4"
                                >
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-black/10 pb-3">
                                        <div className="flex items-center gap-2">
                                            <span className="w-5 h-5 rounded-md bg-black text-white text-[10px] font-black flex items-center justify-center shrink-0">
                                                {idx + 1}
                                            </span>
                                            <h4 className="text-sm font-black text-black">{q.title}</h4>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs font-bold text-neutral-500">
                                            <span>{answered} responses</span>
                                            <span>•</span>
                                            <span>{responseRate}% response rate</span>
                                        </div>
                                    </div>

                                    {/* Choice Distribution */}
                                    {q.distribution && (
                                        <div className="space-y-2.5">
                                            {Object.entries(q.distribution).map(
                                                ([optName, count]: [string, any]) => {
                                                    const pct =
                                                        answered > 0
                                                            ? Math.round((count / answered) * 100)
                                                            : 0;
                                                    return (
                                                        <div key={optName} className="space-y-1">
                                                            <div className="flex items-center justify-between text-xs font-bold text-black">
                                                                <span>{optName}</span>
                                                                <span>
                                                                    {count} ({pct}%)
                                                                </span>
                                                            </div>
                                                            <div className="w-full h-3 bg-neutral-100 rounded-full border border-black overflow-hidden">
                                                                <div
                                                                    className="h-full bg-[#38BDF8] transition-all duration-300"
                                                                    style={{ width: `${pct}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                            )}
                                        </div>
                                    )}

                                    {/* Linear Scale Average */}
                                    {q.type === "linear_scale" && (
                                        <div className="p-4 rounded-xl bg-amber-50 border border-black/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                            <div>
                                                <span className="text-xs font-black text-neutral-600 block">
                                                    Average Score
                                                </span>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-3xl font-black text-black">
                                                        {q.averageRating}
                                                    </span>
                                                    <div className="flex text-amber-500">
                                                        <Star className="w-5 h-5 fill-amber-400 text-amber-500" />
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4 text-xs font-bold text-neutral-600">
                                                <span>Min: {q.minLabel || "Low"}</span>
                                                <span>Max: {q.maxLabel || "High"}</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* File Attachments */}
                                    {q.type === "file_upload" && (
                                        <div className="space-y-2">
                                            <span className="text-xs font-black text-neutral-700 block">
                                                {q.fileCount || 0} Files Uploaded via Cloudinary:
                                            </span>
                                            {q.recentFiles && q.recentFiles.length > 0 ? (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    {q.recentFiles.map((f: any, fIdx: number) => (
                                                        <a
                                                            key={fIdx}
                                                            href={f.fileUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="p-2.5 rounded-xl border border-black bg-neutral-50 hover:bg-neutral-100 flex items-center justify-between text-xs font-bold text-black group"
                                                        >
                                                            <div className="flex items-center gap-2 truncate">
                                                                <Paperclip className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                                                                <span className="truncate">{f.fileName}</span>
                                                            </div>
                                                            <ExternalLink className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 shrink-0" />
                                                        </a>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="text-xs text-neutral-400 font-medium">
                                                    No files uploaded yet.
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {/* Recent Text Responses */}
                                    {q.recentResponses && (
                                        <div className="space-y-2">
                                            <span className="text-xs font-black text-neutral-700 block">
                                                Recent Answers:
                                            </span>
                                            {q.recentResponses.length > 0 ? (
                                                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                                    {q.recentResponses.map((txt: string, tIdx: number) => (
                                                        <div
                                                            key={tIdx}
                                                            className="p-2.5 rounded-xl bg-neutral-50 border border-black/15 text-xs font-medium text-neutral-800"
                                                        >
                                                            &ldquo;{txt}&rdquo;
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="text-xs text-neutral-400 font-medium">
                                                    No answers recorded yet.
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                </div>
            )}

            {/* ---------------------------------------------------------------- */}
            {/* 2. INDIVIDUAL RESPONDENT VIEW (Google Forms Individual Mode) */}
            {/* ---------------------------------------------------------------- */}
            {viewMode === "individual" && (
                <div className="space-y-6">
                    {loadingResponses ? (
                        <div className="p-12 text-center">
                            <OrbixLoader size="md" />
                            <span className="text-xs font-bold text-neutral-500 block mt-2">
                                Loading individual applicant submissions...
                            </span>
                        </div>
                    ) : responses.length === 0 ? (
                        <div className="p-8 text-center text-xs font-bold text-neutral-500 bg-white rounded-2xl border-2 border-black">
                            No individual responses received yet.
                        </div>
                    ) : (
                        <>
                            {/* Pagination / Stepper Header */}
                            <div className="p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        disabled={currentRespIdx === 0}
                                        onClick={() => setCurrentRespIdx((i) => Math.max(0, i - 1))}
                                        className="p-1.5 rounded-xl border border-black hover:bg-neutral-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                                        title="Previous respondent"
                                    >
                                        <ChevronLeft className="w-4 h-4 text-black" />
                                    </button>
                                    <span className="text-xs font-black text-black">
                                        Respondent {currentRespIdx + 1} of {totalResponses}
                                    </span>
                                    <button
                                        type="button"
                                        disabled={currentRespIdx >= responses.length - 1}
                                        onClick={() =>
                                            setCurrentRespIdx((i) => Math.min(responses.length - 1, i + 1))
                                        }
                                        className="p-1.5 rounded-xl border border-black hover:bg-neutral-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                                        title="Next respondent"
                                    >
                                        <ChevronRight className="w-4 h-4 text-black" />
                                    </button>
                                </div>

                                {activeResponse?.ticket_code && (
                                    <div className="flex items-center gap-2 bg-[#FFE566] px-3 py-1 rounded-xl border border-black text-xs font-black">
                                        <Ticket className="w-3.5 h-3.5" />
                                        <span>Pass: {activeResponse.ticket_code}</span>
                                    </div>
                                )}
                            </div>

                            {/* Respondent Profile Card */}
                            {activeResponse && (
                                <div className="p-6 rounded-3xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-4">
                                    <div className="flex items-center justify-between border-b border-black/10 pb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 rounded-2xl bg-neutral-100 border-2 border-black flex items-center justify-center">
                                                <User className="w-6 h-6 text-black" />
                                            </div>
                                            <div>
                                                <h4 className="text-base font-black text-black">
                                                    {activeResponse.applicant_name ||
                                                        activeResponse.student_name ||
                                                        "Student Respondent"}
                                                </h4>
                                                <span className="text-xs text-neutral-500 font-bold flex items-center gap-1.5">
                                                    <Mail className="w-3.5 h-3.5" />
                                                    {activeResponse.applicant_email ||
                                                        activeResponse.student_email ||
                                                        "No email"}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="text-right space-y-1">
                                            {activeResponse.quizScore !== null && activeResponse.quizScore !== undefined && (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#DCFCE7] text-[#15803D] font-black text-xs border border-[#16A34A] shadow-[1px_1px_0px_#16A34A] mb-1">
                                                    <Award className="w-3.5 h-3.5" />
                                                    {activeResponse.quizScore} / {activeResponse.quizMaxScore ?? "?"} pts
                                                </span>
                                            )}
                                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300 block">
                                                {activeResponse.status || "Registered"}
                                            </span>
                                            <span className="text-[10px] text-neutral-500 font-medium block">
                                                {activeResponse.registeredAt || activeResponse.created_at
                                                    ? new Date(activeResponse.registeredAt || activeResponse.created_at).toLocaleString()
                                                    : ""}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Academic Details */}
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                                        <div className="p-3 rounded-xl bg-neutral-50 border border-black/15">
                                            <span className="text-[10px] font-black text-neutral-500 uppercase tracking-wider block">
                                                Roll Number
                                            </span>
                                            <p className="font-black text-black">
                                                {activeResponse.roll_number || "Not provided"}
                                            </p>
                                        </div>
                                        <div className="p-3 rounded-xl bg-neutral-50 border border-black/15">
                                            <span className="text-[10px] font-black text-neutral-500 uppercase tracking-wider block">
                                                Department
                                            </span>
                                            <p className="font-black text-black truncate">
                                                {activeResponse.department || "Not provided"}
                                            </p>
                                        </div>
                                        <div className="p-3 rounded-xl bg-neutral-50 border border-black/15">
                                            <span className="text-[10px] font-black text-neutral-500 uppercase tracking-wider block">
                                                Year of Study
                                            </span>
                                            <p className="font-black text-black">
                                                {activeResponse.year_of_study || "Not provided"}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Dynamic Answers Breakdown */}
                                    <div className="space-y-3 pt-2">
                                        <h5 className="text-xs font-black uppercase tracking-wider text-black">
                                            Form Answers:
                                        </h5>

                                        {activeResponse.answers &&
                                        Object.keys(activeResponse.answers).length > 0 ? (
                                            <div className="space-y-2">
                                                {Object.entries(activeResponse.answers).map(
                                                    ([qId, ansVal]: [string, any]) => (
                                                        <div
                                                            key={qId}
                                                            className="p-3.5 rounded-xl border border-black/20 bg-neutral-50 space-y-1"
                                                        >
                                                            <span className="text-[11px] font-black text-neutral-500 uppercase block">
                                                                {qId}
                                                            </span>
                                                            <p className="text-xs sm:text-sm font-bold text-black whitespace-pre-line">
                                                                {typeof ansVal === "object"
                                                                    ? JSON.stringify(ansVal, null, 2)
                                                                    : String(ansVal)}
                                                            </p>
                                                        </div>
                                                    )
                                                )}
                                            </div>
                                        ) : (
                                            <p className="text-xs text-neutral-400 font-medium">
                                                No custom question answers recorded.
                                            </p>
                                        )}
                                    </div>

                                    {/* File Attachments */}
                                    {activeResponse.file_attachments &&
                                        activeResponse.file_attachments.length > 0 && (
                                            <div className="space-y-2 pt-2 border-t border-black/10">
                                                <h5 className="text-xs font-black uppercase tracking-wider text-black">
                                                    Uploaded Cloudinary Files:
                                                </h5>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    {activeResponse.file_attachments.map(
                                                        (f: any, fIdx: number) => (
                                                            <a
                                                                key={fIdx}
                                                                href={f.fileUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="p-2.5 rounded-xl border border-black bg-white hover:bg-neutral-50 flex items-center justify-between text-xs font-bold text-black group shadow-sm"
                                                            >
                                                                <div className="flex items-center gap-2 truncate">
                                                                    <Paperclip className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                                                                    <span className="truncate">
                                                                        {f.fileName || "Attachment"}
                                                                    </span>
                                                                </div>
                                                                <ExternalLink className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 shrink-0" />
                                                            </a>
                                                        )
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* ---------------------------------------------------------------- */}
            {/* 3. VERSION SNAPSHOTS & AUDIT LOG */}
            {/* ---------------------------------------------------------------- */}
            {viewMode === "versions" && (
                <div className="space-y-4">
                    <div className="p-4 rounded-2xl bg-neutral-50 border-2 border-black text-xs font-medium text-neutral-700">
                        Published form versions are immutable snapshots. Submissions are permanently tied to the exact version used when the student submitted. You can roll back to any historical version below.
                    </div>

                    {loadingVersions ? (
                        <div className="p-12 text-center">
                            <OrbixLoader size="md" />
                            <span className="text-xs font-bold text-neutral-500 block mt-2">
                                Loading form version snapshots...
                            </span>
                        </div>
                    ) : versions.length === 0 ? (
                        <div className="p-8 text-center text-xs font-bold text-neutral-500 bg-white rounded-2xl border-2 border-black">
                            No published snapshots yet. Click &ldquo;Publish Live&rdquo; in the Questions tab to publish Version 1.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {versions.map((ver) => (
                                <div
                                    key={ver.id}
                                    className="p-4 sm:p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                                >
                                    <div className="space-y-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="px-2.5 py-0.5 rounded-full bg-black text-white text-xs font-black">
                                                Version {ver.versionNumber}
                                            </span>
                                            <h4 className="text-sm font-black text-black truncate">
                                                {ver.title}
                                            </h4>
                                        </div>
                                        <p className="text-xs text-neutral-500 font-medium">
                                            {ver.changeSummary || "Published snapshot"} •{" "}
                                            {ver.publishedAt
                                                ? new Date(ver.publishedAt).toLocaleString()
                                                : "Timestamp recorded"}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            type="button"
                                            disabled={revertingVersionId === ver.id}
                                            onClick={() => handleRevertVersion(ver)}
                                            className="px-3.5 py-1.5 rounded-xl border-2 border-black bg-white hover:bg-[#FFE566] text-black font-black text-xs shadow-[2px_2px_0px_#000] flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
                                        >
                                            <RotateCcw className="w-3.5 h-3.5" />
                                            <span>
                                                {revertingVersionId === ver.id
                                                    ? "Reverting..."
                                                    : "Revert to this Version"}
                                            </span>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
