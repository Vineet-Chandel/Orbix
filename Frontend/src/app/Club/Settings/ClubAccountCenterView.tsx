import React from "react";
import {
    ArrowLeft,
    BadgeCheck,
    KeyRound,
    UserCog,
    ChevronRight,
    CheckCircle2,
    Lock,
    Globe,
    GraduationCap,
    Activity,
} from "lucide-react";
import type { ClubSettingsViewKey } from "./types";

interface ClubAccountCenterViewProps {
    club: {
        id: string;
        name: string;
        slug: string;
        college_name: string;
        logo_url: string | null;
        public_email?: string | null;
    };
    user: any;
    isPublic: boolean;
    onSelectView: (view: ClubSettingsViewKey) => void;
    onBack: () => void;
}

export const ClubAccountCenterView: React.FC<ClubAccountCenterViewProps> = ({
    club,
    user,
    isPublic,
    onSelectView,
    onBack,
}) => {
    const isEmailVerified = Boolean(user?.isEmailVerified);

    const accountCenterItems = [
        {
            id: "verify-account" as ClubSettingsViewKey,
            title: "Verify Account",
            description: "Official collegiate accreditation, university recognition status & verified student organization badge.",
            icon: <BadgeCheck className="w-5 h-5 text-black stroke-[2.5]" />,
            iconBg: "bg-[#FFE566]",
            badge: isEmailVerified ? "Verified Organization" : "Pending Email Verification",
            badgeStyle: isEmailVerified ? "bg-[#a2ff86] text-black" : "bg-amber-100 text-amber-900 border border-amber-300",
        },
        {
            id: "account-privacy" as ClubSettingsViewKey,
            title: "Account & Privacy",
            description: "Control public club showcase visibility, prospective student discoverability, event listings & member directory.",
            icon: isPublic ? (
                <Globe className="w-5 h-5 text-black stroke-[2.5]" />
            ) : (
                <Lock className="w-5 h-5 text-black stroke-[2.5]" />
            ),
            iconBg: isPublic ? "bg-[#a2ff86]" : "bg-[#FFE566]",
            badge: isPublic ? "Public Mode" : "Private Mode",
            badgeStyle: isPublic ? "bg-[#a2ff86] text-black" : "bg-black text-white",
        },
        {
            id: "password-security" as ClubSettingsViewKey,
            title: "Password and Security",
            description: "Change club administrative password, manage 2-factor authentication & inspect active device sessions.",
            icon: <KeyRound className="w-5 h-5 text-black stroke-[2.5]" />,
            iconBg: "bg-sky-200",
            badge: "Protected",
            badgeStyle: "bg-neutral-100 text-neutral-800 border border-neutral-300",
        },
        {
            id: "manage-account" as ClubSettingsViewKey,
            title: "Manage Account",
            description: "Primary email address, username management (with monthly quotas), and data archive export.",
            icon: <UserCog className="w-5 h-5 text-black stroke-[2.5]" />,
            iconBg: "bg-purple-200",
            badge: "Manage & Verify",
            badgeStyle: "bg-purple-100 text-purple-900 border border-purple-300",
        },
        {
            id: "your-activity" as ClubSettingsViewKey,
            title: "Team Access & Activity",
            description: "Audit log of team member logins, administrative sessions, and collegiate workspace actions.",
            icon: <Activity className="w-5 h-5 text-black stroke-[2.5]" />,
            iconBg: "bg-[#a2ff86]",
            badge: "Active Audit",
            badgeStyle: "bg-emerald-100 text-emerald-800 border border-emerald-300",
        },
    ];

    return (
        <div className="space-y-6 animate-fadeIn">
            {/* Header */}
            <div className="flex items-center gap-3 pb-4 border-b-2 border-black/15">
                <button
                    type="button"
                    onClick={onBack}
                    className="p-2 rounded-xl bg-white hover:bg-neutral-100 text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[1px_1px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] transition-all cursor-pointer shrink-0"
                    aria-label="Back to Settings Hub"
                    title="Back to Settings"
                >
                    <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
                </button>
                <div className="space-y-0.5">
                    <span className="text-[11px] font-black uppercase tracking-wider text-neutral-500">
                        Settings
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                        Account Center
                    </h2>
                </div>
            </div>

            {/* Profile Hero Overview Card */}
            <div className="p-5 sm:p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl border-2 border-black object-cover shadow-[2px_2px_0px_#000] bg-[#FAF6EE] flex items-center justify-center font-black text-black overflow-hidden shrink-0">
                        {club.logo_url ? (
                            <img
                                src={club.logo_url}
                                alt={club.name}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <span className="text-lg font-black">
                                {club.name.slice(0, 2).toUpperCase()}
                            </span>
                        )}
                    </div>
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-lg font-black text-black leading-tight">
                                {club.name}
                            </h3>
                            <span className="text-xs font-mono font-bold text-neutral-600">
                                @{club.slug}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-medium text-neutral-600 flex-wrap">
                            <span className="flex items-center gap-1">
                                <GraduationCap className="w-3.5 h-3.5 text-neutral-500" />
                                {club.college_name}
                            </span>
                            <span>•</span>
                            <span>{user?.gmail || club.public_email || "Organization Email"}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#a2ff86] text-black text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000]">
                        <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Active Verified Club</span>
                    </span>
                </div>
            </div>

            {/* Account Center Options List */}
            <div className="space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-neutral-600 pl-1">
                    Organization Controls & Security
                </h3>

                <div className="grid grid-cols-1 gap-3.5">
                    {accountCenterItems.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => onSelectView(item.id)}
                            className="w-full text-left p-4 sm:p-5 rounded-2xl bg-white hover:bg-[#FAF6EE] border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-[5px_5px_0px_#000] hover:-translate-y-0.5 active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer flex items-center justify-between gap-4 group"
                        >
                            <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                                <div
                                    className={`w-11 h-11 rounded-xl border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000] shrink-0 ${item.iconBg}`}
                                >
                                    {item.icon}
                                </div>
                                <div className="space-y-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <p className="text-sm sm:text-base font-black text-black group-hover:text-black">
                                            {item.title}
                                        </p>
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${item.badgeStyle}`}>
                                            {item.badge}
                                        </span>
                                    </div>
                                    <p className="text-xs text-neutral-600 font-medium leading-relaxed">
                                        {item.description}
                                    </p>
                                </div>
                            </div>

                            <div className="w-8 h-8 rounded-lg bg-neutral-100 group-hover:bg-[#FFE566] border border-black flex items-center justify-center shrink-0 transition-colors shadow-[1px_1px_0px_#000]">
                                <ChevronRight className="w-4 h-4 text-black stroke-[2.5] group-hover:translate-x-0.5 transition-transform" />
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};
