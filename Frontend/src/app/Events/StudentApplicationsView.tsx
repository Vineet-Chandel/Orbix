import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
    Ticket,
    Calendar,
    Clock,
    MapPin,
    CheckCircle2,
    Copy,
    Search,
    Ban,
    Menu,
} from "lucide-react";
import { useToast } from "../../context/ToastContext";
import {
    fetchStudentApplications,
    cancelEventRegistration,
    type StudentApplicationItem,
} from "../../api/collegeEventsApi";
import { SectionBottomIllustration } from "../common/SectionBottomIllustration";
import { OrbixLoader } from "../../components/ui/loader";
import { ConfirmationModal } from "../../components/ConfirmationModal";

interface StudentApplicationsViewProps {
    onOpenMobileSidebar?: () => void;
}

export const StudentApplicationsView: React.FC<StudentApplicationsViewProps> = ({
    onOpenMobileSidebar,
}) => {
    const toast = useToast();
    const [applications, setApplications] = useState<StudentApplicationItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "registered" | "attended" | "rejected" | "cancelled">("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [cancellingId, setCancellingId] = useState<string | null>(null);
    const [withdrawTargetApp, setWithdrawTargetApp] = useState<StudentApplicationItem | null>(null);
    const [isWithdrawing, setIsWithdrawing] = useState(false);

    const loadApplications = async () => {
        setLoading(true);
        try {
            const data = await fetchStudentApplications();
            setApplications(data);
        } catch (err: any) {
            console.error("Failed to load applications:", err);
            toast.error(err.message || "Failed to load your event applications.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadApplications();
    }, []);

    const handleCopyTicket = (code?: string | null) => {
        if (!code) return;
        navigator.clipboard.writeText(code);
        toast.success("Ticket code copied to clipboard!");
    };

    const handleConfirmWithdraw = async () => {
        if (!withdrawTargetApp) return;
        const target = withdrawTargetApp;

        try {
            setIsWithdrawing(true);
            setCancellingId(target.id);
            await cancelEventRegistration(target.eventId);
            toast.success(`Registration for "${target.eventTitle}" cancelled.`);
            setApplications((prev) =>
                prev.map((a) => (a.id === target.id ? { ...a, status: "cancelled" } : a))
            );
            setWithdrawTargetApp(null);
        } catch (err: any) {
            toast.error(err.message || "Failed to cancel registration.");
        } finally {
            setIsWithdrawing(false);
            setCancellingId(null);
        }
    };

    // Subsets
    const registeredApps = useMemo(
        () => applications.filter((a) => a.status === "registered"),
        [applications]
    );
    const attendedApps = useMemo(
        () => applications.filter((a) => a.status === "attended"),
        [applications]
    );
    const cancelledApps = useMemo(
        () => applications.filter((a) => a.status === "cancelled"),
        [applications]
    );

    const filteredApplications = useMemo(() => {
        let list = applications;
        if (statusFilter !== "all") {
            list = list.filter((a) => a.status === statusFilter);
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter(
                (a) =>
                    a.eventTitle.toLowerCase().includes(q) ||
                    a.clubName.toLowerCase().includes(q) ||
                    (a.ticketCode && a.ticketCode.toLowerCase().includes(q)) ||
                    (a.department && a.department.toLowerCase().includes(q))
            );
        }

        return list;
    }, [applications, statusFilter, searchQuery]);

    return (
        <section
            aria-label="Student Applications & Passes"
            className="flex-1 w-full min-h-0 bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:18px_18px] rounded-2xl border-2 border-black shadow-[6px_6px_0px_#000] overflow-y-auto scrollbar-none flex flex-col justify-between"
        >
            <div className="p-4 sm:p-6 lg:p-8 flex-1 space-y-6">
                {/* Header Banner */}
                <div className="p-5 sm:p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            {onOpenMobileSidebar && (
                                <button
                                    type="button"
                                    onClick={onOpenMobileSidebar}
                                    className="p-1.5 rounded-lg border-2 border-black lg:hidden bg-[#FAF6EE] hover:bg-neutral-100"
                                >
                                    <Menu className="w-4 h-4" />
                                </button>
                            )}
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#a2ff86] border border-black shadow-[1px_1px_0px_#000]">
                                Entry Management
                            </span>
                        </div>
                        <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-black tracking-tight">
                            My Applications & Event Passes
                        </h1>
                        <p className="text-xs sm:text-sm font-medium text-neutral-600">
                            View active registration passes, ticket verification codes, and attendance history.
                        </p>
                    </div>

                    <Link
                        to="/college-events"
                        className="px-4 py-2 rounded-xl bg-[#a2ff86] hover:bg-[#8ee673] border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 self-start md:self-auto cursor-pointer transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                    >
                        <Calendar className="w-3.5 h-3.5 text-black" />
                        <span>Browse College Events</span>
                    </Link>
                </div>

                {/* Metrics Summary Row */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    <button
                        type="button"
                        onClick={() => setStatusFilter("all")}
                        className={`p-4 rounded-xl border-2 border-black text-left cursor-pointer transition-all ${
                            statusFilter === "all"
                                ? "bg-[#a2ff86] text-black shadow-[3px_3px_0px_#000] font-black"
                                : "bg-white text-neutral-900 shadow-[2px_2px_0px_#000] hover:bg-[#FAF6EE]"
                        }`}
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-neutral-600">
                                Total Applied
                            </span>
                            <Ticket className="w-4 h-4 opacity-70" />
                        </div>
                        <div className="text-2xl sm:text-3xl font-black mt-2">{applications.length}</div>
                    </button>

                    <button
                        type="button"
                        onClick={() => setStatusFilter("registered")}
                        className={`p-4 rounded-xl border-2 border-black text-left cursor-pointer transition-all ${
                            statusFilter === "registered"
                                ? "bg-emerald-300 text-black shadow-[3px_3px_0px_#000] font-black"
                                : "bg-emerald-50 text-emerald-950 shadow-[2px_2px_0px_#000] hover:bg-emerald-100"
                        }`}
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-emerald-900">
                                Active Passes
                            </span>
                            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                        </div>
                        <div className="text-2xl sm:text-3xl font-black mt-2 text-neutral-900">
                            {registeredApps.length}
                        </div>
                    </button>

                    <button
                        type="button"
                        onClick={() => setStatusFilter("attended")}
                        className={`p-4 rounded-xl border-2 border-black text-left cursor-pointer transition-all ${
                            statusFilter === "attended"
                                ? "bg-purple-300 text-black shadow-[3px_3px_0px_#000] font-black"
                                : "bg-purple-50 text-purple-950 shadow-[2px_2px_0px_#000] hover:bg-purple-100"
                        }`}
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-purple-900">
                                Attended
                            </span>
                            <CheckCircle2 className="w-4 h-4 text-purple-700" />
                        </div>
                        <div className="text-2xl sm:text-3xl font-black mt-2 text-neutral-900">
                            {attendedApps.length}
                        </div>
                    </button>

                    <button
                        type="button"
                        onClick={() => setStatusFilter("cancelled")}
                        className={`p-4 rounded-xl border-2 border-black text-left cursor-pointer transition-all ${
                            statusFilter === "cancelled"
                                ? "bg-rose-300 text-black shadow-[3px_3px_0px_#000] font-black"
                                : "bg-rose-50 text-rose-950 shadow-[2px_2px_0px_#000] hover:bg-rose-100"
                        }`}
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-rose-900">
                                Cancelled
                            </span>
                            <Ban className="w-4 h-4 text-rose-700" />
                        </div>
                        <div className="text-2xl sm:text-3xl font-black mt-2 text-neutral-900">
                            {cancelledApps.length}
                        </div>
                    </button>
                </div>

                {/* Filter and Search Bar */}
                <div className="p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-3">
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search applications by event title, club name, or ticket code..."
                            className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black focus:outline-hidden focus:bg-white"
                        />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-black/10">
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setStatusFilter("all")}
                                className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider border-2 border-black cursor-pointer transition-all ${
                                    statusFilter === "all"
                                        ? "bg-[#a2ff86] text-black shadow-[2px_2px_0px_#000]"
                                        : "bg-[#FAF6EE] text-neutral-700 hover:bg-neutral-100"
                                }`}
                            >
                                All ({applications.length})
                            </button>
                            <button
                                type="button"
                                onClick={() => setStatusFilter("registered")}
                                className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider border-2 border-black cursor-pointer transition-all ${
                                    statusFilter === "registered"
                                        ? "bg-[#a2ff86] text-black shadow-[2px_2px_0px_#000]"
                                        : "bg-[#FAF6EE] text-neutral-700 hover:bg-neutral-100"
                                }`}
                            >
                                Confirmed ({registeredApps.length})
                            </button>
                            <button
                                type="button"
                                onClick={() => setStatusFilter("attended")}
                                className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider border-2 border-black cursor-pointer transition-all ${
                                    statusFilter === "attended"
                                        ? "bg-[#a2ff86] text-black shadow-[2px_2px_0px_#000]"
                                        : "bg-[#FAF6EE] text-neutral-700 hover:bg-neutral-100"
                                }`}
                            >
                                Attended ({attendedApps.length})
                            </button>
                            <button
                                type="button"
                                onClick={() => setStatusFilter("cancelled")}
                                className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider border-2 border-black cursor-pointer transition-all ${
                                    statusFilter === "cancelled"
                                        ? "bg-[#a2ff86] text-black shadow-[2px_2px_0px_#000]"
                                        : "bg-[#FAF6EE] text-neutral-700 hover:bg-neutral-100"
                                }`}
                            >
                                Cancelled ({cancelledApps.length})
                            </button>
                        </div>

                        <span className="text-xs font-bold text-neutral-500">
                            Showing {filteredApplications.length} record{filteredApplications.length === 1 ? "" : "s"}
                        </span>
                    </div>
                </div>

                {/* Applications Grid */}
                {loading ? (
                    <div className="p-16 flex flex-col items-center justify-center gap-3">
                        <OrbixLoader size="lg" />
                        <span className="text-xs font-black text-black">Loading your applications...</span>
                    </div>
                ) : filteredApplications.length === 0 ? (
                    <div className="p-12 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] text-center space-y-3">
                        <Ticket className="w-10 h-10 text-neutral-400 mx-auto" />
                        <h3 className="font-black text-base text-neutral-900">No applications found</h3>
                        <p className="text-xs font-medium text-neutral-500 max-w-sm mx-auto">
                            {statusFilter !== "all"
                                ? `You have no applications with status "${statusFilter}".`
                                : "You haven't registered for any campus events or workshops yet."}
                        </p>
                        <Link
                            to="/college-events"
                            className="mt-2 inline-flex px-4 py-2 rounded-xl bg-[#a2ff86] text-black border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] hover:bg-[#8ee673]"
                        >
                            Browse Campus Events
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {filteredApplications.map((app) => (
                            <div
                                key={app.id}
                                className="p-5 sm:p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col justify-between space-y-4"
                            >
                                <div className="space-y-3">
                                    {/* Event Banner */}
                                    {app.coverImageUrl && (
                                        <div className="w-full rounded-xl border-2 border-black overflow-hidden relative bg-neutral-950 shadow-[2px_2px_0px_#000] flex items-center justify-center">
                                            <img
                                                src={app.coverImageUrl}
                                                alt={app.eventTitle}
                                                className="w-full h-auto max-h-[560px] object-contain block"
                                                loading="lazy"
                                            />
                                        </div>
                                    )}

                                    {/* Top Event Meta */}
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            {app.clubLogoUrl ? (
                                                <img
                                                    src={app.clubLogoUrl}
                                                    alt={app.clubName}
                                                    className="w-5 h-5 rounded-md border border-black object-cover"
                                                />
                                            ) : (
                                                <div className="w-5 h-5 rounded-md border border-black bg-[#a2ff86] flex items-center justify-center text-[9px] font-black">
                                                    {app.clubName.slice(0, 2).toUpperCase()}
                                                </div>
                                            )}
                                            <span className="text-xs font-black text-black">{app.clubName}</span>
                                        </div>

                                        <span
                                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border border-black ${
                                                app.status === "registered"
                                                    ? "bg-emerald-300 text-black shadow-[1px_1px_0px_#000]"
                                                    : app.status === "attended"
                                                    ? "bg-purple-300 text-black shadow-[1px_1px_0px_#000]"
                                                    : app.status === "pending"
                                                    ? "bg-amber-300 text-black shadow-[1px_1px_0px_#000]"
                                                    : "bg-rose-200 text-black shadow-[1px_1px_0px_#000]"
                                            }`}
                                        >
                                            {app.status === "registered"
                                                ? "Accepted / Pass Active"
                                                : app.status === "attended"
                                                ? "Attended"
                                                : app.status === "pending"
                                                ? "Pending Review"
                                                : app.status === "rejected"
                                                ? "Not Selected"
                                                : "Withdrawn"}
                                        </span>
                                    </div>

                                    {/* Title & Timing */}
                                    <div>
                                        <h3 className="text-base sm:text-lg font-black text-neutral-900 line-clamp-1">
                                            {app.eventTitle}
                                        </h3>
                                        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-600 font-medium">
                                            <span className="flex items-center gap-1 font-bold">
                                                <Clock className="w-3.5 h-3.5 text-neutral-500" />
                                                {new Date(app.startsAt).toLocaleDateString(undefined, {
                                                    weekday: "short",
                                                    month: "short",
                                                    day: "numeric",
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                })}
                                            </span>
                                            <span className="flex items-center gap-1 font-bold">
                                                <MapPin className="w-3.5 h-3.5 text-neutral-500" />
                                                {app.venueOrLocation || (app.locationType === "virtual" ? "Virtual" : "Campus")}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Digital Ticket Pass Card */}
                                    <div className="p-3.5 rounded-xl bg-[#FAF6EE] border-2 border-dashed border-black/40 space-y-2">
                                        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-neutral-500">
                                            <span>{app.status === "registered" || app.status === "attended" ? "Ticket Pass Code" : "Application Status"}</span>
                                            <span>
                                                Applied: {new Date(app.registeredAt).toLocaleDateString()}
                                            </span>
                                        </div>

                                        {app.status === "registered" || app.status === "attended" ? (
                                            <div className="flex items-center justify-between gap-3">
                                                <span className="text-base sm:text-lg font-mono font-black tracking-wider text-black">
                                                    {app.ticketCode}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopyTicket(app.ticketCode)}
                                                    className="px-2.5 py-1 rounded-lg bg-white hover:bg-neutral-100 border border-black text-xs font-black shadow-[1px_1px_0px_#000] flex items-center gap-1 cursor-pointer"
                                                >
                                                    <Copy className="w-3 h-3" />
                                                    <span>Copy</span>
                                                </button>
                                            </div>
                                        ) : app.status === "pending" ? (
                                            <div className="text-amber-900 font-bold text-xs py-1 flex items-center gap-1.5">
                                                <Clock className="w-3.5 h-3.5 text-amber-700" />
                                                <span>Awaiting coordinator review · Ticket pass will generate once approved.</span>
                                            </div>
                                        ) : (
                                            <div className="text-rose-900 font-bold text-xs py-1 flex items-center gap-1.5">
                                                <Ban className="w-3.5 h-3.5 text-rose-700" />
                                                <span>Application not selected by organizers.</span>
                                            </div>
                                        )}

                                        {app.checkedInAt && (
                                            <div className="text-[10px] font-bold text-emerald-800 flex items-center gap-1 pt-1 border-t border-black/10">
                                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                                <span>Checked in at session on {new Date(app.checkedInAt).toLocaleString()}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Applicant Metadata snapshot */}
                                    <div className="text-[11px] font-bold text-neutral-500 flex flex-wrap gap-x-3 gap-y-0.5">
                                        <span>Student: {app.applicantName}</span>
                                        {app.department && <span>• {app.department}</span>}
                                        {app.yearOfStudy && <span>• {app.yearOfStudy}</span>}
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="pt-3 border-t-2 border-black/10 flex items-center justify-between gap-2">
                                    <Link
                                        to="/college-events"
                                        className="text-xs font-black text-neutral-700 hover:text-black underline"
                                    >
                                        View Event in Catalog
                                    </Link>

                                    {app.status === "registered" && (
                                        <button
                                            type="button"
                                            disabled={cancellingId === app.id || isWithdrawing}
                                            onClick={() => setWithdrawTargetApp(app)}
                                            className="px-3 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border-2 border-black text-xs font-black shadow-[1px_1px_0px_#000] cursor-pointer disabled:opacity-50"
                                        >
                                            {cancellingId === app.id ? "Cancelling..." : "Withdraw Pass"}
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Withdraw Application Confirmation Modal */}
            <ConfirmationModal
                isOpen={Boolean(withdrawTargetApp)}
                onClose={() => {
                    if (!isWithdrawing) setWithdrawTargetApp(null);
                }}
                onConfirm={handleConfirmWithdraw}
                title="Withdraw Event Pass"
                description={
                    withdrawTargetApp ? (
                        <div className="space-y-3">
                            <p className="text-xs sm:text-sm font-medium text-neutral-700 leading-relaxed">
                                Are you sure you want to withdraw your pass for{" "}
                                <strong className="text-black font-black">"{withdrawTargetApp.eventTitle}"</strong>?
                            </p>
                            <div className="p-3 bg-rose-50 border-2 border-black rounded-xl text-xs space-y-1.5 font-bold text-rose-950">
                                <div className="flex items-center justify-between">
                                    <span className="text-neutral-500 font-mono text-[10px] uppercase">Host Club:</span>
                                    <span className="text-black">{withdrawTargetApp.clubName}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-neutral-500 font-mono text-[10px] uppercase">Access Ticket:</span>
                                    <span className="font-mono text-black">{withdrawTargetApp.ticketCode}</span>
                                </div>
                                <p className="text-[11px] text-rose-700 pt-1 border-t border-rose-200">
                                    ⚠️ Your pass will be cancelled immediately and cannot be recovered.
                                </p>
                            </div>
                        </div>
                    ) : undefined
                }
                variant="danger"
                confirmText="Withdraw Pass"
                confirmLabel={isWithdrawing ? "Withdrawing..." : "Withdraw Pass"}
                cancelText="Keep Pass"
                isLoading={isWithdrawing}
                requiredInputText="WITHDRAW"
                inputPlaceholder='Type "WITHDRAW" to confirm'
            />

            {/* Bottom Illustration */}
            <SectionBottomIllustration alt="Orbix event passes illustration" />
        </section>
    );
};

export default StudentApplicationsView;
