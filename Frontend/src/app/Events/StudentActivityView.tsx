import { personalDataApi, useApplicationsQuery, useCertificatesQuery } from "../../store/personalDataApi";
import React, { useEffect, useState, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
    Activity,
    Ticket,
    Calendar,
    Clock,
    MapPin,
    Copy,
    Search,
    Ban,
    Award,
    QrCode,
    X,
    Download,
    ShieldCheck,
    AlertTriangle,
    Users,
    CheckCircle2,
    XCircle,
    FileText,
    Lock,
    Sparkles,
    Eye,
    Filter,
} from "lucide-react";
import { NeoSelect } from "../../components/NeoSelect";
import { useToast } from "../../context/ToastContext";
import {
    cancelEventRegistration,
    type StudentApplicationItem,
} from "../../api/collegeEventsApi";
import { clubEventTeamApi } from "../../api/clubEventTeamApi";
import { EventTeamManagementModal } from "./EventTeamManagementModal";
import {
    TeamRosterConfigurator,
    type StagedTeammate,
} from "../../components/events/TeamRosterConfigurator";
import { useAppDispatch, useAppSelector } from "../../store";
import { SectionBottomIllustration } from "../common/SectionBottomIllustration";
import { OrbixLoader } from "../../components/ui/loader";
import { ConfirmationModal } from "../../components/ConfirmationModal";
import { useModalDismiss } from "../../hooks/useModalDismiss";
import { OrbixCardQR } from "../Profile/CardStudio/OrbixCardQR";
import { UserCertificateWalletView } from "../Certificates/UserCertificateWalletView";
import { OrbixLogo } from "../../components/OrbixLogo";
import { downloadPassPdf } from "../../utils/passPdfGenerator";

interface StudentActivityViewProps {
    onOpenMobileSidebar?: () => void;
    initialSegment?: "applications" | "sessions" | "certificates";
}

export const StudentActivityView: React.FC<StudentActivityViewProps> = ({
    onOpenMobileSidebar,
    initialSegment = "applications",
}) => {
    const toast = useToast();
    const [searchParams, setSearchParams] = useSearchParams();
    const tabParam = searchParams.get("tab") || searchParams.get("segment");

    // Active Segment: "applications" | "sessions" | "certificates"
    const [activeSegment, setActiveSegment] = useState<"applications" | "sessions" | "certificates">(() => {
        if (tabParam === "sessions" || tabParam === "certificates" || tabParam === "applications") {
            return tabParam;
        }
        return initialSegment;
    });

    useEffect(() => {
        if (tabParam === "sessions" || tabParam === "certificates" || tabParam === "applications") {
            setActiveSegment(tabParam);
        }
    }, [tabParam]);

    // Applications & Sessions filters
    const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "registered" | "attended" | "waitlisted" | "rejected" | "cancelled">("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [cancellingId, setCancellingId] = useState<string | null>(null);
    const [withdrawTargetApp, setWithdrawTargetApp] = useState<StudentApplicationItem | null>(null);
    const [viewingWithdrawnApp, setViewingWithdrawnApp] = useState<StudentApplicationItem | null>(null);
    const [isWithdrawing, setIsWithdrawing] = useState(false);

    // QR Pass Modal state
    const [activePassApp, setActivePassApp] = useState<StudentApplicationItem | null>(null);

    // Team management modal state & invitations
    const [managingTeamApp, setManagingTeamApp] = useState<StudentApplicationItem | null>(null);
    const [pendingInvitations, setPendingInvitations] = useState<any[]>([]);
    const [respondingInviteId, setRespondingInviteId] = useState<string | null>(null);
    const [previewingInvite, setPreviewingInvite] = useState<any | null>(null);

    // Team formation modal state (for unlinked team events)
    const { user } = useAppSelector((state) => state.user);
    const dispatch = useAppDispatch();
    const userKey = user?.id || user?.username || "";
    const { currentData: applicationData, isFetching: fetchingApps, error: appsError, refetch: loadApplications } =
        useApplicationsQuery(userKey, { skip: !user });
    const { currentData: certificateData } = useCertificatesQuery(userKey, { skip: !user });
    const applications = applicationData || [];
    const certificates = certificateData || [];
    const loadingApps = !applicationData && fetchingApps;
    useEffect(() => {
        if (appsError) toast.error("Failed to load your event applications.");
    }, [appsError]);

    const [walletCertificatesCount, setWalletCertificatesCount] = useState<number | null>(null);
    const [walletRefreshTrigger] = useState<number>(0);

    const [configuringTeamApp, setConfiguringTeamApp] = useState<StudentApplicationItem | null>(null);
    const [createTeamName, setCreateTeamName] = useState("");
    const [joinTeamCode, setJoinTeamCode] = useState("");
    const [teamTab, setTeamTab] = useState<"create" | "join">("create");
    const [stagedTeammates, setStagedTeammates] = useState<StagedTeammate[]>([]);
    const [isConfiguringTeam, setIsConfiguringTeam] = useState(false);

    const { handleBackdropClick: handlePassBackdropClick } = useModalDismiss({
        isOpen: Boolean(activePassApp),
        onClose: () => setActivePassApp(null),
    });

    // Load Invitations
    const loadInvitations = async () => {
        try {
            const res = await clubEventTeamApi.getMyPendingInvitations();
            setPendingInvitations(res.invitations || []);
        } catch {
            // Ignore error
        }
    };

    // Respond to invitation
    const handleRespondInvitation = async (invitationId: string, action: "accept" | "decline") => {
        try {
            setRespondingInviteId(invitationId);
            const res = await clubEventTeamApi.respondToInvitation(invitationId, action);
            toast.success(res.message || (action === "accept" ? "Joined team!" : "Invitation declined."));
            loadInvitations();
            loadApplications();
        } catch (err: any) {
            toast.error(err.message || "Failed to respond to invitation.", {
                title: err.message?.includes("concluded") || err.message?.includes("revoked") ? "Invitation Concluded" : "Error"
            });
            // Automatically clear concluded/revoked invitations immediately from the view
            loadInvitations();
        } finally {
            setRespondingInviteId(null);
        }
    };

    useEffect(() => {
        loadInvitations();
    }, []);

    const handleCopyTicket = (code?: string | null) => {
        if (!code) return;
        navigator.clipboard.writeText(code);
        toast.success("Ticket code copied to clipboard!");
    };

    const [isDownloadingPass, setIsDownloadingPass] = useState(false);

    const handleDownloadPassPdf = async () => {
        if (!activePassApp || isDownloadingPass) return;
        const safeTitle = (activePassApp.eventTitle || "Event").replace(/[^a-zA-Z0-9_-]/g, "_");
        const filename = `Orbix-Pass-${safeTitle}.pdf`;

        try {
            await downloadPassPdf({
                elementId: "orbix-printable-pass",
                filename,
                onStart: () => setIsDownloadingPass(true),
                onSuccess: () => {
                    setIsDownloadingPass(false);
                    toast.success("Pass PDF downloaded successfully!");
                },
                onError: (err) => {
                    setIsDownloadingPass(false);
                    console.error("PDF generation error:", err);
                    toast.error("Could not download pass PDF. Please try again.");
                },
            });
        } catch {
            setIsDownloadingPass(false);
        }
    };

    const handleConfirmWithdraw = async () => {
        if (!withdrawTargetApp) return;
        const target = withdrawTargetApp;

        try {
            setIsWithdrawing(true);
            setCancellingId(target.id);
            await cancelEventRegistration(target.eventId);
            toast.success(`Registration for "${target.eventTitle}" withdrawn successfully.`);
            dispatch(personalDataApi.util.updateQueryData("applications", userKey, (cached) => {
                const application = cached.find((item) => item.id === target.id);
                if (application) application.status = "cancelled";
            }));
            // Registration status in the campus list must also revalidate after withdrawal.
            dispatch(personalDataApi.util.invalidateTags(["CampusEvents"]));

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
                {/* Header Section (clean without outer box border or refresh button) */}
                <div className="pt-1">
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                        {onOpenMobileSidebar && (
                            <button
                                type="button"
                                onClick={onOpenMobileSidebar}
                                className="lg:hidden p-2 bg-white text-black rounded-lg border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-neutral-100 cursor-pointer shrink-0"
                                aria-label="Open sidebar"
                            >
                                <svg className="w-4 h-4 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <line x1="3" y1="12" x2="21" y2="12" />
                                    <line x1="3" y1="6" x2="21" y2="6" />
                                    <line x1="3" y1="18" x2="21" y2="18" />
                                </svg>
                            </button>
                        )}
                        <div className="orbix-page-heading-icon orbix-page-heading-icon--card-p5-b2 p-2 rounded-xl bg-[#FFE566] border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center shrink-0">
                            <Activity className="w-5 h-5 text-black stroke-[2.5]" />
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-black text-black tracking-tight truncate">
                            Activity & Credentials
                        </h1>
                    </div>
                    <p className="mt-1.5 text-xs sm:text-sm font-bold text-neutral-600 max-w-2xl">
                        Track your event registration applications, access active session passes, and view verified digital certificates issued by campus clubs.
                    </p>
                </div>

                {/* Segment Switcher Navigation */}
                <div className="p-1.5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] flex flex-wrap gap-2">
                    <button
                        onClick={() => {
                            setActiveSegment("applications");
                            setSearchParams((prev) => {
                                const next = new URLSearchParams(prev);
                                next.set("tab", "applications");
                                return next;
                            });
                        }}
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
                        onClick={() => {
                            setActiveSegment("sessions");
                            setSearchParams((prev) => {
                                const next = new URLSearchParams(prev);
                                next.set("tab", "sessions");
                                return next;
                            });
                        }}
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
                        onClick={() => {
                            setActiveSegment("certificates");
                            setSearchParams((prev) => {
                                const next = new URLSearchParams(prev);
                                next.set("tab", "certificates");
                                return next;
                            });
                        }}
                        className={`flex-1 min-w-[120px] py-2.5 px-4 rounded-xl border-2 text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 ${
                            activeSegment === "certificates"
                                ? "bg-[#A6E3E9] border-black text-black shadow-[2px_2px_0px_#000]"
                                : "bg-transparent border-transparent text-neutral-700 hover:bg-neutral-100"
                        }`}
                    >
                        <Award className="w-4 h-4" />
                        <span>Certificates</span>
                        <span className="px-1.5 py-0.2 rounded-md bg-white border border-black text-[10px] font-black">
                            {walletCertificatesCount !== null ? walletCertificatesCount : certificates.length}
                        </span>
                    </button>
                </div>

                {/* ========================================================================= */}
                {/* SEGMENT 1: APPLICATIONS */}
                {/* ========================================================================= */}
                {activeSegment === "applications" && (
                    <div className="space-y-6">
                        {/* Search & Status Filters */}
                        <div className="p-3.5 sm:p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                            {/* Search input with constrained, practical width */}
                            <div className="relative w-full sm:w-80 md:w-96">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search applications by event, club, ticket code..."
                                    className="w-full pl-9 pr-8 h-10 rounded-xl border-2 border-black font-bold text-xs bg-[#FAF6EE] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#a2ff86] transition-all"
                                />
                                {searchQuery && (
                                    <button
                                        type="button"
                                        onClick={() => setSearchQuery("")}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-black p-0.5 cursor-pointer"
                                        title="Clear search"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>

                            {/* Redesigned NeoSelect Dropdown on the right side of the search input */}
                            <div className="w-full sm:w-56 shrink-0">
                                <NeoSelect
                                    value={statusFilter}
                                    onChange={(val) => setStatusFilter(val as any)}
                                    size="sm"
                                    triggerClassName="h-10 rounded-xl bg-[#FAF6EE] hover:bg-white border-2 border-black shadow-[2px_2px_0px_#000] font-black text-xs"
                                    dropdownClassName="rounded-xl border-2 border-black shadow-[3px_3px_0px_#000]"
                                    options={[
                                        {
                                            value: "all",
                                            label: `All (${applications.length})`,
                                            icon: <Filter className="w-3.5 h-3.5 text-black stroke-[2.5]" />,
                                        },
                                        {
                                            value: "pending",
                                            label: `Pending (${applications.filter((a) => a.status === "pending").length})`,
                                            icon: <span className="w-2.5 h-2.5 rounded-full bg-[#FFDE59] border border-black inline-block shrink-0" />,
                                        },
                                        {
                                            value: "registered",
                                            label: `Accepted (${applications.filter((a) => a.status === "registered").length})`,
                                            icon: <span className="w-2.5 h-2.5 rounded-full bg-[#a2ff86] border border-black inline-block shrink-0" />,
                                        },
                                        {
                                            value: "attended",
                                            label: `Attended (${applications.filter((a) => a.status === "attended").length})`,
                                            icon: <span className="w-2.5 h-2.5 rounded-full bg-[#A6E3E9] border border-black inline-block shrink-0" />,
                                        },
                                        {
                                            value: "rejected",
                                            label: `Rejected (${applications.filter((a) => a.status === "rejected").length})`,
                                            icon: <span className="w-2.5 h-2.5 rounded-full bg-[#FFAEBC] border border-black inline-block shrink-0" />,
                                        },
                                        {
                                            value: "cancelled",
                                            label: `Withdrawn (${applications.filter((a) => a.status === "cancelled").length})`,
                                            icon: <span className="w-2.5 h-2.5 rounded-full bg-neutral-300 border border-black inline-block shrink-0" />,
                                        },
                                    ]}
                                />
                            </div>
                        </div>

                        {/* Pending Team Invitations Banner */}
                        {pendingInvitations.length > 0 && (
                            <div className="p-4 rounded-2xl bg-[#a2ff86]/25 border-2 border-black shadow-[3px_3px_0px_#000] space-y-3">
                                <div className="flex items-center gap-2">
                                    <Users className="w-4 h-4 text-black" />
                                    <h4 className="text-xs font-black uppercase tracking-wider text-black">
                                        Pending Team Invitations ({pendingInvitations.length})
                                    </h4>
                                </div>

                                <div className="space-y-2">
                                    {pendingInvitations.map((inv) => (
                                        <div
                                            key={inv.id}
                                            className="p-3 bg-white rounded-xl border-2 border-black shadow-[2px_2px_0px_#000] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                                        >
                                            <div className="space-y-0.5">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-black text-black">
                                                        {inv.teamName}
                                                    </span>
                                                    <span className="text-[10px] font-mono text-neutral-500">
                                                        (Code: {inv.teamCode})
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-neutral-600 font-medium">
                                                    Invited by <span className="font-bold text-black">{inv.leaderName}</span> (@{inv.leaderUsername}) for <span className="font-bold text-black">{inv.eventTitle}</span>
                                                </p>
                                            </div>

                                            <div className="flex items-center gap-2 self-end sm:self-center">
                                                <button
                                                    type="button"
                                                    onClick={() => setPreviewingInvite(inv)}
                                                    className="px-3 py-1.5 rounded-lg border-2 border-black bg-[#e0f2fe] hover:bg-[#bae6fd] text-sky-950 text-xs font-black shadow-[1.5px_1.5px_0px_#000] cursor-pointer flex items-center gap-1.5 transition-all"
                                                    title="Preview team roster, join code & details"
                                                >
                                                    <Eye className="w-3.5 h-3.5 text-sky-800" />
                                                    <span>Preview</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRespondInvitation(inv.id, "decline")}
                                                    disabled={respondingInviteId === inv.id}
                                                    className="px-3 py-1.5 rounded-lg border-2 border-black bg-white hover:bg-neutral-100 text-xs font-black shadow-[1.5px_1.5px_0px_#000] cursor-pointer flex items-center gap-1"
                                                >
                                                    <XCircle className="w-3.5 h-3.5 text-neutral-600" />
                                                    <span>Decline</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRespondInvitation(inv.id, "accept")}
                                                    disabled={respondingInviteId === inv.id}
                                                    className="px-3.5 py-1.5 rounded-lg border-2 border-black bg-[#a2ff86] hover:bg-[#86ef6c] text-black text-xs font-black shadow-[1.5px_1.5px_0px_#000] cursor-pointer flex items-center gap-1"
                                                >
                                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                                    <span>{respondingInviteId === inv.id ? "Joining..." : "Accept & Join"}</span>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

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
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-stretch">
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
                                            className="p-5 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col justify-between space-y-4 h-full"
                                        >
                                            {/* Event Banner */}
                                            {app.coverImageUrl && (
                                                <div className="w-full aspect-[2.2/1] rounded-xl border-2 border-black overflow-hidden relative bg-neutral-950 shadow-[2px_2px_0px_#000] flex items-center justify-center">
                                                    <img
                                                        src={app.coverImageUrl}
                                                        alt={app.eventTitle}
                                                        className="w-full h-full object-cover block"
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
                                                    {app.isTeamEvent && (
                                                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                                            {app.teamName ? (
                                                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-[1px_1px_0px_#000] inline-flex items-center gap-1 ${
                                                                    (app.teamMembersCount || 0) < (app.minTeamSize || 2)
                                                                        ? "bg-amber-100 text-amber-950 border-amber-600"
                                                                        : "bg-[#a2ff86] text-black border-black"
                                                                }`}>
                                                                    <Users className="w-3 h-3 text-black" />
                                                                    <span>
                                                                        Team: {app.teamName} ({app.teamRole === "leader" ? "Leader" : "Member"}) · {app.teamMembersCount || 1} Members
                                                                        {(app.teamMembersCount || 0) < (app.minTeamSize || 2) && ` (Needs min ${app.minTeamSize || 2})`}
                                                                    </span>
                                                                </span>
                                                            ) : (
                                                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#FAF6EE] text-neutral-700 border border-black/40 inline-flex items-center gap-1">
                                                                    <Users className="w-3 h-3 text-neutral-500" />
                                                                    <span>Team Event ({app.minTeamSize || 2}-{app.maxTeamSize || 4} Members)</span>
                                                                </span>
                                                            )}

                                                            {(app.isRegistrationClosed || (app.startsAt && Date.now() >= new Date(app.startsAt).getTime())) && (
                                                                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-neutral-200 text-neutral-700 border border-neutral-400 inline-flex items-center gap-1">
                                                                    <Lock className="w-2.5 h-2.5" />
                                                                    Roster Locked
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
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
                                                            Application Under Review
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
                                            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-black/10 mt-auto">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    {app.teamId && app.status !== "cancelled" ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => setManagingTeamApp(app)}
                                                            className="px-3 py-1.5 rounded-lg border-2 border-black bg-[#a2ff86] hover:bg-[#86ef6c] text-black text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 transition-transform active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
                                                        >
                                                            <Users className="w-3.5 h-3.5" />
                                                            <span>Manage Team Roster</span>
                                                        </button>
                                                    ) : app.isTeamEvent && app.status !== "cancelled" ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setConfiguringTeamApp(app);
                                                                setCreateTeamName("");
                                                                setJoinTeamCode("");
                                                                setStagedTeammates([]);
                                                                setTeamTab("create");
                                                            }}
                                                            className="px-3 py-1.5 rounded-lg border-2 border-black bg-[#FFE566] hover:bg-[#ebd04e] text-black text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 transition-transform active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
                                                        >
                                                            <Users className="w-3.5 h-3.5" />
                                                            <span>Create / Join Team</span>
                                                        </button>
                                                    ) : null}
                                                    {app.status === "registered" || app.status === "attended" ? (
                                                        <button
                                                            onClick={() => setActivePassApp(app)}
                                                            className="px-3 py-1.5 rounded-lg border-2 border-black bg-white hover:bg-neutral-100 text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 transition-transform active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
                                                        >
                                                            <QrCode className="w-3.5 h-3.5" />
                                                            View Official Pass & QR
                                                        </button>
                                                    ) : app.status === "pending" ? (
                                                        <button
                                                            onClick={() => setActivePassApp(app)}
                                                            className="px-3 py-1.5 rounded-lg border-2 border-black bg-[#FFE566] hover:bg-[#ebd04e] text-black text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 transition-transform active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
                                                            title="View your official application submission pass"
                                                        >
                                                            <FileText className="w-3.5 h-3.5 text-black" />
                                                            View Application Pass
                                                        </button>
                                                    ) : app.status === "rejected" ? (
                                                        <span className="px-3 py-1.5 rounded-lg border border-rose-300 bg-rose-50 text-rose-800 text-xs font-bold flex items-center gap-1.5 select-none">
                                                            <Ban className="w-3.5 h-3.5 text-rose-600" />
                                                            Application not selected
                                                        </span>
                                                    ) : app.status === "cancelled" ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => setViewingWithdrawnApp(app)}
                                                            className="px-3 py-1.5 rounded-lg border-2 border-black bg-neutral-200 hover:bg-neutral-300 text-neutral-800 text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 cursor-pointer transition-transform active:translate-x-0.5 active:translate-y-0.5"
                                                        >
                                                            <Ban className="w-3.5 h-3.5 text-neutral-600" />
                                                            <span>Application Withdrawn</span>
                                                        </button>
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
                {/* SEGMENT 3: CERTIFICATES & CREDENTIAL WALLET */}
                {/* ========================================================================= */}
                {activeSegment === "certificates" && (
                    <UserCertificateWalletView
                        compact={true}
                        refreshTrigger={walletRefreshTrigger}
                        onStatsChange={(stats) => setWalletCertificatesCount(stats.total)}
                    />
                )}
            </div>

            {/* Bottom Illustration */}
            <SectionBottomIllustration />

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
                            className="absolute top-3 right-3 p-1.5 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 z-20 shadow-[1px_1px_0px_#000] cursor-pointer print:hidden no-print"
                            data-no-print="true"
                        >
                            <X className="w-4 h-4 text-black stroke-[2.5]" />
                        </button>

                        {/* Official Orbix Brand Header */}
                        <div className="flex items-center justify-between pb-2.5 border-b-2 border-black/15 text-left">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-black flex items-center justify-center text-white border border-black shadow-[1.5px_1.5px_0px_#000]">
                                    <OrbixLogo className="w-4 h-4 text-white" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-1 leading-none">
                                        <span className="font-black text-xs text-black tracking-tight uppercase">ORBIX</span>
                                        <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-[#FFE566] text-black border border-black">Official Pass</span>
                                    </div>
                                    <span className="text-[9px] font-bold text-neutral-500 block leading-none mt-0.5">
                                        Collegiate Ecosystem • Verified Pass
                                    </span>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="text-[8px] font-mono font-bold text-neutral-400 uppercase block">Security ID</span>
                                <span className="text-[10px] font-mono font-black text-black">
                                    {activePassApp.id ? activePassApp.id.slice(0, 8).toUpperCase() : "VERIFIED"}
                                </span>
                            </div>
                        </div>

                        {/* Event Banner */}
                        {activePassApp.coverImageUrl && (
                            <div className="w-full rounded-2xl border-2 border-black overflow-hidden relative shadow-[2px_2px_0px_#000] bg-neutral-950 flex items-center justify-center">
                                <img
                                    src={activePassApp.coverImageUrl}
                                    alt={activePassApp.eventTitle}
                                    className="w-full h-auto max-h-[240px] object-contain block"
                                />
                            </div>
                        )}

                        {/* Pass Header */}
                        <div className="space-y-1">
                            {activePassApp.status === "pending" ? (
                                <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#FFE566] text-black border border-black shadow-[1px_1px_0px_#000]">
                                    <Clock className="w-3 h-3 text-black animate-spin" />
                                    <span>Application Pass · Under Review</span>
                                </div>
                            ) : (
                                <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-black text-[#a2ff86]">
                                    <span className="w-2 h-2 rounded-full bg-[#a2ff86] animate-pulse inline-block" />
                                    <span>Official Entry Pass</span>
                                </div>
                            )}
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

                        {/* Middle Section: Scannable QR for Approved Passes OR Application Proof for Pending Review */}
                        {activePassApp.status === "pending" ? (
                            <div className="p-4 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[3px_3px_0px_#000] text-center space-y-3">
                                <div className="w-12 h-12 rounded-2xl bg-[#FFE566] border-2 border-black flex items-center justify-center mx-auto shadow-[2px_2px_0px_#000]">
                                    <FileText className="w-6 h-6 text-black stroke-[2.5]" />
                                </div>
                                <div className="space-y-1">
                                    <h4 className="text-sm font-black text-black">Official Application Receipt</h4>
                                    <p className="text-[11px] font-medium text-neutral-600 max-w-xs mx-auto leading-relaxed">
                                        Your application is in the coordinator review stage. This pass is your verified proof of registration submission.
                                    </p>
                                </div>

                                <div className="p-2.5 rounded-xl bg-white border-2 border-black flex items-center justify-between font-mono text-xs font-black shadow-[1.5px_1.5px_0px_#000]">
                                    <span className="text-[10px] uppercase font-bold text-neutral-500 font-sans">Application ID</span>
                                    <div className="flex items-center gap-1.5 text-black">
                                        <span>APP-{activePassApp.id ? activePassApp.id.slice(0, 8).toUpperCase() : "VERIFIED"}</span>
                                        <button
                                            type="button"
                                            onClick={() => handleCopyTicket(`APP-${activePassApp.id ? activePassApp.id.slice(0, 8).toUpperCase() : "VERIFIED"}`)}
                                            className="p-1 hover:bg-neutral-100 rounded cursor-pointer"
                                            title="Copy Application ID"
                                        >
                                            <Copy className="w-3 h-3 text-neutral-600" />
                                        </button>
                                    </div>
                                </div>

                                {activePassApp.isTeamEvent && (
                                    <div className="p-2.5 rounded-xl bg-white border border-black/30 text-left text-xs space-y-1">
                                        <div className="flex items-center justify-between font-black text-black">
                                            <span>Team: {activePassApp.teamName || "Squad"}</span>
                                            <span className="capitalize text-[10px] px-1.5 py-0.5 rounded bg-amber-100 border border-amber-400 font-bold">
                                                {activePassApp.teamRole === "leader" ? "Team Leader" : "Member"}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-[11px] font-bold text-neutral-600">
                                            <span>Roster:</span>
                                            <span className={activePassApp.teamMembersCount && activePassApp.teamMembersCount >= (activePassApp.minTeamSize || 2) ? "text-emerald-700 font-black" : "text-amber-800 font-black"}>
                                                {activePassApp.teamMembersCount || 1} / {activePassApp.maxTeamSize || 4} Members
                                                {activePassApp.teamMembersCount && activePassApp.teamMembersCount < (activePassApp.minTeamSize || 2) && ` (Needs min ${activePassApp.minTeamSize || 2})`}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <>
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
                            </>
                        )}

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

                        {/* Pass Verification Footer */}
                        <div className="pt-2 border-t border-black/10 flex items-center justify-between text-[9px] text-neutral-500 font-bold">
                            <span className="flex items-center gap-1">
                                <ShieldCheck className="w-3 h-3 text-black" />
                                Cryptographically Verified Admission Pass
                            </span>
                            <span className="font-mono text-neutral-400">orbix.in/verify</span>
                        </div>

                        {/* Modal Action Controls */}
                        <div className="grid grid-cols-2 gap-2 pt-1 print:hidden" data-no-print="true">
                            <button
                                type="button"
                                onClick={() => handleCopyTicket(activePassApp.ticketCode || `APP-${activePassApp.id ? activePassApp.id.slice(0, 8).toUpperCase() : "VERIFIED"}`)}
                                className="py-2.5 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 font-black text-xs shadow-[2px_2px_0px_#000] flex items-center justify-center gap-1.5 cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
                            >
                                <Copy className="w-3.5 h-3.5" />
                                {activePassApp.status === "pending" ? "Copy App ID" : "Copy Code"}
                            </button>
                            <button
                                type="button"
                                onClick={handleDownloadPassPdf}
                                disabled={isDownloadingPass}
                                className="py-2.5 rounded-xl border-2 border-black bg-[#a2ff86] hover:bg-[#8cee70] font-black text-xs shadow-[2px_2px_0px_#000] cursor-pointer active:translate-x-0.5 active:translate-y-0.5 flex items-center justify-center gap-1.5 disabled:opacity-60"
                                title="Download Pass as PDF"
                            >
                                <Download className="w-3.5 h-3.5" />
                                <span>{isDownloadingPass ? "Generating..." : "Download Pass (PDF)"}</span>
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
                                {withdrawTargetApp.ticketCode ? (
                                    <div className="flex items-center justify-between">
                                        <span className="text-neutral-500 font-mono text-[10px] uppercase">Access Ticket:</span>
                                        <span className="font-mono text-black">{withdrawTargetApp.ticketCode}</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-between">
                                        <span className="text-neutral-500 font-mono text-[10px] uppercase">Status:</span>
                                        <span className="font-mono text-amber-700 font-bold uppercase text-[11px]">Awaiting Organizer Review</span>
                                    </div>
                                )}
                                {withdrawTargetApp.isTeamEvent && withdrawTargetApp.teamRole === "leader" ? (
                                    <div className="pt-2 border-t-2 border-rose-300 space-y-1 text-red-950 font-black">
                                        <div className="flex items-center gap-1.5 text-xs text-red-700">
                                            <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                                            <span>CRITICAL: TEAM SQUAD DISBANDMENT</span>
                                        </div>
                                        <p className="text-[11px] font-semibold text-neutral-800 leading-relaxed">
                                            You are the <strong>Team Leader</strong> of squad <strong>"{withdrawTargetApp.teamName || "Your Squad"}"</strong>.
                                            Withdrawing your application will <strong>automatically withdraw all teammates' applications</strong>, invalidate all member passes, and disband the squad. This action cannot be undone.
                                        </p>
                                    </div>
                                ) : withdrawTargetApp.isTeamEvent && withdrawTargetApp.teamRole === "member" ? (
                                    <div className="pt-2 border-t-2 border-amber-300 space-y-1 text-amber-950 font-black">
                                        <div className="flex items-center gap-1.5 text-xs text-amber-800">
                                            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                                            <span>MEMBER SPOT WITHDRAWAL</span>
                                        </div>
                                        <p className="text-[11px] font-semibold text-neutral-800 leading-relaxed">
                                            You are registered as a member of squad <strong>"{withdrawTargetApp.teamName || "Your Squad"}"</strong>.
                                            Withdrawing will release only your spot from the squad and invalidate your pass. The rest of the team will remain intact (and may show as incomplete if minimum capacity is unmet).
                                        </p>
                                    </div>
                                ) : (
                                    <p className="text-[11px] text-rose-700 pt-1 border-t border-rose-200 flex items-center gap-1.5 font-bold">
                                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                        <span>Your admission pass will be immediately invalidated and your seat will be released.</span>
                                    </p>
                                )}
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

            {/* Application Withdrawn Details Modal */}
            {viewingWithdrawnApp && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md overflow-y-auto animate-in fade-in duration-150">
                    <div className="relative w-full max-w-lg bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:16px_16px] border-3 border-black shadow-[8px_8px_0px_#000] rounded-3xl p-6 sm:p-7 space-y-5">
                        <button
                            type="button"
                            onClick={() => setViewingWithdrawnApp(null)}
                            className="absolute -top-3 -right-3 p-2 rounded-xl bg-white border-2 border-black hover:bg-neutral-100 text-black shadow-[2px_2px_0px_#000] cursor-pointer transition-transform active:translate-x-0.5 active:translate-y-0.5 z-30"
                            title="Close"
                        >
                            <Ban className="w-4 h-4 stroke-[2.5]" />
                        </button>

                        <div className="flex items-center justify-between pb-3 border-b-2 border-black">
                            <div className="flex items-center gap-2.5">
                                <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center text-white border-2 border-black shadow-[2px_2px_0px_#000]">
                                    <Ban className="w-5 h-5 text-rose-400 stroke-[2.5]" />
                                </div>
                                <div>
                                    <span className="font-black text-sm uppercase tracking-tight text-black block">Application Withdrawn</span>
                                    <span className="text-[10px] font-bold text-neutral-500 block">Registration Policy Enforcement</span>
                                </div>
                            </div>
                            <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-neutral-200 text-neutral-800 border border-black shadow-[1px_1px_0px_#000]">
                                Withdrawn
                            </span>
                        </div>

                        <div className="p-4 rounded-2xl bg-amber-50 border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                            <div className="flex items-center gap-2 text-xs font-black text-amber-950 uppercase tracking-wide">
                                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 stroke-[2.5]" />
                                <span>Re-Registration Restricted</span>
                            </div>
                            <p className="text-xs font-medium text-neutral-800 leading-relaxed">
                                You previously withdrew your application for{" "}
                                <strong className="text-black font-black">"{viewingWithdrawnApp.eventTitle}"</strong>.
                            </p>
                            <p className="text-[11px] text-neutral-600 leading-relaxed font-semibold">
                                As per event guidelines and to prevent roster tampering, re-applying or switching to another team for this session is restricted.
                            </p>
                        </div>

                        <div className="p-3.5 rounded-xl bg-white border-2 border-black space-y-1.5 text-xs font-bold text-neutral-700">
                            <div className="flex justify-between items-center text-neutral-500 text-[10px] uppercase font-mono">
                                <span>Event:</span>
                                <span className="text-black font-black">{viewingWithdrawnApp.eventTitle}</span>
                            </div>
                            <div className="flex justify-between items-center text-neutral-500 text-[10px] uppercase font-mono">
                                <span>Host Club:</span>
                                <span className="text-black font-black">{viewingWithdrawnApp.clubName}</span>
                            </div>
                            {viewingWithdrawnApp.teamName && (
                                <div className="flex justify-between items-center text-neutral-500 text-[10px] uppercase font-mono">
                                    <span>Squad:</span>
                                    <span className="text-black font-black">{viewingWithdrawnApp.teamName} ({viewingWithdrawnApp.teamRole === "leader" ? "Leader" : "Member"})</span>
                                </div>
                            )}
                        </div>

                        <div className="pt-2 flex items-center justify-end">
                            <button
                                type="button"
                                onClick={() => setViewingWithdrawnApp(null)}
                                className="px-5 py-2.5 rounded-xl bg-black text-white hover:bg-neutral-800 border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] cursor-pointer transition-transform active:translate-x-0.5 active:translate-y-0.5"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Event Team Management Modal */}
            {managingTeamApp && managingTeamApp.teamId && (
                <EventTeamManagementModal
                    isOpen={Boolean(managingTeamApp)}
                    onClose={() => setManagingTeamApp(null)}
                    eventId={managingTeamApp.eventId}
                    teamId={managingTeamApp.teamId}
                    eventTitle={managingTeamApp.eventTitle}
                    eventStartsAt={managingTeamApp.startsAt}
                    onTeamUpdated={loadApplications}
                    onTeamLeft={loadApplications}
                />
            )}

            {/* Preview Team Invitation Modal */}
            {previewingInvite && (
                <EventTeamManagementModal
                    isOpen={Boolean(previewingInvite)}
                    onClose={() => setPreviewingInvite(null)}
                    eventId={previewingInvite.eventId}
                    teamId={previewingInvite.teamId}
                    eventTitle={previewingInvite.eventTitle}
                    eventStartsAt={previewingInvite.startsAt}
                    isInviteePreview={true}
                    invitationId={previewingInvite.id}
                    onAcceptInvite={async () => {
                        const invId = previewingInvite.id;
                        setPreviewingInvite(null);
                        await handleRespondInvitation(invId, "accept");
                    }}
                    onDeclineInvite={async () => {
                        const invId = previewingInvite.id;
                        setPreviewingInvite(null);
                        await handleRespondInvitation(invId, "decline");
                    }}
                />
            )}

            {/* Create or Join Team Modal for unlinked team events */}
            {configuringTeamApp && (
                <div
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setConfiguringTeamApp(null);
                    }}
                    className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm overflow-y-auto"
                >
                    <div className="w-full max-w-lg rounded-2xl bg-white border-3 border-black shadow-[6px_6px_0px_#000] p-5 sm:p-6 space-y-4 relative">
                        <button
                            type="button"
                            onClick={() => setConfiguringTeamApp(null)}
                            className="absolute top-4 right-4 p-1.5 rounded-lg border-2 border-black bg-[#FAF6EE] hover:bg-neutral-200 cursor-pointer"
                        >
                            <X className="w-4 h-4 text-black" />
                        </button>

                        <div className="space-y-1 pr-6">
                            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-black inline-block">
                                Team Configuration Required
                            </span>
                            <h3 className="text-lg font-black text-black">
                                Configure Squad for {configuringTeamApp.eventTitle}
                            </h3>
                            <p className="text-xs text-neutral-600 font-medium">
                                This event requires a team of {configuringTeamApp.minTeamSize || 2} to {configuringTeamApp.maxTeamSize || 5} members.
                            </p>
                        </div>

                        {/* Action Toggle */}
                        <div className="grid grid-cols-2 gap-2 p-1 bg-[#FAF6EE] rounded-2xl border-2 border-black">
                            <button
                                type="button"
                                onClick={() => setTeamTab("create")}
                                className={`py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                                    teamTab === "create"
                                        ? "bg-black text-[#a2ff86] shadow-[2px_2px_0px_#000]"
                                        : "text-neutral-700 hover:text-black"
                                }`}
                            >
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>Create New Team</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setTeamTab("join")}
                                className={`py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                                    teamTab === "join"
                                        ? "bg-black text-[#a2ff86] shadow-[2px_2px_0px_#000]"
                                        : "text-neutral-700 hover:text-black"
                                }`}
                            >
                                <Users className="w-3.5 h-3.5" />
                                <span>Join with Code</span>
                            </button>
                        </div>

                        {teamTab === "create" ? (
                            <div className="space-y-3 pt-1">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-black text-black block">
                                        Team / Squad Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={createTeamName}
                                        onChange={(e) => setCreateTeamName(e.target.value)}
                                        placeholder="e.g. Algorithm Aces, Byte Warriors..."
                                        maxLength={80}
                                        className="w-full p-2.5 text-xs font-bold bg-[#FAF6EE] border-2 border-black rounded-xl shadow-[2px_2px_0px_#000] focus:bg-white focus:outline-hidden"
                                    />
                                </div>

                                <TeamRosterConfigurator
                                    eventId={configuringTeamApp.eventId}
                                    teamId="new"
                                    minTeamSize={configuringTeamApp.minTeamSize || 2}
                                    maxTeamSize={configuringTeamApp.maxTeamSize || 5}
                                    currentUser={{
                                        id: user?.id || "current_user",
                                        username: user?.username || "leader",
                                        fullName: user?.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : user?.username,
                                        avatarUrl: user?.avatarUrl,
                                        collegeName: user?.college?.officialName,
                                    }}
                                    stagedMembers={stagedTeammates}
                                    onStagedMembersChange={setStagedTeammates}
                                />

                                <button
                                    type="button"
                                    disabled={isConfiguringTeam}
                                    onClick={async () => {
                                        if (!createTeamName.trim() || createTeamName.trim().length < 2) {
                                            toast.error("Please provide a team name (at least 2 characters).");
                                            return;
                                        }
                                        const minReq = configuringTeamApp.minTeamSize || 2;
                                        const squadSize = 1 + stagedTeammates.length;
                                        if (squadSize < minReq) {
                                            toast.error(`Team requires at least ${minReq} members. Please add ${minReq - squadSize} more teammate(s).`);
                                            return;
                                        }

                                        try {
                                            setIsConfiguringTeam(true);
                                            const teamRes = await clubEventTeamApi.createTeam(configuringTeamApp.eventId, createTeamName.trim());
                                            
                                            // Send invites to staged teammates
                                            for (const m of stagedTeammates) {
                                                try {
                                                    await clubEventTeamApi.inviteMember(configuringTeamApp.eventId, teamRes.team.id, m.username);
                                                } catch (e: any) {
                                                    console.warn(`Failed to invite ${m.username}:`, e);
                                                }
                                            }

                                            toast.success(`Team "${createTeamName}" created and invites sent!`, { title: "Team Formed" });
                                            setConfiguringTeamApp(null);
                                            loadApplications();
                                        } catch (err: any) {
                                            toast.error(err.message || "Failed to create team.");
                                        } finally {
                                            setIsConfiguringTeam(false);
                                        }
                                    }}
                                    className="w-full py-2.5 rounded-xl bg-[#a2ff86] hover:bg-[#8def6e] text-black border-2 border-black font-black text-xs uppercase shadow-[2px_2px_0px_#000] cursor-pointer flex items-center justify-center gap-2"
                                >
                                    {isConfiguringTeam ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                            <span>Creating Team & Sending Invites...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="w-4 h-4" />
                                            <span>Create Squad & Dispatch Invitations</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-3 pt-1">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-black text-black block">
                                        Team Join Code <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={joinTeamCode}
                                        onChange={(e) => setJoinTeamCode(e.target.value.toUpperCase())}
                                        placeholder="e.g. ALGO-A1B2C3"
                                        maxLength={20}
                                        className="w-full p-2.5 text-xs font-mono font-black uppercase bg-[#FAF6EE] border-2 border-black rounded-xl shadow-[2px_2px_0px_#000] focus:bg-white focus:outline-hidden"
                                    />
                                    <p className="text-[10px] font-bold text-neutral-500">
                                        Enter the 6-character code provided by your squad leader.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    disabled={isConfiguringTeam}
                                    onClick={async () => {
                                        if (!joinTeamCode.trim() || joinTeamCode.trim().length < 4) {
                                            toast.error("Please enter a valid team join code.");
                                            return;
                                        }

                                        try {
                                            setIsConfiguringTeam(true);
                                            await clubEventTeamApi.joinTeamByCode(configuringTeamApp.eventId, joinTeamCode.trim());
                                            toast.success("Successfully joined the squad!", { title: "Team Joined" });
                                            setConfiguringTeamApp(null);
                                            loadApplications();
                                        } catch (err: any) {
                                            toast.error(err.message || "Failed to join team.");
                                        } finally {
                                            setIsConfiguringTeam(false);
                                        }
                                    }}
                                    className="w-full py-2.5 rounded-xl bg-black hover:bg-neutral-900 text-[#a2ff86] border-2 border-black font-black text-xs uppercase shadow-[2px_2px_0px_#000] cursor-pointer flex items-center justify-center gap-2"
                                >
                                    {isConfiguringTeam ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-[#a2ff86] border-t-transparent rounded-full animate-spin" />
                                            <span>Joining Team...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Users className="w-4 h-4" />
                                            <span>Join Squad</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </section>
    );
};
