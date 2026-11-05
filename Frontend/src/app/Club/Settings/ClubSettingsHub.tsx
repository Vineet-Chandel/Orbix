import React, { useState } from "react";
import {
    BadgeCheck,
    KeyRound,
    UserCog,
    HelpCircle,
    ShieldCheck,
    CheckCircle2,
    LogOut,
    ChevronRight,
    Search,
    Lock,
    Globe,
    Building2,
    Activity,
} from "lucide-react";
import type { ClubSettingsViewKey } from "./types";
import { OrbixLogo } from "../../../components/OrbixLogo";

interface ClubSettingsHubProps {
    club: {
        id: string;
        name: string;
        slug: string;
        college_name: string;
        logo_url: string | null;
        is_active?: boolean;
    };
    user: any;
    isPublic: boolean;
    onSelectView: (view: ClubSettingsViewKey) => void;
    onRequestLogout: () => void;
}

export const ClubSettingsHub: React.FC<ClubSettingsHubProps> = ({
    club,
    user,
    isPublic,
    onSelectView,
    onRequestLogout,
}) => {
    const [searchQuery, setSearchQuery] = useState("");

    // More info and support items tailored for Student Organizations / Clubs
    const supportItems = [
        {
            id: "your-activity" as ClubSettingsViewKey,
            title: "Your activity",
            description: "Team access audit log, administrative logins & member session activity",
            icon: <Activity className="w-5 h-5 text-black stroke-[2.5]" />,
            iconBg: "bg-[#a2ff86]",
        },
        {
            id: "help" as ClubSettingsViewKey,
            title: "Help",
            description: "Club Help Center, ticket resolution & event support",
            icon: <HelpCircle className="w-5 h-5 text-black stroke-[2.5]" />,
            iconBg: "bg-sky-200",
        },
        {
            id: "privacy-center" as ClubSettingsViewKey,
            title: "Privacy center",
            description: "Student organization data safety & FERPA compliance",
            icon: <ShieldCheck className="w-5 h-5 text-black stroke-[2.5]" />,
            iconBg: "bg-[#a2ff86]",
        },
        {
            id: "account-status" as ClubSettingsViewKey,
            title: "Account status",
            description: "Institutional standing, verified club badge & event quotas",
            icon: <CheckCircle2 className="w-5 h-5 text-black stroke-[2.5]" />,
            iconBg: "bg-[#FFE566]",
        },
        {
            id: "about" as ClubSettingsViewKey,
            title: "About",
            description: "Orbix for Student Organizations version & platform terms",
            icon: <OrbixLogo className="w-5 h-5 text-black" />,
            iconBg: "bg-[#FFE566]",
        },
    ];

    // Filter items if searching
    const query = searchQuery.trim().toLowerCase();

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
                    placeholder="Search club settings, privacy, verification, and credentials..."
                    className="w-full h-11 pl-10 pr-4 rounded-2xl bg-white border-2 border-black text-xs font-bold text-black placeholder:text-neutral-500 shadow-[3px_3px_0px_#000] focus:outline-none focus:bg-[#FAF6EE] transition-all"
                />
            </div>

            {/* ========================================================================= */}
            {/* 1. ACCOUNT CENTER (HERO CARD FOR CLUB)                                    */}
            {/* ========================================================================= */}
            {(!query || "account center verify privacy password manage club collegiate organization".includes(query)) && (
                <div className="space-y-2.5">
                    <div className="flex items-center justify-between px-1">
                        <span className="text-xs font-black uppercase tracking-wider text-neutral-600">
                            Account Center
                        </span>
                        <span className="text-[11px] font-mono font-bold text-neutral-500">
                            Organization Controls
                        </span>
                    </div>

                    <div className="rounded-3xl bg-white border-2 sm:border-[3px] border-black p-5 sm:p-6 shadow-[5px_5px_0px_#000] space-y-4">
                        {/* Club Account Center Header Hero */}
                        <div
                            onClick={() => onSelectView("account-center")}
                            className="p-4 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000] hover:-translate-y-0.5 active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
                        >
                            <div className="flex items-center gap-3.5 min-w-0">
                                <div className="w-12 h-12 rounded-xl bg-white border-2 border-black flex items-center justify-center font-black text-black overflow-hidden shadow-[2px_2px_0px_#000] shrink-0">
                                    {club.logo_url ? (
                                        <img
                                            src={club.logo_url}
                                            alt={club.name}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <span className="text-base font-black">
                                            {club.name.slice(0, 2).toUpperCase()}
                                        </span>
                                    )}
                                </div>
                                <div className="space-y-0.5 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h3 className="text-base font-black text-black leading-tight">
                                            {club.name}
                                        </h3>
                                        <span className="text-xs font-mono font-bold text-neutral-600">
                                            @{club.slug}
                                        </span>
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#a2ff86] text-black text-[10px] font-black border border-black shadow-[1px_1px_0px_#000]">
                                            <BadgeCheck className="w-3 h-3 stroke-[2.5]" />
                                            <span>Verified Club</span>
                                        </span>
                                    </div>
                                    <p className="text-xs text-neutral-600 font-medium truncate">
                                        Password, credentials, collegiate verification & showcase privacy
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFE566] text-black text-xs font-black uppercase tracking-wider border-2 border-black shadow-[1.5px_1.5px_0px_#000]">
                                    <Building2 className="w-3.5 h-3.5 stroke-[2.5]" />
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
                                            Collegiate identity & student organization verified badge
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
                                            Public showcase, prospective member discoverability & directory status
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
                                            Club credentials, 2FA & active administrative sessions
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
                                            Primary email address, username updates & data archive export
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
            {/* 2. MORE INFO AND SUPPORT (TAILORED FOR CLUBS)                              */}
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
            {/* 3. LOG OUT OPTION (SESSION & SECURITY)                                    */}
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
                                Sign out of @{club.slug} on this device {user?.gmail ? `(${user.gmail})` : ""}
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
