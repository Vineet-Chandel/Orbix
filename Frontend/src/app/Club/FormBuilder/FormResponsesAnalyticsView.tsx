import React, { useEffect, useState, useMemo } from "react";
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
    Award,
    CheckCircle2,
    Clock,
    Filter,
    ArrowUpDown,
    Check,
    Copy,
    HelpCircle,
    TrendingUp,
    FileSpreadsheet,
} from "lucide-react";
import {
    fetchFormStats,
    fetchFormResponses,
    fetchFormVersions,
    revertFormVersion,
    exportFormResponsesCsv,
    releaseFormQuizGrades,
    updateResponseStatus,
    type FormStatsResponse,
    type FormVersionRecord,
    type FetchResponsesParams,
} from "../../../api/clubEventFormApi";
import { NeoSelect } from "../../../components/NeoSelect";
import { NeoCheckbox } from "../../../components/NeoCheckbox";
import { NeoDateTimePicker } from "../../../components/NeoDateTimePicker";
import { OrbixLoader } from "../../../components/ui/loader";
import { useToast } from "../../../context/ToastContext";

export interface FormResponsesAnalyticsViewProps {
    eventId: string;
    eventTitle?: string;
}

type ResponsesViewMode = "summary" | "question" | "individual" | "versions";

export const FormResponsesAnalyticsView: React.FC<FormResponsesAnalyticsViewProps> = ({
    eventId,
    eventTitle: _eventTitle,
}) => {
    const toast = useToast();
    const [viewMode, setViewMode] = useState<ResponsesViewMode>("summary");

    // 1. Stats State (Phase 5.1 & 5.2)
    const [data, setData] = useState<FormStatsResponse["stats"] | null>(null);
    const [loadingStats, setLoadingStats] = useState(true);
    const [summarySearchFilter, setSummarySearchFilter] = useState("");

    // 2. Question-Wise View State (Phase 5.2)
    const [activeQuestionIdx, setActiveQuestionIdx] = useState(0);
    const [textAnswerFilter, setTextAnswerFilter] = useState("");

    // 3. Responses List & Individual View State (Phase 5.3 & 5.4)
    const [responses, setResponses] = useState<any[]>([]);
    const [totalResponses, setTotalResponses] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [currentRespIdx, setCurrentRespIdx] = useState(0);
    const [loadingResponses, setLoadingResponses] = useState(false);
    const [statusCounts, setStatusCounts] = useState({
        totalCount: 0,
        successfulCount: 0,
        pendingCount: 0,
        attendedCount: 0,
        rejectedCount: 0,
        cancelledCount: 0,
    });

    // 4. Server-Side Filters (Phase 5.4)
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [startDateFilter, setStartDateFilter] = useState("");
    const [endDateFilter, setEndDateFilter] = useState("");
    const [sortBy, setSortBy] = useState("registered_at");
    const [sortOrder, setSortOrder] = useState<"DESC" | "ASC">("DESC");
    const [questionAnswerFilterId, setQuestionAnswerFilterId] = useState("");
    const [questionAnswerFilterVal, setQuestionAnswerFilterVal] = useState("");

    // Multi-Select for Export (Phase 5.5)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // 5. Version Snapshots State
    const [versions, setVersions] = useState<FormVersionRecord[]>([]);
    const [loadingVersions, setLoadingVersions] = useState(false);
    const [revertingVersionId, setRevertingVersionId] = useState<string | null>(null);

    // 6. Action States
    const [isReleasingGrades, setIsReleasingGrades] = useState(false);
    const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
    const [copiedKey, setCopiedKey] = useState<string | null>(null);
    const [isExporting, setIsExporting] = useState(false);

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
            setCurrentPage(1);
        }, 350);
        return () => clearTimeout(timer);
    }, [searchQuery]);

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

    // Load Paginated & Filtered Responses (Server-Side)
    const loadResponses = async (pageToLoad = currentPage) => {
        setLoadingResponses(true);
        try {
            const params: FetchResponsesParams = {
                page: pageToLoad,
                limit: pageSize,
                status: statusFilter !== "all" ? statusFilter : undefined,
                search: debouncedSearch.trim() || undefined,
                startDate: startDateFilter || undefined,
                endDate: endDateFilter || undefined,
                sortBy,
                sortOrder,
                questionId: questionAnswerFilterId || undefined,
                answerSearch: questionAnswerFilterVal.trim() || undefined,
            };

            const res = await fetchFormResponses(eventId, params);
            setResponses(res.responses || []);
            setTotalResponses(res.total || 0);
            setTotalPages(res.totalPages || 1);
            setCurrentPage(res.page || 1);

            if (res.statusCounts) {
                setStatusCounts(res.statusCounts);
            }

            if (currentRespIdx >= (res.responses?.length || 0)) {
                setCurrentRespIdx(0);
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to load submissions.");
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

    // Initial load
    useEffect(() => {
        loadStats();
    }, [eventId]);

    // View mode switch loader
    useEffect(() => {
        if (viewMode === "summary") {
            loadStats();
        } else if (viewMode === "individual" || viewMode === "question") {
            loadResponses();
        } else if (viewMode === "versions") {
            loadVersions();
        }
    }, [viewMode]);

    // Reload responses on filter/sort change
    useEffect(() => {
        if (viewMode === "individual" || viewMode === "summary") {
            loadResponses(1);
        }
    }, [debouncedSearch, statusFilter, startDateFilter, endDateFilter, sortBy, sortOrder, pageSize, questionAnswerFilterId, questionAnswerFilterVal]);

    // Reset filters
    const handleResetFilters = () => {
        setSearchQuery("");
        setDebouncedSearch("");
        setStatusFilter("all");
        setStartDateFilter("");
        setEndDateFilter("");
        setSortBy("registered_at");
        setSortOrder("DESC");
        setQuestionAnswerFilterId("");
        setQuestionAnswerFilterVal("");
        setCurrentPage(1);
        setSelectedIds(new Set());
    };

    // Copy to clipboard helper
    const handleCopy = (text: string, key: string) => {
        navigator.clipboard.writeText(text);
        setCopiedKey(key);
        toast.success("Copied to clipboard!");
        setTimeout(() => setCopiedKey(null), 2000);
    };

    // Release Quiz Grades to Students
    const handleReleaseGrades = async () => {
        try {
            setIsReleasingGrades(true);
            const res = await releaseFormQuizGrades(eventId);
            toast.success(res.message || "Quiz grades released to students!");
            await loadStats();
            await loadResponses();
        } catch (err: any) {
            toast.error(err.message || "Failed to release quiz grades.");
        } finally {
            setIsReleasingGrades(false);
        }
    };

    // Update Status of Individual Response (Phase 5.3)
    const handleStatusChange = async (registrationId: string, newStatus: string) => {
        try {
            setUpdatingStatusId(registrationId);
            await updateResponseStatus(eventId, registrationId, newStatus);
            toast.success(`Registration status updated to ${newStatus}.`);

            // Update in-memory state
            setResponses((prev) =>
                prev.map((r) => (r.id === registrationId ? { ...r, status: newStatus } : r))
            );
            loadStats();
        } catch (err: any) {
            toast.error(err.message || "Failed to update registration status.");
        } finally {
            setUpdatingStatusId(null);
        }
    };

    // CSV Download (Phase 5.5)
    const handleDownloadCsv = async (onlySelected = false) => {
        try {
            setIsExporting(true);
            const options: any = {};
            if (onlySelected && selectedIds.size > 0) {
                options.responseIds = Array.from(selectedIds);
            } else {
                if (statusFilter !== "all") options.status = statusFilter;
                if (debouncedSearch.trim()) options.search = debouncedSearch.trim();
                if (startDateFilter) options.startDate = startDateFilter;
                if (endDateFilter) options.endDate = endDateFilter;
            }

            await exportFormResponsesCsv(eventId, options);
            toast.success(
                onlySelected
                    ? `Exported ${selectedIds.size} selected response(s)!`
                    : "Responses exported to CSV successfully!"
            );
        } catch (err: any) {
            toast.error(err.message || "Failed to export CSV.");
        } finally {
            setIsExporting(false);
        }
    };

    // Revert Version
    const handleRevertVersion = async (version: FormVersionRecord) => {
        if (!confirm(`Are you sure you want to revert to Version ${version.versionNumber}?`)) return;
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

    // Toggle row selection
    const toggleSelect = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === responses.length && responses.length > 0) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(responses.map((r) => r.id)));
        }
    };

    // Question-wise helpers (Phase 5.2)
    const questionsList = useMemo(() => {
        if (!data?.questionStats) return [];
        return Object.values(data.questionStats);
    }, [data]);

    const activeQuestion = questionsList[activeQuestionIdx] || null;

    // Timeline calculation (Phase 5.1)
    const timelineData = useMemo(() => {
        if (!data?.timeline) return [];
        const entries = Object.entries(data.timeline).sort(([a], [b]) => a.localeCompare(b));
        const maxVal = Math.max(...entries.map(([, count]) => count), 1);
        return entries.map(([date, count]) => ({
            date,
            count,
            pct: Math.round((count / maxVal) * 100),
        }));
    }, [data?.timeline]);

    if (loadingStats && !data) {
        return (
            <div className="p-12 flex flex-col items-center justify-center space-y-3">
                <OrbixLoader size="md" />
                <span className="text-xs font-black text-neutral-600">Loading form responses & metrics...</span>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="p-8 text-center text-xs font-medium text-neutral-500 bg-white dark:bg-[#0A0A0A] rounded-2xl border border-neutral-200 dark:border-neutral-800">
                No response data available.
            </div>
        );
    }

    const totalSubmissions = data.totalRegistrations ?? data.totalResponses;
    const successfulSubmissions = data.successfulCount ?? (data.totalResponses - (data.pendingCount || 0));
    const pendingSubmissions = data.pendingCount ?? 0;
    const attendedSubmissions = data.attendedCount ?? 0;
    const turnoutRate = totalSubmissions > 0 ? Math.round((attendedSubmissions / totalSubmissions) * 100) : 0;
    const activeResponse = responses[currentRespIdx] || null;

    return (
        <div className="space-y-6">
            {/* ============================================================== */}
            {/* TOP METRICS BANNER (Phase 5.1 Summary Cards)                    */}
            {/* ============================================================== */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
                {/* Total Registrations */}
                <div className="p-4 rounded-2xl bg-white dark:bg-[#0A0A0A] border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 mb-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wider">Total Submissions</span>
                        <Users className="w-4 h-4 text-neutral-700 dark:text-neutral-300" />
                    </div>
                    <div className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-neutral-100">{totalSubmissions}</div>
                    <span className="text-[10px] text-neutral-400 font-normal truncate">
                        All student submissions
                    </span>
                </div>

                {/* Successful Registrations */}
                <div className="p-4 rounded-2xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 mb-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wider">Confirmed</span>
                        <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div className="text-2xl sm:text-3xl font-bold text-emerald-700 dark:text-emerald-400">{successfulSubmissions}</div>
                    <span className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 font-normal truncate">
                        Registered & verified
                    </span>
                </div>

                {/* Pending Submissions */}
                <div className="p-4 rounded-2xl bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between text-amber-700 dark:text-amber-400 mb-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wider">Under Review</span>
                        <Clock className="w-4 h-4" />
                    </div>
                    <div className="text-2xl sm:text-3xl font-bold text-amber-700 dark:text-amber-400">{pendingSubmissions}</div>
                    <span className="text-[10px] text-amber-600/80 dark:text-amber-400/80 font-normal truncate">
                        Awaiting moderation
                    </span>
                </div>

                {/* Turnout / Attendance Rate */}
                <div className="p-4 rounded-2xl bg-sky-50/40 dark:bg-sky-950/20 border border-sky-200/60 dark:border-sky-800/40 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between text-sky-700 dark:text-sky-400 mb-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wider">Turnout Rate</span>
                        <TrendingUp className="w-4 h-4" />
                    </div>
                    <div className="text-2xl sm:text-3xl font-bold text-sky-700 dark:text-sky-400">{turnoutRate}%</div>
                    <div className="w-full bg-neutral-200/80 dark:bg-neutral-800 rounded-full h-1.5 overflow-hidden mt-1">
                        <div className="bg-sky-600 h-full rounded-full" style={{ width: `${turnoutRate}%` }} />
                    </div>
                </div>

                {/* File Upload Stats / Quick Export Action */}
                <div className="p-4 rounded-2xl bg-neutral-900 text-white dark:bg-neutral-800 border border-neutral-800 dark:border-neutral-700 shadow-sm flex flex-col justify-between col-span-2 sm:col-span-1">
                    <div>
                        <div className="flex items-center justify-between text-neutral-300 mb-1">
                            <span className="text-[10px] font-semibold uppercase tracking-wider">Spreadsheet Export</span>
                            <FileSpreadsheet className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-[10px] text-neutral-400 font-medium block truncate">
                            {data.totalFilesCount || 0} Files Attached
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={() => handleDownloadCsv(false)}
                        disabled={isExporting}
                        className="mt-2 px-3 py-1.5 rounded-xl bg-white text-neutral-900 hover:bg-neutral-100 font-semibold text-xs shadow-sm inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
                    >
                        <Download className="w-3.5 h-3.5" />
                        <span>{isExporting ? "Exporting..." : "Export CSV"}</span>
                    </button>
                </div>
            </div>

            {/* Quiz Performance Banner (if Quiz Mode active) */}
            {data.quizStats && (
                <div className="p-5 rounded-2xl bg-emerald-50/30 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 shadow-sm space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-200/60 dark:border-emerald-800/40 pb-3">
                        <div className="flex items-center gap-3">
                            <span className="p-2.5 rounded-xl bg-emerald-600 text-white shadow-sm">
                                <Award className="w-5 h-5" />
                            </span>
                            <div>
                                <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">Quiz Evaluation & Grading Metrics</h3>
                                <p className="text-xs text-neutral-500 font-normal">
                                    Overall respondent performance across graded quiz questions
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={handleReleaseGrades}
                            disabled={isReleasingGrades}
                            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm cursor-pointer inline-flex items-center gap-2 transition-colors disabled:opacity-50"
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
                        <div className="p-3.5 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 block">
                                Average Score
                            </span>
                            <div className="text-xl sm:text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                                {data.quizStats.average} / {data.quizStats.maxPossiblePoints}
                            </div>
                        </div>
                        <div className="p-3.5 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 block">
                                Median Score
                            </span>
                            <div className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                                {data.quizStats.median} pts
                            </div>
                        </div>
                        <div className="p-3.5 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 block">
                                Score Range
                            </span>
                            <div className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                                {data.quizStats.min} - {data.quizStats.max} pts
                            </div>
                        </div>
                        <div className="p-3.5 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 block">
                                Graded Submissions
                            </span>
                            <div className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                                {data.quizStats.gradedCount}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ============================================================== */}
            {/* PRIMARY VIEW SWITCHER (5.1 Summary, 5.2 Question, 5.3 Individual) */}
            {/* ============================================================== */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-black/10 dark:border-white/10 pb-3">
                <div className="flex items-center p-1.5 bg-[#FAF6EE] dark:bg-[#121212] border-2 border-black shadow-[3px_3px_0px_#000] rounded-2xl gap-1.5 flex-wrap">
                    <button
                        type="button"
                        onClick={() => setViewMode("summary")}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-black cursor-pointer transition-all flex items-center gap-1.5 active:translate-x-0.5 active:translate-y-0.5 ${
                            viewMode === "summary"
                                ? "bg-black text-[#FFE566] dark:bg-white dark:text-black border-2 border-black shadow-[2px_2px_0px_#000] translate-x-[-1px] translate-y-[-1px]"
                                : "text-neutral-700 dark:text-neutral-300 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 border-2 border-transparent"
                        }`}
                    >
                        <BarChart3 className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Summary</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setViewMode("question")}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-black cursor-pointer transition-all flex items-center gap-1.5 active:translate-x-0.5 active:translate-y-0.5 ${
                            viewMode === "question"
                                ? "bg-black text-[#FFE566] dark:bg-white dark:text-black border-2 border-black shadow-[2px_2px_0px_#000] translate-x-[-1px] translate-y-[-1px]"
                                : "text-neutral-700 dark:text-neutral-300 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 border-2 border-transparent"
                        }`}
                    >
                        <HelpCircle className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Question-wise</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setViewMode("individual")}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-black cursor-pointer transition-all flex items-center gap-1.5 active:translate-x-0.5 active:translate-y-0.5 ${
                            viewMode === "individual"
                                ? "bg-black text-[#FFE566] dark:bg-white dark:text-black border-2 border-black shadow-[2px_2px_0px_#000] translate-x-[-1px] translate-y-[-1px]"
                                : "text-neutral-700 dark:text-neutral-300 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 border-2 border-transparent"
                        }`}
                    >
                        <User className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Individual ({totalResponses})</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setViewMode("versions")}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-black cursor-pointer transition-all flex items-center gap-1.5 active:translate-x-0.5 active:translate-y-0.5 ${
                            viewMode === "versions"
                                ? "bg-black text-[#FFE566] dark:bg-white dark:text-black border-2 border-black shadow-[2px_2px_0px_#000] translate-x-[-1px] translate-y-[-1px]"
                                : "text-neutral-700 dark:text-neutral-300 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 border-2 border-transparent"
                        }`}
                    >
                        <History className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Snapshots</span>
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    {/* Selected Export button */}
                    {selectedIds.size > 0 && (
                        <button
                            type="button"
                            onClick={() => handleDownloadCsv(true)}
                            disabled={isExporting}
                            className="px-3 py-1.5 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-semibold text-xs shadow-sm flex items-center gap-1.5 cursor-pointer hover:bg-neutral-800 transition-colors"
                        >
                            <Download className="w-3.5 h-3.5" />
                            <span>Export Selected ({selectedIds.size})</span>
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={() => {
                            if (viewMode === "summary") loadStats();
                            else if (viewMode === "versions") loadVersions();
                            else loadResponses();
                        }}
                        className="p-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800 shadow-sm cursor-pointer text-neutral-600 dark:text-neutral-300 transition-colors"
                        title="Refresh Analytics"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* ============================================================== */}
            {/* 1. SUMMARY VIEW (Phase 5.1)                                    */}
            {/* ============================================================== */}
            {viewMode === "summary" && (
                <div className="space-y-6">
                    {/* Registration Timeline & Status Distribution Deck */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                        {/* Daily Registration Timeline Bar Graph */}
                        <div className="lg:col-span-7 p-5 rounded-2xl bg-white dark:bg-[#0A0A0A] border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4 flex flex-col justify-between">
                            <div>
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full bg-neutral-900 dark:bg-white" />
                                        <h3 className="font-bold text-sm text-neutral-900 dark:text-neutral-100">Registration Timeline & Velocity</h3>
                                    </div>
                                    <span className="text-[11px] font-medium text-neutral-500">
                                        {timelineData.length} active day(s) recorded
                                    </span>
                                </div>
                                <p className="text-[11px] text-neutral-500 font-normal mt-1">
                                    Daily distribution of student event registration submissions.
                                </p>
                            </div>

                            {/* Timeline Bar Chart */}
                            {timelineData.length > 0 ? (
                                <div className="pt-4 pb-2">
                                    <div className="flex items-end gap-2 h-40 border-b border-neutral-200 dark:border-neutral-800 px-2 overflow-x-auto">
                                        {timelineData.map((d) => (
                                            <div
                                                key={d.date}
                                                className="flex flex-col items-center flex-1 min-w-[32px] group relative"
                                            >
                                                {/* Hover Count Badge */}
                                                <span className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-7 px-2 py-0.5 rounded-lg bg-neutral-900 text-white text-[10px] font-medium pointer-events-none whitespace-nowrap z-10 shadow-sm">
                                                    {d.count} RSVP(s)
                                                </span>
                                                <div
                                                    className="w-full bg-neutral-900 dark:bg-neutral-100 hover:opacity-80 transition-all rounded-t-md"
                                                    style={{ height: `${Math.max(d.pct, 12)}%` }}
                                                />
                                                <span className="text-[9px] font-medium text-neutral-400 mt-1 truncate max-w-[45px]">
                                                    {d.date.slice(5)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="p-8 text-center text-xs font-normal text-neutral-400">
                                    No timeline activity recorded yet.
                                </div>
                            )}
                        </div>

                        {/* Response Status Distribution Breakdown */}
                        <div className="lg:col-span-5 p-5 rounded-2xl bg-white dark:bg-[#0A0A0A] border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4 flex flex-col justify-between">
                            <div>
                                <div className="flex items-center gap-2">
                                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                                    <h3 className="font-bold text-sm text-neutral-900 dark:text-neutral-100">Response Distribution</h3>
                                </div>
                                <p className="text-[11px] text-neutral-500 font-normal mt-1">
                                    Breakdown of applicant lifecycle stages.
                                </p>
                            </div>

                            {/* Multi-segment status bar */}
                            <div className="space-y-3">
                                <div className="w-full h-3 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden flex">
                                    {totalSubmissions > 0 && (
                                        <>
                                            <div
                                                className="bg-emerald-500 h-full"
                                                style={{
                                                    width: `${((statusCounts.successfulCount || successfulSubmissions) / totalSubmissions) * 100}%`,
                                                }}
                                                title={`Confirmed: ${statusCounts.successfulCount || successfulSubmissions}`}
                                            />
                                            <div
                                                className="bg-amber-400 h-full"
                                                style={{
                                                    width: `${((statusCounts.pendingCount || pendingSubmissions) / totalSubmissions) * 100}%`,
                                                }}
                                                title={`Pending: ${statusCounts.pendingCount || pendingSubmissions}`}
                                            />
                                            <div
                                                className="bg-rose-400 h-full"
                                                style={{
                                                    width: `${(statusCounts.rejectedCount / totalSubmissions) * 100}%`,
                                                }}
                                                title={`Rejected: ${statusCounts.rejectedCount}`}
                                            />
                                        </>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className="p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/60 flex items-center justify-between">
                                        <span className="font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-emerald-500" /> Confirmed
                                        </span>
                                        <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                                            {statusCounts.successfulCount || successfulSubmissions}
                                        </span>
                                    </div>

                                    <div className="p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/60 flex items-center justify-between">
                                        <span className="font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-amber-500" /> Pending
                                        </span>
                                        <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                                            {statusCounts.pendingCount || pendingSubmissions}
                                        </span>
                                    </div>

                                    <div className="p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/60 flex items-center justify-between">
                                        <span className="font-medium text-sky-700 dark:text-sky-400 flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-sky-500" /> Attended
                                        </span>
                                        <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                                            {statusCounts.attendedCount || attendedSubmissions}
                                        </span>
                                    </div>

                                    <div className="p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/60 flex items-center justify-between">
                                        <span className="font-medium text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-rose-500" /> Rejected
                                        </span>
                                        <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                                            {statusCounts.rejectedCount || 0}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Question-Wise Summaries Deck (Phase 5.1 Question Summaries + Popular Choices) */}
                    <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">Question-wise Summaries</h3>
                                <p className="text-xs text-neutral-500 font-normal">
                                    Aggregate choice percentages, popular answers, rating scores, and uploaded files.
                                </p>
                            </div>

                            <div className="relative">
                                <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    value={summarySearchFilter}
                                    onChange={(e) => setSummarySearchFilter(e.target.value)}
                                    placeholder="Filter question title..."
                                    className="pl-8 pr-3 py-1.5 text-xs font-normal border border-neutral-200 dark:border-neutral-800 rounded-xl bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-neutral-900 dark:focus:border-white"
                                />
                            </div>
                        </div>

                        {questionsList
                            .filter(
                                (q: any) =>
                                    !summarySearchFilter ||
                                    q.title.toLowerCase().includes(summarySearchFilter.toLowerCase())
                            )
                            .map((q: any, idx: number) => {
                                const answered = q.answeredCount || 0;
                                const rate = q.responseRate ?? (totalSubmissions > 0 ? Math.round((answered / totalSubmissions) * 100) : 0);

                                return (
                                    <div
                                        key={q.id || idx}
                                        className="p-5 rounded-2xl bg-white dark:bg-[#0A0A0A] border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4"
                                    >
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 dark:border-neutral-800 pb-3">
                                            <div className="flex items-center gap-2.5">
                                                <span className="w-6 h-6 rounded-md bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-[11px] font-bold flex items-center justify-center shrink-0">
                                                    {idx + 1}
                                                </span>
                                                <div>
                                                    <h4 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">{q.title}</h4>
                                                    <span className="text-[10px] text-neutral-400 font-medium uppercase tracking-wider">
                                                        {q.type.replace("_", " ")} {q.required && "• Required"}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <div className="text-right">
                                                    <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 block">
                                                        {answered} responses ({rate}%)
                                                    </span>
                                                    <span className="text-[10px] text-neutral-400 font-normal">
                                                        {q.skippedCount || 0} skipped
                                                    </span>
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setActiveQuestionIdx(idx);
                                                        setViewMode("question");
                                                    }}
                                                    className="px-2.5 py-1 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 text-xs font-semibold transition-colors cursor-pointer"
                                                >
                                                    Deep Dive →
                                                </button>
                                            </div>
                                        </div>

                                        {/* Popular Choice Badge (Requirement 5.1 Popular choices) */}
                                        {q.popularChoice && (
                                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs font-semibold text-neutral-900 dark:text-neutral-100 shadow-sm">
                                                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                                                <span>
                                                    Popular Choice: {q.popularChoice.text} ({q.popularChoice.percentage}%)
                                                </span>
                                            </div>
                                        )}

                                        {/* Option Percentage Bars (Requirement 5.1 & 5.2) */}
                                        {(q.optionCounts || q.selectionCounts) && (
                                            <div className="space-y-2 pt-1">
                                                {Object.entries(q.optionCounts || q.selectionCounts).map(
                                                    ([optName, count]: [string, any]) => {
                                                        const pct =
                                                            q.optionPercentages?.[optName] ??
                                                            (answered > 0 ? Math.round((count / answered) * 100) : 0);
                                                        const isTop = q.popularChoice?.text === optName;

                                                        return (
                                                            <div key={optName} className="space-y-1">
                                                                <div className="flex items-center justify-between text-xs font-medium text-neutral-800 dark:text-neutral-200">
                                                                    <span className="flex items-center gap-1.5">
                                                                        {optName}
                                                                        {isTop && (
                                                                            <span className="px-1.5 py-0.2 rounded bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-[9px] font-semibold">
                                                                                TOP
                                                                            </span>
                                                                        )}
                                                                    </span>
                                                                    <span className="text-neutral-500">
                                                                        {count} ({pct}%)
                                                                    </span>
                                                                </div>
                                                                <div className="w-full h-2.5 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                                                                    <div
                                                                        className={`h-full transition-all duration-300 rounded-full ${
                                                                            isTop ? "bg-neutral-900 dark:bg-white" : "bg-neutral-400 dark:bg-neutral-500"
                                                                        }`}
                                                                        style={{ width: `${pct}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        );
                                                    }
                                                )}
                                            </div>
                                        )}

                                        {/* Scale / Rating summary */}
                                        {q.type === "linear_scale" && (
                                            <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                <div>
                                                    <span className="text-xs font-semibold text-neutral-500 block">
                                                        Average Rating Score
                                                    </span>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">
                                                            {q.average}
                                                        </span>
                                                        <div className="flex text-amber-500">
                                                            <Star className="w-5 h-5 fill-amber-400 text-amber-500" />
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4 text-xs font-medium text-neutral-500">
                                                    <span>Min ({q.minScale || 1}): {q.minLabel || "Low"}</span>
                                                    <span>Max ({q.maxScale || 5}): {q.maxLabel || "High"}</span>
                                                </div>
                                            </div>
                                        )}

                                        {/* File upload summary */}
                                        {q.type === "file_upload" && (
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                                                    <span>{q.fileCount || 0} Files Uploaded</span>
                                                    <span>{((q.totalBytes || 0) / (1024 * 1024)).toFixed(2)} MB total</span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Descriptive answer preview samples */}
                                        {q.readableSamples && q.readableSamples.length > 0 && (
                                            <div className="space-y-1.5">
                                                <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block">
                                                    Readable Response Samples:
                                                </span>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
                                                    {q.readableSamples.slice(0, 4).map((sample: any) => (
                                                        <div
                                                            key={sample.id}
                                                            className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs space-y-1"
                                                        >
                                                            <div className="flex items-center justify-between text-[10px] font-medium text-neutral-400">
                                                                <span className="truncate">{sample.respondentName}</span>
                                                                <span>{new Date(sample.submittedAt).toLocaleDateString()}</span>
                                                            </div>
                                                            <p className="font-medium text-neutral-900 dark:text-neutral-100 line-clamp-2">
                                                                &ldquo;{sample.answer}&rdquo;
                                                            </p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                    </div>
                </div>
            )}

            {/* ============================================================== */}
            {/* 2. QUESTION-WISE VIEW (Phase 5.2)                              */}
            {/* ============================================================== */}
            {viewMode === "question" && activeQuestion && (
                <div className="space-y-5">
                    {/* Question Stepper Header */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#0A0A0A] border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                disabled={activeQuestionIdx === 0}
                                onClick={() => setActiveQuestionIdx((i) => Math.max(0, i - 1))}
                                className="p-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer text-neutral-700 dark:text-neutral-300 transition-colors"
                                title="Previous question"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>

                            <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                                Question {activeQuestionIdx + 1} of {questionsList.length}
                            </span>

                            <button
                                type="button"
                                disabled={activeQuestionIdx >= questionsList.length - 1}
                                onClick={() => setActiveQuestionIdx((i) => Math.min(questionsList.length - 1, i + 1))}
                                className="p-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer text-neutral-700 dark:text-neutral-300 transition-colors"
                                title="Next question"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Multi-select for export (Phase 5.5) */}
                        {activeResponse && (
                            <div className="flex items-center gap-3">
                                <NeoCheckbox
                                    checked={selectedIds.has(activeResponse.id)}
                                    onCheckedChange={() => toggleSelect(activeResponse.id)}
                                    size="sm"
                                    label="Select for Export"
                                />

                                <button
                                    type="button"
                                    onClick={toggleSelectAll}
                                    className="px-2 py-0.5 text-[11px] font-medium border border-neutral-200 dark:border-neutral-700 rounded-lg bg-neutral-50 dark:bg-neutral-900 hover:bg-neutral-100 cursor-pointer text-neutral-700 dark:text-neutral-300"
                                >
                                    {selectedIds.size === responses.length && responses.length > 0
                                        ? "Deselect All on Page"
                                        : "Select All on Page"}
                                </button>
                            </div>
                        )}

                        {/* Dropdown to jump directly to any question */}
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-neutral-500">Jump to:</span>
                            <NeoSelect
                                value={String(activeQuestionIdx)}
                                onChange={(val) => setActiveQuestionIdx(Number(val))}
                                size="sm"
                                className="w-56"
                                options={questionsList.map((q: any, qIdx: number) => ({
                                    value: String(qIdx),
                                    label: `${qIdx + 1}. ${q.title || "Untitled Question"}`
                                }))}
                            />
                        </div>
                    </div>

                    {/* Active Question Deep Dive Card */}
                    <div className="p-6 rounded-2xl bg-white dark:bg-[#0A0A0A] border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-6">
                        {/* Question Title & Meta */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 dark:border-neutral-800 pb-4">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="px-2 py-0.5 rounded-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-[10px] font-semibold uppercase tracking-wider">
                                        {activeQuestion.type.replace("_", " ")}
                                    </span>
                                    {activeQuestion.sectionTitle && (
                                        <span className="px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-[10px] font-medium text-neutral-700 dark:text-neutral-300">
                                            {activeQuestion.sectionTitle}
                                        </span>
                                    )}
                                    {activeQuestion.required && (
                                        <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 text-[10px] font-semibold">
                                            Required
                                        </span>
                                    )}
                                    {activeQuestion.isQuizQuestion && (
                                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 text-[10px] font-semibold flex items-center gap-1">
                                            <Award className="w-3 h-3" />
                                            {activeQuestion.points} pts
                                        </span>
                                    )}
                                </div>
                                <h3 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-neutral-100">
                                    {activeQuestion.title}
                                </h3>
                                {activeQuestion.description && (
                                    <p className="text-xs text-neutral-500 font-normal">
                                        {activeQuestion.description}
                                    </p>
                                )}
                            </div>

                            <div className="text-right sm:self-center shrink-0">
                                <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100 block">
                                    {activeQuestion.answeredCount || 0} / {totalSubmissions} responses
                                </span>
                                <span className="text-xs text-neutral-400 font-normal">
                                    {activeQuestion.responseRate}% completion rate
                                </span>
                            </div>
                        </div>

                        {/* A. Choice / Option Visualisations (Requirement 5.2: MERN 45%, Next.js 30%, Django 15%) */}
                        {(activeQuestion.optionCounts || activeQuestion.selectionCounts) && (
                            <div className="space-y-3">
                                <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                                    Response Distribution:
                                </h4>

                                <div className="space-y-3">
                                    {Object.entries(
                                        activeQuestion.optionCounts || activeQuestion.selectionCounts
                                    ).map(([optName, count]: [string, any]) => {
                                        const pct =
                                            activeQuestion.optionPercentages?.[optName] ??
                                            (activeQuestion.answeredCount > 0
                                                ? Math.round((count / activeQuestion.answeredCount) * 100)
                                                : 0);
                                        const isTop = activeQuestion.popularChoice?.text === optName;

                                        return (
                                            <div key={optName} className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 space-y-1.5">
                                                <div className="flex items-center justify-between text-xs sm:text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                                                    <span className="flex items-center gap-2">
                                                        <span>{optName}</span>
                                                        {isTop && (
                                                            <span className="px-2 py-0.5 rounded-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-[10px] font-semibold">
                                                                POPULAR ({pct}%)
                                                            </span>
                                                        )}
                                                    </span>
                                                    <span className="text-neutral-500">
                                                        {count} responses ({pct}%)
                                                    </span>
                                                </div>
                                                <div className="w-full h-2.5 bg-white dark:bg-neutral-800 rounded-full overflow-hidden border border-neutral-200 dark:border-neutral-700">
                                                    <div
                                                        className={`h-full transition-all duration-300 rounded-full ${
                                                            isTop ? "bg-neutral-900 dark:bg-white" : "bg-neutral-400 dark:bg-neutral-500"
                                                        }`}
                                                        style={{ width: `${pct}%` }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* B. Scale / Rating breakdown */}
                        {activeQuestion.type === "linear_scale" && (
                            <div className="space-y-4">
                                <div className="p-5 rounded-2xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                                    <div>
                                        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                                            Score Average
                                        </span>
                                        <div className="text-3xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">
                                            {activeQuestion.average}
                                        </div>
                                    </div>
                                    <div className="text-right text-xs font-medium text-neutral-500">
                                        <span>Min: {activeQuestion.minLabel || "1"}</span>
                                        <span className="mx-2">•</span>
                                        <span>Max: {activeQuestion.maxLabel || "5"}</span>
                                    </div>
                                </div>

                                {/* Scale Distribution Histogram */}
                                <div className="space-y-2">
                                    <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                                        Rating Scale Breakdown:
                                    </h4>
                                    <div className="grid grid-cols-5 gap-2">
                                        {activeQuestion.distribution &&
                                            Object.entries(activeQuestion.distribution).map(([point, count]: [string, any]) => {
                                                const pct = activeQuestion.distributionPercentages?.[Number(point)] || 0;
                                                return (
                                                    <div key={point} className="p-3 bg-neutral-50 dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 text-center space-y-1">
                                                        <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">{point} ★</span>
                                                        <div className="text-lg font-bold text-neutral-800 dark:text-neutral-200">{count}</div>
                                                        <span className="text-[10px] text-neutral-400 font-medium">{pct}%</span>
                                                    </div>
                                                );
                                            })}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* C. Descriptive / Text Answers (Requirement 5.2: Readable response samples rather than forcing a chart) */}
                        {activeQuestion.readableSamples && (
                            <div className="space-y-3">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                                        Readable Student Answers ({activeQuestion.readableSamples.length}):
                                    </h4>

                                    <div className="relative">
                                        <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                        <input
                                            type="text"
                                            value={textAnswerFilter}
                                            onChange={(e) => setTextAnswerFilter(e.target.value)}
                                            placeholder="Search answers..."
                                            className="pl-8 pr-3 py-1 text-xs font-normal border border-neutral-200 dark:border-neutral-800 rounded-xl bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-neutral-900"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                                    {activeQuestion.readableSamples
                                        .filter(
                                            (s: any) =>
                                                !textAnswerFilter ||
                                                s.answer.toLowerCase().includes(textAnswerFilter.toLowerCase()) ||
                                                s.respondentName.toLowerCase().includes(textAnswerFilter.toLowerCase())
                                        )
                                        .map((sample: any) => (
                                            <div
                                                key={sample.id}
                                                className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 space-y-2"
                                            >
                                                <div className="flex items-center justify-between text-xs font-medium text-neutral-500 border-b border-neutral-100 dark:border-neutral-800 pb-1.5">
                                                    <span className="flex items-center gap-1.5 text-neutral-900 dark:text-neutral-100 font-semibold">
                                                        <User className="w-3.5 h-3.5 text-neutral-400" />
                                                        {sample.respondentName}
                                                        {sample.applicantEmail && (
                                                            <span className="text-neutral-400 font-normal">
                                                                ({sample.applicantEmail})
                                                            </span>
                                                        )}
                                                    </span>
                                                    <span>{new Date(sample.submittedAt).toLocaleString()}</span>
                                                </div>
                                                <p className="text-xs sm:text-sm font-medium text-neutral-800 dark:text-neutral-200 whitespace-pre-wrap">
                                                    &ldquo;{sample.answer}&rdquo;
                                                </p>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        )}

                        {/* D. File Upload Questions */}
                        {activeQuestion.type === "file_upload" && (
                            <div className="space-y-3">
                                <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                                    Uploaded Files ({activeQuestion.recentFiles?.length || 0}):
                                </h4>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                    {activeQuestion.recentFiles && activeQuestion.recentFiles.length > 0 ? (
                                        activeQuestion.recentFiles.map((file: any, fIdx: number) => (
                                            <a
                                                key={fIdx}
                                                href={file.fileUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800 flex items-center justify-between text-xs font-medium text-neutral-900 dark:text-neutral-100 shadow-sm group transition-colors"
                                            >
                                                <div className="flex items-center gap-2.5 truncate">
                                                    <Paperclip className="w-4 h-4 text-neutral-400 shrink-0" />
                                                    <div className="truncate">
                                                        <span className="font-semibold text-neutral-900 dark:text-neutral-100 block truncate">
                                                            {file.fileName || "Attachment"}
                                                        </span>
                                                        <span className="text-[10px] text-neutral-400 font-normal block">
                                                            By {file.respondentName} • {((file.fileSize || 0) / 1024).toFixed(1)} KB
                                                        </span>
                                                    </div>
                                                </div>
                                                <ExternalLink className="w-4 h-4 opacity-50 group-hover:opacity-100 shrink-0" />
                                            </a>
                                        ))
                                    ) : (
                                        <p className="text-xs text-neutral-400 font-normal">
                                            No file attachments uploaded for this question yet.
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ============================================================== */}
            {/* 3. INDIVIDUAL RESPONSES & FILTER TOOLBAR (Phase 5.3 & 5.4)       */}
            {/* ============================================================== */}
            {viewMode === "individual" && (
                <div className="space-y-5">
                    {/* Filter & Search Toolbar (Phase 5.4 Server-Side Filtering) */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#0A0A0A] border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <Filter className="w-4 h-4 text-neutral-900 dark:text-neutral-100" />
                                <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
                                    Server-Side Filter & Search Toolbar
                                </h4>
                            </div>

                            <button
                                type="button"
                                onClick={handleResetFilters}
                                className="text-xs font-medium text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 self-end sm:self-auto cursor-pointer underline"
                            >
                                Reset All Filters
                            </button>
                        </div>

                        {/* Search, Status, Dates, Sorting Controls */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                            {/* Search Name/Email/Username */}
                            <div className="relative">
                                <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search name, email, username..."
                                    className="w-full pl-8 pr-3 py-1.5 text-xs font-normal border border-neutral-200 dark:border-neutral-800 rounded-xl bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-neutral-900"
                                />
                            </div>

                            {/* Status Filter */}
                            <div>
                                <NeoSelect
                                    value={statusFilter}
                                    onChange={(val) => setStatusFilter(val)}
                                    size="sm"
                                    triggerClassName="w-full"
                                >
                                    <option value="all">All Statuses ({statusCounts.totalCount})</option>
                                    <option value="registered">Registered ({statusCounts.successfulCount})</option>
                                    <option value="pending">Pending ({statusCounts.pendingCount})</option>
                                    <option value="attended">Attended ({statusCounts.attendedCount})</option>
                                    <option value="rejected">Rejected ({statusCounts.rejectedCount})</option>
                                    <option value="cancelled">Cancelled ({statusCounts.cancelledCount})</option>
                                </NeoSelect>
                            </div>

                            {/* Date Range: From Date */}
                            <div>
                                <NeoDateTimePicker
                                    value={startDateFilter}
                                    onChange={(val) => setStartDateFilter(val)}
                                    mode="date"
                                    placeholder="From date..."
                                />
                            </div>

                            {/* Date Range: To Date */}
                            <div>
                                <NeoDateTimePicker
                                    value={endDateFilter}
                                    onChange={(val) => setEndDateFilter(val)}
                                    mode="date"
                                    placeholder="To date..."
                                />
                            </div>
                        </div>

                        {/* Sort & Pagination Options Bar */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-medium text-neutral-500">Sort by:</span>
                                <NeoSelect
                                    value={sortBy}
                                    onChange={(val) => setSortBy(val)}
                                    size="sm"
                                    triggerClassName="min-w-[140px]"
                                >
                                    <option value="registered_at">Submission Date</option>
                                    <option value="applicant_name">Applicant Name</option>
                                    <option value="quiz_score">Quiz Score</option>
                                    <option value="status">Status</option>
                                </NeoSelect>

                                <button
                                    type="button"
                                    onClick={() => setSortOrder((o) => (o === "DESC" ? "ASC" : "DESC"))}
                                    className="px-2.5 py-1 text-xs font-semibold border border-neutral-200 dark:border-neutral-700 rounded-lg bg-neutral-50 dark:bg-neutral-900 hover:bg-neutral-100 text-neutral-800 dark:text-neutral-200 flex items-center gap-1 cursor-pointer transition-colors"
                                    title="Toggle sort direction"
                                >
                                    <ArrowUpDown className="w-3 h-3" />
                                    <span>{sortOrder === "DESC" ? "Newest / High" : "Oldest / Low"}</span>
                                </button>
                            </div>

                            {/* Page size selector */}
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-neutral-500">Page Size:</span>
                                <NeoSelect
                                    value={pageSize}
                                    onChange={(val) => setPageSize(Number(val))}
                                    size="sm"
                                    triggerClassName="w-20"
                                >
                                    <option value={10}>10</option>
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                </NeoSelect>
                            </div>
                        </div>
                    </div>

                    {/* Pagination / Stepper Control Bar (Phase 5.3) */}
                    <div className="p-4 rounded-2xl bg-white dark:bg-[#0A0A0A] border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                disabled={currentRespIdx === 0}
                                onClick={() => setCurrentRespIdx((i) => Math.max(0, i - 1))}
                                className="p-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer text-neutral-700 dark:text-neutral-300 transition-colors"
                                title="Previous respondent"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>

                            <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                                Respondent {totalResponses > 0 ? currentRespIdx + 1 : 0} of {responses.length} on page (Total {totalResponses})
                            </span>

                            <button
                                type="button"
                                disabled={currentRespIdx >= responses.length - 1}
                                onClick={() => setCurrentRespIdx((i) => Math.min(responses.length - 1, i + 1))}
                                className="p-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer text-neutral-700 dark:text-neutral-300 transition-colors"
                                title="Next respondent"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Multi-select for export (Phase 5.5) */}
                        {activeResponse && (
                            <div className="flex items-center gap-3">
                                <NeoCheckbox
                                    checked={selectedIds.has(activeResponse.id)}
                                    onCheckedChange={() => toggleSelect(activeResponse.id)}
                                    size="sm"
                                    label="Select for Export"
                                />

                                <button
                                    type="button"
                                    onClick={toggleSelectAll}
                                    className="px-2 py-0.5 text-[11px] font-medium border border-neutral-200 dark:border-neutral-700 rounded-lg bg-neutral-50 dark:bg-neutral-900 hover:bg-neutral-100 text-neutral-700 dark:text-neutral-300 cursor-pointer"
                                >
                                    {selectedIds.size === responses.length && responses.length > 0
                                        ? "Deselect All on Page"
                                        : "Select All on Page"}
                                </button>
                            </div>
                        )}

                        {/* Page navigation */}
                        {totalPages > 1 && (
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    disabled={currentPage <= 1}
                                    onClick={() => loadResponses(currentPage - 1)}
                                    className="px-2.5 py-1 text-xs font-semibold border border-neutral-200 dark:border-neutral-700 rounded-lg bg-neutral-50 dark:bg-neutral-900 hover:bg-neutral-100 disabled:opacity-40 cursor-pointer text-neutral-800 dark:text-neutral-200"
                                >
                                    Prev Page
                                </button>
                                <span className="text-xs font-medium text-neutral-500">
                                    Page {currentPage} of {totalPages}
                                </span>
                                <button
                                    type="button"
                                    disabled={currentPage >= totalPages}
                                    onClick={() => loadResponses(currentPage + 1)}
                                    className="px-2.5 py-1 text-xs font-semibold border border-neutral-200 dark:border-neutral-700 rounded-lg bg-neutral-50 dark:bg-neutral-900 hover:bg-neutral-100 disabled:opacity-40 cursor-pointer text-neutral-800 dark:text-neutral-200"
                                >
                                    Next Page
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Respondent Profile Card & All Answers (Phase 5.3) */}
                    {loadingResponses ? (
                        <div className="p-12 text-center">
                            <OrbixLoader size="md" />
                            <span className="text-xs font-medium text-neutral-400 block mt-2">
                                Loading student responses...
                            </span>
                        </div>
                    ) : responses.length === 0 ? (
                        <div className="p-8 text-center text-xs font-medium text-neutral-500 bg-white dark:bg-[#0A0A0A] rounded-2xl border border-neutral-200 dark:border-neutral-800">
                            No student responses match your current filter criteria.
                        </div>
                    ) : (
                        activeResponse && (
                            <div className="p-6 rounded-2xl bg-white dark:bg-[#0A0A0A] border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-6">
                                {/* Respondent Identity Card Header */}
                                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-neutral-100 dark:border-neutral-800 pb-5">
                                    <div className="flex items-center gap-3">
                                        <div className="w-14 h-14 rounded-2xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 overflow-hidden flex items-center justify-center shrink-0">
                                            {activeResponse.userPhotoUrl ? (
                                                <img
                                                    src={activeResponse.userPhotoUrl}
                                                    alt="Student"
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <User className="w-7 h-7 text-neutral-400" />
                                            )}
                                        </div>

                                        <div className="space-y-0.5">
                                            <div className="flex items-center gap-2">
                                                <h4 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                                                    {activeResponse.applicantName || activeResponse.applicant_name || "Student Respondent"}
                                                </h4>
                                                {activeResponse.username && (
                                                    <span className="text-xs font-medium text-neutral-400">
                                                        @{activeResponse.username}
                                                    </span>
                                                )}
                                            </div>

                                            <span className="text-xs text-neutral-500 font-medium flex items-center gap-1.5">
                                                <Mail className="w-3.5 h-3.5 text-neutral-400" />
                                                {activeResponse.applicantEmail || activeResponse.applicant_email || "No email"}
                                            </span>

                                            {activeResponse.phoneNumber && (
                                                <span className="text-[11px] text-neutral-400 font-normal block">
                                                    Phone: {activeResponse.phoneNumber}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Action Pills & Status Changer */}
                                    <div className="space-y-2 text-right">
                                        {/* Status Changer Dropdown */}
                                        <div className="flex items-center gap-2 justify-end">
                                            <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                                                Status:
                                            </span>
                                            <NeoSelect
                                                value={activeResponse.status}
                                                disabled={updatingStatusId === activeResponse.id}
                                                onChange={(val) => handleStatusChange(activeResponse.id, val)}
                                                size="sm"
                                                className="w-36"
                                                options={[
                                                    { value: "registered", label: "Registered" },
                                                    { value: "pending", label: "Pending" },
                                                    { value: "attended", label: "Attended" },
                                                    { value: "rejected", label: "Rejected" },
                                                    { value: "cancelled", label: "Cancelled" },
                                                ]}
                                            />
                                        </div>

                                        {/* Quiz Score Badge */}
                                        {activeResponse.quizScore !== null && activeResponse.quizScore !== undefined && (
                                            <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 font-semibold text-xs border border-emerald-200 dark:border-emerald-800/60 shadow-sm">
                                                <Award className="w-3.5 h-3.5" />
                                                <span>
                                                    Score: {activeResponse.quizScore} / {activeResponse.quizMaxScore ?? "?"} pts
                                                </span>
                                            </div>
                                        )}

                                        <div className="text-[10px] text-neutral-400 font-normal block">
                                            Submitted: {new Date(activeResponse.registeredAt || activeResponse.registered_at).toLocaleString()}
                                        </div>
                                    </div>
                                </div>

                                {/* Registration Identifiers & Copy Buttons */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    {/* Ticket / Pass Code */}
                                    <div className="p-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
                                        <div>
                                            <span className="text-[9px] font-semibold uppercase tracking-wider text-neutral-500 block">
                                                Ticket Code
                                            </span>
                                            <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                                                {activeResponse.ticketCode || activeResponse.ticket_code || "PENDING"}
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                handleCopy(activeResponse.ticketCode || activeResponse.ticket_code, "ticket")
                                            }
                                            className="p-1 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:bg-neutral-50 cursor-pointer text-neutral-700 dark:text-neutral-300 transition-colors"
                                            title="Copy ticket pass code"
                                        >
                                            {copiedKey === "ticket" ? (
                                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                            ) : (
                                                <Copy className="w-3.5 h-3.5" />
                                            )}
                                        </button>
                                    </div>

                                    {/* Registration ID */}
                                    <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                                        <div className="truncate mr-2">
                                            <span className="text-[9px] font-semibold uppercase tracking-wider text-neutral-400 block">
                                                Registration ID
                                            </span>
                                            <span className="text-xs font-mono font-medium text-neutral-900 dark:text-neutral-100 truncate block">
                                                {activeResponse.id}
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleCopy(activeResponse.id, "regId")}
                                            className="p-1 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-100 cursor-pointer shrink-0 text-neutral-700 dark:text-neutral-300 transition-colors"
                                            title="Copy Registration ID"
                                        >
                                            {copiedKey === "regId" ? (
                                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                            ) : (
                                                <Copy className="w-3.5 h-3.5" />
                                            )}
                                        </button>
                                    </div>

                                    {/* Form Version Used */}
                                    <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                                        <span className="text-[9px] font-semibold uppercase tracking-wider text-neutral-400 block">
                                            Form Snapshot Used
                                        </span>
                                        <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                                            {activeResponse.versionNumber ? `Version ${activeResponse.versionNumber}` : "Version 1 (Initial)"}
                                        </span>
                                    </div>
                                </div>

                                {/* Student Academic Identity Fields */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                                    <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                                        <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block">
                                            Roll Number
                                        </span>
                                        <p className="font-semibold text-neutral-900 dark:text-neutral-100">
                                            {activeResponse.rollNumber || activeResponse.roll_number || "Not provided"}
                                        </p>
                                    </div>
                                    <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                                        <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block">
                                            Department
                                        </span>
                                        <p className="font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                                            {activeResponse.department || "Not provided"}
                                        </p>
                                    </div>
                                    <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                                        <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block">
                                            Year of Study
                                        </span>
                                        <p className="font-semibold text-neutral-900 dark:text-neutral-100">
                                            {activeResponse.yearOfStudy || activeResponse.year_of_study || "Not provided"}
                                        </p>
                                    </div>
                                </div>

                                {/* All Submitted Answers (Phase 5.3) */}
                                <div className="space-y-3 pt-2">
                                    <h5 className="text-xs font-semibold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                                        All Submitted Answers:
                                    </h5>

                                    {activeResponse.answers && Object.keys(activeResponse.answers).length > 0 ? (
                                        <div className="space-y-3">
                                            {Object.entries(activeResponse.answers).map(([qId, ansVal]: [string, any]) => {
                                                const qMeta = data?.questionStats?.[qId];
                                                const title = qMeta?.title || qId;

                                                return (
                                                    <div
                                                        key={qId}
                                                        className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/50 space-y-1.5"
                                                    >
                                                        <div className="flex items-center justify-between text-xs">
                                                            <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                                                                {title}
                                                            </span>
                                                            {qMeta?.type && (
                                                                <span className="text-[10px] font-medium text-neutral-400 uppercase">
                                                                    {qMeta.type.replace("_", " ")}
                                                                </span>
                                                            )}
                                                        </div>

                                                        <p className="text-xs sm:text-sm font-medium text-neutral-900 dark:text-neutral-100 whitespace-pre-wrap bg-white dark:bg-neutral-900 p-3 rounded-xl border border-neutral-200 dark:border-neutral-800">
                                                            {Array.isArray(ansVal)
                                                                ? ansVal.join(", ")
                                                                : typeof ansVal === "object" && ansVal !== null
                                                                ? JSON.stringify(ansVal, null, 2)
                                                                : String(ansVal)}
                                                        </p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-neutral-400 font-normal">
                                            No custom question answers recorded.
                                        </p>
                                    )}
                                </div>

                                {/* Uploaded Attachments (Phase 5.3) */}
                                {activeResponse.fileAttachments && activeResponse.fileAttachments.length > 0 && (
                                    <div className="space-y-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                                        <h5 className="text-xs font-semibold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                                            Uploaded Attachments:
                                        </h5>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                            {activeResponse.fileAttachments.map((f: any, fIdx: number) => (
                                                <a
                                                    key={fIdx}
                                                    href={f.fileUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800 flex items-center justify-between text-xs font-medium text-neutral-900 dark:text-neutral-100 shadow-sm group transition-colors"
                                                >
                                                    <div className="flex items-center gap-2 truncate">
                                                        <Paperclip className="w-4 h-4 text-neutral-400 shrink-0" />
                                                        <span className="truncate font-semibold">
                                                            {f.fileName || "Attachment"}
                                                        </span>
                                                    </div>
                                                    <ExternalLink className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100 shrink-0" />
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    )}
                </div>
            )}

            {/* ============================================================== */}
            {/* 4. VERSION SNAPSHOTS (Audit Trail & Rollback)                   */}
            {/* ============================================================== */}
            {viewMode === "versions" && (
                <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs font-normal text-neutral-600 dark:text-neutral-400">
                        Published form versions are immutable snapshots. Submissions are permanently tied to the exact version used when the student submitted. You can roll back to any historical version below.
                    </div>

                    {loadingVersions ? (
                        <div className="p-12 text-center">
                            <OrbixLoader size="md" />
                            <span className="text-xs font-medium text-neutral-400 block mt-2">
                                Loading form version snapshots...
                            </span>
                        </div>
                    ) : versions.length === 0 ? (
                        <div className="p-8 text-center text-xs font-medium text-neutral-500 bg-white dark:bg-[#0A0A0A] rounded-2xl border border-neutral-200 dark:border-neutral-800">
                            No published snapshots yet. Click &ldquo;Publish Live&rdquo; in the Questions tab to publish Version 1.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {versions.map((ver) => (
                                <div
                                    key={ver.id}
                                    className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#0A0A0A] border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                                >
                                    <div className="space-y-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="px-2.5 py-0.5 rounded-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-semibold">
                                                Version {ver.versionNumber}
                                            </span>
                                            <h4 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 truncate">
                                                {ver.title}
                                            </h4>
                                        </div>
                                        <p className="text-xs text-neutral-400 font-normal">
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
                                            className="px-3.5 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-semibold text-xs shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
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
