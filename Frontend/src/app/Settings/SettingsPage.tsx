import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
    Settings,
    Shield,
    Lock,
    Globe,
    Check,
    X,
    Eye,
    EyeOff,
    Share2,
    Layers,
    ExternalLink,
    User,
    GraduationCap,
    ArrowRight,
    Loader2,
    Menu,
} from "lucide-react";
import { useAppDispatch, useAppSelector, updateUserProfile } from "../../store";
import { useToast } from "../../context/ToastContext";
import { updateProfile } from "../../utils/profileApi";
import { Sidebar } from "../Dashboard/Sidebar";
import { SectionBottomIllustration } from "../common/SectionBottomIllustration";

export default function SettingsPage() {
    const dispatch = useAppDispatch();
    const toast = useToast();
    const { user } = useAppSelector((state) => state.user);

    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);

    // Controlled public profile state directly from user
    const [isPublic, setIsPublic] = useState<boolean>(() => {
        return user?.isPublic !== false;
    });

    // Synchronize local state if user changes in Redux
    useEffect(() => {
        if (user) {
            setIsPublic(user.isPublic !== false);
        }
    }, [user?.isPublic]);

    // Handle instant zero-lag privacy toggle
    const handleTogglePrivacy = async (newIsPublic: boolean) => {
        if (isUpdating) return;

        // 1. Synchronously update local and Redux state immediately (ZERO LAG)
        setIsPublic(newIsPublic);

        if (!newIsPublic) {
            // Turning Private: automatically cascades hire, resume, and open-to-work to false
            dispatch(
                updateUserProfile({
                    isPublic: false,
                    isHireable: false,
                    isOpenToWork: false,
                    isResumePublic: false,
                })
            );
        } else {
            // Turning Public
            dispatch(
                updateUserProfile({
                    isPublic: true,
                })
            );
        }

        // 2. Persist to backend database via PUT /api/profile
        setIsUpdating(true);
        try {
            const payload: any = {
                isPublic: newIsPublic,
            };

            if (!newIsPublic) {
                payload.isHireable = false;
                payload.isOpenToWork = false;
            }

            const updatedUser = await updateProfile(payload);

            if (updatedUser) {
                dispatch(updateUserProfile(updatedUser));
            }

            if (!newIsPublic) {
                toast.success(
                    "Hire, resume, and open to work buttons have been automatically disabled.",
                    { title: "Profile is now Private" }
                );
            } else {
                toast.success(
                    "Your developer showcase and platform analytics are visible to the public.",
                    { title: "Profile is now Public" }
                );
            }
        } catch (err: any) {
            console.error("Failed to update profile privacy:", err);
            // Revert state if request failed
            setIsPublic(!newIsPublic);
            dispatch(
                updateUserProfile({
                    isPublic: !newIsPublic,
                })
            );
            toast.error(
                err?.message || "Could not save your privacy preferences. Please try again.",
                { title: "Failed to update privacy" }
            );
        } finally {
            setIsUpdating(false);
        }
    };

    const displayName = user?.firstName
        ? `${user.firstName} ${user.lastName || ""}`.trim()
        : user?.username || "Developer";

    const formattedJoinDate = user?.createdAt
        ? new Date(user.createdAt).toLocaleDateString("en-US", {
              month: "short",
              year: "numeric",
          })
        : "Recent";

    return (
        <div className="flex h-screen bg-white text-neutral-900 overflow-hidden font-sans">
            {/* Desktop & Mobile Collapsible Navigation Sidebar */}
            <Sidebar
                activeTab="settings"
                isOpen={isMobileSidebarOpen}
                onClose={() => setIsMobileSidebarOpen(false)}
            />

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col h-full min-h-0 overflow-y-auto min-w-0 p-2 sm:p-3 lg:py-3 lg:pr-3 lg:pl-2">
                <section
                    aria-label="Account Settings & Privacy Controls"
                    className="flex-1 w-full min-h-0 bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:18px_18px] rounded-2xl border-2 border-black shadow-[6px_6px_0px_#000] overflow-y-auto scrollbar-none flex flex-col justify-between"
                >
                    <div className="p-4 sm:p-6 lg:p-8 flex-1 space-y-6 max-w-6xl w-full mx-auto">
                        {/* Header Bar */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b-2 border-black/15">
                            <div className="flex items-start gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsMobileSidebarOpen(true)}
                                    className="lg:hidden mt-0.5 p-2 text-black hover:bg-neutral-100 rounded-lg border-2 border-black shadow-[2px_2px_0px_#000] transition-all cursor-pointer shrink-0"
                                    aria-label="Open sidebar"
                                >
                                    <Menu className="w-5 h-5 stroke-[2.5]" />
                                </button>
                                <div className="space-y-1">
                                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FFE566] border-2 border-black text-black font-black text-xs shadow-[2px_2px_0px_#000] uppercase tracking-wider">
                                        <Settings className="w-3.5 h-3.5 stroke-[2.5]" />
                                        <span>Account & Privacy Controls</span>
                                    </div>
                                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-black tracking-tight pt-1">
                                        Settings & Privacy
                                    </h1>
                                    <p className="text-xs sm:text-sm text-neutral-600 font-bold max-w-xl">
                                        Configure whether your developer profile is public or private, control platform analytics sharing, and manage your account preferences.
                                    </p>
                                </div>
                            </div>

                            {/* Top Action Pill */}
                            {user?.username && (
                                <Link
                                    to={`/profile/u/${encodeURIComponent(user.username)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-[#FAF6EE] border-2 border-black text-black font-black text-xs shadow-[3px_3px_0px_#000] hover:shadow-[4px_4px_0px_#000] hover:-translate-y-0.5 active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer self-start sm:self-auto shrink-0"
                                >
                                    <Eye className="w-4 h-4 stroke-[2.5]" />
                                    <span>Preview Public Showcase</span>
                                    <ExternalLink className="w-3.5 h-3.5" />
                                </Link>
                            )}
                        </div>

                    {/* ========================================================================= */}
                    {/* SECTION 1: PROFILE VISIBILITY & PRIVACY (CORE TOGGLE)                     */}
                    {/* ========================================================================= */}
                    <section className="rounded-3xl bg-white border-2 sm:border-[3px] border-black p-6 sm:p-8 shadow-[6px_6px_0px_#000] space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 pb-6 border-b-2 border-black/10">
                            <div className="flex items-start gap-4">
                                <div
                                    className={`p-3.5 rounded-2xl border-2 border-black shadow-[3px_3px_0px_#000] shrink-0 transition-colors ${
                                        isPublic ? "bg-[#a2ff86]" : "bg-[#FFE566]"
                                    }`}
                                >
                                    {isPublic ? (
                                        <Globe className="w-6 h-6 text-black stroke-[2.5]" />
                                    ) : (
                                        <Lock className="w-6 h-6 text-black stroke-[2.5]" />
                                    )}
                                </div>
                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-2.5 flex-wrap">
                                        <h2 className="text-xl sm:text-2xl font-black text-black tracking-tight">
                                            Public Profile Showcase
                                        </h2>
                                        <span
                                            className={`px-3 py-0.5 rounded-full text-xs font-black border-2 border-black shadow-[1.5px_1.5px_0px_#000] uppercase tracking-wider ${
                                                isPublic
                                                    ? "bg-[#a2ff86] text-black"
                                                    : "bg-black text-white"
                                            }`}
                                        >
                                            {isPublic ? "Public Mode" : "Private Mode"}
                                        </span>
                                        {isUpdating && (
                                            <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-neutral-500">
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                Syncing...
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs sm:text-sm text-neutral-600 font-medium leading-relaxed max-w-2xl">
                                        {isPublic
                                            ? "Your profile is fully public. Visitors can inspect your coding platforms, submissions, contest ratings, view your resume, send hire inquiries, and share your Orbix developer card."
                                            : "Your profile is private. Visitors can ONLY view your name, headline, bio, location, college, links (max 4), and skills. Hire button, resume access, open to work status, platform analytics, and public card sharing are automatically turned off."}
                                    </p>
                                </div>
                            </div>

                            {/* Neo-brutalist Interactive Toggle Switch (Zero Lag) */}
                            <div className="flex flex-col items-start sm:items-end gap-2 shrink-0">
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={isPublic}
                                    disabled={isUpdating}
                                    onClick={() => handleTogglePrivacy(!isPublic)}
                                    className={`relative w-20 h-11 rounded-full border-[3px] border-black shadow-[3px_3px_0px_#000] transition-colors p-1 cursor-pointer focus:outline-none ${
                                        isPublic ? "bg-[#a2ff86]" : "bg-neutral-200"
                                    }`}
                                >
                                    <motion.div
                                        animate={{ x: isPublic ? 36 : 0 }}
                                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                        className="w-7 h-7 rounded-full bg-white border-2 border-black shadow-[1px_1px_0px_#000] flex items-center justify-center"
                                    >
                                        {isPublic ? (
                                            <Globe className="w-3.5 h-3.5 text-black stroke-[3]" />
                                        ) : (
                                            <Lock className="w-3.5 h-3.5 text-neutral-700 stroke-[3]" />
                                        )}
                                    </motion.div>
                                </button>
                                <span className="text-[11px] font-mono font-bold text-neutral-600">
                                    {isPublic ? "Status: Public" : "Status: Private"}
                                </span>
                            </div>
                        </div>

                        {/* ========================================================================= */}
                        {/* FEATURE AVAILABILITY MATRIX (EXACT USER SPECIFICATION)                    */}
                        {/* ========================================================================= */}
                        <div className="space-y-4 pt-2">
                            <div className="flex items-center gap-2">
                                <Shield className="w-4 h-4 text-black stroke-[2.5]" />
                                <h3 className="text-sm font-black text-black uppercase tracking-wider">
                                    Feature & Field Visibility Matrix
                                </h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Always Visible (Both Public & Private) */}
                                <div className="rounded-2xl bg-[#FAF6EE] border-2 border-black p-5 shadow-[3px_3px_0px_#000] space-y-3">
                                    <div className="flex items-center justify-between pb-2 border-b-2 border-black/15">
                                        <div className="flex items-center gap-2">
                                            <Check className="w-4 h-4 text-[#008f39] stroke-[3]" />
                                            <span className="font-black text-xs text-black uppercase tracking-wide">
                                                Visible in Both (Public & Private)
                                            </span>
                                        </div>
                                        <span className="px-2 py-0.5 rounded bg-black/5 text-[10px] font-mono font-bold">
                                            7 Permitted Fields
                                        </span>
                                    </div>
                                    <ul className="space-y-2 text-xs font-bold text-neutral-800">
                                        <li className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-black shrink-0" />
                                            <span>First name & Last name</span>
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-black shrink-0" />
                                            <span>Professional Headline</span>
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-black shrink-0" />
                                            <span>Biography</span>
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-black shrink-0" />
                                            <span>Location</span>
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-black shrink-0" />
                                            <span>College (Verified Institution)</span>
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-black shrink-0" />
                                            <span>External Links (Max 4 Links)</span>
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-black shrink-0" />
                                            <span>Skills & Technologies</span>
                                        </li>
                                    </ul>
                                </div>

                                {/* Hidden in Private Mode */}
                                <div className="rounded-2xl bg-[#FAF6EE] border-2 border-black p-5 shadow-[3px_3px_0px_#000] space-y-3">
                                    <div className="flex items-center justify-between pb-2 border-b-2 border-black/15">
                                        <div className="flex items-center gap-2">
                                            <EyeOff className="w-4 h-4 text-rose-600 stroke-[2.5]" />
                                            <span className="font-black text-xs text-black uppercase tracking-wide">
                                                Automatically Disabled When Private
                                            </span>
                                        </div>
                                        <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300 text-[10px] font-mono font-bold">
                                            Protected
                                        </span>
                                    </div>
                                    <ul className="space-y-2 text-xs font-bold text-neutral-800">
                                        <li className="flex items-center gap-2">
                                            <X className="w-3.5 h-3.5 text-rose-600 stroke-[3] shrink-0" />
                                            <span>Hire Button & Recruiter Inquiries</span>
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <X className="w-3.5 h-3.5 text-rose-600 stroke-[3] shrink-0" />
                                            <span>Resume View & PDF Download</span>
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <X className="w-3.5 h-3.5 text-rose-600 stroke-[3] shrink-0" />
                                            <span>Open to Work Candidate Badge</span>
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <X className="w-3.5 h-3.5 text-rose-600 stroke-[3] shrink-0" />
                                            <span>Connected Platform Analytics (LeetCode, GitHub, etc.)</span>
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <X className="w-3.5 h-3.5 text-rose-600 stroke-[3] shrink-0" />
                                            <span>Public Card Sharing (Visitors cannot access your card)</span>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        {/* Card Ownership Notice */}
                        <div className="rounded-2xl bg-amber-50 border-2 border-black p-4 shadow-[2px_2px_0px_#000] flex items-start gap-3">
                            <Share2 className="w-4 h-4 text-amber-900 shrink-0 mt-0.5 stroke-[2.5]" />
                            <div className="text-xs text-amber-950 font-bold leading-relaxed space-y-1">
                                <p className="font-black text-black">
                                    Card Sharing in Private Profiles:
                                </p>
                                <p>
                                    As the profile owner, you always maintain full access to generate, preview, and download your LinkedIn Story and Instagram Story cards in Card Studio. However, external visitors on the website will not be able to view, share, or access your cards while your profile is in Private mode.
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* ========================================================================= */}
                    {/* SECTION 2: ACCOUNT OVERVIEW & QUICK ACTIONS                               */}
                    {/* ========================================================================= */}
                    <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Profile Info Card */}
                        <div className="rounded-3xl bg-white border-2 sm:border-[3px] border-black p-6 shadow-[5px_5px_0px_#000] space-y-4 flex flex-col justify-between">
                            <div className="space-y-3">
                                <div className="p-2.5 rounded-xl bg-[#FFE566] border-2 border-black shadow-[2px_2px_0px_#000] w-fit">
                                    <User className="w-5 h-5 text-black stroke-[2.5]" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-black">Developer Identity</h3>
                                    <p className="text-xs text-neutral-600 font-bold mt-0.5">
                                        Your primary name, username, and bio details.
                                    </p>
                                </div>
                                <div className="space-y-1.5 pt-1 text-xs font-bold text-neutral-700">
                                    <div className="flex items-center justify-between">
                                        <span className="text-neutral-500">Name:</span>
                                        <span className="font-black text-black">{displayName}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-neutral-500">Username:</span>
                                        <span className="font-mono font-bold text-black">@{user?.username}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-neutral-500">Joined:</span>
                                        <span>{formattedJoinDate}</span>
                                    </div>
                                </div>
                            </div>

                            <Link
                                to="/profile"
                                className="inline-flex items-center justify-center gap-1.5 w-full py-2.5 px-4 rounded-xl bg-black text-[#a2ff86] hover:bg-neutral-900 font-black text-xs border-2 border-black shadow-[2px_2px_0px_#000] transition-all cursor-pointer"
                            >
                                <span>Edit Profile Details</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
                        </div>

                        {/* Connected Platforms Card */}
                        <div className="rounded-3xl bg-white border-2 sm:border-[3px] border-black p-6 shadow-[5px_5px_0px_#000] space-y-4 flex flex-col justify-between">
                            <div className="space-y-3">
                                <div className="p-2.5 rounded-xl bg-[#a2ff86] border-2 border-black shadow-[2px_2px_0px_#000] w-fit">
                                    <Layers className="w-5 h-5 text-black stroke-[2.5]" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-black">Platform Integrations</h3>
                                    <p className="text-xs text-neutral-600 font-bold mt-0.5">
                                        Sync coding platforms & competitive trackers.
                                    </p>
                                </div>
                                <div className="space-y-1.5 pt-1 text-xs font-bold text-neutral-700">
                                    <div className="flex items-center justify-between">
                                        <span className="text-neutral-500">Connected:</span>
                                        <span className="font-black text-black">
                                            {user?.platforms?.length || 0} Platforms
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-neutral-500">Sync Status:</span>
                                        <span className="font-bold text-[#008f39]">Active & Verified</span>
                                    </div>
                                </div>
                            </div>

                            <Link
                                to="/onboarding"
                                className="inline-flex items-center justify-center gap-1.5 w-full py-2.5 px-4 rounded-xl bg-white hover:bg-[#FAF6EE] text-black font-black text-xs border-2 border-black shadow-[2px_2px_0px_#000] transition-all cursor-pointer"
                            >
                                <span>Manage Connected Portals</span>
                                <ExternalLink className="w-3.5 h-3.5" />
                            </Link>
                        </div>

                        {/* Verified College Card */}
                        <div className="rounded-3xl bg-white border-2 sm:border-[3px] border-black p-6 shadow-[5px_5px_0px_#000] space-y-4 flex flex-col justify-between">
                            <div className="space-y-3">
                                <div className="p-2.5 rounded-xl bg-sky-200 border-2 border-black shadow-[2px_2px_0px_#000] w-fit">
                                    <GraduationCap className="w-5 h-5 text-black stroke-[2.5]" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-black">College Affiliation</h3>
                                    <p className="text-xs text-neutral-600 font-bold mt-0.5">
                                        Verified campus leaderboard directory.
                                    </p>
                                </div>
                                <div className="space-y-1 pt-1 text-xs font-bold text-neutral-700">
                                    <p className="font-black text-black truncate">
                                        {user?.college?.officialName || "No college linked"}
                                    </p>
                                    <p className="text-[11px] text-neutral-500 font-medium">
                                        {user?.college?.city && user?.college?.state
                                            ? `${user.college.city}, ${user.college.state}`
                                            : "Link your verified college in profile manager"}
                                    </p>
                                </div>
                            </div>

                            <Link
                                to="/profile"
                                className="inline-flex items-center justify-center gap-1.5 w-full py-2.5 px-4 rounded-xl bg-white hover:bg-[#FAF6EE] text-black font-black text-xs border-2 border-black shadow-[2px_2px_0px_#000] transition-all cursor-pointer"
                            >
                                <span>Change College</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
                        </div>
                    </section>
                </div>

                {/* Bottom Full-Width Desk Illustration (Matching all app sections) */}
                <SectionBottomIllustration alt="Settings workspace illustration" />
            </section>
        </div>
    </div>
    );
}
