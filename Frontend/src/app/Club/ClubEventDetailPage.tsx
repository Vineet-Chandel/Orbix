import React, { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate, useSearchParams, useLocation, Link } from "react-router-dom";
import {
    ArrowLeft,
    Calendar,
    Clock,
    MapPin,
    ExternalLink,
    Edit3,
    Trash2,
    Users,
    QrCode,
    FileSpreadsheet,
    CheckCircle2,
    CheckCheck,
    RotateCcw,
    XCircle,
    Download,
    Search,
    Building2,
    GraduationCap,
    ShieldAlert,
    Copy,
    Check,
    RefreshCw,
    Award,
    ScanLine,
    Sliders,
    Eye,
    Paperclip,
    X,
} from "lucide-react";
import { useAppDispatch, useAppSelector } from "../../store";
import {
    updateClubEvent,
    changeClubEventStatus,
    deleteClubEvent,
    type ClubEvent,
    type CreateClubEventPayload,
} from "../../store/clubEventsSlice";
import { useToast } from "../../context/ToastContext";
import {
    fetchClubEventApplications,
    updateApplicantStatus,
    getEventApplicationsExportUrl,
    type ClubEventApplicantRow,
    type ClubEventApplicationsResponse,
} from "../../api/collegeEventsApi";
import { ClubEventModal } from "./ClubEventModal";
import { EventSecurityConfirmModal } from "./EventSecurityConfirmModal";
import { ClubCertificateStudioModal } from "./ClubCertificateStudioModal";
import { EventLiveListingCard } from "../../components/EventLiveListingCard";
import { ClubEventCheckinTerminal } from "./ClubEventCheckinTerminal";
import { EventFormBuilderWorkspace } from "./FormBuilder/EventFormBuilderWorkspace";
import { OrbixLoader } from "../../components/ui/loader";

type EventTab = "roster" | "form" | "checkin" | "analytics" | "pass";

export interface ClubEventDetailWorkspaceProps {
    eventId?: string;
    club?: any;
    onBack?: () => void;
    onOpenMobileSidebar?: () => void;
}

export const ClubEventDetailWorkspace: React.FC<ClubEventDetailWorkspaceProps> = ({
    eventId: propEventId,
    club: propClub,
    onBack,
    onOpenMobileSidebar,
}) => {
    const params = useParams<{ eventId: string }>();
    const eventId = propEventId || params.eventId;
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const toast = useToast();

    // Redux club state
    const clubState = useAppSelector((state) => state.club);

    // Event & loading state
    const [event, setEvent] = useState<ClubEvent | null>(null);
    const [clubInfo, setClubInfo] = useState<{
        id: string;
        name: string;
        slug: string;
        college_name: string;
        college_id?: string;
        logo_url?: string | null;
    } | null>(propClub || null);
    const [loading, setLoading] = useState(true);
    const [accessDenied, setAccessDenied] = useState(false);
    const [searchParams, setSearchParams] = useSearchParams();
    const location = useLocation();
    const isCheckinRoute = location.pathname.endsWith("/checkin") || searchParams.get("tab") === "checkin";
    const [activeTab, setActiveTab] = useState<EventTab>(isCheckinRoute ? "checkin" : "roster");

    const handleTabChange = (tab: EventTab) => {
        setActiveTab(tab);
        if (tab === "roster") {
            loadApplications();
        }
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            if (tab === "roster") {
                next.delete("tab");
            } else {
                next.set("tab", tab);
            }
            return next;
        });
    };

    // Modal states
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isCertStudioOpen, setIsCertStudioOpen] = useState(false);
    const [securityTarget, setSecurityTarget] = useState<{
        action: "draft" | "cancelled" | "delete";
    } | null>(null);

    // Applications & Roster State
    const [appsData, setAppsData] = useState<ClubEventApplicationsResponse | null>(null);
    const [loadingApps, setLoadingApps] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<
        "all" | "pending" | "registered" | "attended" | "rejected" | "cancelled"
    >("all");
    const [updatingApplicantId, setUpdatingApplicantId] = useState<string | null>(null);
    const [copiedShareLink, setCopiedShareLink] = useState(false);
    const [inspectingApplicant, setInspectingApplicant] = useState<ClubEventApplicantRow | null>(null);

    // Check authentication and load event from backend
    const loadEventDetails = async () => {
        if (!eventId) return;
        setLoading(true);
        setAccessDenied(false);

        try {
            const res = await fetch(`/api/club/events/${eventId}`, {
                credentials: "include",
            });

            if (res.status === 401 || res.status === 403) {
                setAccessDenied(true);
                setLoading(false);
                return;
            }

            const data = await res.json();
            if (!res.ok || !data.success || !data.event) {
                setAccessDenied(true);
                setLoading(false);
                return;
            }

            setEvent(data.event);
            if (data.club) {
                setClubInfo(data.club);
            }
        } catch (err: any) {
            console.error("Failed to load club event:", err);
            setAccessDenied(true);
        } finally {
            setLoading(false);
        }
    };

    // Load Applications Roster
    const loadApplications = async () => {
        if (!eventId) return;
        setLoadingApps(true);
        try {
            const res = await fetchClubEventApplications(eventId);
            setAppsData(res);
        } catch (err: any) {
            console.error("Failed to fetch applications:", err);
        } finally {
            setLoadingApps(false);
        }
    };

    useEffect(() => {
        loadEventDetails();
    }, [eventId]);

    useEffect(() => {
        if (event?.id) {
            loadApplications();
        }
    }, [event?.id]);

    // Handle Edit Event Submit directly on this page
    const handleEditSubmit = async (
        payload: CreateClubEventPayload,
        _isEditing: boolean,
        _editId?: string
    ) => {
        if (!event) return;
        try {
            const resultAction = await dispatch(
                updateClubEvent({
                    eventId: event.id,
                    payload,
                    previousEvent: event,
                })
            ).unwrap();

            setEvent(resultAction.event);
            setIsEditModalOpen(false);
            toast.success("Event details updated successfully!", { title: "Updated" });
        } catch (err: any) {
            toast.error(err?.message || "Failed to update event details.", {
                title: "Update Error",
            });
        }
    };

    // Handle Quick Status Change to Published (no security prompt needed to publish live)
    const handlePublishLive = async () => {
        if (!event) return;
        try {
            await dispatch(
                changeClubEventStatus({
                    eventId: event.id,
                    status: "published",
                    previousStatus: event.status,
                })
            ).unwrap();

            setEvent((prev) => (prev ? { ...prev, status: "published" } : null));
            toast.success("Event is now published live for campus registrations!", {
                title: "Live Published",
            });
        } catch (err: any) {
            toast.error(err?.message || "Failed to publish event.", { title: "Error" });
        }
    };

    // Fast status transition: Mark Completed
    const handleMarkCompleted = async () => {
        if (!event) return;
        try {
            await dispatch(
                changeClubEventStatus({
                    eventId: event.id,
                    status: "completed",
                    previousStatus: event.status,
                })
            ).unwrap();

            setEvent((prev) => (prev ? { ...prev, status: "completed" } : null));
            toast.success("Event session marked as completed with final attendance records!", {
                title: "Session Completed",
            });
        } catch (err: any) {
            toast.error(err?.message || "Failed to mark event as completed.", { title: "Error" });
        }
    };

    // Handle Security Action Execution (Draft, Cancel, Delete with password & delete phrase)
    const handleExecuteSecurityAction = async (password: string, confirmationText: string, emergencyBypass?: boolean) => {
        if (!event || !securityTarget) return;
        const { action } = securityTarget;

        try {
            if (action === "draft" || action === "cancelled") {
                await dispatch(
                    changeClubEventStatus({
                        eventId: event.id,
                        status: action,
                        previousStatus: event.status,
                        password,
                        confirmationText,
                        emergencyBypass,
                    })
                ).unwrap();

                setEvent((prev) => (prev ? { ...prev, status: action } : null));
                const label = action === "draft" ? "moved to draft" : "marked as cancelled";
                toast.success(`Event is now ${label}.`, { title: "Status Updated" });
            } else if (action === "delete") {
                await dispatch(
                    deleteClubEvent({
                        eventId: event.id,
                        previousEvent: event,
                        password,
                        confirmationText,
                    })
                ).unwrap();

                toast.success(`Event "${event.title}" permanently deleted.`, { title: "Deleted" });
                navigate("/club/events", { replace: true });
            }
            setSecurityTarget(null);
        } catch (err: any) {
            const message =
                err?.message ||
                err?.payload?.message ||
                "Authentication failed. Please verify your club password and confirmation phrase.";
            throw new Error(message);
        }
    };

    // Handle Applicant Status Toggle (Accept / Reject / Check-in / Attended / Waitlisted / Cancelled)
    const handleApplicantStatusChange = async (
        applicant: ClubEventApplicantRow,
        nextStatus: "pending" | "registered" | "attended" | "waitlisted" | "rejected" | "cancelled"
    ) => {
        if (!event) return;
        try {
            setUpdatingApplicantId(applicant.id);
            await updateApplicantStatus(event.id, applicant.id, nextStatus);
            const actionWord =
                nextStatus === "registered"
                    ? "accepted"
                    : nextStatus === "rejected"
                    ? "rejected"
                    : nextStatus === "attended"
                    ? "checked-in"
                    : nextStatus;
            toast.success(`Applicant ${applicant.applicantName} marked as ${actionWord}.`);

            setAppsData((prev) => {
                if (!prev) return prev;
                const updatedApps = prev.applications.map((a) =>
                    a.id === applicant.id
                        ? {
                              ...a,
                              status: nextStatus,
                              checkedInAt: nextStatus === "attended" ? new Date().toISOString() : a.checkedInAt,
                          }
                        : a
                );
                return {
                    ...prev,
                    summary: {
                        ...prev.summary,
                        total: updatedApps.length,
                        pending: updatedApps.filter((a) => a.status === "pending").length,
                        registered: updatedApps.filter((a) => a.status === "registered").length,
                        attended: updatedApps.filter((a) => a.status === "attended").length,
                        waitlisted: updatedApps.filter((a) => a.status === "waitlisted").length,
                        rejected: updatedApps.filter((a) => a.status === "rejected").length,
                        cancelled: updatedApps.filter((a) => a.status === "cancelled").length,
                    },
                    applications: updatedApps,
                };
            });
        } catch (err: any) {
            toast.error(err?.message || "Failed to update applicant status.");
        } finally {
            setUpdatingApplicantId(null);
        }
    };

    // Filtered Applications for Roster Tab
    const filteredApplications = useMemo(() => {
        if (!appsData?.applications) return [];
        return appsData.applications.filter((a) => {
            const matchesStatus = statusFilter === "all" || a.status === statusFilter;
            const query = searchQuery.trim().toLowerCase();
            if (!query) return matchesStatus;

            const name = (a.applicantName || "").toLowerCase();
            const username = (a.username || "").toLowerCase();
            const email = (a.applicantEmail || "").toLowerCase();
            const rollNo = (a.rollNumber || "").toLowerCase();
            const department = (a.department || "").toLowerCase();

            const matchesQuery =
                name.includes(query) ||
                username.includes(query) ||
                email.includes(query) ||
                rollNo.includes(query) ||
                department.includes(query);

            return matchesStatus && matchesQuery;
        });
    }, [appsData, statusFilter, searchQuery]);

    // Analytics Breakdown computations
    const analytics = useMemo(() => {
        if (!appsData) {
            return {
                total: 0,
                registered: 0,
                attended: 0,
                waitlisted: 0,
                cancelled: 0,
                turnoutRate: 0,
                deptBreakdown: [] as { name: string; count: number; pct: number }[],
                yearBreakdown: [] as { year: string; count: number; pct: number }[],
            };
        }

        const { total, registered, attended, waitlisted, cancelled } = appsData.summary;
        const totalActive = registered + attended;
        const turnoutRate =
            totalActive > 0 ? Math.round((attended / totalActive) * 100) : 0;

        const deptMap = new Map<string, number>();
        const yearMap = new Map<string, number>();

        appsData.applications.forEach((a) => {
            const dept = (a.department || "General / Undeclared").trim();
            deptMap.set(dept, (deptMap.get(dept) || 0) + 1);

            const yr = a.yearOfStudy ? `Year ${a.yearOfStudy}` : "Unspecified";
            yearMap.set(yr, (yearMap.get(yr) || 0) + 1);
        });

        const deptBreakdown = Array.from(deptMap.entries())
            .map(([name, count]) => ({
                name,
                count,
                pct: total > 0 ? Math.round((count / total) * 100) : 0,
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 6);

        const yearBreakdown = Array.from(yearMap.entries())
            .map(([year, count]) => ({
                year,
                count,
                pct: total > 0 ? Math.round((count / total) * 100) : 0,
            }))
            .sort((a, b) => a.year.localeCompare(b.year));

        return {
            total,
            registered,
            attended,
            waitlisted,
            cancelled,
            turnoutRate,
            deptBreakdown,
            yearBreakdown,
        };
    }, [appsData]);

    const handleCopyShareLink = () => {
        const url = `${window.location.origin}/college-events?event=${event?.id}`;
        navigator.clipboard.writeText(url);
        setCopiedShareLink(true);
        toast.success("Event link copied to clipboard!");
        setTimeout(() => setCopiedShareLink(false), 2000);
    };

    // ACCESS DENIED SCREEN
    if (!loading && accessDenied) {
        return (
            <div className="p-8 sm:p-12 text-center bg-white rounded-3xl border-2 border-black shadow-[4px_4px_0px_#000] max-w-lg mx-auto space-y-4 my-8">
                <div className="w-16 h-16 rounded-2xl bg-rose-100 border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center mx-auto text-rose-700">
                    <ShieldAlert className="w-9 h-9 stroke-[2.2]" />
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-black">
                    Access Restricted
                </h2>
                <p className="text-xs sm:text-sm text-neutral-600 font-bold leading-relaxed">
                    This event management console is restricted to the authorized club coordinators
                    of this verified chapter. You do not have permissions to manage this event.
                </p>
                <div className="pt-2 flex flex-col gap-2">
                    <button
                        type="button"
                        onClick={onBack || (() => navigate("/club/events"))}
                        className="w-full px-4 py-2.5 rounded-xl bg-[#a2ff86] hover:bg-[#8ee673] text-black text-xs font-black border-2 border-black shadow-[3px_3px_0px_#000] cursor-pointer transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                    >
                        ← Return to Club Events
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate("/club/dashboard")}
                        className="w-full px-4 py-2 rounded-xl bg-white hover:bg-neutral-100 text-black text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer"
                    >
                        Club Dashboard
                    </button>
                </div>
            </div>
        );
    }

    // LOADING SCREEN
    if (loading || !event) {
        return (
            <div className="py-24 flex flex-col items-center justify-center p-4">
                <OrbixLoader size="lg" variant="centered" color="#000" />
                <p className="text-xs font-black uppercase tracking-wider text-neutral-700 mt-4">
                    Loading Event Management Workspace...
                </p>
            </div>
        );
    }

    const hostClubName = clubInfo?.name || clubState.club?.name || "Verified Club";
    const collegeAffiliation = clubInfo?.college_name || clubState.club?.collegeName || "Campus Community";
    const clubLogo = clubInfo?.logo_url || clubState.club?.logoUrl;

    if (isEditModalOpen) {
        return (
            <ClubEventModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                onSubmit={handleEditSubmit}
                editingEvent={event}
                clubId={clubInfo?.id || clubState.club?.id}
                clubName={hostClubName}
                clubLogoUrl={clubLogo}
                collegeName={collegeAffiliation}
                collegeId={clubInfo?.college_id || (clubState.club as any)?.college_id}
                initialStatus={event.status}
                onOpenMobileSidebar={onOpenMobileSidebar}
            />
        );
    }

    return (
        <div className="space-y-6 text-black">
            {/* Top Navigation & Breadcrumbs Bar */}
            <div className="pb-5 border-b-2 border-black/55 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
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

                    <button
                        type="button"
                        onClick={onBack || (() => navigate("/club/events"))}
                        className="px-3 py-1.5 rounded-xl bg-white hover:bg-neutral-100 text-black text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer flex items-center gap-1.5 shrink-0 transition-transform active:translate-x-[0.5px] active:translate-y-[0.5px]"
                        title="Back to all events"
                    >
                        <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span className="hidden sm:inline">All Events</span>
                    </button>

                    <div className="hidden md:flex items-center gap-2 text-xs font-bold text-neutral-500 truncate">
                        <Link to="/club/dashboard" className="hover:text-black">
                            {hostClubName}
                        </Link>
                        <span>/</span>
                        <Link to="/club/events" className="hover:text-black">
                            Events
                        </Link>
                        <span>/</span>
                        <span className="text-black font-black truncate max-w-xs">{event.title}</span>
                    </div>
                </div>

                {/* Right Top Status & Share Actions */}
                <div className="flex items-center gap-2 shrink-0">
                    <span
                        className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border-2 border-black ${
                            event.status === "published"
                                ? "bg-emerald-300 text-black shadow-[1.5px_1.5px_0px_#000]"
                                : event.status === "completed"
                                ? "bg-sky-200 text-black shadow-[1.5px_1.5px_0px_#000]"
                                : event.status === "draft"
                                ? "bg-amber-200 text-black shadow-[1.5px_1.5px_0px_#000]"
                                : "bg-rose-200 text-black shadow-[1.5px_1.5px_0px_#000]"
                        }`}
                    >
                        {event.status === "published"
                            ? "Published"
                            : event.status === "completed"
                            ? "Completed"
                            : event.status === "draft"
                            ? "Draft"
                            : "Cancelled"}
                    </span>

                    <button
                        type="button"
                        onClick={() => setIsEditModalOpen(true)}
                        className="px-3 py-1.5 rounded-xl bg-[#FFE566] hover:bg-[#ebd04e] text-black text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer flex items-center gap-1.5 transition-transform active:translate-x-[0.5px] active:translate-y-[0.5px]"
                        title="Edit event details"
                    >
                        <Edit3 className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span className="hidden sm:inline">Edit Details</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleCopyShareLink}
                        className="px-3 py-1.5 rounded-xl bg-white hover:bg-neutral-100 text-black text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer flex items-center gap-1.5 transition-transform active:translate-x-[0.5px] active:translate-y-[0.5px]"
                        title="Copy student registration link"
                    >
                        {copiedShareLink ? (
                            <>
                                <Check className="w-3.5 h-3.5 text-emerald-700 stroke-[3]" />
                                <span className="text-emerald-700">Copied!</span>
                            </>
                        ) : (
                            <>
                                <Copy className="w-3.5 h-3.5 stroke-[2.5]" />
                                <span className="hidden sm:inline">Share Link</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Hero Event Card */}
            <div className="p-6 sm:p-7 rounded-3xl bg-white border-3 border-black shadow-[6px_6px_0px_#000] space-y-6">
                    {/* Cover Banner if present */}
                    {event.coverImageUrl ? (
                        <div className="w-full h-44 sm:h-64 rounded-2xl border-2 border-black overflow-hidden relative shadow-[3px_3px_0px_#000] bg-neutral-100">
                            <img
                                src={event.coverImageUrl}
                                alt={event.title}
                                className="w-full h-full object-cover"
                            />
                        </div>
                    ) : (
                        <div className="w-full h-28 sm:h-36 rounded-2xl border-2 border-black overflow-hidden bg-gradient-to-r from-amber-200 via-sky-200 to-emerald-200 flex items-center justify-between px-6 shadow-[3px_3px_0px_#000]">
                            <div className="space-y-1">
                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-black text-[#FFE566]">
                                    Official Campus Session
                                </span>
                                <h3 className="text-lg font-black text-black">{hostClubName}</h3>
                            </div>
                            <Calendar className="w-12 h-12 text-black/40 stroke-[2]" />
                        </div>
                    )}

                    {/* Event Identity & Metadata */}
                    <div className="space-y-3 min-w-0 w-full">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-950 border border-black text-xs font-black shadow-[1px_1px_0px_#000]">
                                <Building2 className="w-3 h-3 text-emerald-700" />
                                {hostClubName}
                            </span>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#FFE566] text-black border border-black text-xs font-black shadow-[1px_1px_0px_#000]">
                                <GraduationCap className="w-3 h-3" />
                                {collegeAffiliation}
                            </span>
                        </div>

                        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-black tracking-tight leading-tight">
                            {event.title}
                        </h1>

                        <p className="text-sm text-neutral-700 font-medium leading-relaxed max-w-4xl">
                            {event.summary || event.description || "No description provided."}
                        </p>

                        <div className="pt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs sm:text-sm text-neutral-700 font-bold">
                            <span className="flex items-center gap-1.5 bg-[#FAF6EE] px-3 py-1 rounded-xl border border-black">
                                <Clock className="w-4 h-4 text-neutral-600" />
                                {new Date(event.startsAt).toLocaleDateString(undefined, {
                                    weekday: "short",
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                })}
                            </span>

                            <span className="flex items-center gap-1.5 bg-[#FAF6EE] px-3 py-1 rounded-xl border border-black">
                                <MapPin className="w-4 h-4 text-neutral-600" />
                                {event.venueOrLocation ||
                                    (event.locationType === "virtual"
                                        ? "Virtual (Online)"
                                        : event.locationType === "hybrid"
                                        ? "Hybrid"
                                        : "Campus Hall")}
                            </span>

                            {event.registrationUrl && (
                                <a
                                    href={event.registrationUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 bg-[#38BDF8]/20 text-sky-950 px-3 py-1 rounded-xl border border-black hover:underline font-black"
                                >
                                    <span>External RSVP Form</span>
                                    <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                            )}
                        </div>
                    </div>
                </div>

                {/* Sub-Navigation Tabs */}
                <div className="flex items-center gap-2 border-b-2 border-black/10 pb-2 overflow-x-auto">
                    <button
                        type="button"
                        onClick={() => handleTabChange("roster")}
                        className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black border-2 border-black transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                            activeTab === "roster"
                                ? "bg-[#38BDF8] text-black shadow-[3px_3px_0px_#000]"
                                : "bg-white hover:bg-neutral-100 text-neutral-800 shadow-[1.5px_1.5px_0px_#000]"
                        }`}
                    >
                        <FileSpreadsheet className="w-4 h-4 stroke-[2.5]" />
                        <span>Applications Sheet & Roster</span>
                        <span className="px-2 py-0.5 rounded-full bg-white text-black border border-black text-[10px] font-black">
                            {appsData?.summary.total || 0}
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={() => handleTabChange("form")}
                        className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black border-2 border-black transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                            activeTab === "form"
                                ? "bg-[#C084FC] text-black shadow-[3px_3px_0px_#000]"
                                : "bg-white hover:bg-neutral-100 text-neutral-800 shadow-[1.5px_1.5px_0px_#000]"
                        }`}
                    >
                        <Sliders className="w-4 h-4 stroke-[2.5]" />
                        <span>Registration Form Builder</span>
                        <span className="px-2 py-0.5 rounded-full bg-white text-black border border-black text-[10px] font-black">
                            BUILDER
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={() => handleTabChange("checkin")}
                        className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black border-2 border-black transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                            activeTab === "checkin"
                                ? "bg-[#a2ff86] text-black shadow-[3px_3px_0px_#000]"
                                : "bg-white hover:bg-neutral-100 text-neutral-800 shadow-[1.5px_1.5px_0px_#000]"
                        }`}
                    >
                        <ScanLine className="w-4 h-4 stroke-[2.5]" />
                        <span>Live Check-In Scanner</span>
                        <span className="px-2 py-0.5 rounded-full bg-black text-[#a2ff86] border border-black text-[10px] font-black">
                            LIVE QR
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={() => handleTabChange("pass")}
                        className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black border-2 border-black transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                            activeTab === "pass"
                                ? "bg-purple-300 text-black shadow-[3px_3px_0px_#000]"
                                : "bg-white hover:bg-neutral-100 text-neutral-800 shadow-[1.5px_1.5px_0px_#000]"
                        }`}
                    >
                        <QrCode className="w-4 h-4 stroke-[2.5]" />
                        <span>Invitation Card & QR Pass</span>
                    </button>
                </div>

                {/* TAB 1: APPLICATIONS SHEET & ATTENDEE ROSTER */}
                {activeTab === "roster" && (
                    <div className="space-y-4">
                        {/* Summary Metrics Row */}
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                            <div className="p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000]">
                                <span className="text-[10px] font-black uppercase text-neutral-500">Total Signups</span>
                                <div className="text-2xl font-black text-black mt-1">
                                    {appsData?.summary.total || 0}
                                </div>
                            </div>
                            <div className="p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000]">
                                <span className="text-[10px] font-black uppercase text-amber-700">Pending Review</span>
                                <div className="text-2xl font-black text-amber-600 mt-1">
                                    {appsData?.summary.pending || 0}
                                </div>
                            </div>
                            <div className="p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000]">
                                <span className="text-[10px] font-black uppercase text-emerald-700">Accepted / Pass</span>
                                <div className="text-2xl font-black text-emerald-600 mt-1">
                                    {appsData?.summary.registered || 0}
                                </div>
                            </div>
                            <div className="p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000]">
                                <span className="text-[10px] font-black uppercase text-sky-700">Checked-In</span>
                                <div className="text-2xl font-black text-[#0284c7] mt-1">
                                    {appsData?.summary.attended || 0}
                                </div>
                            </div>
                            <div className="p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] col-span-2 sm:col-span-1">
                                <span className="text-[10px] font-black uppercase text-neutral-500">Turnout Rate</span>
                                <div className="text-2xl font-black text-purple-700 mt-1">
                                    {analytics.turnoutRate}%
                                </div>
                            </div>
                        </div>

                        {/* Search, Filter & Export Controls */}
                        <div className="p-4 sm:p-5 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col md:flex-row md:items-center justify-between gap-3">
                            {/* Search */}
                            <div className="relative flex-1 max-w-md">
                                <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search by student name, roll no, branch, or email..."
                                    className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black focus:outline-hidden"
                                />
                            </div>

                            {/* Filter Chips & Export */}
                            <div className="flex items-center gap-2 flex-wrap">
                                <div className="flex items-center gap-1 bg-[#FAF6EE] p-1 rounded-xl border border-black">
                                    {(["all", "pending", "registered", "attended", "rejected"] as const).map((status) => {
                                        const label =
                                            status === "all"
                                                ? `All (${appsData?.summary.total || 0})`
                                                : status === "pending"
                                                ? `Pending (${appsData?.summary.pending || 0})`
                                                : status === "registered"
                                                ? `Accepted (${appsData?.summary.registered || 0})`
                                                : status === "attended"
                                                ? `Attended (${appsData?.summary.attended || 0})`
                                                : `Rejected (${appsData?.summary.rejected || 0})`;

                                        return (
                                            <button
                                                key={status}
                                                type="button"
                                                onClick={() => setStatusFilter(status)}
                                                className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition-all cursor-pointer ${
                                                    statusFilter === status
                                                        ? "bg-black text-[#FFE566] shadow-[1px_1px_0px_#000]"
                                                        : "text-neutral-700 hover:bg-neutral-200"
                                                }`}
                                            >
                                                {label}
                                            </button>
                                        );
                                    })}
                                </div>

                                <a
                                    href={getEventApplicationsExportUrl(event.id)}
                                    download
                                    className="px-3.5 py-2 rounded-xl bg-[#a2ff86] hover:bg-[#8ee673] text-black text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 cursor-pointer transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                                    title="Export applicant roster to Excel / CSV"
                                >
                                    <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                                    <span>Export CSV</span>
                                </a>

                                <button
                                    type="button"
                                    onClick={loadApplications}
                                    disabled={loadingApps}
                                    className="p-2 rounded-xl bg-white hover:bg-neutral-100 text-black border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer"
                                    title="Refresh roster"
                                >
                                    <RefreshCw className={`w-3.5 h-3.5 ${loadingApps ? "animate-spin" : ""}`} />
                                </button>
                            </div>
                        </div>

                        {/* Attendee Roster Table */}
                        <div className="rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] overflow-hidden">
                            {loadingApps ? (
                                <div className="py-12 flex flex-col items-center justify-center space-y-2">
                                    <OrbixLoader size="md" variant="centered" color="#000" />
                                    <span className="text-xs font-bold text-neutral-600">Loading applicant roster...</span>
                                </div>
                            ) : filteredApplications.length === 0 ? (
                                <div className="py-12 text-center space-y-2">
                                    <Users className="w-10 h-10 text-neutral-400 mx-auto" />
                                    <h4 className="text-sm font-black text-black">No applicants found</h4>
                                    <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                                        {searchQuery || statusFilter !== "all"
                                            ? "No students match your active filters."
                                            : "No students have RSVP'd or applied to this session yet. Share your event pass to start receiving registrations."}
                                    </p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead>
                                            <tr className="bg-[#FAF6EE] border-b-2 border-black text-[11px] font-black uppercase text-neutral-700 tracking-wider">
                                                <th className="py-3 px-4">Student</th>
                                                <th className="py-3 px-4">Roll / ID</th>
                                                <th className="py-3 px-4">Department</th>
                                                <th className="py-3 px-4">Year</th>
                                                <th className="py-3 px-4">Applied At</th>
                                                <th className="py-3 px-4">Status</th>
                                                <th className="py-3 px-4 text-right">Review & Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y border-black/10">
                                            {filteredApplications.map((app) => (
                                                <tr
                                                    key={app.id}
                                                    className="hover:bg-neutral-50/80 transition-colors"
                                                >
                                                    <td className="py-3 px-4 font-bold">
                                                        <div className="flex items-center gap-2.5">
                                                            {app.avatarUrl ? (
                                                                <img
                                                                    src={app.avatarUrl}
                                                                    alt={app.applicantName}
                                                                    className="w-8 h-8 rounded-full border border-black object-cover shrink-0 shadow-[1px_1px_0px_#000]"
                                                                    onError={(e) => {
                                                                        e.currentTarget.style.display = "none";
                                                                        const fallback = e.currentTarget.nextElementSibling;
                                                                        if (fallback) (fallback as HTMLElement).style.display = "flex";
                                                                    }}
                                                                />
                                                            ) : null}
                                                            <div
                                                                className={`w-8 h-8 rounded-full bg-black text-[#a2ff86] items-center justify-center font-black text-[11px] shrink-0 border border-black shadow-[1px_1px_0px_#000] ${
                                                                    app.avatarUrl ? "hidden" : "flex"
                                                                }`}
                                                            >
                                                                {(app.applicantName || "S").slice(0, 2).toUpperCase()}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div className="text-black font-black truncate">
                                                                    {app.applicantName}
                                                                </div>
                                                                <div className="text-[10px] text-neutral-500 font-normal truncate flex items-center gap-1">
                                                                    {app.username ? (
                                                                        <a
                                                                            href={`/profile/${app.username}`}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="hover:underline text-indigo-700 font-bold"
                                                                            title="Inspect student profile"
                                                                            onClick={(e) => e.stopPropagation()}
                                                                        >
                                                                            @{app.username}
                                                                        </a>
                                                                    ) : null}
                                                                    {app.applicantEmail && <span>· {app.applicantEmail}</span>}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4 font-mono font-bold text-neutral-700">
                                                        {app.rollNumber || "—"}
                                                    </td>
                                                    <td className="py-3 px-4 font-bold text-neutral-800">
                                                        {app.department || "General"}
                                                    </td>
                                                    <td className="py-3 px-4 font-bold text-neutral-700">
                                                        {app.yearOfStudy ? `Year ${app.yearOfStudy}` : "—"}
                                                    </td>
                                                    <td className="py-3 px-4 text-neutral-500 font-medium">
                                                        {new Date(app.registeredAt).toLocaleDateString(undefined, {
                                                            month: "short",
                                                            day: "numeric",
                                                            hour: "2-digit",
                                                            minute: "2-digit",
                                                        })}
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <span
                                                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-[1px_1px_0px_#000] inline-block ${
                                                                app.status === "attended"
                                                                    ? "bg-sky-100 text-sky-950 border-sky-800"
                                                                    : app.status === "registered"
                                                                    ? "bg-emerald-100 text-emerald-950 border-emerald-800"
                                                                    : app.status === "pending"
                                                                    ? "bg-amber-100 text-amber-950 border-amber-800"
                                                                    : app.status === "waitlisted"
                                                                    ? "bg-amber-100 text-amber-950 border-amber-800"
                                                                    : "bg-rose-100 text-rose-950 border-rose-800"
                                                            }`}
                                                        >
                                                            {app.status === "registered"
                                                                ? "Accepted / Active"
                                                                : app.status === "pending"
                                                                ? "Pending Review"
                                                                : app.status}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4 text-right">
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => setInspectingApplicant(app)}
                                                                className="px-2 py-1 rounded-lg bg-white hover:bg-neutral-100 text-black font-black text-[11px] border border-black shadow-[1px_1px_0px_#000] cursor-pointer inline-flex items-center gap-1 shrink-0"
                                                                title="Inspect student form responses & attachments"
                                                            >
                                                                <Eye className="w-3 h-3" />
                                                                <span>Answers</span>
                                                            </button>

                                                            {app.status === "pending" ? (
                                                                <>
                                                                    <button
                                                                        type="button"
                                                                        disabled={updatingApplicantId === app.id}
                                                                        onClick={() => handleApplicantStatusChange(app, "registered")}
                                                                        className="px-2.5 py-1 rounded-lg bg-[#a2ff86] hover:bg-[#8ee673] text-black font-black text-[11px] border border-black shadow-[1px_1px_0px_#000] cursor-pointer inline-flex items-center gap-1 active:translate-x-[0.5px] active:translate-y-[0.5px]"
                                                                        title="Accept application and activate event entry pass"
                                                                    >
                                                                        <CheckCircle2 className="w-3 h-3 stroke-[2.5]" />
                                                                        <span>Accept</span>
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        disabled={updatingApplicantId === app.id}
                                                                        onClick={() => handleApplicantStatusChange(app, "rejected")}
                                                                        className="px-2 py-1 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-900 font-black text-[11px] border border-rose-800 shadow-[1px_1px_0px_#000] cursor-pointer inline-flex items-center gap-1 active:translate-x-[0.5px] active:translate-y-[0.5px]"
                                                                        title="Reject application"
                                                                    >
                                                                        <XCircle className="w-3 h-3 stroke-[2.5]" />
                                                                        <span>Reject</span>
                                                                    </button>
                                                                </>
                                                            ) : app.status === "registered" ? (
                                                                <>
                                                                    <button
                                                                        type="button"
                                                                        disabled={updatingApplicantId === app.id}
                                                                        onClick={() => handleApplicantStatusChange(app, "attended")}
                                                                        className="px-2.5 py-1 rounded-lg bg-[#a2ff86] hover:bg-[#8ee673] text-black font-black text-[11px] border border-black shadow-[1px_1px_0px_#000] cursor-pointer inline-flex items-center gap-1 active:translate-x-[0.5px] active:translate-y-[0.5px]"
                                                                        title="Check in attendee at session entrance"
                                                                    >
                                                                        <CheckCircle2 className="w-3 h-3 stroke-[2.5]" />
                                                                        <span>Check-in</span>
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        disabled={updatingApplicantId === app.id}
                                                                        onClick={() => handleApplicantStatusChange(app, "rejected")}
                                                                        className="px-2 py-1 rounded-lg bg-neutral-100 hover:bg-rose-50 text-neutral-600 hover:text-rose-700 font-bold text-[10px] border border-black/40 cursor-pointer inline-flex items-center gap-0.5"
                                                                        title="Revoke and reject application"
                                                                    >
                                                                        <XCircle className="w-3 h-3" />
                                                                        <span>Revoke</span>
                                                                    </button>
                                                                </>
                                                            ) : app.status === "attended" ? (
                                                                <button
                                                                    type="button"
                                                                    disabled={updatingApplicantId === app.id}
                                                                    onClick={() => handleApplicantStatusChange(app, "registered")}
                                                                    className="px-2.5 py-1 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold text-[11px] border border-black cursor-pointer inline-flex items-center gap-1"
                                                                    title="Undo check-in status"
                                                                >
                                                                    <span>Undo</span>
                                                                </button>
                                                            ) : app.status === "rejected" ? (
                                                                <button
                                                                    type="button"
                                                                    disabled={updatingApplicantId === app.id}
                                                                    onClick={() => handleApplicantStatusChange(app, "registered")}
                                                                    className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-bold text-[11px] border border-emerald-800 cursor-pointer inline-flex items-center gap-1"
                                                                    title="Re-accept application"
                                                                >
                                                                    <CheckCircle2 className="w-3 h-3" />
                                                                    <span>Re-Accept</span>
                                                                </button>
                                                            ) : null}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* TAB: REGISTRATION FORM BUILDER */}
                {activeTab === "form" && event && (
                    <EventFormBuilderWorkspace
                        eventId={event.id}
                        club={clubInfo || clubState.club}
                        onBack={() => handleTabChange("roster")}
                    />
                )}

                {/* TAB: LIVE CHECK-IN SCANNER TERMINAL */}
                {activeTab === "checkin" && event && (
                    <ClubEventCheckinTerminal
                        eventId={event.id}
                        eventTitle={event.title}
                        onCheckinCompleted={(attendee) => {
                            setAppsData((prev) => {
                                if (!prev) return prev;
                                const updatedList = prev.applications.map((app) =>
                                    app.id === attendee.registrationId
                                        ? { ...app, status: "attended" as const, checkedInAt: attendee.checkedInAt }
                                        : app
                                );
                                return {
                                    ...prev,
                                    summary: {
                                        ...prev.summary,
                                        attended: updatedList.filter((a) => a.status === "attended").length,
                                    },
                                    applications: updatedList,
                                };
                            });
                        }}
                    />
                )}

                {/* TAB 2: ANALYTICS & ATTENDANCE */}
                {activeTab === "analytics" && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Department Breakdown */}
                            <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-4">
                                <div className="flex items-center gap-2 pb-2 border-b-2 border-black/10">
                                    <Building2 className="w-5 h-5 text-black stroke-[2.5]" />
                                    <h3 className="text-base font-black text-black">Department & Branch Distribution</h3>
                                </div>

                                {analytics.deptBreakdown.length === 0 ? (
                                    <p className="text-xs text-neutral-500 py-6 text-center">
                                        No department statistics available yet.
                                    </p>
                                ) : (
                                    <div className="space-y-3">
                                        {analytics.deptBreakdown.map((dept) => (
                                            <div key={dept.name} className="space-y-1">
                                                <div className="flex items-center justify-between text-xs font-bold">
                                                    <span className="text-black truncate">{dept.name}</span>
                                                    <span className="text-neutral-500 font-mono">
                                                        {dept.count} ({dept.pct}%)
                                                    </span>
                                                </div>
                                                <div className="h-3 w-full bg-[#FAF6EE] rounded-full border border-black overflow-hidden p-0.5">
                                                    <div
                                                        className="h-full bg-[#38BDF8] rounded-full border-r border-black"
                                                        style={{ width: `${Math.max(5, dept.pct)}%` }}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Year of Study Breakdown */}
                            <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-4">
                                <div className="flex items-center gap-2 pb-2 border-b-2 border-black/10">
                                    <GraduationCap className="w-5 h-5 text-black stroke-[2.5]" />
                                    <h3 className="text-base font-black text-black">Academic Cohort Distribution</h3>
                                </div>

                                {analytics.yearBreakdown.length === 0 ? (
                                    <p className="text-xs text-neutral-500 py-6 text-center">
                                        No student cohort statistics available yet.
                                    </p>
                                ) : (
                                    <div className="space-y-3">
                                        {analytics.yearBreakdown.map((cohort) => (
                                            <div key={cohort.year} className="space-y-1">
                                                <div className="flex items-center justify-between text-xs font-bold">
                                                    <span className="text-black">{cohort.year}</span>
                                                    <span className="text-neutral-500 font-mono">
                                                        {cohort.count} ({cohort.pct}%)
                                                    </span>
                                                </div>
                                                <div className="h-3 w-full bg-[#FAF6EE] rounded-full border border-black overflow-hidden p-0.5">
                                                    <div
                                                        className="h-full bg-[#a2ff86] rounded-full border-r border-black"
                                                        style={{ width: `${Math.max(5, cohort.pct)}%` }}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB 3: OFFICIAL INVITATION PASS & QR CODE */}
                {activeTab === "pass" && (
                    <div className="space-y-4">
                        <div className="p-6 rounded-3xl bg-white border-2 border-black shadow-[4px_4px_0px_#000]">
                            <div className="mb-4">
                                <h3 className="text-lg font-black text-black">Shareable Event Invitation Pass</h3>
                                <p className="text-xs text-neutral-600 font-bold">
                                    Students can scan the QR code to open the registration form and confirm campus verification.
                                </p>
                            </div>

                            <div className="max-w-2xl mx-auto">
                                <EventLiveListingCard
                                    title={event.title}
                                    summary={event.summary || undefined}
                                    description={event.description || undefined}
                                    startsAt={event.startsAt}
                                    endsAt={event.endsAt || undefined}
                                    timezone={event.timezone}
                                    venueOrLocation={event.venueOrLocation || undefined}
                                    locationType={event.locationType}
                                    registrationUrl={event.registrationUrl || undefined}
                                    coverImageUrl={event.coverImageUrl || undefined}
                                    status={event.status}
                                    clubName={hostClubName}
                                    clubLogoUrl={clubLogo}
                                    collegeName={collegeAffiliation}
                                    eventId={event.id}
                                    slug={event.slug}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* DEDICATED BOTTOM EVENT ACTIONS & CONTROLS */}
                <div className="p-6 sm:p-8 rounded-3xl bg-white border-3 border-black shadow-[6px_6px_0px_#000] space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b-2 border-black/10">
                        <div>
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-black text-[#FFE566] tracking-wider">
                                Event Operations
                            </span>
                            <h3 className="text-lg sm:text-xl font-black text-black mt-1">
                                Event Actions & Controls
                            </h3>
                            <p className="text-xs text-neutral-600 font-bold">
                                Update details, mark completion, change publication state, or delete event.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-neutral-500">Status:</span>
                            <span
                                className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border-2 border-black ${
                                    event.status === "published"
                                        ? "bg-emerald-300 text-black shadow-[1.5px_1.5px_0px_#000]"
                                        : event.status === "completed"
                                        ? "bg-sky-200 text-black shadow-[1.5px_1.5px_0px_#000]"
                                        : event.status === "draft"
                                        ? "bg-amber-200 text-black shadow-[1.5px_1.5px_0px_#000]"
                                        : "bg-rose-200 text-black shadow-[1.5px_1.5px_0px_#000]"
                                }`}
                            >
                                {event.status}
                            </span>
                        </div>
                    </div>

                    {/* Action Controls & Impact Guidelines (Row-by-Row: Left Info / Right Button) */}
                    <div className="space-y-4 pt-1">
                        {/* 1. Mark Completed / Re-open Live (Sky Blue / Emerald) */}
                        <div className="p-4 sm:p-5 rounded-2xl bg-[#F0F9FF] border-2 border-black shadow-[3px_3px_0px_#000] flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="space-y-1 max-w-xl">
                                <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-sky-500 border border-black"></span>
                                    <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider text-sky-950">
                                        {event.status === "published"
                                            ? "Conclude Event Session"
                                            : event.status === "completed"
                                            ? "Re-open Live Session"
                                            : "Publish to Campus"}
                                    </h4>
                                </div>
                                <p className="text-xs text-neutral-600 font-medium leading-relaxed">
                                    {event.status === "published"
                                        ? "Conclude the live event once it has finished. Freezes new RSVP registrations, preserves verified attendee records, and archives it into chapter completed milestones."
                                        : event.status === "completed"
                                        ? "Re-publish this completed event back to the live campus directory and resume public student RSVP registrations."
                                        : event.status === "draft"
                                        ? "Make this draft event live and visible in the public campus directory for students to view and register."
                                        : "Reactivate this cancelled event and restore public RSVPs in the campus directory."}
                                </p>
                            </div>

                            <div className="w-full md:w-60 shrink-0">
                                {event.status === "published" && (
                                    <button
                                        type="button"
                                        onClick={handleMarkCompleted}
                                        className="w-full py-3 px-6 rounded-2xl bg-[#BAE6FD] hover:bg-[#93c5fd] text-sky-950 text-sm font-black border-2 border-black shadow-[3.5px_3.5px_0px_#000] hover:shadow-[4.5px_4.5px_0px_#000] flex items-center justify-center gap-2.5 cursor-pointer transition-all active:translate-x-[1px] active:translate-y-[1px]"
                                        title="Mark session as completed with final attendee roster"
                                    >
                                        <CheckCheck className="w-4 h-4 stroke-[2.5]" />
                                        <span>Mark Completed</span>
                                    </button>
                                )}

                                {event.status === "completed" && (
                                    <button
                                        type="button"
                                        onClick={handlePublishLive}
                                        className="w-full py-3 px-6 rounded-2xl bg-emerald-200 hover:bg-emerald-300 text-emerald-950 text-sm font-black border-2 border-black shadow-[3.5px_3.5px_0px_#000] hover:shadow-[4.5px_4.5px_0px_#000] flex items-center justify-center gap-2.5 cursor-pointer transition-all active:translate-x-[1px] active:translate-y-[1px]"
                                        title="Re-open this event as live in campus directory"
                                    >
                                        <RotateCcw className="w-4 h-4 stroke-[2.5]" />
                                        <span>Re-open as Live Event</span>
                                    </button>
                                )}

                                {event.status === "draft" && (
                                    <button
                                        type="button"
                                        onClick={handlePublishLive}
                                        className="w-full py-3 px-6 rounded-2xl bg-emerald-200 hover:bg-emerald-300 text-emerald-950 text-sm font-black border-2 border-black shadow-[3.5px_3.5px_0px_#000] hover:shadow-[4.5px_4.5px_0px_#000] flex items-center justify-center gap-2.5 cursor-pointer transition-all active:translate-x-[1px] active:translate-y-[1px]"
                                        title="Publish live to campus directory"
                                    >
                                        <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                                        <span>Publish Live to Campus</span>
                                    </button>
                                )}

                                {event.status === "cancelled" && (
                                    <button
                                        type="button"
                                        onClick={handlePublishLive}
                                        className="w-full py-3 px-6 rounded-2xl bg-emerald-200 hover:bg-emerald-300 text-emerald-950 text-sm font-black border-2 border-black shadow-[3.5px_3.5px_0px_#000] hover:shadow-[4.5px_4.5px_0px_#000] flex items-center justify-center gap-2.5 cursor-pointer transition-all active:translate-x-[1px] active:translate-y-[1px]"
                                        title="Restore and publish live"
                                    >
                                        <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                                        <span>Restore & Publish Live</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* 2. [To Draft] and [Cancel Event] side-by-side with Left Guidelines */}
                        <div className="p-4 sm:p-5 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[3px_3px_0px_#000] flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="space-y-1 max-w-xl">
                                <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 border border-black"></span>
                                    <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider text-neutral-900">
                                        Campus Directory Visibility
                                    </h4>
                                </div>
                                <p className="text-xs text-neutral-600 font-medium leading-relaxed">
                                    Move to Draft to temporarily unpublish this event from campus feeds for offline changes, or mark as Cancelled to display a cancellation notice while preserving student applicant records. Both actions require security verification.
                                </p>
                            </div>

                            <div className="w-full md:w-60 shrink-0 grid grid-cols-2 gap-2.5">
                                {event.status !== "draft" ? (
                                    <button
                                        type="button"
                                        onClick={() => setSecurityTarget({ action: "draft" })}
                                        className="w-full py-2.5 px-3 rounded-2xl bg-[#FEF3C7] hover:bg-[#fde68a] text-amber-950 text-xs sm:text-sm font-black border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-[4px_4px_0px_#000] flex items-center justify-center gap-1.5 cursor-pointer transition-all active:translate-x-[1px] active:translate-y-[1px]"
                                        title="Move event to draft status"
                                    >
                                        <RotateCcw className="w-3.5 h-3.5 stroke-[2.5]" />
                                        <span>To Draft</span>
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={handlePublishLive}
                                        className="w-full py-2.5 px-3 rounded-2xl bg-emerald-100 hover:bg-emerald-200 text-emerald-950 text-xs sm:text-sm font-black border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-[4px_4px_0px_#000] flex items-center justify-center gap-1.5 cursor-pointer transition-all active:translate-x-[1px] active:translate-y-[1px]"
                                    >
                                        <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                                        <span>Publish Live</span>
                                    </button>
                                )}

                                {event.status !== "cancelled" ? (
                                    <button
                                        type="button"
                                        onClick={() => setSecurityTarget({ action: "cancelled" })}
                                        className="w-full py-2.5 px-3 rounded-2xl bg-[#FECDD3] hover:bg-[#fca5a5] text-rose-950 text-xs sm:text-sm font-black border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-[4px_4px_0px_#000] flex items-center justify-center gap-1.5 cursor-pointer transition-all active:translate-x-[1px] active:translate-y-[1px]"
                                        title="Cancel event with notification"
                                    >
                                        <XCircle className="w-3.5 h-3.5 stroke-[2.5]" />
                                        <span>Cancel</span>
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => setSecurityTarget({ action: "draft" })}
                                        className="w-full py-2.5 px-3 rounded-2xl bg-amber-100 hover:bg-amber-200 text-amber-950 text-xs sm:text-sm font-black border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-[4px_4px_0px_#000] flex items-center justify-center gap-1.5 cursor-pointer transition-all active:translate-x-[1px] active:translate-y-[1px]"
                                    >
                                        <RotateCcw className="w-3.5 h-3.5 stroke-[2.5]" />
                                        <span>Restore Draft</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* 2.5 Issue Participation & Turnout Certificates */}
                        <div className="p-4 sm:p-5 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[3px_3px_0px_#000] flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="space-y-1 max-w-xl">
                                <div className="flex items-center gap-2">
                                    <Award className="w-4 h-4 text-black stroke-[2.5]" />
                                    <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider text-neutral-900">
                                        Participation & Merit Certificates
                                    </h4>
                                </div>
                                <p className="text-xs text-neutral-600 font-medium leading-relaxed">
                                    Issue verifiable credentials to students who attended or registered for "{event.title}". Dispatches in-app notifications to each recipient's Activity portfolio.
                                </p>
                            </div>

                            <div className="w-full md:w-60 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setIsCertStudioOpen(true)}
                                    className="w-full py-3 px-4 rounded-2xl bg-[#a2ff86] hover:bg-[#8ee673] text-black text-xs sm:text-sm font-black border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-[4px_4px_0px_#000] flex items-center justify-center gap-2 cursor-pointer transition-all active:translate-x-[1px] active:translate-y-[1px]"
                                >
                                    <Award className="w-4 h-4 stroke-[2.5]" />
                                    <span>Issue Certificates</span>
                                </button>
                            </div>
                        </div>

                        {/* 3. Delete Event... with Danger Zone Guidelines */}
                        <div className="p-4 sm:p-5 rounded-2xl bg-[#FFF1F2] border-2 border-black shadow-[3px_3px_0px_#000] flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="space-y-1 max-w-xl">
                                <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 border border-black"></span>
                                    <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider text-rose-950">
                                        Danger Zone — Permanent Removal
                                    </h4>
                                </div>
                                <p className="text-xs text-rose-900/80 font-medium leading-relaxed">
                                    Permanently delete this event listing, remove the public invitation pass, and erase all student RSVP applications from the database. Irreversible action protected by title confirmation and coordinator password verification.
                                </p>
                            </div>

                            <div className="w-full md:w-60 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setSecurityTarget({ action: "delete" })}
                                    className="w-full py-3 px-6 rounded-2xl bg-[#FFE4E6] hover:bg-[#fecdd3] text-rose-950 text-sm font-black border-2 border-black shadow-[3.5px_3.5px_0px_#000] hover:shadow-[4.5px_4.5px_0px_#000] flex items-center justify-center gap-2.5 cursor-pointer transition-all active:translate-x-[1px] active:translate-y-[1px]"
                                    title="Permanently delete this event from the system"
                                >
                                    <Trash2 className="w-4 h-4 stroke-[2.2] text-rose-900" />
                                    <span>Delete Event...</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

            {/* INSPECT APPLICANT FORM RESPONSES & ATTACHMENTS MODAL */}
            {inspectingApplicant && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className="w-full max-w-2xl bg-white rounded-3xl border-2 border-black shadow-[6px_6px_0px_#000] p-6 sm:p-7 space-y-5 max-h-[90vh] overflow-y-auto">
                        {/* Header */}
                        <div className="flex items-center justify-between border-b-2 border-black/10 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-black text-[#a2ff86] flex items-center justify-center font-black text-sm border border-black shadow-[1.5px_1.5px_0px_#000]">
                                    {(inspectingApplicant.applicantName || "S").slice(0, 2).toUpperCase()}
                                </div>
                                <div>
                                    <h3 className="text-base sm:text-lg font-black text-black">
                                        {inspectingApplicant.applicantName}
                                    </h3>
                                    <div className="text-xs text-neutral-500 font-medium flex items-center gap-2">
                                        <span>@{inspectingApplicant.username}</span>
                                        <span>•</span>
                                        <span>{inspectingApplicant.applicantEmail}</span>
                                    </div>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setInspectingApplicant(null)}
                                className="p-1.5 rounded-xl border-2 border-black hover:bg-neutral-100 cursor-pointer shadow-[1.5px_1.5px_0px_#000]"
                            >
                                <X className="w-4 h-4 text-black" />
                            </button>
                        </div>

                        {/* Status & Pass Banner */}
                        <div className="p-4 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] flex flex-wrap items-center justify-between gap-3 text-xs">
                            <div className="flex items-center gap-2">
                                <span className="font-black text-neutral-600 uppercase">Status:</span>
                                <span className="px-2.5 py-0.5 rounded-full font-black uppercase text-[10px] bg-white border border-black shadow-[1px_1px_0px_#000]">
                                    {inspectingApplicant.status}
                                </span>
                            </div>
                            {inspectingApplicant.ticketCode && (
                                <div className="flex items-center gap-2">
                                    <span className="font-black text-neutral-600 uppercase">Pass Code:</span>
                                    <span className="font-mono font-black text-black bg-white px-2 py-0.5 rounded-lg border border-black">
                                        {inspectingApplicant.ticketCode}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Basic Profile Details */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                            <div className="p-3 rounded-xl border border-black/20 bg-neutral-50">
                                <span className="text-[10px] font-black uppercase text-neutral-500 block mb-0.5">
                                    Department
                                </span>
                                <span className="font-bold text-black">{inspectingApplicant.department || "—"}</span>
                            </div>
                            <div className="p-3 rounded-xl border border-black/20 bg-neutral-50">
                                <span className="text-[10px] font-black uppercase text-neutral-500 block mb-0.5">
                                    Year
                                </span>
                                <span className="font-bold text-black">{inspectingApplicant.yearOfStudy || "—"}</span>
                            </div>
                            <div className="p-3 rounded-xl border border-black/20 bg-neutral-50">
                                <span className="text-[10px] font-black uppercase text-neutral-500 block mb-0.5">
                                    Roll Number
                                </span>
                                <span className="font-mono font-bold text-black">{inspectingApplicant.rollNumber || "—"}</span>
                            </div>
                            <div className="p-3 rounded-xl border border-black/20 bg-neutral-50">
                                <span className="text-[10px] font-black uppercase text-neutral-500 block mb-0.5">
                                    Phone
                                </span>
                                <span className="font-bold text-black">{inspectingApplicant.phoneNumber || "—"}</span>
                            </div>
                        </div>

                        {/* Dynamic Custom Form Answers */}
                        <div className="space-y-3 pt-2">
                            <h4 className="text-xs font-black uppercase tracking-wider text-black">
                                Dynamic Form Responses
                            </h4>

                            {inspectingApplicant.answers || inspectingApplicant.formResponse ? (
                                <div className="space-y-2.5">
                                    {Object.entries(
                                        inspectingApplicant.formResponse || inspectingApplicant.answers || {}
                                    ).map(([qKey, val]: [string, any]) => {
                                        let displayVal = val;
                                        if (typeof val === "object" && val !== null) {
                                            displayVal = JSON.stringify(val);
                                        } else if (Array.isArray(val)) {
                                            displayVal = val.join(", ");
                                        }

                                        return (
                                            <div
                                                key={qKey}
                                                className="p-3.5 rounded-xl border-2 border-black/15 bg-white space-y-1 text-xs"
                                            >
                                                <span className="font-black text-neutral-700 block text-[11px]">
                                                    {qKey.replace(/^q_/, "").replace(/_/g, " ").toUpperCase()}
                                                </span>
                                                <div className="font-medium text-black whitespace-pre-wrap">
                                                    {String(displayVal ?? "—")}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <span className="text-xs text-neutral-400 font-medium">
                                    No custom form answers recorded.
                                </span>
                            )}
                        </div>

                        {/* File Attachments */}
                        {inspectingApplicant.fileAttachments && inspectingApplicant.fileAttachments.length > 0 && (
                            <div className="space-y-2 pt-2">
                                <h4 className="text-xs font-black uppercase tracking-wider text-black">
                                    Uploaded Attachments (Cloudinary)
                                </h4>
                                <div className="space-y-2">
                                    {inspectingApplicant.fileAttachments.map((f: any, fIdx: number) => (
                                        <a
                                            key={fIdx}
                                            href={f.fileUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-3 rounded-xl border-2 border-black bg-emerald-50/60 hover:bg-emerald-50 flex items-center justify-between text-xs font-black text-black group"
                                        >
                                            <div className="flex items-center gap-2 truncate">
                                                <Paperclip className="w-4 h-4 text-emerald-800 shrink-0" />
                                                <span className="truncate">{f.fileName || `Attachment ${fIdx + 1}`}</span>
                                                {f.fileSize && (
                                                    <span className="text-[10px] text-neutral-500 font-normal">
                                                        ({(f.fileSize / (1024 * 1024)).toFixed(2)} MB)
                                                    </span>
                                                )}
                                            </div>
                                            <ExternalLink className="w-4 h-4 text-emerald-800" />
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Modal Footer */}
                        <div className="pt-4 border-t-2 border-black/10 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                {inspectingApplicant.status === "pending" && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                handleApplicantStatusChange(inspectingApplicant, "registered");
                                                setInspectingApplicant(null);
                                            }}
                                            className="px-4 py-2 rounded-xl bg-[#a2ff86] hover:bg-[#8ee673] text-black font-black text-xs border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer"
                                        >
                                            Accept Application
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                handleApplicantStatusChange(inspectingApplicant, "rejected");
                                                setInspectingApplicant(null);
                                            }}
                                            className="px-4 py-2 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-950 font-black text-xs border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer"
                                        >
                                            Reject
                                        </button>
                                    </>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() => setInspectingApplicant(null)}
                                className="px-5 py-2 rounded-xl bg-black text-white font-black text-xs hover:bg-neutral-800 cursor-pointer shadow-[2px_2px_0px_#000]"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ATTACHED HIGH-SECURITY CONFIRMATION CHALLENGE MODAL */}
            <EventSecurityConfirmModal
                isOpen={Boolean(securityTarget)}
                onClose={() => setSecurityTarget(null)}
                event={event}
                action={securityTarget?.action || null}
                onConfirm={handleExecuteSecurityAction}
            />

            {/* ATTACHED CERTIFICATE ISSUANCE STUDIO */}
            <ClubCertificateStudioModal
                isOpen={isCertStudioOpen}
                onClose={() => setIsCertStudioOpen(false)}
                preselectedEventId={event.id}
            />
        </div>
    );
};

export const ClubEventDetailPage = ClubEventDetailWorkspace;
export default ClubEventDetailWorkspace;
