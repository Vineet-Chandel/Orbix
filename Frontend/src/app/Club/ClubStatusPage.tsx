import { useEffect, useState, useMemo } from "react";
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
    ArrowRight,
    ExternalLink,
    Mail,
    FileText,
    Check,
    Sparkles,
    Shield,
    Info,
    X,
    Lock,
    GraduationCap,
    Send,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppDispatch, clearUser } from "../../store";
import { useToast } from "../../context/ToastContext";
import { OrbixLogo } from "../../components/OrbixLogo";
import { OrbixLoader } from "../../components/ui/loader";
import OtpSegmentedInput from "../../LandingPages/Auth-Pages/OtpSegmentedInput";
import {
    sendClubEmailVerificationOtp,
    confirmClubEmailVerificationOtp,
} from "../../api/clubSettingsApi";

// -----------------------------------------------------------------------------
// TYPE DEFINITIONS
// -----------------------------------------------------------------------------

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
    auth_user_id: string;
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
    terms_accepted?: boolean;
    terms_version?: string;
    privacy_policy_accepted?: boolean;
    privacy_policy_version?: string;
    consent_recorded_at?: string;
    status: "pending" | "under_review" | "needs_information" | "rejected" | "ready_for_promotion" | "approved";
    college_contact_status: "not_started" | "contacted" | "confirmed" | "not_found" | "no_response";
    club_existence_confirmed?: boolean;
    college_authorization_confirmed?: boolean;
    representative_authority_confirmed?: boolean;
    last_college_contacted_at?: string | null;
    reviewed_by?: string | null;
    reviewed_at?: string | null;
    internal_notes?: string | null;
    submitted_at: string;
    updated_at: string;
    verified_club_id?: string | null;
    college_id?: string | null;
    is_email_verified?: boolean;
    is_phone_verified?: boolean;
    phone_verified_at?: string | null;
    applicant_user_id?: string | null;
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

const DEFAULT_STAGES = [
    {
        key: "application_submitted",
        stepNum: "01",
        defaultTitle: "Application Submitted",
        defaultDesc: "Your registration intake was logged and queued for investigation.",
        category: "Intake",
    },
    {
        key: "initial_review",
        stepNum: "02",
        defaultTitle: "Initial Review & Automated Triage",
        defaultDesc: "Orbix automated triage verifies domain validity, MX records, and duplicate prevention.",
        category: "Triage",
    },
    {
        key: "college_verification",
        stepNum: "03",
        defaultTitle: "Institutional Outreach & Multi-Channel Investigation",
        defaultDesc: "Active outreach across the 6 investigation touchpoints: students, administrators, school center, and college validation.",
        category: "Investigation",
    },
    {
        key: "verification_decision",
        stepNum: "04",
        defaultTitle: "Reviewer Decision & Sign-off",
        defaultDesc: "Reviewer formal evaluation: approval, additional information request, or rejection.",
        category: "Evaluation",
    },
    {
        key: "club_activated",
        stepNum: "05",
        defaultTitle: "Club Access Activated",
        defaultDesc: "Promoted to verified registry. Dedicated Club Dashboard and public profile are unlocked.",
        category: "Activation",
    },
];

export default function ClubStatusPage() {
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const toast = useToast();

    // Data State
    const [application, setApplication] = useState<ClubApplication | null>(null);
    const [verifiedClub, setVerifiedClub] = useState<VerifiedClub | null>(null);
    const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Context Page / Drawer Visibility
    const [showContextDrawer, setShowContextDrawer] = useState(false);

    // Email OTP Inline Verification State
    const [isVerifyingEmail, setIsVerifyingEmail] = useState(false);
    const [emailOtp, setEmailOtp] = useState("");
    const [isSendingOtp, setIsSendingOtp] = useState(false);
    const [isSubmittingOtp, setIsSubmittingOtp] = useState(false);
    const [otpCooldown, setOtpCooldown] = useState(0);

    // Investigation touchpoints expander
    const [expandedTouchpoint, setExpandedTouchpoint] = useState<string | null>("college_administrators");

    // Cooldown countdown
    useEffect(() => {
        if (otpCooldown <= 0) return;
        const timer = setInterval(() => setOtpCooldown((prev) => prev - 1), 1000);
        return () => clearInterval(timer);
    }, [otpCooldown]);

    // Fetch Status Data from Database
    const fetchStatus = async (isManualRefresh = false) => {
        if (isManualRefresh) setRefreshing(true);
        else if (!application) setLoading(true);
        setError(null);

        try {
            const primaryEndpoint = "/api/club/application-status";
            const endpoints = import.meta.env.DEV
                ? [primaryEndpoint, "http://localhost:3000/api/club/application-status"]
                : [primaryEndpoint];
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
                toast.success("Application status refreshed from database.", { title: "Updated" });
            }
        } catch (err: any) {
            console.error("Status fetch error:", err);
            setError(err.message || "Failed to connect to Orbix verification server.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // Initial mount fetch
    useEffect(() => {
        fetchStatus();
    }, []);

    // Periodic auto-poll every 30 seconds for live database updates
    useEffect(() => {
        const timer = setInterval(() => {
            fetchStatus(false);
        }, 30000);
        return () => clearInterval(timer);
    }, []);

    const handleLogout = async () => {
        try {
            await fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
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

    // Handle sending OTP to contact email
    const handleSendVerificationCode = async () => {
        setIsSendingOtp(true);
        try {
            const res = await sendClubEmailVerificationOtp(application?.contact_email);
            setOtpCooldown(60);
            toast.success(res?.message || "Verification code sent to your email.", { title: "Code Dispatched" });
        } catch (err: any) {
            toast.error(err?.message || "Failed to dispatch verification code. Please try again.", { title: "Error" });
        } finally {
            setIsSendingOtp(false);
        }
    };

    // Handle confirming OTP
    const handleConfirmVerificationCode = async (codeToSubmit?: string) => {
        const code = codeToSubmit || emailOtp;
        if (!code || code.length !== 6) {
            toast.error("Please enter a valid 6-digit code.", { title: "Incomplete Code" });
            return;
        }

        setIsSubmittingOtp(true);
        try {
            const res = await confirmClubEmailVerificationOtp(code);
            toast.success(res?.message || "Email verified successfully!", { title: "Email Confirmed" });
            setIsVerifyingEmail(false);
            setEmailOtp("");
            if (application) {
                setApplication({ ...application, is_email_verified: true });
            }
            fetchStatus();
        } catch (err: any) {
            toast.error(err?.message || "Invalid or expired verification code.", { title: "Verification Failed" });
        } finally {
            setIsSubmittingOtp(false);
        }
    };

    // Status UI Configuration
    const getStatusConfig = (status: ClubApplication["status"]) => {
        switch (status) {
            case "pending":
                return {
                    label: "Application Received: In Review",
                    badgeClass: "bg-[#70d6ff] text-black border-2 border-black shadow-[2px_2px_0px_#000]",
                    dotClass: "bg-black",
                    title: "Application Received — Investigation in Progress",
                    description:
                        "Your registration request has been successfully recorded in our database. Orbix reviewers are actively processing your college outreach and identity credentials.",
                    nextSteps:
                        "No action is required from you at this moment. You can check back here periodically or click 'Refresh' to inspect live database updates.",
                };
            case "under_review":
                return {
                    label: "Active Investigation & College Outreach",
                    badgeClass: "bg-[#70d6ff] text-black border-2 border-black shadow-[2px_2px_0px_#000]",
                    dotClass: "bg-black",
                    title: "Active Multi-Channel Verification in Progress",
                    description:
                        "Our team is actively verifying your chapter existence, reviewing student leadership credentials, and reaching out to your college administration and department faculty.",
                    nextSteps:
                        "Please ensure your student chapter references and college email accounts are reachable to expedite official confirmation.",
                };
            case "needs_information":
                return {
                    label: "Action Required: Additional Information Needed",
                    badgeClass: "bg-[#FFE566] text-black border-2 border-black shadow-[2px_2px_0px_#000]",
                    dotClass: "bg-black",
                    title: "Reviewer Inquiry: Clarification Required",
                    description:
                        "Our verification team requires additional documentation, an official charter letter, or updated contact references to complete institutional validation.",
                    nextSteps:
                        "Please review the reviewer message highlighted in your investigation timeline below and respond with the requested details.",
                };
            case "rejected":
                return {
                    label: "Application Not Approved",
                    badgeClass: "bg-[#ff70a6] text-black border-2 border-black shadow-[2px_2px_0px_#000]",
                    dotClass: "bg-black",
                    title: "Application Could Not Be Verified",
                    description:
                        "After investigation, this registration request could not be validated against collegiate engineering society standards.",
                    nextSteps:
                        "If your student chapter obtains official university recognition later, you may submit a new application with verified faculty sponsorship.",
                };
            case "ready_for_promotion":
                return {
                    label: "College Verification Passed — Final Release",
                    badgeClass: "bg-[#a2ff86] text-black border-2 border-black shadow-[2px_2px_0px_#000]",
                    dotClass: "bg-black",
                    title: "Institutional Verification Completed!",
                    description:
                        "All student credentials, college recognition, and faculty references have been confirmed in our database. The administrator holding final release is finalizing activation.",
                    nextSteps:
                        "Your verified club portal and public club page will become active once promoted.",
                };
            case "approved":
                return {
                    label: "Club Access Activated",
                    badgeClass: "bg-[#a2ff86] text-black border-2 border-black shadow-[2px_2px_0px_#000]",
                    dotClass: "bg-black",
                    title: "Club Verification Approved & Live!",
                    description:
                        "Congratulations! Your collegiate society is officially verified on Orbix. Your dedicated club dashboard and verified campus profile are now active.",
                    nextSteps:
                        "You can now publish coding contests, track campus rankings, and manage member applications directly from your dashboard.",
                };
            default:
                return {
                    label: "Status Pending",
                    badgeClass: "bg-[#FAF6EE] text-black border-2 border-black shadow-[2px_2px_0px_#000]",
                    dotClass: "bg-black",
                    title: "Application Under Review",
                    description: "Your registration is logged and queued for investigation.",
                    nextSteps: "Please check back periodically for updates.",
                };
        }
    };

    const isApplicationApproved = application?.status === "approved" || !!verifiedClub;

    // Check if all 4 core checks in DB are confirmed
    const isCollegeContactConfirmed = application?.college_contact_status === "confirmed";
    const allChecksConfirmedInDb = Boolean(
        isCollegeContactConfirmed &&
        application?.club_existence_confirmed &&
        application?.college_authorization_confirmed &&
        application?.representative_authority_confirmed
    );

    // Resolved Stages with timestamps
    const resolvedStages = useMemo(() => {
        return DEFAULT_STAGES.map((def) => {
            const matchingEvents = timelineEvents.filter((ev) => ev.stage === def.key);
            const latestEvent = matchingEvents[matchingEvents.length - 1];

            let stageStatus: TimelineEvent["status"] = latestEvent ? latestEvent.status : "upcoming";
            let stageTitle = latestEvent ? latestEvent.title : def.defaultTitle;
            let stageMessage = latestEvent ? latestEvent.message : def.defaultDesc;
            let actionRequired = latestEvent?.actionRequired || null;
            let timestamp = latestEvent?.createdAt || null;

            if (isApplicationApproved) {
                stageStatus = "completed";
                if (def.key === "club_activated") {
                    stageTitle = "Club Access Activated";
                    stageMessage = "Your verified club dashboard and public collegiate profile are live.";
                } else if (def.key === "verification_decision") {
                    stageTitle = "Verification Decision: Approved";
                    stageMessage = "All 4 pillars confirmed and approved by Orbix reviewer.";
                } else if (def.key === "college_verification") {
                    stageTitle = "College Outreach & Verification Completed";
                    stageMessage = "Institution recognition, campus charter, and student representative authority confirmed.";
                } else if (def.key === "initial_review") {
                    stageTitle = "Initial Review & Automated Triage Completed";
                    stageMessage = "Domain validity, MX records, and campus association validated.";
                }
                timestamp = timestamp || application?.reviewed_at || verifiedClub?.verified_at || application?.submitted_at || null;
            } else if (allChecksConfirmedInDb) {
                if (def.key === "application_submitted" || def.key === "initial_review" || def.key === "college_verification") {
                    stageStatus = "completed";
                } else if (def.key === "verification_decision") {
                    stageStatus = "in_progress";
                    stageTitle = "Verification Decision: Awaiting Promotion";
                    stageMessage = "All institutional checks passed. Awaiting final promotion sign-off and access release.";
                } else if (def.key === "club_activated") {
                    stageStatus = "upcoming";
                }
                timestamp = timestamp || application?.updated_at || application?.submitted_at || null;
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
    }, [timelineEvents, isApplicationApproved, allChecksConfirmedInDb, application, verifiedClub]);

    // Dynamic 6 Investigation Touchpoints directly bound to the DB row
    const dynamicTouchpoints = useMemo(() => {
        const studentConfirmed = Boolean(application?.representative_authority_confirmed);
        const collegeContactStatus = application?.college_contact_status || "not_started";
        const collegeContactConfirmed = collegeContactStatus === "confirmed";
        const collegeContactContacted = collegeContactStatus === "contacted";
        const deptConfirmed = Boolean(application?.college_authorization_confirmed);
        const clubExistenceConfirmed = Boolean(application?.club_existence_confirmed);
        const isApproved = application?.status === "approved" || Boolean(verifiedClub);
        const isReadyForPromotion = application?.status === "ready_for_promotion" || allChecksConfirmedInDb;

        return [
            {
                id: "students",
                stepNumber: "01",
                label: "The Students & Chapter Officers",
                title: "Student Chapter & Leadership Validation",
                isConfirmed: studentConfirmed,
                isInProgress: !studentConfirmed && application?.status !== "pending",
                statusLabel: studentConfirmed
                    ? "Confirmed Authority"
                    : (application?.status === "pending" ? "Queued for Review" : "In Review"),
                statusColor: studentConfirmed ? "bg-[#a2ff86]" : "bg-[#FFE566]",
                summary: "Audit of applicant leadership credentials, active student enrollment, and executive role authority.",
                dbEvidence: `Representative: ${application?.contact_person_name || "DHOLAKIYA"} (${application?.contact_person_role || "President"}) • Email: ${application?.contact_email || "N/A"}`,
                icon: User,
            },
            {
                id: "college_administrators",
                stepNumber: "02",
                label: "College Administration",
                title: "Direct University Administrative Outreach",
                isConfirmed: collegeContactConfirmed,
                isInProgress: collegeContactContacted,
                statusLabel: collegeContactConfirmed
                    ? "Confirmed by College Administration"
                    : collegeContactContacted
                    ? "Outreach Dispatched (Awaiting Response)"
                    : "Queued for Outreach",
                statusColor: collegeContactConfirmed ? "bg-[#a2ff86]" : (collegeContactContacted ? "bg-[#70d6ff]" : "bg-neutral-200"),
                summary: "Direct outreach dispatched to the Dean of Student Affairs, Registrar, or Campus Student Welfare Office.",
                dbEvidence: `College: ${application?.college_name || "N/A"} • Contact Status in DB: [${collegeContactStatus.toUpperCase()}]`,
                icon: Building2,
            },
            {
                id: "school_center",
                stepNumber: "03",
                label: "The School Center & Department",
                title: "Academic Department & Computing Center Validation",
                isConfirmed: deptConfirmed,
                isInProgress: !deptConfirmed && collegeContactContacted,
                statusLabel: deptConfirmed
                    ? "Confirmed Department Recognition"
                    : "Pending Department Charter Check",
                statusColor: deptConfirmed ? "bg-[#a2ff86]" : "bg-[#FFE566]",
                summary: "Verification with the School of Computer Science / Engineering Department leadership.",
                dbEvidence: `Category: ${application?.club_category || "technology"} • Campus: ${application?.college_city || ""}, ${application?.college_state || ""}`,
                icon: GraduationCap,
            },
            {
                id: "college_validation",
                stepNumber: "04",
                label: "College Validation",
                title: "Institution Accreditation & Campus Charter Audit",
                isConfirmed: clubExistenceConfirmed,
                isInProgress: !clubExistenceConfirmed && application?.status !== "pending",
                statusLabel: clubExistenceConfirmed
                    ? "Confirmed Club Existence & Directory"
                    : "Verifying Campus Directory",
                statusColor: clubExistenceConfirmed ? "bg-[#a2ff86]" : "bg-[#FFE566]",
                summary: "Cross-referencing the college against national university and accreditation directories.",
                dbEvidence: `Club Name: ${application?.club_name || "N/A"} • Official College: ${application?.college_name || "N/A"}`,
                icon: ShieldCheck,
            },
            {
                id: "holding_release",
                stepNumber: "05",
                label: "Administrator Holding Final Release",
                title: "Orbix Compliance Gatekeeper & Release Lock",
                isConfirmed: isApproved,
                isInProgress: isReadyForPromotion && !isApproved,
                statusLabel: isApproved
                    ? "Access Released & Club Live"
                    : isReadyForPromotion
                    ? "Ready for Promotion (Release Pending)"
                    : "Gate Locked (Pending Investigation)",
                statusColor: isApproved ? "bg-[#a2ff86]" : (isReadyForPromotion ? "bg-[#70d6ff]" : "bg-[#FFE566]"),
                summary: "Senior Orbix reviewer gatekeeping the promotion lock and final release of the verified shield.",
                dbEvidence: `Current DB Status: [${(application?.status || "pending").toUpperCase()}] • Verified ID: ${application?.verified_club_id || "Unassigned"}`,
                icon: Lock,
            },
            {
                id: "contact_reviewed_by",
                stepNumber: "06",
                label: "College Contact Reviewed By",
                title: "Audited College Reference & Reviewer Sign-Off",
                isConfirmed: Boolean(application?.reviewed_by || application?.reviewed_at || allChecksConfirmedInDb),
                isInProgress: !application?.reviewed_by && (collegeContactConfirmed || collegeContactContacted),
                statusLabel: application?.reviewed_by
                    ? `Audited by: ${application.reviewed_by}`
                    : (allChecksConfirmedInDb ? "Checks Confirmed (Awaiting Final Stamp)" : "Awaiting Auditor Review"),
                statusColor: (application?.reviewed_by || allChecksConfirmedInDb) ? "bg-[#a2ff86]" : "bg-neutral-200",
                summary: "Verified institutional contact logged with timestamps and audit trail.",
                dbEvidence: application?.reviewed_at
                    ? `Reviewed at: ${new Date(application.reviewed_at).toLocaleDateString()}`
                    : (application?.internal_notes || "Real-time DB reactive verification audit"),
                icon: CheckCircle2,
            },
        ];
    }, [application, verifiedClub, allChecksConfirmedInDb]);

    const currentStatus = verifiedClub ? "approved" : (application?.status || "pending");
    const statusConfig = getStatusConfig(currentStatus);

    return (
        <div className="min-h-screen bg-[#FAF6EE] text-black font-sans selection:bg-black selection:text-[#a2ff86] flex flex-col relative antialiased">
            {/* Signature Orbix canvas radial dot grid */}
            <div className="fixed inset-0 bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:20px_20px] pointer-events-none -z-10 opacity-70" />

            {/* ================================================================= */}
            {/* NEO-BRUTALIST TOP NAVIGATION BAR                                  */}
            {/* ================================================================= */}
            <header className="w-full bg-white border-b-2 border-black px-4 sm:px-8 py-3.5 flex items-center justify-between sticky top-0 z-30 select-none shadow-[0px_2px_0px_#000]">
                <div className="flex items-center gap-3.5">
                    <Link
                        to="/"
                        className="flex items-center gap-2.5 group hover:opacity-85 transition-opacity"
                        title="Orbix Home"
                    >
                        <OrbixLogo className="w-8 h-8 sm:w-9 sm:h-9 text-black group-hover:scale-105 transition-transform flex-shrink-0" />
                        <span className="font-black text-xl sm:text-2xl tracking-tight text-black leading-none">
                            Orbix
                        </span>
                    </Link>

                    <span className="hidden sm:inline-block w-1 h-4 bg-black/20 rounded-full mx-1" />

                    <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FAF6EE] border-2 border-black text-xs font-black text-black shadow-[2px_2px_0px_#000]">
                        <ShieldCheck className="w-3.5 h-3.5 text-black stroke-[2.5]" />
                        <span>Club Verification Portal</span>
                    </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-3">
                    {/* View Context Page / Guidelines Drawer Button */}
                    <button
                        type="button"
                        onClick={() => setShowContextDrawer(true)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white hover:bg-[#FAF6EE] text-black text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer"
                        title="View Full Application Context & Guidelines"
                    >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Context & Guidelines</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => fetchStatus(true)}
                        disabled={refreshing || loading}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-black text-[#a2ff86] text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-neutral-900 active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer disabled:opacity-50"
                        title="Refresh live status from database"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
                        <span className="hidden sm:inline">Refresh DB</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleLogout}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#FAF6EE] hover:bg-rose-100 hover:text-rose-900 text-black text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer"
                        title="Sign out of club account"
                    >
                        <LogOut className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Sign out</span>
                    </button>
                </div>
            </header>

            {/* ================================================================= */}
            {/* MAIN CONTENT CANVAS (SPACIOUS, NEO-BRUTALIST, RESPONSIVE)         */}
            {/* ================================================================= */}
            <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 md:px-8 py-8 sm:py-12 space-y-8 sm:space-y-10">
                {/* Loading State */}
                {loading && (
                    <div className="py-20 text-center rounded-3xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-4">
                        <OrbixLoader size="md" />
                        <p className="text-xs sm:text-sm font-black text-black">
                            Fetching live club verification state from database...
                        </p>
                    </div>
                )}

                {/* Error State */}
                {!loading && error && (
                    <div className="p-8 rounded-3xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-4 text-center max-w-lg mx-auto">
                        <div className="w-12 h-12 rounded-2xl bg-rose-100 border-2 border-black shadow-[2px_2px_0px_#000] text-rose-600 flex items-center justify-center mx-auto">
                            <AlertCircle className="w-6 h-6 stroke-[2.5]" />
                        </div>
                        <h3 className="text-base font-black text-black">Unable to load database record</h3>
                        <p className="text-xs text-neutral-700 font-medium leading-relaxed">{error}</p>
                        <button
                            type="button"
                            onClick={() => fetchStatus(false)}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-black text-[#a2ff86] text-xs font-black border-2 border-black shadow-[3px_3px_0px_#000] hover:bg-neutral-900 active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer"
                        >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Retry Connection</span>
                        </button>
                    </div>
                )}

                {/* Empty State */}
                {!loading && !error && !application && !verifiedClub && (
                    <div className="p-10 sm:p-14 text-center rounded-3xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-5 max-w-lg mx-auto">
                        <div className="w-14 h-14 rounded-2xl bg-[#FFE566] border-2 border-black shadow-[3px_3px_0px_#000] text-black flex items-center justify-center mx-auto">
                            <Building2 className="w-7 h-7" />
                        </div>
                        <div className="space-y-1.5">
                            <h2 className="text-xl font-black text-black">No Club Application Found</h2>
                            <p className="text-xs text-neutral-600 font-medium leading-relaxed">
                                We could not find an active club verification application associated with this account. If you just registered, click refresh below.
                            </p>
                        </div>
                        <div className="pt-2 flex items-center justify-center gap-3">
                            <button
                                type="button"
                                onClick={() => fetchStatus(true)}
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-black text-xs font-black border-2 border-black shadow-[3px_3px_0px_#000] hover:bg-[#FAF6EE] cursor-pointer"
                            >
                                <RefreshCw className="w-3.5 h-3.5" />
                                <span>Refresh</span>
                            </button>
                            <Link
                                to="/auth/signup"
                                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-black text-[#a2ff86] text-xs font-black border-2 border-black shadow-[3px_3px_0px_#000] hover:bg-neutral-900 active:translate-x-[1px] active:translate-y-[1px] transition-all"
                            >
                                <span>Register Your Club</span>
                                <ArrowRight className="w-4 h-4" />
                            </Link>
                        </div>
                    </div>
                )}

                {/* ACTIVE APPLICATION CONTENT */}
                {!loading && !error && (application || verifiedClub) && (
                    <div className="space-y-8 sm:space-y-10">
                        {/* --------------------------------------------------------- */}
                        {/* 1. CELEBRATION BANNER FOR APPROVED CLUBS                  */}
                        {/* --------------------------------------------------------- */}
                        {(currentStatus === "approved" || verifiedClub) && (
                            <div className="p-6 sm:p-8 rounded-3xl bg-[#a2ff86] border-2 border-black shadow-[5px_5px_0px_#000] space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                                    <div className="space-y-1.5">
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black text-[#a2ff86] text-xs font-black uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_#000]">
                                            <Sparkles className="w-3.5 h-3.5" />
                                            <span>Institutional Verification Approved</span>
                                        </span>
                                        <h2 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                                            {verifiedClub?.name || application?.club_name} is Verified!
                                        </h2>
                                        <p className="text-xs sm:text-sm font-bold text-neutral-800 leading-relaxed max-w-xl">
                                            Your chapter has received the Orbix Verified Shield. You now have full sovereign access to your dedicated club management dashboard.
                                        </p>
                                    </div>

                                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => navigate("/club/dashboard")}
                                            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-black text-[#a2ff86] font-black text-xs uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_#000] hover:bg-neutral-900 active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer"
                                        >
                                            <span>Enter Club Dashboard</span>
                                            <ArrowRight className="w-4 h-4" />
                                        </button>

                                        {verifiedClub?.slug && (
                                            <a
                                                href={`/clubs/${(verifiedClub as any)?.clubUsername || verifiedClub.slug}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center justify-center gap-1.5 px-5 py-3 rounded-full bg-white text-black font-black text-xs border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#FAF6EE] transition-all"
                                            >
                                                <span>View Public Profile</span>
                                                <ExternalLink className="w-3.5 h-3.5" />
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* --------------------------------------------------------- */}
                        {/* 2. HERO STATUS BANNER (AUTHENTIC ORBIX NEO-BRUTALISM)    */}
                        {/* --------------------------------------------------------- */}
                        <div className="p-6 sm:p-8 rounded-3xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-6">
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b-2 border-black/10">
                                <div className="space-y-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${statusConfig.badgeClass}`}>
                                            <span className={`w-2 h-2 rounded-full ${statusConfig.dotClass} animate-pulse`} />
                                            <span>{statusConfig.label}</span>
                                        </span>
                                        {application?.club_category && (
                                            <span className="px-2.5 py-0.5 rounded-full bg-[#FAF6EE] text-black font-black text-[11px] border-2 border-black shadow-[1.5px_1.5px_0px_#000] uppercase">
                                                {application.club_category}
                                            </span>
                                        )}
                                    </div>

                                    <h1 className="text-2xl sm:text-3xl font-black text-black tracking-tight pt-1">
                                        {application?.club_name || verifiedClub?.name}
                                    </h1>
                                    <p className="text-xs sm:text-sm text-neutral-600 font-bold">
                                        {application?.college_name} • {application?.college_city}, {application?.college_state}, {application?.college_country}
                                    </p>
                                </div>

                                <div className="text-left sm:text-right sm:shrink-0 space-y-1">
                                    <div className="text-xs font-mono font-bold text-neutral-500">
                                        ID: {application?.id.slice(0, 8)}...
                                    </div>
                                    <div className="text-[10px] font-mono text-neutral-400">
                                        Last DB Sync: {new Date(application?.updated_at || Date.now()).toLocaleTimeString()}
                                    </div>
                                </div>
                            </div>

                            {/* Summary description & next steps */}
                            <div className="space-y-4">
                                <p className="text-xs sm:text-sm text-neutral-800 font-medium leading-relaxed">
                                    {statusConfig.description}
                                </p>

                                <div className="p-4 sm:p-5 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] space-y-1">
                                    <span className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-1.5">
                                        <Info className="w-3.5 h-3.5 text-black stroke-[2.5]" />
                                        <span>Next Steps & Expectations</span>
                                    </span>
                                    <p className="text-xs text-neutral-700 font-medium leading-relaxed">
                                        {statusConfig.nextSteps}
                                    </p>
                                </div>
                            </div>

                            {/* Security Sovereignty Notice */}
                            <div className="p-3.5 rounded-2xl bg-[#FFE566]/30 border-2 border-black shadow-[2px_2px_0px_#000] text-xs text-black font-semibold flex items-center gap-2.5">
                                <Shield className="w-4 h-4 text-black shrink-0 stroke-[2.5]" />
                                <span>
                                    <strong>Account Sovereignty:</strong> Club administrative accounts remain strictly isolated from individual developer profiles, contest histories, and personal resumes.
                                </span>
                            </div>
                        </div>

                        {/* --------------------------------------------------------- */}
                        {/* 3. EMAIL & IDENTITY VERIFICATION HUB (LIVE DB STATUS)    */}
                        {/* --------------------------------------------------------- */}
                        <div className="p-6 sm:p-8 rounded-3xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-6">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b-2 border-black/10">
                                <div>
                                    <h3 className="text-sm font-black uppercase tracking-wider text-black flex items-center gap-2">
                                        <Mail className="w-4 h-4 text-black stroke-[2.5]" />
                                        <span>Email & Identity Verification Hub</span>
                                    </h3>
                                    <p className="text-xs text-neutral-600 font-medium mt-0.5">
                                        Reflecting live database verification status for email, phone, and representative authority.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setShowContextDrawer(true)}
                                    className="inline-flex items-center gap-1 text-xs font-black text-black hover:text-neutral-700 underline cursor-pointer self-start sm:self-auto"
                                >
                                    <span>View Full General Details</span>
                                    <ArrowRight className="w-3.5 h-3.5" />
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                                {/* Account Representative Email Card */}
                                <div className="p-4 sm:p-5 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] space-y-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-600">
                                                Account Contact Email
                                            </span>
                                            <div className="font-mono font-bold text-xs text-black truncate pt-0.5">
                                                {application?.contact_email}
                                            </div>
                                        </div>

                                        {application?.is_email_verified ? (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#a2ff86] text-black border border-black text-[10px] font-black shadow-[1px_1px_0px_#000]">
                                                <Check className="w-3 h-3 stroke-[3]" />
                                                <span>Verified</span>
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#FFE566] text-black border border-black text-[10px] font-black shadow-[1px_1px_0px_#000]">
                                                <Clock className="w-3 h-3" />
                                                <span>Unverified</span>
                                            </span>
                                        )}
                                    </div>

                                    {/* Action to Verify Email if not yet verified */}
                                    {!application?.is_email_verified && (
                                        <div className="pt-2 border-t-2 border-black/10">
                                            {!isVerifyingEmail ? (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setIsVerifyingEmail(true);
                                                        handleSendVerificationCode();
                                                    }}
                                                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-black text-[#a2ff86] text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-neutral-900 transition-all cursor-pointer"
                                                >
                                                    <Send className="w-3 h-3" />
                                                    <span>Send Verification Code</span>
                                                </button>
                                            ) : (
                                                <div className="space-y-3 pt-1">
                                                    <div className="text-[11px] text-neutral-700 font-bold">
                                                        Enter 6-digit code sent to your email:
                                                    </div>
                                                    <OtpSegmentedInput
                                                        value={emailOtp}
                                                        onChange={(code) => setEmailOtp(code)}
                                                        onComplete={(code) => handleConfirmVerificationCode(code)}
                                                        disabled={isSubmittingOtp}
                                                        autoFocus
                                                    />

                                                    <div className="flex items-center justify-between text-xs pt-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => setIsVerifyingEmail(false)}
                                                            className="text-[11px] text-neutral-600 hover:text-black cursor-pointer underline font-bold"
                                                        >
                                                            Cancel
                                                        </button>

                                                        <button
                                                            type="button"
                                                            onClick={handleSendVerificationCode}
                                                            disabled={otpCooldown > 0 || isSendingOtp}
                                                            className="text-[11px] font-black text-black disabled:text-neutral-400 cursor-pointer"
                                                        >
                                                            {otpCooldown > 0 ? `Resend code in ${otpCooldown}s` : "Resend code"}
                                                        </button>
                                                    </div>

                                                    <button
                                                        type="button"
                                                        onClick={() => handleConfirmVerificationCode()}
                                                        disabled={isSubmittingOtp || emailOtp.length !== 6}
                                                        className="w-full py-2 rounded-xl bg-black text-[#a2ff86] text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-neutral-900 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                                                    >
                                                        {isSubmittingOtp ? <OrbixLoader size="xs" variant="inline" /> : "Confirm & Verify Email"}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Phone Verification Status from DB */}
                                    <div className="pt-2 border-t border-black/10 flex items-center justify-between text-[11px] font-mono">
                                        <span className="text-neutral-600 font-bold">Phone: {application?.contact_phone || "N/A"}</span>
                                        {application?.is_phone_verified ? (
                                            <span className="text-emerald-700 font-black flex items-center gap-1">
                                                <Check className="w-3 h-3 stroke-[3]" />
                                                <span>Phone Verified</span>
                                            </span>
                                        ) : (
                                            <span className="text-neutral-500 font-bold">Pending OTP</span>
                                        )}
                                    </div>
                                </div>

                                {/* Official College Domain Email Card */}
                                <div className="p-4 sm:p-5 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] space-y-2 flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-600">
                                                    Official College Domain Email
                                                </span>
                                                <div className="font-mono font-bold text-xs text-black truncate pt-0.5">
                                                    {application?.college_official_email || "No institutional email provided"}
                                                </div>
                                            </div>

                                            {application?.college_official_email ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#70d6ff] text-black border border-black text-[10px] font-black shadow-[1px_1px_0px_#000]">
                                                    <GraduationCap className="w-3 h-3" />
                                                    <span>Campus Domain</span>
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white text-neutral-500 border border-black/20 text-[10px] font-bold">
                                                    Optional
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[11px] text-neutral-600 font-medium mt-1 leading-relaxed">
                                            {application?.college_official_email
                                                ? "Used for university registrar validation and administrative outreach."
                                                : "Providing an official university domain email accelerates administrative confirmation."}
                                        </p>
                                    </div>

                                    <div className="pt-2 border-t border-black/10 flex items-center justify-between text-[11px] font-medium text-black">
                                        <span>Representative: <strong>{application?.contact_person_name}</strong></span>
                                        <span>Role: <strong>{application?.contact_person_role}</strong></span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* --------------------------------------------------------- */}
                        {/* 4. THE WELL-DEFINED TIMELINE (LIVE DB BOUND)              */}
                        {/* --------------------------------------------------------- */}
                        <div className="p-6 sm:p-8 rounded-3xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-8">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b-2 border-black/10">
                                <div>
                                    <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#FAF6EE] text-black text-xs font-black border border-black mb-1 shadow-[1px_1px_0px_#000]">
                                        <Clock className="w-3 h-3 text-black" />
                                        <span>Live Database Reactive Timeline</span>
                                    </div>
                                    <h2 className="text-xl sm:text-2xl font-black text-black tracking-tight">
                                        Club Verification Timeline
                                    </h2>
                                    <p className="text-xs sm:text-sm text-neutral-600 font-medium mt-0.5">
                                        Directly linked to database fields: college contact, club existence, and representative authority.
                                    </p>
                                </div>

                                <Link
                                    to="/docs/club-verification-protocol"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white hover:bg-[#FAF6EE] text-black text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000] transition-colors self-start sm:self-auto cursor-pointer"
                                >
                                    <span>5-Stage Protocol Specs</span>
                                    <ExternalLink className="w-3.5 h-3.5 text-black" />
                                </Link>
                            </div>

                            {/* Sequential Vertical Step Timeline */}
                            <div className="relative pl-6 sm:pl-8 space-y-6 sm:space-y-8">
                                {/* Vertical Connector Line */}
                                <div className="absolute left-[17px] sm:left-[21px] top-3 bottom-4 w-[3px] bg-black -z-0" />

                                {resolvedStages.map((stage) => {
                                    const isCompleted = stage.status === "completed";
                                    const isInProgress = stage.status === "in_progress";
                                    const isActionRequired = stage.status === "action_required";
                                    const isRejected = stage.status === "rejected";
                                    const isUpcoming = stage.status === "upcoming";

                                    return (
                                        <div key={stage.key} className="relative z-10 flex items-start gap-4 sm:gap-6 group">
                                            {/* Step Circle Indicator */}
                                            <div className="relative -ml-[25px] sm:-ml-[29px] mt-0.5 shrink-0">
                                                {isCompleted && (
                                                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#a2ff86] text-black border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000]">
                                                        <Check className="w-4 h-4 stroke-[3]" />
                                                    </div>
                                                )}
                                                {isInProgress && (
                                                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-black text-[#a2ff86] border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000]">
                                                        <span className="w-2.5 h-2.5 rounded-full bg-[#a2ff86] animate-ping" />
                                                    </div>
                                                )}
                                                {isActionRequired && (
                                                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#FFE566] text-black border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000]">
                                                        <AlertCircle className="w-4 h-4 stroke-[2.5]" />
                                                    </div>
                                                )}
                                                {isRejected && (
                                                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#ff70a6] text-black border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000]">
                                                        <XCircle className="w-4 h-4 stroke-[2.5]" />
                                                    </div>
                                                )}
                                                {isUpcoming && (
                                                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#FAF6EE] text-neutral-500 border-2 border-black/40 flex items-center justify-center shadow-[1px_1px_0px_#000]">
                                                        <span className="text-[11px] font-black font-mono">{stage.stepNum}</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Stage Content Card */}
                                            <div className={`flex-1 p-5 sm:p-6 rounded-2xl border-2 border-black transition-all ${
                                                isInProgress
                                                    ? "bg-[#FAF6EE] shadow-[3px_3px_0px_#000]"
                                                    : isActionRequired
                                                    ? "bg-[#FFE566]/20 shadow-[3px_3px_0px_#000]"
                                                    : isCompleted
                                                    ? "bg-white shadow-[2px_2px_0px_#000]"
                                                    : "bg-white/60 opacity-80 shadow-[1px_1px_0px_#000]"
                                            }`}>
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono text-xs font-black text-neutral-500">
                                                            Stage {stage.stepNum}
                                                        </span>
                                                        <span className="text-black/30 font-bold">•</span>
                                                        <span className="text-xs font-black uppercase tracking-wider text-black">
                                                            {stage.category}
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        {isCompleted && (
                                                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-[#a2ff86] text-black border border-black shadow-[1px_1px_0px_#000]">
                                                                Done
                                                            </span>
                                                        )}
                                                        {isInProgress && (
                                                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-[#70d6ff] text-black border border-black shadow-[1px_1px_0px_#000]">
                                                                Active
                                                            </span>
                                                        )}
                                                        {isActionRequired && (
                                                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-[#FFE566] text-black border border-black shadow-[1px_1px_0px_#000]">
                                                                Action Required
                                                            </span>
                                                        )}
                                                        {isUpcoming && (
                                                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#FAF6EE] text-neutral-600 border border-black/30">
                                                                Upcoming
                                                            </span>
                                                        )}

                                                        {stage.timestamp && (
                                                            <span className="text-[11px] font-mono font-bold text-neutral-500 hidden sm:inline">
                                                                {new Date(stage.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                <h3 className="text-sm sm:text-base font-black text-black">
                                                    {stage.title}
                                                </h3>
                                                <p className="text-xs sm:text-sm text-neutral-700 font-medium leading-relaxed mt-1">
                                                    {stage.message}
                                                </p>

                                                {/* SPECIAL EMBED: 6 INVESTIGATION TOUCHPOINTS BOUND TO DB FOR STAGE 3 */}
                                                {stage.key === "college_verification" && (
                                                    <div className="mt-4 pt-4 border-t-2 border-black/10 space-y-3">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs font-black uppercase tracking-wider text-black">
                                                                6-Pillar Investigation Guidelines & Live DB Status:
                                                            </span>
                                                            <span className="text-[11px] font-mono font-bold text-neutral-500">
                                                                {allChecksConfirmedInDb ? "All 4 DB Checks Confirmed" : "Real-Time Verification"}
                                                            </span>
                                                        </div>

                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                                            {dynamicTouchpoints.map((tp) => {
                                                                const TpIcon = tp.icon;
                                                                const isExpanded = expandedTouchpoint === tp.id;

                                                                return (
                                                                    <div
                                                                        key={tp.id}
                                                                        onClick={() => setExpandedTouchpoint(isExpanded ? null : tp.id)}
                                                                        className={`p-3 rounded-xl border-2 border-black text-xs transition-all cursor-pointer shadow-[2px_2px_0px_#000] ${
                                                                            tp.isConfirmed
                                                                                ? "bg-[#a2ff86]/20"
                                                                                : tp.isInProgress
                                                                                ? "bg-[#70d6ff]/20"
                                                                                : "bg-white"
                                                                        }`}
                                                                    >
                                                                        <div className="flex items-center justify-between gap-2">
                                                                            <div className="flex items-center gap-2 truncate">
                                                                                <div className="w-6 h-6 rounded-lg bg-black text-white flex items-center justify-center shrink-0">
                                                                                    <TpIcon className="w-3.5 h-3.5" />
                                                                                </div>
                                                                                <span className="font-black text-black truncate">
                                                                                    {tp.label}
                                                                                </span>
                                                                            </div>

                                                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border border-black shrink-0 ${tp.statusColor}`}>
                                                                                {tp.isConfirmed ? "✓ Confirmed" : (tp.isInProgress ? "● Active" : "○ Queued")}
                                                                            </span>
                                                                        </div>

                                                                        <div className="pt-2 text-[11px] text-neutral-600 font-medium">
                                                                            {tp.statusLabel}
                                                                        </div>

                                                                        {isExpanded && (
                                                                            <motion.div
                                                                                initial={{ opacity: 0, height: 0 }}
                                                                                animate={{ opacity: 1, height: "auto" }}
                                                                                className="pt-2 mt-2 border-t border-black/10 space-y-1.5 text-[11px] text-neutral-700 leading-relaxed"
                                                                            >
                                                                                <div className="font-black text-black">{tp.title}</div>
                                                                                <p>{tp.summary}</p>
                                                                                <div className="font-mono text-[10px] text-black bg-white p-2 rounded-lg border border-black shadow-[1px_1px_0px_#000]">
                                                                                    <strong>DB Evidence:</strong> {tp.dbEvidence}
                                                                                </div>
                                                                            </motion.div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Action Required Banner if present */}
                                                {stage.actionRequired && (
                                                    <div className="mt-3 p-3.5 bg-[#FFE566] border-2 border-black rounded-xl text-xs font-black text-black shadow-[2px_2px_0px_#000] flex items-center gap-2">
                                                        <AlertCircle className="w-4 h-4 text-black shrink-0 stroke-[2.5]" />
                                                        <span>{stage.actionRequired}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* --------------------------------------------------------- */}
                        {/* 5. BOTTOM APPLICATION CONTEXT ACCESS BAR                  */}
                        {/* --------------------------------------------------------- */}
                        <div className="p-6 sm:p-7 rounded-3xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="space-y-1">
                                <h4 className="text-sm font-black text-black">
                                    Need to review the full submitted application record or institutional guidelines?
                                </h4>
                                <p className="text-xs text-neutral-600 font-medium">
                                    All details including officer contacts, verification URLs, and accreditation standards are securely archived.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => setShowContextDrawer(true)}
                                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-full bg-black text-[#a2ff86] font-black text-xs uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_#000] hover:bg-neutral-900 active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer shrink-0"
                            >
                                <FileText className="w-3.5 h-3.5" />
                                <span>Open Application Context</span>
                            </button>
                        </div>
                    </div>
                )}
            </main>

            {/* ================================================================= */}
            {/* 6. CONTEXT PAGE / DRAWER ("HIDE THIS PAGE AND MAKE IT CONTEXT")  */}
            {/* ================================================================= */}
            <AnimatePresence>
                {showContextDrawer && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowContextDrawer(false)}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 cursor-pointer"
                        />

                        {/* Slide-over Context Panel (Orbix Neo-Brutalist Theme) */}
                        <motion.aside
                            initial={{ x: "100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "100%" }}
                            transition={{ type: "spring", damping: 30, stiffness: 300 }}
                            className="fixed top-0 right-0 bottom-0 w-full max-w-2xl bg-[#FAF6EE] z-50 border-l-2 border-black shadow-[-6px_0px_0px_#000] flex flex-col overflow-hidden"
                        >
                            {/* Drawer Header */}
                            <div className="px-6 sm:px-8 py-5 border-b-2 border-black flex items-center justify-between bg-white select-none shrink-0">
                                <div className="space-y-0.5">
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FAF6EE] text-black border border-black text-[11px] font-black shadow-[1px_1px_0px_#000]">
                                        <FileText className="w-3 h-3 text-black" />
                                        <span>Application Context & Guidelines</span>
                                    </div>
                                    <h3 className="text-base sm:text-lg font-black text-black">
                                        Submitted Club Verification Record
                                    </h3>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setShowContextDrawer(false)}
                                    className="p-2 rounded-full hover:bg-[#FAF6EE] border-2 border-black text-black transition-colors cursor-pointer shadow-[2px_2px_0px_#000]"
                                    aria-label="Close Context Panel"
                                >
                                    <X className="w-4 h-4 stroke-[2.5]" />
                                </button>
                            </div>

                            {/* Drawer Scrollable Body */}
                            <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-8">
                                {/* Section A: Organization & Institution Record */}
                                <div className="space-y-3">
                                    <h4 className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-1.5">
                                        <Building2 className="w-3.5 h-3.5" />
                                        <span>Institution & Campus Details</span>
                                    </h4>

                                    <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-3 text-xs">
                                        <div>
                                            <span className="text-[10px] uppercase font-black text-neutral-500 block">Club Name</span>
                                            <span className="font-black text-black text-sm">{application?.club_name}</span>
                                        </div>

                                        <div>
                                            <span className="text-[10px] uppercase font-black text-neutral-500 block">College / University</span>
                                            <span className="font-bold text-black">{application?.college_name}</span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 pt-1">
                                            <div>
                                                <span className="text-[10px] uppercase font-black text-neutral-500 block">Location</span>
                                                <span className="text-neutral-800 font-medium">
                                                    {application?.college_city}, {application?.college_state}, {application?.college_country}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-[10px] uppercase font-black text-neutral-500 block">Category</span>
                                                <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#FAF6EE] border border-black text-black text-[11px] font-black mt-0.5 shadow-[1px_1px_0px_#000]">
                                                    {application?.club_category}
                                                </span>
                                            </div>
                                        </div>

                                        {application?.club_description && (
                                            <div className="pt-2 border-t-2 border-black/10">
                                                <span className="text-[10px] uppercase font-black text-neutral-500 block">Description</span>
                                                <p className="text-neutral-700 font-medium leading-relaxed mt-0.5">
                                                    {application.club_description}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Section B: Representative & Contact Coordinates */}
                                <div className="space-y-3">
                                    <h4 className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-1.5">
                                        <User className="w-3.5 h-3.5" />
                                        <span>Leadership Representative & References</span>
                                    </h4>

                                    <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-3 text-xs">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <span className="text-[10px] uppercase font-black text-neutral-500 block">Representative</span>
                                                <span className="font-black text-black text-sm">{application?.contact_person_name}</span>
                                            </div>
                                            <span className="px-2.5 py-1 rounded-full bg-[#FAF6EE] text-black border border-black font-black text-[11px] shadow-[1px_1px_0px_#000]">
                                                {application?.contact_person_role}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                            <div>
                                                <span className="text-[10px] uppercase font-black text-neutral-500 block">Personal Email</span>
                                                <span className="font-mono text-black font-bold">{application?.contact_email}</span>
                                            </div>
                                            <div>
                                                <span className="text-[10px] uppercase font-black text-neutral-500 block">Official College Email</span>
                                                <span className="font-mono text-black font-bold">{application?.college_official_email || "None provided"}</span>
                                            </div>
                                        </div>

                                        {application?.contact_phone && (
                                            <div>
                                                <span className="text-[10px] uppercase font-black text-neutral-500 block">Phone</span>
                                                <span className="font-mono text-black font-bold">{application.contact_phone}</span>
                                            </div>
                                        )}

                                        {/* Digital References */}
                                        <div className="pt-2 border-t-2 border-black/10 space-y-1.5">
                                            <span className="text-[10px] uppercase font-black text-neutral-500 block">Verification Links</span>
                                            <div className="space-y-1">
                                                {application?.college_website_url && (
                                                    <a href={application.college_website_url} target="_blank" rel="noopener noreferrer" className="text-black hover:underline block truncate font-bold">
                                                        College: {application.college_website_url}
                                                    </a>
                                                )}
                                                {application?.club_website_url && (
                                                    <a href={application.club_website_url} target="_blank" rel="noopener noreferrer" className="text-black hover:underline block truncate font-bold">
                                                        Club: {application.club_website_url}
                                                    </a>
                                                )}
                                                {application?.club_social_url && (
                                                    <a href={application.club_social_url} target="_blank" rel="noopener noreferrer" className="text-black hover:underline block truncate font-bold">
                                                        Social: {application.club_social_url}
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Section C: The 6 Investigation Guidelines Detailed */}
                                <div className="space-y-3">
                                    <h4 className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-1.5">
                                        <ShieldCheck className="w-3.5 h-3.5" />
                                        <span>Orbix Investigation Protocol & Operational Guidelines</span>
                                    </h4>

                                    <div className="space-y-2.5">
                                        {dynamicTouchpoints.map((tp) => {
                                            const TpIcon = tp.icon;
                                            return (
                                                <div key={tp.id} className="p-3.5 rounded-xl border-2 border-black bg-white shadow-[2px_2px_0px_#000] space-y-1 text-xs">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-mono text-[10px] font-black text-neutral-500">{tp.stepNumber}</span>
                                                            <TpIcon className="w-3.5 h-3.5 text-black" />
                                                            <span className="font-black text-black">{tp.label}</span>
                                                        </div>
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border border-black ${tp.statusColor}`}>
                                                            {tp.isConfirmed ? "Confirmed" : (tp.isInProgress ? "Active" : "Queued")}
                                                        </span>
                                                    </div>
                                                    <p className="text-[11px] text-neutral-700 font-medium pl-6 leading-relaxed">
                                                        {tp.summary}
                                                    </p>
                                                    <div className="ml-6 font-mono text-[10px] text-neutral-600 bg-[#FAF6EE] p-1.5 rounded-lg border border-black/20">
                                                        <strong>DB Status:</strong> {tp.dbEvidence}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Section D: Timestamps & Legal Records */}
                                {application?.submitted_at && (
                                    <div className="pt-4 border-t-2 border-black/10 flex items-center justify-between text-[11px] font-mono text-neutral-500 font-bold">
                                        <span>Submitted: {new Date(application.submitted_at).toLocaleDateString()}</span>
                                        <span>Updated: {new Date(application.updated_at).toLocaleDateString()}</span>
                                    </div>
                                )}
                            </div>

                            {/* Drawer Footer */}
                            <div className="p-4 sm:p-6 border-t-2 border-black bg-white flex items-center justify-end">
                                <button
                                    type="button"
                                    onClick={() => setShowContextDrawer(false)}
                                    className="px-6 py-2.5 rounded-full bg-black text-[#a2ff86] text-xs font-black uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_#000] hover:bg-neutral-900 active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer"
                                >
                                    Close Context
                                </button>
                            </div>
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
