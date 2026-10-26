import React, { useState } from "react";
import { DEFAULT_AVATAR_URL } from "../../utils/avatarConstants";
import {
    BadgeCheck,
    KeyRound,
    UserCog,
    Bookmark,
    Activity,
    Bell,
    Users,
    UserX,
    MessageSquare,
    HelpCircle,
    ShieldCheck,
    CheckCircle2,
    Info,
    LogOut,
    ChevronRight,
    Search,
    User,
    Lock,
    Globe,
} from "lucide-react";
import type { SettingsViewKey } from "./types";

interface SettingsHubProps {
    user: any;
    isPublic: boolean;
    onSelectView: (view: SettingsViewKey) => void;
    onRequestLogout: () => void;
}

export const SettingsHub: React.FC<SettingsHubProps> = ({
    user,
    isPublic,
    onSelectView,
    onRequestLogout,
}) => {
    const [searchQuery, setSearchQuery] = useState("");

    const displayName = user?.firstName
        ? `${user.firstName} ${user.lastName || ""}`.trim()
        : user?.username || "Developer";

    // How you use Orbix items
    const usageItems = [
        {
            id: "saved" as SettingsViewKey,
            title: "Saved",
            description: "View and manage your saved bookmarks, questions, and repos",
            icon: <Bookmark className="w-5 h-5 text-black stroke-[2.5]" />,
            iconBg: "bg-[#FFE566]",
        },
        {
            id: "your-activity" as SettingsViewKey,
            title: "Your activity",
            description: "Time spent, interactions, history, and search logs",
            icon: <Activity className="w-5 h-5 text-black stroke-[2.5]" />,
            iconBg: "bg-[#a2ff86]",
        },
        {
            id: "notifications" as SettingsViewKey,
            title: "Notifications",
            description: "Push, email notifications, and contest reminders",
            icon: <Bell className="w-5 h-5 text-black stroke-[2.5]" />,
            iconBg: "bg-sky-200",
        },
        {
            id: "blocked" as SettingsViewKey,
            title: "Blocked",
            description: "Blocked accounts and restricted connections",
            icon: <UserX className="w-5 h-5 text-black stroke-[2.5]" />,
            iconBg: "bg-rose-200",
        },
        {
            id: "connections" as SettingsViewKey,
            title: "Connections",
            description: "Linked peers, mentors, and collegiate network",
            icon: <Users className="w-5 h-5 text-black stroke-[2.5]" />,
            iconBg: "bg-amber-200",
        },
        {
            id: "comments" as SettingsViewKey,
            title: "Comments",
            description: "Your discussions, thread replies, and code reviews",
            icon: <MessageSquare className="w-5 h-5 text-black stroke-[2.5]" />,
            iconBg: "bg-emerald-200",
        },
    ];

    // More info and support items
    const supportItems = [
        {
            id: "help" as SettingsViewKey,
            title: "Help",
            description: "Help center, FAQ, and developer guides",
            icon: <HelpCircle className="w-5 h-5 text-black stroke-[2.5]" />,
            iconBg: "bg-sky-200",
        },
        {
            id: "privacy-center" as SettingsViewKey,
            title: "Privacy center",
            description: "Privacy policy, data safety, and compliance",
            icon: <ShieldCheck className="w-5 h-5 text-black stroke-[2.5]" />,
            iconBg: "bg-[#a2ff86]",
        },
        {
            id: "account-status" as SettingsViewKey,
            title: "Account status",
            description: "Platform standing, verified badges, and limits",
            icon: <CheckCircle2 className="w-5 h-5 text-black stroke-[2.5]" />,
            iconBg: "bg-[#FFE566]",
        },
        {
            id: "about" as SettingsViewKey,
            title: "About",
            description: "Orbix version, terms of service, and licenses",
            icon: <Info className="w-5 h-5 text-black stroke-[2.5]" />,
            iconBg: "bg-neutral-200",
        },
    ];

    // Filter items if searching
    const query = searchQuery.trim().toLowerCase();
    const filteredUsage = query
        ? usageItems.filter(
              (i) =>
                  i.title.toLowerCase().includes(query) ||
                  i.description.toLowerCase().includes(query)
          )
        : usageItems;

    const filteredSupport = query
        ? supportItems.filter(
              (i) =>
                  i.title.toLowerCase().includes(query) ||
                  i.description.toLowerCase().includes(query)
          )
        : supportItems;

    return (
        <div className="space-y-6 animate-fadeIn">
            {/* Search Input Filter */}
            <div className="relative">
                <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2 stroke-[2.5]" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search settings, privacy, and account options..."
                    className="w-full h-11 pl-10 pr-4 rounded-2xl bg-white border-2 border-black text-xs font-bold text-black placeholder:text-neutral-500 shadow-[3px_3px_0px_#000] focus:outline-none focus:bg-[#FAF6EE] transition-all"
                />
            </div>

            {/* ========================================================================= */}
            {/* 1. ACCOUNT CENTER (PROMINENT HERO SECTION)                                */}
            {/* ========================================================================= */}
            {(!query || "account center verify privacy password manage".includes(query)) && (
                <div className="space-y-2.5">
                    <div className="flex items-center justify-between px-1">
                        <span className="text-xs font-black uppercase tracking-wider text-neutral-600">
                            Account Center
                        </span>
                        <span className="text-[11px] font-mono font-bold text-neutral-500">
                            Core Controls
                        </span>
                    </div>

                    <div className="rounded-3xl bg-white border-2 sm:border-[3px] border-black p-5 sm:p-6 shadow-[5px_5px_0px_#000] space-y-4">
                        {/* Account Center Header Hero */}
                        <div
                            onClick={() => onSelectView("account-center")}
                            className="p-4 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000] hover:-translate-y-0.5 active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
                        >
                            <div className="flex items-center gap-3.5 min-w-0">
                                <img
                                    src={user?.photoUrl || user?.avatarUrl || DEFAULT_AVATAR_URL}
                                    alt={displayName}
                                    className="w-12 h-12 rounded-full border-2 border-black object-cover shadow-[2px_2px_0px_#000] bg-[#FFE566] shrink-0"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = DEFAULT_AVATAR_URL;
                                    }}
                                />
                                <div className="space-y-0.5 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h3 className="text-base font-black text-black leading-tight">
                                            {displayName}
                                        </h3>
                                        <span className="text-xs font-mono font-bold text-neutral-600">
                                            @{user?.username}
                                        </span>
                                    </div>
                                    <p className="text-xs text-neutral-600 font-medium truncate">
                                        Password, security, personal details, verification & privacy
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFE566] text-black text-xs font-black uppercase tracking-wider border-2 border-black shadow-[1.5px_1.5px_0px_#000]">
                                    <User className="w-3.5 h-3.5 stroke-[2.5]" />
                                    <span>Account Center</span>
                                </span>
                                <div className="w-8 h-8 rounded-lg bg-white border border-black flex items-center justify-center shadow-[1px_1px_0px_#000] group-hover:bg-[#FFE566] transition-colors">
                                    <ChevronRight className="w-4 h-4 text-black stroke-[2.5] group-hover:translate-x-0.5 transition-transform" />
                                </div>
                            </div>
                        </div>

                        {/* Account Center 4 Sub-options Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                            {/* 1. Verify Account */}
                            <button
                                type="button"
                                onClick={() => onSelectView("verify-account")}
                                className="text-left p-3.5 rounded-xl bg-white hover:bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000] hover:-translate-y-0.5 active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer flex items-center justify-between gap-3 group"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-9 h-9 rounded-lg bg-[#FFE566] border border-black flex items-center justify-center shrink-0 shadow-[1px_1px_0px_#000]">
                                        <BadgeCheck className="w-4 h-4 text-black stroke-[2.5]" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xs font-black text-black group-hover:text-black">
                                            Verify account
                                        </p>
                                        <p className="text-[11px] text-neutral-600 font-medium truncate">
                                            Collegiate identity & student coder badge
                                        </p>
                                    </div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-neutral-400 group-hover:text-black shrink-0 transition-transform group-hover:translate-x-0.5" />
                            </button>

                            {/* 2. Account & Privacy */}
                            <button
                                type="button"
                                onClick={() => onSelectView("account-privacy")}
                                className="text-left p-3.5 rounded-xl bg-white hover:bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000] hover:-translate-y-0.5 active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer flex items-center justify-between gap-3 group"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className={`w-9 h-9 rounded-lg border border-black flex items-center justify-center shrink-0 shadow-[1px_1px_0px_#000] ${isPublic ? "bg-[#a2ff86]" : "bg-[#FFE566]"}`}>
                                        {isPublic ? (
                                            <Globe className="w-4 h-4 text-black stroke-[2.5]" />
                                        ) : (
                                            <Lock className="w-4 h-4 text-black stroke-[2.5]" />
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <p className="text-xs font-black text-black group-hover:text-black">
                                                Account & Privacy
                                            </p>
                                            <span className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase ${isPublic ? "bg-[#a2ff86] text-black" : "bg-black text-white"}`}>
                                                {isPublic ? "Public" : "Private"}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-neutral-600 font-medium truncate">
                                            Public profile, recruiter access & field matrix
                                        </p>
                                    </div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-neutral-400 group-hover:text-black shrink-0 transition-transform group-hover:translate-x-0.5" />
                            </button>

                            {/* 3. Password and Security */}
                            <button
                                type="button"
                                onClick={() => onSelectView("password-security")}
                                className="text-left p-3.5 rounded-xl bg-white hover:bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000] hover:-translate-y-0.5 active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer flex items-center justify-between gap-3 group"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-9 h-9 rounded-lg bg-sky-200 border border-black flex items-center justify-center shrink-0 shadow-[1px_1px_0px_#000]">
                                        <KeyRound className="w-4 h-4 text-black stroke-[2.5]" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xs font-black text-black group-hover:text-black">
                                            Password and Security
                                        </p>
                                        <p className="text-[11px] text-neutral-600 font-medium truncate">
                                            Password credentials, 2FA & active devices
                                        </p>
                                    </div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-neutral-400 group-hover:text-black shrink-0 transition-transform group-hover:translate-x-0.5" />
                            </button>

                            {/* 4. Manage Account */}
                            <button
                                type="button"
                                onClick={() => onSelectView("manage-account")}
                                className="text-left p-3.5 rounded-xl bg-white hover:bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000] hover:-translate-y-0.5 active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer flex items-center justify-between gap-3 group"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-9 h-9 rounded-lg bg-purple-200 border border-black flex items-center justify-center shrink-0 shadow-[1px_1px_0px_#000]">
                                        <UserCog className="w-4 h-4 text-black stroke-[2.5]" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xs font-black text-black group-hover:text-black">
                                            Manage Account
                                        </p>
                                        <p className="text-[11px] text-neutral-600 font-medium truncate">
                                            Email updates, data archive export & deactivation
                                        </p>
                                    </div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-neutral-400 group-hover:text-black shrink-0 transition-transform group-hover:translate-x-0.5" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* 2. HOW YOU USE ORBIX                                                      */}
            {/* ========================================================================= */}
            {filteredUsage.length > 0 && (
                <div className="space-y-2.5">
                    <span className="text-xs font-black uppercase tracking-wider text-neutral-600 px-1">
                        How you use Orbix
                    </span>

                    <div className="rounded-3xl bg-white border-2 sm:border-[3px] border-black p-3 sm:p-4 shadow-[5px_5px_0px_#000] divide-y-2 divide-black/10">
                        {filteredUsage.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => onSelectView(item.id)}
                                className="w-full text-left p-3 sm:p-3.5 rounded-xl hover:bg-[#FAF6EE] transition-all cursor-pointer flex items-center justify-between gap-3 group"
                            >
                                <div className="flex items-center gap-3.5 min-w-0">
                                    <div
                                        className={`w-10 h-10 rounded-xl border-2 border-black flex items-center justify-center shrink-0 shadow-[2px_2px_0px_#000] ${item.iconBg}`}
                                    >
                                        {item.icon}
                                    </div>
                                    <div className="min-w-0 space-y-0.5">
                                        <p className="text-xs sm:text-sm font-black text-black group-hover:text-black">
                                            {item.title}
                                        </p>
                                        <p className="text-[11px] text-neutral-600 font-medium truncate">
                                            {item.description}
                                        </p>
                                    </div>
                                </div>

                                <div className="w-7 h-7 rounded-lg bg-neutral-100 group-hover:bg-[#FFE566] border border-black flex items-center justify-center shrink-0 transition-colors shadow-[1px_1px_0px_#000]">
                                    <ChevronRight className="w-3.5 h-3.5 text-black stroke-[2.5] group-hover:translate-x-0.5 transition-transform" />
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* 3. MORE INFO AND SUPPORT                                                  */}
            {/* ========================================================================= */}
            {filteredSupport.length > 0 && (
                <div className="space-y-2.5">
                    <span className="text-xs font-black uppercase tracking-wider text-neutral-600 px-1">
                        More info and support
                    </span>

                    <div className="rounded-3xl bg-white border-2 sm:border-[3px] border-black p-3 sm:p-4 shadow-[5px_5px_0px_#000] divide-y-2 divide-black/10">
                        {filteredSupport.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => onSelectView(item.id)}
                                className="w-full text-left p-3 sm:p-3.5 rounded-xl hover:bg-[#FAF6EE] transition-all cursor-pointer flex items-center justify-between gap-3 group"
                            >
                                <div className="flex items-center gap-3.5 min-w-0">
                                    <div
                                        className={`w-10 h-10 rounded-xl border-2 border-black flex items-center justify-center shrink-0 shadow-[2px_2px_0px_#000] ${item.iconBg}`}
                                    >
                                        {item.icon}
                                    </div>
                                    <div className="min-w-0 space-y-0.5">
                                        <p className="text-xs sm:text-sm font-black text-black group-hover:text-black">
                                            {item.title}
                                        </p>
                                        <p className="text-[11px] text-neutral-600 font-medium truncate">
                                            {item.description}
                                        </p>
                                    </div>
                                </div>

                                <div className="w-7 h-7 rounded-lg bg-neutral-100 group-hover:bg-[#FFE566] border border-black flex items-center justify-center shrink-0 transition-colors shadow-[1px_1px_0px_#000]">
                                    <ChevronRight className="w-3.5 h-3.5 text-black stroke-[2.5] group-hover:translate-x-0.5 transition-transform" />
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* 4. LOG OUT OPTION                                                         */}
            {/* ========================================================================= */}
            <div className="space-y-2.5 pt-2">
                <span className="text-xs font-black uppercase tracking-wider text-neutral-600 px-1">
                    Session & Security
                </span>

                <button
                    type="button"
                    onClick={onRequestLogout}
                    className="w-full text-left p-4 rounded-2xl bg-white hover:bg-rose-50 border-2 border-black shadow-[4px_4px_0px_#000] hover:shadow-[5px_5px_0px_#000] hover:-translate-y-0.5 active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer flex items-center justify-between gap-4 group"
                >
                    <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-rose-100 border-2 border-black flex items-center justify-center shrink-0 shadow-[2px_2px_0px_#000]">
                            <LogOut className="w-5 h-5 text-rose-600 stroke-[2.5]" />
                        </div>
                        <div className="min-w-0 space-y-0.5">
                            <p className="text-xs sm:text-sm font-black text-rose-600 group-hover:text-rose-700">
                                Log Out
                            </p>
                            <p className="text-[11px] text-neutral-600 font-medium truncate">
                                Sign out of @{user?.username || "account"} on this device
                            </p>
                        </div>
                    </div>

                    <div className="px-3 py-1 rounded-xl bg-rose-100 border border-black text-rose-700 text-xs font-black uppercase tracking-wider shrink-0 shadow-[1px_1px_0px_#000]">
                        Log Out
                    </div>
                </button>
            </div>
        </div>
    );
};
