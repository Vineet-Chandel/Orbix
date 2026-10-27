import React from "react";
import { DEFAULT_AVATAR_URL } from "../../utils/avatarConstants";
import {
    ArrowLeft,
    BadgeCheck,
    KeyRound,
    UserCog,
    ChevronRight,
    CheckCircle2,
    Lock,
    Globe,
} from "lucide-react";
import type { SettingsViewKey } from "./types";

interface AccountCenterViewProps {
    user: any;
    isPublic: boolean;
    onSelectView: (view: SettingsViewKey) => void;
    onBack: () => void;
}

export const AccountCenterView: React.FC<AccountCenterViewProps> = ({
    user,
    isPublic,
    onSelectView,
    onBack,
}) => {
    const displayName = user?.firstName
        ? `${user.firstName} ${user.lastName || ""}`.trim()
        : user?.username || "Developer";

    const accountCenterItems = [
        {
            id: "verify-account" as SettingsViewKey,
            title: "Verify Account",
            description: "Verify your email via Resend OTP, confirm collegiate enrollment & unlock the verified student coder badge.",
            icon: <BadgeCheck className="w-5 h-5 text-black stroke-[2.5]" />,
            iconBg: "bg-[#FFE566]",
            badge: (user?.isEmailVerified || user?.isVerified) ? "Verified" : "Pending Verification",
            badgeStyle: (user?.isEmailVerified || user?.isVerified) ? "bg-[#a2ff86] text-black" : "bg-amber-100 text-amber-900 border border-amber-300",
        },
        {
            id: "account-privacy" as SettingsViewKey,
            title: "Account & Privacy",
            description: "Control public profile visibility, recruiter contact permissions, resume access & field matrix.",
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
            id: "password-security" as SettingsViewKey,
            title: "Password and Security",
            description: "Change account password, manage 2-factor authentication & inspect active device sessions.",
            icon: <KeyRound className="w-5 h-5 text-black stroke-[2.5]" />,
            iconBg: "bg-sky-200",
            badge: "Protected",
            badgeStyle: "bg-neutral-100 text-neutral-800 border border-neutral-300",
        },
        {
            id: "manage-account" as SettingsViewKey,
            title: "Manage Account",
            description: "Update primary contact email, download personal GDPR data archive & account deactivation.",
            icon: <UserCog className="w-5 h-5 text-black stroke-[2.5]" />,
            iconBg: "bg-purple-200",
            badge: "Account Owner",
            badgeStyle: "bg-purple-100 text-purple-900 border border-purple-300",
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
                    <img
                        src={user?.photoUrl || user?.avatarUrl || DEFAULT_AVATAR_URL}
                        alt={displayName}
                        className="w-14 h-14 rounded-full border-2 border-black object-cover shadow-[2px_2px_0px_#000] bg-[#FFE566] shrink-0"
                        onError={(e) => {
                            (e.target as HTMLImageElement).src = DEFAULT_AVATAR_URL;
                        }}
                    />
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-lg font-black text-black leading-tight">
                                {displayName}
                            </h3>
                            <span className="text-xs font-mono font-bold text-neutral-600">
                                @{user?.username}
                            </span>
                        </div>
                        <p className="text-xs font-medium text-neutral-600">
                            {user?.gmail || user?.email || "Connected with Google / Email"}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#a2ff86] text-black text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000]">
                        <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Active Account</span>
                    </span>
                </div>
            </div>

            {/* Account Center Options List */}
            <div className="space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-neutral-600 pl-1">
                    Account Controls & Security
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
                                        <h4 className="text-sm sm:text-base font-black text-black group-hover:text-black">
                                            {item.title}
                                        </h4>
                                        {item.badge && (
                                            <span
                                                className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border border-black/40 ${item.badgeStyle}`}
                                            >
                                                {item.badge}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-neutral-600 font-medium leading-relaxed truncate sm:whitespace-normal">
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
