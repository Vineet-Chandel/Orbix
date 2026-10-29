import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
    ShieldCheck,
    Clock,
    AlertCircle,
    XCircle,
    CheckCircle2,
    RefreshCw,
    LogOut,
    Building2,
    User,
    Calendar,
    ArrowRight,
    ExternalLink,
} from "lucide-react";
import { useAppDispatch, clearUser } from "../../store";
import { useToast } from "../../context/ToastContext";
import { OrbixLogo } from "../../components/OrbixLogo";

interface TimelineEvent {
    id: string;
    stage: "application_submitted" | "initial_review" | "college_verification" | "verification_decision" | "club_activated";
    status: "completed" | "in_progress" | "upcoming" | "action_required" | "rejected";
    title: string;
    message: string;
    actionRequired?: string | null;
    createdAt?: string;
}

interface ClubApplication {
    id: string;
    club_name: string;
    college_name: string;
    college_city: string;
    college_state: string;
    college_country: string;
    club_category: string;
    club_description: string | null;
    contact_person_name: string;
    contact_person_role: string;
    contact_email: string;
    college_official_email: string | null;
    contact_phone: string | null;
    college_website_url: string | null;
    club_website_url: string | null;
    club_social_url: string | null;
    status: "pending" | "under_review" | "needs_information" | "rejected" | "ready_for_promotion" | "approved";
    submitted_at: string;
    updated_at: string;
    reviewed_at?: string | null;
    verified_club_id?: string | null;
}

interface VerifiedClub {
    id: string;
    name: string;
    slug: string;
    category?: string;
    college_name?: string;
    logo_url?: string | null;
    verified_at?: string | null;
}

const DEFAULT_STAGES: Array<{
    key: TimelineEvent["stage"];
    stepNum: string;
    defaultTitle: string;
    defaultDesc: string;
}> = [
    {
        key: "application_submitted",
        stepNum: "01",
        defaultTitle: "Application submitted",
        defaultDesc: "Your application was received.",
    },
    {
        key: "initial_review",
        stepNum: "02",
        defaultTitle: "Initial review",
        defaultDesc: "Orbix is reviewing the submitted details.",
    },
    {
        key: "college_verification",
        stepNum: "03",
        defaultTitle: "College verification",
        defaultDesc: "The college and representative will be checked.",
    },
    {
        key: "verification_decision",
        stepNum: "04",
        defaultTitle: "Verification decision",
        defaultDesc: "Approval, additional information, or rejection.",
    },
    {
        key: "club_activated",
        stepNum: "05",
        defaultTitle: "Club access activated",
        defaultDesc: "Your dedicated club dashboard becomes available.",
    },
];

export default function ClubStatusPage() {
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const toast = useToast();

    const [application, setApplication] = useState<ClubApplication | null>(null);
    const [verifiedClub, setVerifiedClub] = useState<VerifiedClub | null>(null);
    const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchStatus = async (isManualRefresh = false) => {
        if (isManualRefresh) setRefreshing(true);
        else setLoading(true);
        setError(null);

        try {
            const endpoints = [
                "/api/club/application-status",
                "http://localhost:3000/api/club/application-status",
            ];
            let res: Response | null = null;
            let data: any = null;

            for (const endpoint of endpoints) {
                try {
                    const r = await fetch(endpoint, {
                        credentials: "include",
                        headers: { "Content-Type": "application/json" },
                    });
                    res = r;
                    data = await r.json().catch(() => null);
                    break;
                } catch {
                    continue;
                }
            }

            if (!res || !res.ok) {
                if (res?.status === 401) {
                    navigate("/auth/signin");
                    return;
                }
                throw new Error(data?.message || "Failed to load club application status.");
            }

            if (data?.application) {
                setApplication(data.application);
            } else {
                setApplication(null);
            }

            if (data?.verifiedClub) {
                setVerifiedClub(data.verifiedClub);
            }

            if (Array.isArray(data?.timelineEvents)) {
                setTimelineEvents(data.timelineEvents);
            }

            if (isManualRefresh) {
                toast.success("Application status refreshed.", { title: "Updated" });
            }
        } catch (err: any) {
            console.error("Status fetch error:", err);
            setError(err.message || "Failed to connect to Orbix verification server.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchStatus();
    }, []);

    const handleLogout = async () => {
        try {
            await fetch("/api/signout", { method: "POST", credentials: "include" }).catch(() => {});
        } catch {
            // ignore
        }
        try {
            localStorage.removeItem("orbix_token");
            localStorage.removeItem("orbix_user");
        } catch {
            // ignore
        }
        dispatch(clearUser());
        toast.info("Signed out successfully.");
        navigate("/auth/signin");
    };

    // Status UI Configuration
    const getStatusConfig = (status: ClubApplication["status"]) => {
        switch (status) {
            case "pending":
                return {
                    label: "Application Received: Awaiting Review",
                    badgeBg: "bg-amber-100 text-amber-900 border-amber-400",
                    icon: Clock,
                    iconBg: "bg-amber-100 text-amber-600",
                    title: "Application Received — Awaiting Review",
                    description:
                        "Your club registration request has been received. An authorized reviewer will examine your institution and club details soon.",
                    nextSteps:
                        "No action is required from you at this moment. You can check back here periodically or reach out if your contact details change.",
                };
            case "under_review":
                return {
                    label: "Under Active Review & Verification",
                    badgeBg: "bg-sky-100 text-sky-900 border-sky-400",
                    icon: ShieldCheck,
                    iconBg: "bg-sky-100 text-sky-600",
                    title: "Orbix Is Reviewing Your Application",
                    description:
                        "Our team is currently verifying the college details, confirming club existence, and checking representative authorization with institution contacts.",
                    nextSteps:
                        "Our reviewers may contact your college administration or official faculty advisor. Please ensure your college contacts are reachable.",
                };
            case "needs_information":
                return {
                    label: "Action Required: Additional Information Needed",
                    badgeBg: "bg-orange-100 text-orange-900 border-orange-400",
                    icon: AlertCircle,
                    iconBg: "bg-orange-100 text-orange-600",
                    title: "Further Information Required",
                    description:
                        "Our verification team requires additional confirmation or reference materials to verify your club's association with the college.",
                    nextSteps:
                        "Please review the action message highlighted in the timeline below and provide the requested details.",
                };
            case "rejected":
                return {
                    label: "Application Not Approved",
                    badgeBg: "bg-rose-100 text-rose-900 border-rose-400",
                    icon: XCircle,
                    iconBg: "bg-rose-100 text-rose-600",
                    title: "Application Not Approved",
                    description:
                        "After evaluation, this registration request could not be verified according to Orbix collegiate standards.",
                    nextSteps:
                        "If you believe this was in error or if your club receives official authorization later, you may submit a new application with verified references.",
                };
            case "ready_for_promotion":
                return {
                    label: "College Verification Passed",
                    badgeBg: "bg-emerald-100 text-emerald-900 border-emerald-400",
                    icon: CheckCircle2,
                    iconBg: "bg-emerald-100 text-emerald-600",
                    title: "College Verification Completed!",
                    description:
                        "All institution checks, club existence, and representative authority have been verified by Orbix.",
                    nextSteps:
                        "Final review and activation is in progress. Your dedicated club dashboard will be accessible shortly.",
                };
            case "approved":
                return {
                    label: "Club Access Activated",
                    badgeBg: "bg-emerald-300 text-black border-black",
                    icon: CheckCircle2,
                    iconBg: "bg-emerald-200 text-black",
                    title: "Club Verification Approved & Activated!",
                    description:
                        "Congratulations! Your collegiate club has been verified and promoted. Your dedicated club dashboard and public profile are now live.",
                    nextSteps:
                        "You can now manage your public club profile and publish events directly from your club dashboard.",
                };
            default:
                return {
                    label: "Status Pending",
                    badgeBg: "bg-neutral-100 text-neutral-800 border-neutral-300",
                    icon: Clock,
                    iconBg: "bg-neutral-100 text-neutral-600",
                    title: "Application Received",
                    description: "Your registration has been logged and is queued for verification.",
                    nextSteps: "Please check back later for updates.",
                };
        }
    };

    // Compute dynamic stage representations from application, verified club, and timeline events
    const isApplicationApproved = application?.status === "approved" || !!verifiedClub;

    const resolvedStages = DEFAULT_STAGES.map((def) => {
        const matchingEvents = timelineEvents.filter((ev) => ev.stage === def.key);
        const latestEvent = matchingEvents[matchingEvents.length - 1];

        let stageStatus: TimelineEvent["status"] = latestEvent ? latestEvent.status : "upcoming";
        let stageTitle = latestEvent ? latestEvent.title : def.defaultTitle;
        let stageMessage = latestEvent ? latestEvent.message : def.defaultDesc;
        let actionRequired = latestEvent?.actionRequired || null;
        let timestamp = latestEvent?.createdAt || null;

        // When application is approved, all verification stages are completed
        if (isApplicationApproved) {
            stageStatus = "completed";
            if (def.key === "club_activated") {
                stageTitle = "Club access activated";
                stageMessage = "Your dedicated club dashboard and public profile are now live.";
            } else if (def.key === "verification_decision") {
                stageTitle = "Verification decision: Approved";
                stageMessage = "Orbix reviewer verified all credentials and approved the application.";
            } else if (def.key === "college_verification") {
                stageTitle = "College verification completed";
                stageMessage = "Institution recognition and representative authority confirmed.";
            } else if (def.key === "initial_review") {
                stageTitle = "Initial review completed";
                stageMessage = "Application details and campus association validated.";
            }
            timestamp = timestamp || application?.reviewed_at || verifiedClub?.verified_at || application?.submitted_at || null;
        } else if (!latestEvent && application) {
            // Dynamic fallback if no events received
            if (def.key === "application_submitted") {
                stageStatus = "completed";
                timestamp = application.submitted_at;
            } else if (def.key === "initial_review") {
                stageStatus = application.status === "pending" ? "in_progress" : "completed";
                timestamp = application.updated_at;
            } else if (def.key === "college_verification") {
                if (application.status === "under_review") stageStatus = "in_progress";
                else if (application.status === "needs_information") stageStatus = "action_required";
                else if (["ready_for_promotion", "approved"].includes(application.status)) stageStatus = "completed";
            } else if (def.key === "verification_decision") {
                if (application.status === "rejected") stageStatus = "rejected";
                else if (["ready_for_promotion", "approved"].includes(application.status)) stageStatus = "completed";
            } else if (def.key === "club_activated") {
                if (application.status === "approved" || verifiedClub) stageStatus = "completed";
            }
        }

        return {
            ...def,
            status: stageStatus,
            title: stageTitle,
            message: stageMessage,
            actionRequired,
            timestamp,
        };
    });

    return (
        <div className="min-h-screen bg-[#FAF6EE] text-neutral-900 font-sans selection:bg-black selection:text-white flex flex-col relative">
            {/* Eye-friendly canvas dot grid */}
            <div className="fixed inset-0 bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:20px_20px] pointer-events-none -z-10 opacity-70" />

            {/* Top Navigation Bar */}
            <header className="w-full bg-white border-b-2 border-black px-4 sm:px-8 py-3.5 flex items-center justify-between sticky top-0 z-30 select-none">
                <div className="flex items-center gap-3">
                    <Link
                        to="/"
                        className="flex items-center gap-2 group"
                        title="Orbix Home"
                    >
                        <div className="w-8 h-8 rounded-xl bg-[#FFE566] border-2 border-black flex items-center justify-center p-1.5 shadow-[1.5px_1.5px_0px_#000] group-hover:scale-105 transition-transform flex-shrink-0">
                            <OrbixLogo className="w-full h-full text-black" />
                        </div>
                        <span className="font-black text-lg tracking-tight text-black group-hover:text-neutral-700 transition-colors">
                            Orbix
                        </span>
                    </Link>

                    <span className="hidden sm:inline-block w-1 h-4 bg-neutral-300 rounded-full mx-1" />

                    <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FAF6EE] border border-black/20 text-xs font-bold text-neutral-700">
                        <ShieldCheck className="w-3.5 h-3.5 text-black" />
                        <span>Club Verification Portal</span>
                    </div>
                </div>

                <div className="flex items-center gap-2.5">
                    {application && (
                        <span className="hidden md:inline-block text-xs font-bold text-neutral-600 truncate max-w-[220px]">
                            {application.club_name}
                        </span>
                    )}

                    <button
                        type="button"
                        onClick={() => fetchStatus(true)}
                        disabled={refreshing || loading}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white hover:bg-neutral-50 text-black text-xs font-bold border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer disabled:opacity-50"
                        title="Refresh status"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
                        <span className="hidden sm:inline">Refresh</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleLogout}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#FAF6EE] hover:bg-rose-50 hover:border-rose-600 hover:text-rose-600 text-black text-xs font-bold border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer"
                        title="Log out of club account"
                    >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Sign out</span>
                    </button>
                </div>
            </header>

            {/* Main Container */}
            <main className="flex-1 w-full max-w-4xl mx-auto p-4 sm:p-6 md:p-8 space-y-6">
                {/* Loading State */}
                {loading && (
                    <div className="p-12 text-center rounded-3xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-4">
                        <div className="w-10 h-10 rounded-full border-3 border-black/20 border-t-black animate-spin mx-auto" />
                        <p className="text-sm font-bold text-neutral-600">
                            Loading your club registration record...
                        </p>
                    </div>
                )}

                {/* Error State */}
                {!loading && error && (
                    <div className="p-6 rounded-3xl bg-white border-2 border-rose-500 shadow-[4px_4px_0px_#f43f5e] space-y-3">
                        <div className="flex items-center gap-2 text-rose-600 font-black">
                            <AlertCircle className="w-5 h-5" />
                            <span>Unable to load application details</span>
                        </div>
                        <p className="text-xs sm:text-sm text-neutral-700">{error}</p>
                        <button
                            type="button"
                            onClick={() => fetchStatus(false)}
                            className="px-4 py-2 rounded-full bg-black text-white text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer"
                        >
                            Retry Loading
                        </button>
                    </div>
                )}

                {/* Empty State: No Application Found */}
                {!loading && !error && !application && !verifiedClub && (
                    <div className="p-8 sm:p-12 text-center rounded-3xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-4">
                        <div className="w-14 h-14 rounded-2xl bg-amber-100 border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-center mx-auto">
                            <Building2 className="w-7 h-7 text-black" />
                        </div>
                        <h2 className="text-xl font-black text-black">
                            No Club Application Found
                        </h2>
                        <p className="text-xs sm:text-sm text-neutral-600 max-w-md mx-auto leading-relaxed">
                            We could not find an active club verification application associated with this account. If you just registered, try refreshing. Otherwise, you can submit an application from the signup page.
                        </p>
                        <div className="pt-2">
                            <Link
                                to="/auth/signup"
                                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-black text-white text-xs sm:text-sm font-black border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-[5px_5px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition-all"
                            >
                                Submit Club Application
                            </Link>
                        </div>
                    </div>
                )}

                {/* Active Application Content */}
                {!loading && !error && (application || verifiedClub) && (() => {
                    const currentStatus = verifiedClub ? "approved" : (application?.status || "pending");
                    const statusConfig = getStatusConfig(currentStatus);
                    const StatusIcon = statusConfig.icon;

                    return (
                        <div className="space-y-6">
                            {/* Approved Club Callout (Direct Jump to Dashboard) */}
                            {(currentStatus === "approved" || verifiedClub) && (
                                <div className="p-6 sm:p-8 rounded-3xl bg-[#a2ff86] border-2 border-black shadow-[5px_5px_0px_#000] space-y-4">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                        <div className="space-y-1">
                                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black text-[#a2ff86] text-xs font-black uppercase tracking-wider mb-1">
                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                <span>Verified & Promoted</span>
                                            </div>
                                            <h2 className="text-xl sm:text-2xl font-black text-black tracking-tight">
                                                {verifiedClub?.name || application?.club_name} is Live on Orbix!
                                            </h2>
                                            <p className="text-xs sm:text-sm font-medium text-neutral-800 leading-relaxed max-w-xl">
                                                Your club has been promoted into the verified-club registry. You now have full access to your dedicated club dashboard and public profile.
                                            </p>
                                        </div>

                                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => navigate("/club/dashboard")}
                                                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-black text-white text-xs sm:text-sm font-black border-2 border-black shadow-[3px_3px_0px_#000] hover:bg-neutral-900 active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer"
                                            >
                                                <span>Enter Club Dashboard</span>
                                                <ArrowRight className="w-4 h-4" />
                                            </button>

                                            {verifiedClub?.slug && (
                                                <a
                                                    href={`/clubs/${(verifiedClub as any)?.clubUsername || verifiedClub.slug}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-2xl bg-white text-black text-xs sm:text-sm font-bold border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-neutral-50 active:translate-x-[1px] active:translate-y-[1px] transition-all"
                                                >
                                                    <span>View Public Profile</span>
                                                    <ExternalLink className="w-3.5 h-3.5" />
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Hero Status Banner */}
                            <div className="p-6 sm:p-8 rounded-3xl bg-white border-2 border-black shadow-[5px_5px_0px_#000] space-y-5">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-black/10 pb-5">
                                    <div className="flex items-center gap-3">
                                        <div
                                            className={`w-12 h-12 rounded-2xl border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center shrink-0 ${statusConfig.iconBg}`}
                                        >
                                            <StatusIcon className="w-6 h-6 stroke-[2.5]" />
                                        </div>
                                        <div>
                                            <div className="text-[11px] font-black uppercase tracking-wider text-neutral-500 mb-0.5">
                                                Application Status
                                            </div>
                                            <h1 className="text-xl sm:text-2xl font-black text-black tracking-tight">
                                                {statusConfig.title}
                                            </h1>
                                        </div>
                                    </div>

                                    <div className="self-start sm:self-auto">
                                        <span
                                            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border-2 ${statusConfig.badgeBg} shadow-[2px_2px_0px_#000]`}
                                        >
                                            <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                                            <span>{statusConfig.label}</span>
                                        </span>
                                    </div>
                                </div>

                                {/* Status Narrative and Instructions */}
                                <div className="space-y-3.5 text-xs sm:text-sm leading-relaxed text-neutral-700">
                                    <p className="font-medium">{statusConfig.description}</p>
                                    <div className="p-4 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000]">
                                        <span className="font-black text-black block mb-1">
                                            Next Steps & Expectations:
                                        </span>
                                        <p className="text-xs text-neutral-700 font-medium">
                                            {statusConfig.nextSteps}
                                        </p>
                                    </div>
                                </div>

                                {/* Notice about restricted access to user dashboard */}
                                <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-300 text-xs text-amber-900 font-medium flex items-start gap-2.5">
                                    <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                                    <span>
                                        <strong>Account Notice: </strong> Club accounts are separate from individual developer profiles. Individual coding statistics, personal profile editors, and practice tools remain isolated from club operations.
                                    </span>
                                </div>
                            </div>

                            {/* Phase 2: Live Verification Timeline (5 Dynamic Stages) */}
                            <div className="p-6 sm:p-8 rounded-3xl bg-white border-2 border-black shadow-[5px_5px_0px_#000] space-y-6">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-black/10 pb-4">
                                    <div>
                                        <h2 className="text-sm font-black uppercase tracking-wider text-black">
                                            Club Verification Timeline
                                        </h2>
                                        <p className="text-xs text-neutral-600 font-medium">
                                            Each stage is backed by real persisted verification events from the database.
                                        </p>
                                    </div>
                                    <Link
                                        to="/docs/club-verification-protocol"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-neutral-600 bg-neutral-100 hover:bg-neutral-200 px-2.5 py-1 rounded-full border border-black/15 transition-colors self-start sm:self-auto cursor-pointer"
                                        title="View official documentation on Orbix club verification"
                                    >
                                        <span>5-Stage Verification Standard</span>
                                        <ExternalLink className="w-3 h-3 text-neutral-600" />
                                    </Link>
                                </div>

                                {/* 5 Stage Cards Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                                    {resolvedStages.map((stage) => {
                                        const isCompleted = stage.status === "completed";
                                        const isInProgress = stage.status === "in_progress";
                                        const isActionRequired = stage.status === "action_required";
                                        const isRejected = stage.status === "rejected";
                                        const isUpcoming = stage.status === "upcoming";

                                        return (
                                            <div
                                                key={stage.key}
                                                className={`p-4 rounded-2xl border-2 flex flex-col justify-between transition-all ${
                                                    isCompleted
                                                        ? "bg-[#FAFDF7] border-[#86efac] shadow-[2px_2px_0px_#86efac]"
                                                        : isInProgress
                                                        ? "bg-[#F0F9FF] border-sky-400 shadow-[3px_3px_0px_#0284c7]"
                                                        : isActionRequired
                                                        ? "bg-[#FFF7ED] border-orange-400 shadow-[3px_3px_0px_#ea580c]"
                                                        : isRejected
                                                        ? "bg-[#FFF1F2] border-rose-400 shadow-[3px_3px_0px_#e11d48]"
                                                        : "bg-[#FAFAFA] border-neutral-300 shadow-[1px_1px_0px_#d4d4d4]"
                                                }`}
                                            >
                                                <div className="space-y-2">
                                                    {/* Number Header & Badge */}
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs font-black font-mono text-neutral-500">
                                                            {stage.stepNum}
                                                        </span>

                                                        {isCompleted && (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                                                                <CheckCircle2 className="w-3 h-3" />
                                                                <span>Done</span>
                                                            </span>
                                                        )}
                                                        {isInProgress && (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-sky-100 text-sky-800 border border-sky-300">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-sky-600 animate-ping" />
                                                                <span>Active</span>
                                                            </span>
                                                        )}
                                                        {isActionRequired && (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-orange-100 text-orange-900 border border-orange-400">
                                                                <AlertCircle className="w-3 h-3 text-orange-600" />
                                                                <span>Action</span>
                                                            </span>
                                                        )}
                                                        {isRejected && (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300">
                                                                <XCircle className="w-3 h-3" />
                                                                <span>Declined</span>
                                                            </span>
                                                        )}
                                                        {isUpcoming && (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-100 text-neutral-500 border border-neutral-200">
                                                                <span>Upcoming</span>
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Title */}
                                                    <h3 className="text-xs sm:text-sm font-black text-black leading-tight">
                                                        {stage.title}
                                                    </h3>

                                                    {/* Description */}
                                                    <p className="text-[11px] text-neutral-600 font-medium leading-relaxed">
                                                        {stage.message}
                                                    </p>
                                                </div>

                                                {/* Timestamp footer */}
                                                <div className="pt-3 mt-3 border-t border-black/10">
                                                    {stage.timestamp ? (
                                                        <span className="text-[10px] font-mono text-neutral-500 block truncate" title={new Date(stage.timestamp).toLocaleString()}>
                                                            {new Date(stage.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] font-mono text-neutral-400 block">
                                                            Pending
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Action Required Callout if status is needs_information */}
                                {currentStatus === "needs_information" && (() => {
                                    const actionStage = resolvedStages.find((s) => s.actionRequired);
                                    const message = actionStage?.actionRequired || "Our reviewers require additional documentation or clarification before your club can be verified.";

                                    return (
                                        <div className="p-4 sm:p-5 rounded-2xl bg-orange-50 border-2 border-orange-400 shadow-[3px_3px_0px_#ea580c] space-y-2">
                                            <div className="flex items-center gap-2 text-orange-950 font-black text-xs sm:text-sm">
                                                <AlertCircle className="w-4 h-4 text-orange-600 shrink-0" />
                                                <span>Action Required from Club Representative</span>
                                            </div>
                                            <p className="text-xs text-neutral-800 font-medium leading-relaxed">
                                                {message}
                                            </p>
                                            <div className="text-[11px] font-bold text-neutral-600 pt-1">
                                                Please reply to the official review correspondence sent to <strong>{application?.contact_email}</strong> or update your references.
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* Application Details Summary */}
                            {application && (
                                <div className="p-6 sm:p-8 rounded-3xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-6">
                                    <div className="flex items-center justify-between border-b-2 border-black/10 pb-3">
                                        <h2 className="text-sm font-black uppercase tracking-wider text-black">
                                            Submitted Application Record
                                        </h2>
                                        <span className="text-xs font-mono font-bold text-neutral-500">
                                            ID: {application.id.slice(0, 8)}...
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* Club & College */}
                                        <div className="space-y-3">
                                            <h3 className="text-xs font-black uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
                                                <Building2 className="w-3.5 h-3.5" />
                                                <span>Institution & Club</span>
                                            </h3>

                                            <div className="p-4 rounded-2xl bg-[#FAF6EE] border-2 border-black/15 space-y-2 text-xs font-medium">
                                                <div>
                                                    <span className="text-[10px] uppercase font-black text-neutral-500 block">
                                                        Club Name
                                                    </span>
                                                    <span className="font-bold text-black text-sm">
                                                        {application.club_name}
                                                    </span>
                                                </div>

                                                <div>
                                                    <span className="text-[10px] uppercase font-black text-neutral-500 block">
                                                        College / University
                                                    </span>
                                                    <span className="font-bold text-black">
                                                        {application.college_name}
                                                    </span>
                                                </div>

                                                <div>
                                                    <span className="text-[10px] uppercase font-black text-neutral-500 block">
                                                        Location
                                                    </span>
                                                    <span className="text-neutral-800">
                                                        {application.college_city}, {application.college_state}, {application.college_country}
                                                    </span>
                                                </div>

                                                <div>
                                                    <span className="text-[10px] uppercase font-black text-neutral-500 block">
                                                        Category
                                                    </span>
                                                    <span className="inline-block px-2 py-0.5 rounded-full bg-white border border-black/20 text-[11px] font-bold text-black mt-0.5">
                                                        {application.club_category}
                                                    </span>
                                                </div>

                                                {application.club_description && (
                                                    <div className="pt-1">
                                                        <span className="text-[10px] uppercase font-black text-neutral-500 block">
                                                            Description
                                                        </span>
                                                        <p className="text-neutral-600 line-clamp-3">
                                                            {application.club_description}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Representative & Contacts */}
                                        <div className="space-y-3">
                                            <h3 className="text-xs font-black uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
                                                <User className="w-3.5 h-3.5" />
                                                <span>Representative & References</span>
                                            </h3>

                                            <div className="p-4 rounded-2xl bg-[#FAF6EE] border-2 border-black/15 space-y-2 text-xs font-medium">
                                                <div>
                                                    <span className="text-[10px] uppercase font-black text-neutral-500 block">
                                                        Representative
                                                    </span>
                                                    <span className="font-bold text-black text-sm">
                                                        {application.contact_person_name}
                                                    </span>
                                                    <span className="text-neutral-600 text-xs block">
                                                        Role: {application.contact_person_role}
                                                    </span>
                                                </div>

                                                <div>
                                                    <span className="text-[10px] uppercase font-black text-neutral-500 block">
                                                        Account Email
                                                    </span>
                                                    <span className="text-black font-mono">
                                                        {application.contact_email}
                                                    </span>
                                                </div>

                                                {application.college_official_email && (
                                                    <div>
                                                        <span className="text-[10px] uppercase font-black text-neutral-500 block">
                                                            Official College Email
                                                        </span>
                                                        <span className="text-black font-mono">
                                                            {application.college_official_email}
                                                        </span>
                                                    </div>
                                                )}

                                                {application.contact_phone && (
                                                    <div>
                                                        <span className="text-[10px] uppercase font-black text-neutral-500 block">
                                                            Phone
                                                        </span>
                                                        <span className="text-black font-mono">
                                                            {application.contact_phone}
                                                        </span>
                                                    </div>
                                                )}

                                                {/* References List */}
                                                <div className="pt-1 space-y-1">
                                                    <span className="text-[10px] uppercase font-black text-neutral-500 block">
                                                        Verification URLs
                                                    </span>
                                                    <div className="space-y-1">
                                                        {application.college_website_url && (
                                                            <a
                                                                href={application.college_website_url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-xs text-sky-700 hover:underline block truncate"
                                                            >
                                                                College: {application.college_website_url}
                                                            </a>
                                                        )}
                                                        {application.club_website_url && (
                                                            <a
                                                                href={application.club_website_url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-xs text-sky-700 hover:underline block truncate"
                                                            >
                                                                Club: {application.club_website_url}
                                                            </a>
                                                        )}
                                                        {application.club_social_url && (
                                                            <a
                                                                href={application.club_social_url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-xs text-sky-700 hover:underline block truncate"
                                                            >
                                                                Social: {application.club_social_url}
                                                            </a>
                                                        )}
                                                        {!application.college_website_url &&
                                                            !application.club_website_url &&
                                                            !application.club_social_url && (
                                                                <span className="text-neutral-500 text-[11px]">
                                                                    No public references supplied.
                                                                </span>
                                                            )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Timestamps Bar */}
                                    <div className="pt-3 border-t-2 border-black/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px] font-mono text-neutral-600 font-bold">
                                        <div className="flex items-center gap-1.5">
                                            <Calendar className="w-3.5 h-3.5" />
                                            <span>
                                                Submitted: {new Date(application.submitted_at).toLocaleDateString()} at{" "}
                                                {new Date(application.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <div>
                                            Last Updated: {new Date(application.updated_at).toLocaleDateString()}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })()}
            </main>
        </div>
    );
}
