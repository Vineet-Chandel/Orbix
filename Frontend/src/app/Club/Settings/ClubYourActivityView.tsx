import React, { useState, useEffect, useCallback } from "react";
import {
    Activity,
    Laptop,
    Monitor,
    Smartphone,
    Tablet,
    ShieldCheck,
    MapPin,
    RefreshCw,
    Search,
    Filter,
    Users,
    BadgeCheck,
    Lock,
    Eye,
    Settings,
    UserPlus,
    UserMinus,
} from "lucide-react";
import { useToast } from "../../../context/ToastContext";
import {
    fetchClubAccessActivity,
    logClubAccessEvent,
    type ClubAccessItem,
} from "../../../api/sessionActivityApi";

interface ClubYourActivityViewProps {
    club: {
        id: string;
        name: string;
        slug: string;
        college_name: string;
        logo_url: string | null;
    };
    user: any;
}

export const ClubYourActivityView: React.FC<ClubYourActivityViewProps> = ({ club, user: _user }) => {
    const toast = useToast();

    // Data states
    const [activities, setActivities] = useState<ClubAccessItem[]>([]);
    const [totalCount, setTotalCount] = useState<number>(0);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

    // Filters
    const [selectedActionFilter, setSelectedActionFilter] = useState<string>("all");
    const [searchMemberQuery, setSearchMemberQuery] = useState<string>("");

    // Load activities
    const loadClubActivity = useCallback(async (showToast = false) => {
        try {
            if (showToast) setIsRefreshing(true);
            else setIsLoading(true);

            const res = await fetchClubAccessActivity(club.id, {
                limit: 40,
                action: selectedActionFilter !== "all" ? selectedActionFilter : undefined,
            });

            setActivities(res.events || []);
            setTotalCount(res.total || 0);

            if (showToast) {
                toast.success("Team access logs refreshed.");
            }
        } catch (err: any) {
            console.error("[ClubYourActivity] Error fetching access activity:", err);
            // If 403, user doesn't have lead/admin permission
            if (err?.message?.includes("403") || err?.message?.toLowerCase().includes("permission")) {
                toast.warning("Access activity is restricted to Club Leads, Co-Leads, and Administrators.");
            } else {
                toast.error(err?.message || "Failed to load team access activity.");
            }
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [club.id, selectedActionFilter, toast]);

    // Initial log of current view access & load logs
    useEffect(() => {
        // Log access event on mount
        logClubAccessEvent(club.id, "club_settings_viewed", {
            subview: "your-activity",
            timestamp: new Date().toISOString(),
        }).catch(() => {
            // non-blocking
        });

        loadClubActivity();
    }, [club.id, loadClubActivity]);

    // Device Icon helper
    const renderDeviceIcon = (browserStr: string, osStr: string, className = "w-4 h-4") => {
        const text = `${browserStr} ${osStr}`.toLowerCase();
        if (text.includes("iphone") || text.includes("android") || text.includes("mobile")) {
            return <Smartphone className={className} />;
        }
        if (text.includes("ipad") || text.includes("tablet")) {
            return <Tablet className={className} />;
        }
        if (text.includes("mac") || text.includes("windows") || text.includes("linux")) {
            return <Laptop className={className} />;
        }
        return <Monitor className={className} />;
    };

    // Role badge color helper
    const getRoleBadgeStyle = (role: string) => {
        const r = (role || "").toLowerCase();
        if (r.includes("lead") || r === "owner") {
            return "bg-[#FFE566] text-black border-black";
        }
        if (r.includes("admin") || r.includes("co-lead")) {
            return "bg-[#a2ff86] text-black border-black";
        }
        if (r.includes("core") || r.includes("officer")) {
            return "bg-sky-200 text-black border-black";
        }
        return "bg-neutral-100 text-neutral-800 border-neutral-400";
    };

    // Action icon helper
    const renderActionIcon = (action: string) => {
        switch (action) {
            case "club_dashboard_opened":
                return <Eye className="w-3.5 h-3.5 text-blue-700 stroke-[2.5]" />;
            case "club_settings_viewed":
                return <Settings className="w-3.5 h-3.5 text-amber-700 stroke-[2.5]" />;
            case "club_settings_modified":
                return <Lock className="w-3.5 h-3.5 text-rose-700 stroke-[2.5]" />;
            case "club_member_added":
                return <UserPlus className="w-3.5 h-3.5 text-emerald-700 stroke-[2.5]" />;
            case "club_member_removed":
                return <UserMinus className="w-3.5 h-3.5 text-rose-700 stroke-[2.5]" />;
            default:
                return <Activity className="w-3.5 h-3.5 text-neutral-700 stroke-[2.5]" />;
        }
    };

    // Time formatting helper
    const formatTimeAgo = (dateStr: string) => {
        try {
            const date = new Date(dateStr);
            const now = new Date();
            const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

            if (diffSeconds < 60) return "Just now";
            if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
            if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
            if (diffSeconds < 172800) return "Yesterday";
            return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
        } catch {
            return dateStr;
        }
    };

    const formatFullTime = (dateStr: string) => {
        try {
            return new Date(dateStr).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
            });
        } catch {
            return dateStr;
        }
    };

    // Filtered by search query
    const filteredActivities = activities.filter((act) => {
        if (!searchMemberQuery) return true;
        const q = searchMemberQuery.toLowerCase();
        return (
            act.fullName?.toLowerCase().includes(q) ||
            act.username?.toLowerCase().includes(q) ||
            act.actionLabel?.toLowerCase().includes(q) ||
            act.userRoleAtTime?.toLowerCase().includes(q) ||
            act.locationSummary?.toLowerCase().includes(q)
        );
    });

    // Unique members count
    const uniqueMembersCount = new Set(activities.map((a) => a.userId)).size;

    return (
        <div className="space-y-6">
            {/* ========================================================================= */}
            {/* 1. TOP OVERVIEW HERO CARD & METRICS                                       */}
            {/* ========================================================================= */}
            <div className="p-6 rounded-3xl bg-white border-2 sm:border-[3px] border-black shadow-[5px_5px_0px_#000] space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <h3 className="text-xl sm:text-2xl font-black text-black">
                                Team Access & Activity Audit Log
                            </h3>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#a2ff86] text-black text-xs font-black border border-black shadow-[1.5px_1.5px_0px_#000]">
                                <BadgeCheck className="w-3.5 h-3.5 stroke-[2.5]" />
                                <span>Institutional Audit</span>
                            </span>
                        </div>
                        <p className="text-xs sm:text-sm text-neutral-600 font-medium">
                            Authorized access logs, team logins, and administrative sessions for{" "}
                            <strong>{club.name}</strong>.
                        </p>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                        <button
                            type="button"
                            onClick={() => loadClubActivity(true)}
                            disabled={isRefreshing || isLoading}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-[#FAF6EE] text-black text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer disabled:opacity-50"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 stroke-[2.5] ${isRefreshing ? "animate-spin" : ""}`} />
                            <span>{isRefreshing ? "Refreshing..." : "Refresh"}</span>
                        </button>
                    </div>
                </div>

                {/* 4 Metric KPI Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                    <div className="p-4 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[2.5px_2.5px_0px_#000] space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block">
                            Logged Events
                        </span>
                        <p className="text-2xl font-black text-black">
                            {isLoading ? "..." : totalCount}
                        </p>
                        <p className="text-[11px] font-bold text-neutral-600">
                            Immutable audit trail
                        </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[2.5px_2.5px_0px_#000] space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block">
                            Active Team Members
                        </span>
                        <p className="text-2xl font-black text-black">
                            {isLoading ? "..." : uniqueMembersCount || 1}
                        </p>
                        <p className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                            <span>Authorized identity</span>
                        </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[2.5px_2.5px_0px_#000] space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block">
                            Governance Role
                        </span>
                        <p className="text-base font-black text-black truncate">
                            Lead / Officer
                        </p>
                        <p className="text-[11px] font-bold text-neutral-600">
                            Audit log access enabled
                        </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[2.5px_2.5px_0px_#000] space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block">
                            Session Protocol
                        </span>
                        <p className="text-base font-black text-black flex items-center gap-1.5">
                            <span>Canonical SSO</span>
                        </p>
                        <p className="text-[11px] font-bold text-emerald-700">
                            Zero credential sharing
                        </p>
                    </div>
                </div>
            </div>

            {/* ========================================================================= */}
            {/* 2. FILTER & SEARCH CONTROLS                                               */}
            {/* ========================================================================= */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Search Bar */}
                <div className="relative flex-1">
                    <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2 stroke-[2.5]" />
                    <input
                        type="text"
                        value={searchMemberQuery}
                        onChange={(e) => setSearchMemberQuery(e.target.value)}
                        placeholder="Search team member name, username, or action..."
                        className="w-full h-11 pl-10 pr-4 rounded-2xl bg-white border-2 border-black text-xs font-bold text-black placeholder:text-neutral-500 shadow-[3px_3px_0px_#000] focus:outline-none focus:bg-[#FAF6EE] transition-all"
                    />
                </div>

                {/* Action Filter Dropdown */}
                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-black stroke-[2.5] shrink-0" />
                    <select
                        value={selectedActionFilter}
                        onChange={(e) => setSelectedActionFilter(e.target.value)}
                        className="h-11 px-3.5 rounded-2xl bg-white border-2 border-black text-xs font-black text-black shadow-[3px_3px_0px_#000] focus:outline-none cursor-pointer"
                    >
                        <option value="all">All Actions</option>
                        <option value="club_dashboard_opened">Dashboard Access</option>
                        <option value="club_settings_viewed">Settings Access</option>
                        <option value="club_settings_modified">Settings Modified</option>
                        <option value="club_member_added">Member Added</option>
                        <option value="club_member_removed">Member Removed</option>
                    </select>
                </div>
            </div>

            {/* ========================================================================= */}
            {/* 3. ACTIVITY LOG LIST                                                      */}
            {/* ========================================================================= */}
            <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-black uppercase tracking-wider text-neutral-600">
                        Recent Access Logs ({filteredActivities.length})
                    </span>
                    <span className="text-[11px] font-mono font-bold text-neutral-500">
                        {club.name}
                    </span>
                </div>

                {isLoading ? (
                    <div className="p-8 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] text-center font-bold text-xs text-neutral-600">
                        Loading access logs...
                    </div>
                ) : filteredActivities.length === 0 ? (
                    <div className="p-8 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] text-center space-y-2">
                        <Users className="w-8 h-8 text-neutral-400 mx-auto stroke-[2]" />
                        <h5 className="text-sm font-black text-black">No matching access events found</h5>
                        <p className="text-xs text-neutral-600 max-w-sm mx-auto">
                            When team members open the club dashboard or modify settings, access records will appear here automatically.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2.5">
                        {filteredActivities.map((act) => (
                            <div
                                key={act.id}
                                className="p-4 sm:p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-[4px_4px_0px_#000] transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                            >
                                {/* Left: User Info + Action */}
                                <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                                    {/* Member Avatar */}
                                    <div className="w-11 h-11 rounded-xl bg-[#FAF6EE] border-2 border-black flex items-center justify-center font-black text-sm text-black shrink-0 overflow-hidden shadow-[1.5px_1.5px_0px_#000]">
                                        {act.avatarUrl ? (
                                            <img
                                                src={act.avatarUrl}
                                                alt={act.fullName || act.username}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <span>{(act.fullName || act.username || "U").slice(0, 2).toUpperCase()}</span>
                                        )}
                                    </div>

                                    {/* Details */}
                                    <div className="space-y-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-sm font-black text-black">
                                                {act.fullName || act.username}
                                            </span>
                                            <span className="text-xs font-mono font-bold text-neutral-500">
                                                @{act.username}
                                            </span>
                                            <span
                                                className={`px-2 py-0.2 rounded-full text-[10px] font-black uppercase tracking-wider border ${getRoleBadgeStyle(
                                                    act.userRoleAtTime
                                                )}`}
                                            >
                                                {act.userRoleAtTime || "Member"}
                                            </span>
                                        </div>

                                        {/* Action badge */}
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-[#FAF6EE] border border-black/40 text-xs font-black text-neutral-900">
                                                {renderActionIcon(act.action)}
                                                <span>{act.actionLabel}</span>
                                            </span>

                                            <span className="inline-flex items-center gap-1 text-xs text-neutral-600 font-medium">
                                                {renderDeviceIcon(act.browser, act.operatingSystem, "w-3.5 h-3.5 text-neutral-500")}
                                                <span>{act.deviceName}</span>
                                            </span>
                                        </div>

                                        {/* Location & IP */}
                                        <div className="flex items-center gap-3 text-xs text-neutral-500 font-medium flex-wrap pt-0.5">
                                            <span className="inline-flex items-center gap-1">
                                                <MapPin className="w-3 h-3 text-neutral-400 stroke-[2.5]" />
                                                <span>{act.locationSummary || "Location unavailable"}</span>
                                            </span>
                                            <span>·</span>
                                            <span className="font-mono text-[10.5px]">
                                                {act.ipAddressMasked}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Right: Timestamp & Session Status */}
                                <div className="flex items-center md:flex-col md:items-end justify-between md:justify-center gap-1.5 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-black/10">
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                        <span className="text-xs font-black text-black">
                                            {formatTimeAgo(act.createdAt)}
                                        </span>
                                    </div>
                                    <span className="text-[10.5px] font-mono text-neutral-500 font-medium" title={act.createdAt}>
                                        {formatFullTime(act.createdAt)}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ========================================================================= */}
            {/* 4. SECURITY & PRIVACY NOTICE                                              */}
            {/* ========================================================================= */}
            <div className="p-5 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[3px_3px_0px_#000] flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-white border-2 border-black flex items-center justify-center shrink-0 shadow-[1px_1px_0px_#000]">
                    <ShieldCheck className="w-5 h-5 text-emerald-700 stroke-[2.5]" />
                </div>
                <div className="space-y-1 text-xs">
                    <h5 className="font-black text-black">Canonical Single-Sign-On Governance</h5>
                    <p className="text-neutral-700 font-medium leading-relaxed">
                        Orbix eliminates shared passwords or dummy shared accounts. Every team member signs into their personal developer account and accesses {club.name} via verified institutional permissions. All access records are bound to individual identities for verifiable audit trails.
                    </p>
                </div>
            </div>
        </div>
    );
};
