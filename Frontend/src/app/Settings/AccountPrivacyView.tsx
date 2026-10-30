import React from "react";
import { Link } from "react-router-dom";
import {
    Shield,
    Lock,
    Globe,
    Check,
    X,
    EyeOff,
    Share2,
    Layers,
    ExternalLink,
    User,
    GraduationCap,
    ArrowRight,
    Loader2,
    ArrowLeft,
} from "lucide-react";
import { NeoToggle } from "../../components/NeoToggle";

interface AccountPrivacyViewProps {
    user: any;
    isPublic: boolean;
    isUpdating: boolean;
    onTogglePrivacy: (newIsPublic: boolean) => Promise<void>;
    onBack?: () => void;
}

export const AccountPrivacyView: React.FC<AccountPrivacyViewProps> = ({
    user,
    isPublic,
    isUpdating,
    onTogglePrivacy,
    onBack,
}) => {
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
        <div className="space-y-6 animate-fadeIn">
            {/* Header / Subview Navigation */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b-2 border-black/15">
                <div className="flex items-center gap-3">
                    {onBack && (
                        <button
                            type="button"
                            onClick={onBack}
                            className="p-2 rounded-xl bg-white hover:bg-neutral-100 text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[1px_1px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] transition-all cursor-pointer shrink-0"
                            aria-label="Back to Settings Hub"
                            title="Back to Settings"
                        >
                            <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
                        </button>
                    )}
                    <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] font-black uppercase tracking-wider text-neutral-500">
                                Account Center
                            </span>
                            <span className="text-neutral-400">•</span>
                            <span className="text-[11px] font-black uppercase tracking-wider text-black">
                                Privacy Controls
                            </span>
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                            Account & Privacy
                        </h2>
                    </div>
                </div>
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
                                <h3 className="text-xl sm:text-2xl font-black text-black tracking-tight">
                                    Public Profile Showcase
                                </h3>
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
                    <NeoToggle
                        checked={isPublic}
                        disabled={isUpdating}
                        onChange={onTogglePrivacy}
                        onIcon={<Globe className="w-3.5 h-3.5 text-black stroke-[3]" />}
                        offIcon={<Lock className="w-3.5 h-3.5 text-neutral-700 stroke-[3]" />}
                        onStatusText="Status: Public"
                        offStatusText="Status: Private"
                        ariaLabel="Toggle profile public or private visibility"
                    />
                </div>

                {/* ========================================================================= */}
                {/* FEATURE AVAILABILITY MATRIX                                              */}
                {/* ========================================================================= */}
                <div className="space-y-4 pt-2">
                    <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-black stroke-[2.5]" />
                        <h4 className="text-sm font-black text-black uppercase tracking-wider">
                            Feature & Field Visibility Matrix
                        </h4>
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
    );
};
