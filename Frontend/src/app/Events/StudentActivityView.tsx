import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
    Ticket,
    Calendar,
    Clock,
    MapPin,
    Copy,
    Search,
    Ban,
    Menu,
    Award,
    Sparkles,
    Eye,
    QrCode,
    Share2,
    Building2,
    X,
    Printer,
} from "lucide-react";
import { useToast } from "../../context/ToastContext";
import {
    fetchStudentApplications,
    cancelEventRegistration,
    type StudentApplicationItem,
} from "../../api/collegeEventsApi";
import {
    fetchStudentCertificates,
    type CertificateItem,
} from "../../api/clubCertificatesApi";
import { CertificateModal } from "../common/CertificateModal";
import { SectionBottomIllustration } from "../common/SectionBottomIllustration";
import { OrbixLoader } from "../../components/ui/loader";
import { ConfirmationModal } from "../../components/ConfirmationModal";
import { useModalDismiss } from "../../hooks/useModalDismiss";
import { OrbixCardQR } from "../Profile/CardStudio/OrbixCardQR";

interface StudentActivityViewProps {
    onOpenMobileSidebar?: () => void;
    initialSegment?: "applications" | "sessions" | "certificates";
}

export const StudentActivityView: React.FC<StudentActivityViewProps> = ({
    onOpenMobileSidebar,
    initialSegment = "applications",
}) => {
    const toast = useToast();

    // Active Segment: "applications" | "sessions" | "certificates"
    const [activeSegment, setActiveSegment] = useState<"applications" | "sessions" | "certificates">(
        initialSegment
    );

    // Applications & Sessions data
    const [applications, setApplications] = useState<StudentApplicationItem[]>([]);
    const [loadingApps, setLoadingApps] = useState(true);
    const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "registered" | "attended" | "waitlisted" | "rejected" | "cancelled">("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [cancellingId, setCancellingId] = useState<string | null>(null);
    const [withdrawTargetApp, setWithdrawTargetApp] = useState<StudentApplicationItem | null>(null);
    const [isWithdrawing, setIsWithdrawing] = useState(false);

    // Certificates data
    const [certificates, setCertificates] = useState<CertificateItem[]>([]);
    const [loadingCerts, setLoadingCerts] = useState(false);
    const [selectedCert, setSelectedCert] = useState<CertificateItem | null>(null);

    // QR Pass Modal state
    const [activePassApp, setActivePassApp] = useState<StudentApplicationItem | null>(null);

    const { handleBackdropClick: handlePassBackdropClick } = useModalDismiss({
        isOpen: Boolean(activePassApp),
        onClose: () => setActivePassApp(null),
    });

    // Load Applications
    const loadApplications = async () => {
        setLoadingApps(true);
        try {
            const data = await fetchStudentApplications();
            setApplications(data);
        } catch (err: any) {
            console.error("Failed to load applications:", err);
            toast.error(err.message || "Failed to load your event applications.");
        } finally {
            setLoadingApps(false);
        }
    };

    // Load Certificates
    const loadCertificates = async () => {
        setLoadingCerts(true);
        try {
            const certs = await fetchStudentCertificates();
            setCertificates(certs);
        } catch (err: any) {
            console.error("Failed to load certificates:", err);
            toast.error(err.message || "Failed to load certificates.");
        } finally {
            setLoadingCerts(false);
        }
    };

    useEffect(() => {
        loadApplications();
        loadCertificates();
    }, []);

    const handleCopyTicket = (code?: string | null) => {
        if (!code) return;
        navigator.clipboard.writeText(code);
        toast.success("Ticket code copied to clipboard!");
    };

    const handlePrintPass = () => {
        window.print();
    };

    const handleConfirmWithdraw = async () => {
        if (!withdrawTargetApp) return;
        const target = withdrawTargetApp;

        try {
            setIsWithdrawing(true);
            setCancellingId(target.id);
            await cancelEventRegistration(target.eventId);
            toast.success(`Registration for "${target.eventTitle}" withdrawn successfully.`);
            setApplications((prev) =>
                prev.map((a) => (a.id === target.id ? { ...a, status: "cancelled" } : a))
            );
            setWithdrawTargetApp(null);
        } catch (err: any) {
            toast.error(err.message || "Failed to withdraw registration.");
        } finally {
            setIsWithdrawing(false);
            setCancellingId(null);
        }
    };

    // Filtered Applications for Segment 1
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

    // Sessions for Segment 2: active / registered / attended
    const sessionItems = useMemo(() => {
        return applications.filter((a) => a.status === "registered" || a.status === "attended");
    }, [applications]);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "pending":
                return {
                    label: "Under Review",
                    bg: "bg-[#FFDE59]",
                    border: "border-black",
                    desc: "Awaiting Club Approval",
                };
            case "registered":
                return {
                    label: "Confirmed / Registered",
                    bg: "bg-[#a2ff86]",
                    border: "border-black",
                    desc: "Application Accepted · Pass Active",
                };
            case "attended":
                return {
                    label: "Attended & Checked In",
                    bg: "bg-[#A6E3E9]",
                    border: "border-black",
                    desc: "Turnout Verified",
                };
            case "waitlisted":
                return {
                    label: "Waitlisted",
                    bg: "bg-[#FFDE59]",
                    border: "border-black",
                    desc: "Awaiting Seat Allocation",
                };
            case "rejected":
                return {
                    label: "Application Not Selected",
                    bg: "bg-[#FFAEBC]",
                    border: "border-black",
                    desc: "Declined by Club Coordinators",
                };
            case "cancelled":
            default:
                return {
                    label: "Withdrawn",
                    bg: "bg-neutral-200",
                    border: "border-black",
                    desc: "Application Withdrawn",
                };
        }
    };

    return (
        <section
            aria-label="Student Activity, Sessions & Certificates"
            className="flex-1 w-full min-h-0 bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:18px_18px] rounded-2xl border-2 border-black shadow-[6px_6px_0px_#000] overflow-y-auto scrollbar-none flex flex-col justify-between"
        >
            <div className="p-4 sm:p-6 lg:p-8 flex-1 space-y-6">
                {/* Header Banner */}
                <div className="p-5 sm:p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            {onOpenMobileSidebar && (
                                <button
                                    onClick={onOpenMobileSidebar}
                                    className="p-1.5 rounded-lg border-2 border-black bg-white md:hidden hover:bg-neutral-100 shadow-[2px_2px_0px_#000]"
                                >
                                    <Menu className="w-4 h-4" />
                                </button>
                            )}
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-[#a2ff86] text-black border border-black shadow-[1px_1px_0px_#000]">
                                Student Portfolio
                            </span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                            Activity & Credentials
                        </h1>
                        <p className="text-xs sm:text-sm font-bold text-neutral-600 max-w-2xl">
                            Track your event registration applications, access active session passes, and view verified digital certificates issued by campus clubs.
                        </p>
                    </div>

                    {/* Quick Explore Link */}
                    <Link
                        to="/college-events"
                        className="px-4 py-2.5 rounded-xl border-2 border-black bg-[#a2ff86] hover:bg-[#8cee70] text-black font-black text-xs shadow-[3px_3px_0px_#000] flex items-center gap-2 transition-transform active:translate-x-0.5 active:translate-y-0.5 self-start md:self-auto"
                    >
                        <Sparkles className="w-4 h-4" />
                        Explore Campus Events
                    </Link>
                </div>

                {/* Segment Switcher Navigation */}
                <div className="p-1.5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] flex flex-wrap gap-2">
                    <button
                        onClick={() => setActiveSegment("applications")}
                        className={`flex-1 min-w-[120px] py-2.5 px-4 rounded-xl border-2 text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 ${
                            activeSegment === "applications"
                                ? "bg-[#a2ff86] border-black text-black shadow-[2px_2px_0px_#000]"
                                : "bg-transparent border-transparent text-neutral-700 hover:bg-neutral-100"
                        }`}
                    >
                        <Ticket className="w-4 h-4" />
                        <span>Applications</span>
                        <span className="px-1.5 py-0.2 rounded-md bg-white border border-black text-[10px] font-black">
                            {applications.length}
                        </span>
                    </button>

                    <button
                        onClick={() => setActiveSegment("sessions")}
                        className={`flex-1 min-w-[120px] py-2.5 px-4 rounded-xl border-2 text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 ${
                            activeSegment === "sessions"
                                ? "bg-[#FFDE59] border-black text-black shadow-[2px_2px_0px_#000]"
                                : "bg-transparent border-transparent text-neutral-700 hover:bg-neutral-100"
                        }`}
                    >
                        <Calendar className="w-4 h-4" />
                        <span>Sessions</span>
                        <span className="px-1.5 py-0.2 rounded-md bg-white border border-black text-[10px] font-black">
                            {sessionItems.length}
                        </span>
                    </button>

                    <button
                        onClick={() => setActiveSegment("certificates")}
                        className={`flex-1 min-w-[120px] py-2.5 px-4 rounded-xl border-2 text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 ${
                            activeSegment === "certificates"
                                ? "bg-[#A6E3E9] border-black text-black shadow-[2px_2px_0px_#000]"
                                : "bg-transparent border-transparent text-neutral-700 hover:bg-neutral-100"
                        }`}
                    >
                        <Award className="w-4 h-4" />
                        <span>Certificates</span>
                        <span className="px-1.5 py-0.2 rounded-md bg-white border border-black text-[10px] font-black">
                            {certificates.length}
                        </span>
                    </button>
                </div>

                {/* ========================================================================= */}
                {/* SEGMENT 1: APPLICATIONS */}
                {/* ========================================================================= */}
                {activeSegment === "applications" && (
                    <div className="space-y-6">
                        {/* Search & Status Filters */}
                        <div className="p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                            <div className="relative flex-1">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search applications by event, club, ticket code..."
                                    className="w-full pl-9 pr-3 py-2 rounded-xl border-2 border-black font-bold text-xs bg-[#FAF6EE] focus:outline-none focus:ring-2 focus:ring-[#a2ff86]"
                                />
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5 text-xs">
                                <button
                                    onClick={() => setStatusFilter("all")}
                                    className={`px-3 py-1.5 rounded-lg border font-black transition-all ${
                                        statusFilter === "all"
                                            ? "bg-black text-white border-black"
                                            : "bg-white text-neutral-700 border-neutral-300 hover:border-black"
                                    }`}
                                >
                                    All ({applications.length})
                                </button>
                                <button
                                    onClick={() => setStatusFilter("pending")}
                                    className={`px-3 py-1.5 rounded-lg border font-black transition-all ${
                                        statusFilter === "pending"
                                            ? "bg-[#FFDE59] text-black border-black"
                                            : "bg-white text-neutral-700 border-neutral-300 hover:border-black"
                                    }`}
                                >
                                    Pending ({applications.filter((a) => a.status === "pending").length})
                                </button>
                                <button
                                    onClick={() => setStatusFilter("registered")}
                                    className={`px-3 py-1.5 rounded-lg border font-black transition-all ${
                                        statusFilter === "registered"
                                            ? "bg-[#a2ff86] text-black border-black"
                                            : "bg-white text-neutral-700 border-neutral-300 hover:border-black"
                                    }`}
                                >
                                    Accepted ({applications.filter((a) => a.status === "registered").length})
                                </button>
                                <button
                                    onClick={() => setStatusFilter("attended")}
                                    className={`px-3 py-1.5 rounded-lg border font-black transition-all ${
                                        statusFilter === "attended"
                                            ? "bg-[#A6E3E9] text-black border-black"
                                            : "bg-white text-neutral-700 border-neutral-300 hover:border-black"
                                    }`}
                                >
                                    Attended ({applications.filter((a) => a.status === "attended").length})
                                </button>
                                <button
                                    onClick={() => setStatusFilter("rejected")}
                                    className={`px-3 py-1.5 rounded-lg border font-black transition-all ${
                                        statusFilter === "rejected"
                                            ? "bg-[#FFAEBC] text-black border-black"
                                            : "bg-white text-neutral-700 border-neutral-300 hover:border-black"
                                    }`}
                                >
                                    Rejected ({applications.filter((a) => a.status === "rejected").length})
                                </button>
                                <button
                                    onClick={() => setStatusFilter("cancelled")}
                                    className={`px-3 py-1.5 rounded-lg border font-black transition-all ${
                                        statusFilter === "cancelled"
                                            ? "bg-neutral-300 text-black border-black"
                                            : "bg-white text-neutral-700 border-neutral-300 hover:border-black"
                                    }`}
                                >
                                    Withdrawn ({applications.filter((a) => a.status === "cancelled").length})
                                </button>
                            </div>
                        </div>

                        {/* Applications List */}
                        {loadingApps ? (
                            <div className="p-16 text-center space-y-3">
                                <OrbixLoader size="md" />
                                <span className="text-xs font-black text-black">Loading your event applications...</span>
                            </div>
                        ) : filteredApplications.length === 0 ? (
                            <div className="p-12 text-center rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-3">
                                <Ticket className="w-10 h-10 text-neutral-400 mx-auto" />
                                <h3 className="font-black text-base text-neutral-900">No applications found</h3>
                                <p className="text-xs font-bold text-neutral-600 max-w-md mx-auto">
                                    {searchQuery.trim()
                                        ? `No applications matched "${searchQuery}".`
                                        : "You haven't applied for any college sessions or workshops yet."}
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {filteredApplications.map((app) => {
                                    const badge = getStatusBadge(app.status);
                                    const eventDateStr = new Date(app.startsAt).toLocaleDateString("en-US", {
                                        weekday: "short",
                                        month: "short",
                                        day: "numeric",
                                        year: "numeric",
                                    });
                                    const eventTimeStr = new Date(app.startsAt).toLocaleTimeString("en-US", {
                                        hour: "numeric",
                                        minute: "2-digit",
                                        hour12: true,
                                    });

                                    return (
                                        <div
                                            key={app.id}
                                            className="p-5 rounded-2xl bg-white border-3 border-black shadow-[4px_4px_0px_#000] space-y-4"
                                        >
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

                                            {/* Top Row: Event Info & Status Badge */}
                                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                                                <div className="space-y-1.5">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${badge.border} ${badge.bg}`}>
                                                            {badge.label}
                                                        </span>
                                                        <span className="text-[11px] font-bold text-neutral-500">
                                                            {badge.desc}
                                                        </span>
                                                    </div>
                                                    <h3 className="font-black text-lg text-black leading-tight">
                                                        {app.eventTitle}
                                                    </h3>
                                                    <div className="flex items-center gap-2">
                                                        {app.clubLogoUrl ? (
                                                            <img
                                                                src={app.clubLogoUrl}
                                                                alt={app.clubName}
                                                                className="w-5 h-5 rounded-md border border-black object-cover shrink-0 shadow-[1px_1px_0px_#000]"
                                                            />
                                                        ) : (
                                                            <div className="w-5 h-5 rounded-md border border-black bg-[#a2ff86] flex items-center justify-center font-black text-[9px] shrink-0 shadow-[1px_1px_0px_#000]">
                                                                {app.clubName ? app.clubName.slice(0, 2).toUpperCase() : "CL"}
                                                            </div>
                                                        )}
                                                        <Link
                                                            to={`/clubs/${app.clubSlug}`}
                                                            className="text-xs font-black text-black hover:underline truncate"
                                                        >
                                                            {app.clubName}
                                                        </Link>
                                                        <span className="text-xs font-bold text-neutral-500">
                                                            · {app.collegeName || "Campus Event"}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="text-left sm:text-right flex flex-col sm:items-end gap-1">
                                                    <div className="text-xs font-black text-black flex items-center gap-1">
                                                        <Calendar className="w-3.5 h-3.5" />
                                                        {eventDateStr}
                                                    </div>
                                                    <div className="text-[11px] font-bold text-neutral-500 flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />
                                                        {eventTimeStr}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Middle Details Grid */}
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-xl bg-[#FAF6EE] border border-black/20 text-xs font-bold">
                                                <div>
                                                    <span className="text-[10px] uppercase font-black text-neutral-500 block">
                                                        Venue / Room
                                                    </span>
                                                    <span className="text-black flex items-center gap-1">
                                                        <MapPin className="w-3.5 h-3.5 text-neutral-700 flex-shrink-0" />
                                                        <span className="truncate">{app.venueOrLocation || "Campus Venue"}</span>
                                                    </span>
                                                </div>

                                                <div>
                                                    <span className="text-[10px] uppercase font-black text-neutral-500 block">
                                                        {app.status === "registered" || app.status === "attended" ? "Access Ticket Code" : "Application Status"}
                                                    </span>
                                                    {app.status === "registered" || app.status === "attended" ? (
                                                        <span className="font-mono text-black font-black flex items-center gap-1">
                                                            {app.ticketCode}
                                                            {app.ticketCode && (
                                                                <button
                                                                    onClick={() => handleCopyTicket(app.ticketCode!)}
                                                                    className="p-1 hover:bg-neutral-200 rounded cursor-pointer"
                                                                    title="Copy Ticket Code"
                                                                >
                                                                    <Copy className="w-3 h-3" />
                                                                </button>
                                                            )}
                                                        </span>
                                                    ) : app.status === "pending" ? (
                                                        <span className="text-amber-900 font-bold flex items-center gap-1 text-xs">
                                                            <Clock className="w-3.5 h-3.5 text-amber-700" />
                                                            Pending Review
                                                        </span>
                                                    ) : app.status === "rejected" ? (
                                                        <span className="text-rose-900 font-bold flex items-center gap-1 text-xs">
                                                            <Ban className="w-3.5 h-3.5 text-rose-700" />
                                                            Not Selected
                                                        </span>
                                                    ) : (
                                                        <span className="text-neutral-500 font-bold text-xs">
                                                            Withdrawn
                                                        </span>
                                                    )}
                                                </div>

                                                <div>
                                                    <span className="text-[10px] uppercase font-black text-neutral-500 block">
                                                        Applicant Details
                                                    </span>
                                                    <span className="text-neutral-800 truncate block">
                                                        {app.department || "General"} {app.yearOfStudy ? `(${app.yearOfStudy})` : ""}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Action Controls */}
                                            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-black/10">
                                                <div className="flex items-center gap-2">
                                                    {app.status === "registered" || app.status === "attended" ? (
                                                        <button
                                                            onClick={() => setActivePassApp(app)}
                                                            className="px-3 py-1.5 rounded-lg border-2 border-black bg-white hover:bg-neutral-100 text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 transition-transform active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
                                                        >
                                                            <QrCode className="w-3.5 h-3.5" />
                                                            View Pass & QR
                                                        </button>
                                                    ) : app.status === "pending" ? (
                                                        <span className="px-3 py-1.5 rounded-lg border border-amber-400 bg-amber-50 text-amber-950 text-xs font-bold flex items-center gap-1.5 select-none">
                                                            <Clock className="w-3.5 h-3.5 text-amber-700" />
                                                            Pass will activate once club approves
                                                        </span>
                                                    ) : app.status === "rejected" ? (
                                                        <span className="px-3 py-1.5 rounded-lg border border-rose-300 bg-rose-50 text-rose-800 text-xs font-bold flex items-center gap-1.5 select-none">
                                                            <Ban className="w-3.5 h-3.5 text-rose-600" />
                                                            Application not selected
                                                        </span>
                                                    ) : null}
                                                </div>

                                                {(app.status === "registered" || app.status === "pending") && (
                                                    <button
                                                        onClick={() => setWithdrawTargetApp(app)}
                                                        disabled={cancellingId === app.id || isWithdrawing}
                                                        className="px-3 py-1.5 rounded-lg border border-red-500 text-red-600 hover:bg-red-50 text-xs font-black flex items-center gap-1 transition-all cursor-pointer"
                                                    >
                                                        <Ban className="w-3.5 h-3.5" />
                                                        {cancellingId === app.id ? "Withdrawing..." : "Withdraw Application"}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* ========================================================================= */}
                {/* SEGMENT 2: SESSIONS */}
                {/* ========================================================================= */}
                {activeSegment === "sessions" && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="font-black text-base text-black">Active & Upcoming Sessions</h3>
                                <p className="text-xs font-bold text-neutral-600">
                                    Show this digital pass at the entrance check-in or join virtual meeting rooms.
                                </p>
                            </div>
                            <span className="px-2.5 py-1 rounded-lg border border-black bg-white text-xs font-black shadow-[1.5px_1.5px_0px_#000]">
                                Total Sessions: {sessionItems.length}
                            </span>
                        </div>

                        {sessionItems.length === 0 ? (
                            <div className="p-12 text-center rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-3">
                                <Calendar className="w-10 h-10 text-neutral-400 mx-auto" />
                                <h4 className="font-black text-base text-black">No active sessions</h4>
                                <p className="text-xs font-bold text-neutral-600 max-w-sm mx-auto">
                                    You don't have any confirmed session passes right now. Explore college events to register.
                                </p>
                                <Link
                                    to="/college-events"
                                    className="inline-block mt-2 px-4 py-2 rounded-xl border-2 border-black bg-[#a2ff86] text-black font-black text-xs shadow-[2px_2px_0px_#000]"
                                >
                                    Browse Events & Workshops
                                </Link>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {sessionItems.map((item) => {
                                    const isAttended = item.status === "attended";
                                    const formattedDate = new Date(item.startsAt).toLocaleDateString("en-US", {
                                        month: "short",
                                        day: "numeric",
                                        year: "numeric",
                                    });
                                    const formattedTime = new Date(item.startsAt).toLocaleTimeString("en-US", {
                                        hour: "numeric",
                                        minute: "2-digit",
                                        hour12: true,
                                    });

                                    return (
                                        <div
                                            key={item.id}
                                            className="p-5 rounded-2xl bg-white border-3 border-black shadow-[5px_5px_0px_#000] flex flex-col justify-between space-y-4"
                                        >
                                            {/* Cover Banner */}
                                            {item.coverImageUrl && (
                                                <div className="w-full rounded-xl border-2 border-black overflow-hidden relative bg-neutral-950 shadow-[2px_2px_0px_#000] flex items-center justify-center">
                                                    <img
                                                        src={item.coverImageUrl}
                                                        alt={item.eventTitle}
                                                        className="w-full h-auto max-h-[380px] object-contain block"
                                                        loading="lazy"
                                                    />
                                                </div>
                                            )}

                                            <div className="space-y-3">
                                                <div className="flex items-start justify-between gap-2">
                                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border border-black ${
                                                        isAttended ? "bg-[#A6E3E9]" : "bg-[#a2ff86]"
                                                    }`}>
                                                        {isAttended ? "Checked-In (Attended)" : "Active Admission Pass"}
                                                    </span>
                                                    <div className="text-[11px] font-mono font-bold text-neutral-600">
                                                        {formattedDate}
                                                    </div>
                                                </div>

                                                <div>
                                                    <h4 className="font-black text-base text-black leading-tight">
                                                        {item.eventTitle}
                                                    </h4>
                                                    <div className="flex items-center gap-1.5 mt-1">
                                                        {item.clubLogoUrl ? (
                                                            <img
                                                                src={item.clubLogoUrl}
                                                                alt={item.clubName}
                                                                className="w-4 h-4 rounded border border-black object-cover shrink-0 shadow-[1px_1px_0px_#000]"
                                                            />
                                                        ) : (
                                                            <div className="w-4 h-4 rounded border border-black bg-[#a2ff86] flex items-center justify-center font-black text-[8px] shrink-0 shadow-[1px_1px_0px_#000]">
                                                                {item.clubName ? item.clubName.slice(0, 2).toUpperCase() : "CL"}
                                                            </div>
                                                        )}
                                                        <Link
                                                            to={`/clubs/${item.clubSlug}`}
                                                            className="text-xs font-black text-black hover:underline truncate"
                                                        >
                                                            {item.clubName}
                                                        </Link>
                                                    </div>
                                                </div>

                                                <div className="p-3 rounded-xl bg-[#FAF6EE] border border-black/20 space-y-2 text-xs font-bold">
                                                    <div className="flex items-center gap-2 text-neutral-800">
                                                        <Clock className="w-4 h-4 text-black flex-shrink-0" />
                                                        <span>{formattedTime}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-neutral-800">
                                                        <MapPin className="w-4 h-4 text-black flex-shrink-0" />
                                                        <span className="truncate">{item.venueOrLocation || "Campus Center"}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between pt-1 border-t border-black/10">
                                                        <span className="text-[10px] font-mono text-neutral-500">
                                                            Ticket Code:
                                                        </span>
                                                        <span className="font-mono font-black text-black">
                                                            {item.ticketCode}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between pt-2 border-t border-black/10">
                                                <button
                                                    onClick={() => setActivePassApp(item)}
                                                    className="px-3 py-1.5 rounded-lg border-2 border-black bg-white hover:bg-neutral-100 text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5"
                                                >
                                                    <QrCode className="w-3.5 h-3.5" />
                                                    Show QR Pass
                                                </button>

                                                <button
                                                    onClick={() => handleCopyTicket(item.ticketCode)}
                                                    className="px-3 py-1.5 rounded-lg border border-black bg-neutral-100 hover:bg-neutral-200 text-xs font-black flex items-center gap-1"
                                                >
                                                    <Copy className="w-3 h-3" />
                                                    Copy Code
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* ========================================================================= */}
                {/* SEGMENT 3: CERTIFICATES */}
                {/* ========================================================================= */}
                {activeSegment === "certificates" && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="font-black text-base text-black">Awarded Certificates & Credentials</h3>
                                <p className="text-xs font-bold text-neutral-600">
                                    Official verified achievement certificates issued to you by verified campus clubs.
                                </p>
                            </div>
                            <span className="px-2.5 py-1 rounded-lg border border-black bg-white text-xs font-black shadow-[1.5px_1.5px_0px_#000]">
                                Total Earned: {certificates.length}
                            </span>
                        </div>

                        {loadingCerts ? (
                            <div className="p-16 text-center space-y-3">
                                <OrbixLoader size="md" />
                                <span className="text-xs font-black text-black">Loading your verified certificates...</span>
                            </div>
                        ) : certificates.length === 0 ? (
                            <div className="p-12 text-center rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-3">
                                <Award className="w-12 h-12 text-neutral-400 mx-auto" />
                                <h4 className="font-black text-base text-black">No certificates awarded yet</h4>
                                <p className="text-xs font-bold text-neutral-600 max-w-md mx-auto">
                                    When you participate in club events, contribute to campus chapters, or earn distinctions, verified certificates issued by clubs will appear right here.
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {certificates.map((cert) => {
                                    const issueDateStr = new Date(cert.issueDate).toLocaleDateString("en-US", {
                                        month: "short",
                                        day: "numeric",
                                        year: "numeric",
                                    });

                                    return (
                                        <div
                                            key={cert.id}
                                            className="p-5 rounded-2xl bg-white border-3 border-black shadow-[5px_5px_0px_#000] flex flex-col justify-between space-y-4"
                                        >
                                            <div className="space-y-3">
                                                <div className="flex items-start justify-between gap-2">
                                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#FFDE59] text-black border border-black shadow-[1px_1px_0px_#000]">
                                                        {cert.certificateType}
                                                    </span>
                                                    <span className="text-[11px] font-mono font-bold text-neutral-500">
                                                        {issueDateStr}
                                                    </span>
                                                </div>

                                                <div>
                                                    <h4 className="font-black text-lg text-black leading-tight">
                                                        {cert.title}
                                                    </h4>
                                                    <p className="text-xs font-bold text-neutral-600 flex items-center gap-1.5 mt-1">
                                                        <Building2 className="w-3.5 h-3.5" />
                                                        {cert.clubName} · {cert.collegeName || "Campus Club"}
                                                    </p>
                                                </div>

                                                <p className="text-xs font-medium text-neutral-700 line-clamp-2">
                                                    {cert.description}
                                                </p>

                                                <div className="p-2.5 rounded-xl bg-neutral-100 border border-black/20 flex items-center justify-between text-xs font-mono">
                                                    <span className="font-bold text-neutral-600">Credential ID:</span>
                                                    <span className="font-black text-black">{cert.credentialCode}</span>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between pt-2 border-t border-black/10">
                                                <button
                                                    onClick={() => setSelectedCert(cert)}
                                                    className="px-3.5 py-1.5 rounded-xl border-2 border-black bg-[#a2ff86] hover:bg-[#8cee70] text-black text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 transition-transform active:translate-x-0.5 active:translate-y-0.5"
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                    View Certificate
                                                </button>

                                                <button
                                                    onClick={() => {
                                                        const url = `${window.location.origin}/verify-cert/${encodeURIComponent(cert.credentialCode)}`;
                                                        navigator.clipboard.writeText(url);
                                                        toast.success("Verification link copied!");
                                                    }}
                                                    className="p-1.5 rounded-lg border border-black bg-white hover:bg-neutral-100 text-xs font-black shadow-[1px_1px_0px_#000]"
                                                    title="Share Verification Link"
                                                >
                                                    <Share2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Bottom Illustration */}
            <SectionBottomIllustration />

            {/* Official Certificate Full View Modal */}
            <CertificateModal
                certificate={selectedCert}
                isOpen={!!selectedCert}
                onClose={() => setSelectedCert(null)}
            />

            {/* QR Pass Details Modal */}
            {activePassApp && (
                <div
                    onClick={handlePassBackdropClick}
                    className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white print:static"
                >
                    <style>{`
                        @media print {
                            body * {
                                visibility: hidden !important;
                            }
                            #orbix-printable-pass, #orbix-printable-pass * {
                                visibility: visible !important;
                            }
                            #orbix-printable-pass {
                                position: absolute !important;
                                left: 50% !important;
                                top: 20px !important;
                                transform: translateX(-50%) !important;
                                width: 100% !important;
                                max-width: 480px !important;
                                margin: 0 auto !important;
                                background: #ffffff !important;
                                border: 3px solid #000000 !important;
                                border-radius: 24px !important;
                                box-shadow: none !important;
                                -webkit-print-color-adjust: exact !important;
                                print-color-adjust: exact !important;
                            }
                        }
                    `}</style>
                    <div
                        id="orbix-printable-pass"
                        onClick={(e) => e.stopPropagation()}
                        className="relative w-full max-w-sm sm:max-w-md bg-white rounded-3xl border-4 border-black shadow-[8px_8px_0px_#000] p-5 sm:p-6 text-center space-y-4 my-auto overflow-hidden print:border-3 print:shadow-none print:max-w-md print:mx-auto print:my-0"
                    >
                        {/* Close button */}
                        <button
                            onClick={() => setActivePassApp(null)}
                            className="absolute top-3 right-3 p-1.5 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 z-20 shadow-[1px_1px_0px_#000] cursor-pointer print:hidden"
                        >
                            <X className="w-4 h-4 text-black stroke-[2.5]" />
                        </button>

                        {/* Event Banner */}
                        {activePassApp.coverImageUrl && (
                            <div className="w-full rounded-2xl border-2 border-black overflow-hidden relative shadow-[2px_2px_0px_#000] -mt-1 bg-neutral-950 flex items-center justify-center">
                                <img
                                    src={activePassApp.coverImageUrl}
                                    alt={activePassApp.eventTitle}
                                    className="w-full h-auto max-h-[260px] object-contain block"
                                />
                            </div>
                        )}

                        {/* Pass Header */}
                        <div className="space-y-1">
                            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-black text-[#a2ff86]">
                                <span className="w-2 h-2 rounded-full bg-[#a2ff86] animate-pulse inline-block" />
                                Official Entry Pass
                            </div>
                            <h3 className="font-black text-lg text-black mt-1 leading-tight">
                                {activePassApp.eventTitle}
                            </h3>
                            <div className="flex items-center justify-center gap-1.5 mt-1">
                                {activePassApp.clubLogoUrl ? (
                                    <img
                                        src={activePassApp.clubLogoUrl}
                                        alt={activePassApp.clubName}
                                        className="w-4 h-4 rounded border border-black object-cover shrink-0 shadow-[1px_1px_0px_#000]"
                                    />
                                ) : (
                                    <div className="w-4 h-4 rounded border border-black bg-[#a2ff86] flex items-center justify-center font-black text-[8px] shrink-0 shadow-[1px_1px_0px_#000]">
                                        {activePassApp.clubName ? activePassApp.clubName.slice(0, 2).toUpperCase() : "CL"}
                                    </div>
                                )}
                                <p className="text-xs font-black text-neutral-800">
                                    {activePassApp.clubName}
                                </p>
                            </div>
                        </div>

                        {/* Real Scannable High-DPI QR Code Card */}
                        <div className="flex flex-col items-center justify-center py-1">
                            <div className="p-3.5 bg-white rounded-2xl border-3 border-black shadow-[4px_4px_0px_#000] inline-block">
                                <OrbixCardQR
                                    value={activePassApp.ticketCode || ""}
                                    size={180}
                                    showLogo={true}
                                    noShadow={true}
                                />
                            </div>
                            <span className="text-[10px] font-mono font-bold text-neutral-500 mt-2 flex items-center gap-1.5">
                                <QrCode className="w-3.5 h-3.5 text-black" />
                                Scan at registration desk for admission check-in
                            </span>
                        </div>

                        {/* Ticket Code Box */}
                        <div className="p-3.5 rounded-2xl bg-[#FAF6EE] border-2 border-black space-y-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                                Your Pass Code
                            </span>
                            <div className="flex items-center justify-center gap-2">
                                <span className="font-mono text-xl sm:text-2xl font-black text-black tracking-widest">
                                    {activePassApp.ticketCode}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => handleCopyTicket(activePassApp.ticketCode)}
                                    className="p-1.5 rounded-lg border border-black bg-white hover:bg-neutral-100 shadow-[1px_1px_0px_#000] cursor-pointer"
                                    title="Copy Pass Code"
                                >
                                    <Copy className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>

                        {/* Attendee Info Grid: Name, College, Applied Time, Student ID/Dept */}
                        <div className="p-3 sm:p-3.5 rounded-2xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-left grid grid-cols-2 gap-2.5 shadow-[1.5px_1.5px_0px_#000]">
                            <div>
                                <span className="text-[9px] uppercase font-black text-neutral-500 block">
                                    Ticket Holder
                                </span>
                                <span className="text-black font-black truncate block text-xs">
                                    {activePassApp.applicantName || "Attendee"}
                                </span>
                            </div>
                            <div>
                                <span className="text-[9px] uppercase font-black text-neutral-500 block">
                                    College / Campus
                                </span>
                                <span className="text-black font-black truncate block text-xs" title={activePassApp.collegeName || "Campus Student"}>
                                    {activePassApp.collegeName || "Campus Student"}
                                </span>
                            </div>
                            <div>
                                <span className="text-[9px] uppercase font-black text-neutral-500 block">
                                    Applied Time
                                </span>
                                <span className="text-neutral-800 font-mono text-[11px] block truncate">
                                    {activePassApp.registeredAt
                                        ? new Date(activePassApp.registeredAt).toLocaleString("en-US", {
                                              month: "short",
                                              day: "numeric",
                                              year: "numeric",
                                              hour: "numeric",
                                              minute: "2-digit",
                                              hour12: true,
                                          })
                                        : "Verified Registration"}
                                </span>
                            </div>
                            <div>
                                <span className="text-[9px] uppercase font-black text-neutral-500 block">
                                    Student ID / Dept
                                </span>
                                <span className="text-neutral-800 font-mono text-[11px] block truncate">
                                    {activePassApp.rollNumber || activePassApp.department || "Verified"}
                                </span>
                            </div>
                        </div>

                        {/* Modal Action Controls */}
                        <div className="grid grid-cols-2 gap-2 pt-1 print:hidden">
                            <button
                                type="button"
                                onClick={() => handleCopyTicket(activePassApp.ticketCode)}
                                className="py-2.5 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 font-black text-xs shadow-[2px_2px_0px_#000] flex items-center justify-center gap-1.5 cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
                            >
                                <Copy className="w-3.5 h-3.5" />
                                Copy Code
                            </button>
                            <button
                                type="button"
                                onClick={handlePrintPass}
                                className="py-2.5 rounded-xl border-2 border-black bg-[#a2ff86] hover:bg-[#8cee70] font-black text-xs shadow-[2px_2px_0px_#000] cursor-pointer active:translate-x-0.5 active:translate-y-0.5 flex items-center justify-center gap-1.5"
                            >
                                <Printer className="w-3.5 h-3.5" />
                                Print Pass
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Withdraw Application Confirmation Modal */}
            <ConfirmationModal
                isOpen={Boolean(withdrawTargetApp)}
                onClose={() => {
                    if (!isWithdrawing) setWithdrawTargetApp(null);
                }}
                onConfirm={handleConfirmWithdraw}
                title="Withdraw Event Registration"
                description={
                    withdrawTargetApp ? (
                        <div className="space-y-3">
                            <p className="text-xs sm:text-sm font-medium text-neutral-700 leading-relaxed">
                                Are you sure you want to withdraw your registration for{" "}
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
                                    ⚠️ Your admission pass will be immediately invalidated and your seat will be released.
                                </p>
                            </div>
                        </div>
                    ) : undefined
                }
                variant="danger"
                confirmText="Withdraw Registration"
                confirmLabel={isWithdrawing ? "Withdrawing..." : "Withdraw Registration"}
                cancelText="Keep Registration"
                isLoading={isWithdrawing}
                requiredInputText="WITHDRAW"
                inputPlaceholder='Type "WITHDRAW" to confirm'
            />
        </section>
    );
};
