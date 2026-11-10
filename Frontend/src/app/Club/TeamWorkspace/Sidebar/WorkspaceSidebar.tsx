// Frontend/src/app/Club/TeamWorkspace/Sidebar/WorkspaceSidebar.tsx
import React, { useState } from "react";
import {
    Hash,
    Volume2,
    MessageSquare,
    CheckSquare,
    Lock,
    ChevronDown,
    ChevronRight,
    Plus,
    Settings,
    LayoutDashboard,
    CheckCircle2,
    ListTodo,
    Users,
    Activity,
    Shield,
    Search,
} from "lucide-react";
import type {
    WorkspaceChannelCategory,
    WorkspaceChannel,
    WorkspaceChannelType,
    WorkspaceMember,
} from "../../../../types/workspace";

interface WorkspaceSidebarProps {
    categories: WorkspaceChannelCategory[];
    activeChannelId: string | null;
    activeNavSection: "overview" | "my-tasks" | "all-tasks" | "members" | "activity" | "channels" | "audit";
    unreadCounts: Record<string, number>;
    currentMember: WorkspaceMember | null;
    canManageChannels: boolean;
    isAdmin?: boolean;
    onSelectChannel: (channel: WorkspaceChannel) => void;
    onSelectNavSection: (section: "overview" | "my-tasks" | "all-tasks" | "members" | "activity" | "audit") => void;
    onOpenCreateCategory: () => void;
    onOpenCreateChannel: (categoryId?: string | null) => void;
    onOpenChannelSettings: (channel: WorkspaceChannel) => void;
    onOpenSearch?: () => void;
}

export const WorkspaceSidebar: React.FC<WorkspaceSidebarProps> = ({
    categories,
    activeChannelId,
    activeNavSection,
    unreadCounts,
    currentMember,
    canManageChannels,
    isAdmin = false,
    onSelectChannel,
    onSelectNavSection,
    onOpenCreateCategory,
    onOpenCreateChannel,
    onOpenChannelSettings,
    onOpenSearch,
}) => {
    // Collapsed categories map
    const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

    const toggleCategory = (categoryId: string) => {
        setCollapsedCategories((prev) => ({
            ...prev,
            [categoryId]: !prev[categoryId],
        }));
    };

    const getChannelIcon = (type: WorkspaceChannelType) => {
        switch (type) {
            case "announcement":
                return <Volume2 className="w-4 h-4 text-amber-400 shrink-0" />;
            case "forum":
                return <MessageSquare className="w-4 h-4 text-cyan-400 shrink-0" />;
            case "task_discussion":
                return <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />;
            case "text":
            default:
                return <Hash className="w-4 h-4 text-slate-400 shrink-0" />;
        }
    };

    return (
        <aside className="w-64 sm:w-72 bg-[#0B0F17] border-r border-slate-800/80 flex flex-col h-full select-none shrink-0">
            {/* Top Navigation Items */}
            <div className="p-3 border-b border-slate-800/80 space-y-1">
                {onOpenSearch && (
                    <button
                        onClick={onOpenSearch}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold bg-slate-900/80 hover:bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-800 transition mb-2"
                    >
                        <span className="flex items-center gap-2">
                            <Search className="w-3.5 h-3.5 text-slate-400" />
                            <span>Quick Search...</span>
                        </span>
                        <kbd className="px-1.5 py-0.5 text-[10px] bg-slate-800 border border-slate-700 text-slate-400 rounded">
                            ⌘K
                        </kbd>
                    </button>
                )}

                <button
                    onClick={() => onSelectNavSection("overview")}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition ${
                        activeNavSection === "overview"
                            ? "bg-indigo-600/20 text-indigo-300 font-semibold"
                            : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
                    }`}
                >
                    <LayoutDashboard className="w-4 h-4" />
                    <span>Workspace Overview</span>
                </button>

                <button
                    onClick={() => onSelectNavSection("my-tasks")}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition ${
                        activeNavSection === "my-tasks"
                            ? "bg-indigo-600/20 text-indigo-300 font-semibold"
                            : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
                    }`}
                >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>My Tasks</span>
                </button>

                <button
                    onClick={() => onSelectNavSection("all-tasks")}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition ${
                        activeNavSection === "all-tasks"
                            ? "bg-indigo-600/20 text-indigo-300 font-semibold"
                            : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
                    }`}
                >
                    <ListTodo className="w-4 h-4" />
                    <span>All Tasks</span>
                </button>

                <button
                    onClick={() => onSelectNavSection("members")}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition ${
                        activeNavSection === "members"
                            ? "bg-indigo-600/20 text-indigo-300 font-semibold"
                            : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
                    }`}
                >
                    <Users className="w-4 h-4" />
                    <span>Members & Roster</span>
                </button>

                <button
                    onClick={() => onSelectNavSection("activity")}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition ${
                        activeNavSection === "activity"
                            ? "bg-indigo-600/20 text-indigo-300 font-semibold"
                            : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
                    }`}
                >
                    <Activity className="w-4 h-4" />
                    <span>Activity Log</span>
                </button>

                {isAdmin && (
                    <button
                        onClick={() => onSelectNavSection("audit")}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition ${
                            activeNavSection === "audit"
                                ? "bg-indigo-600/20 text-indigo-300 font-semibold"
                                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
                        }`}
                    >
                        <Shield className="w-4 h-4" />
                        <span>Audit Trail</span>
                    </button>
                )}
            </div>

            {/* Channels Header with Add Category action */}
            <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Channels & Discussions
                </span>
                {canManageChannels && (
                    <div className="flex items-center gap-1">
                        <button
                            onClick={onOpenCreateCategory}
                            title="Create Channel Category"
                            className="p-1 rounded-md text-slate-400 hover:text-indigo-400 hover:bg-slate-800 transition"
                        >
                            <Plus className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}
            </div>

            {/* Scrollable Categories & Channels List */}
            <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-4">
                {categories.length === 0 ? (
                    <div className="p-4 text-center">
                        <p className="text-xs text-slate-500">No channels yet.</p>
                        {canManageChannels && (
                            <button
                                onClick={() => onOpenCreateChannel(null)}
                                className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 font-semibold transition"
                            >
                                + Create your first channel
                            </button>
                        )}
                    </div>
                ) : (
                    categories.map((cat) => {
                        const isCollapsed = collapsedCategories[cat.id];
                        const channels = cat.channels || [];

                        return (
                            <div key={cat.id} className="space-y-1">
                                {/* Category Header */}
                                <div className="group flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-900/50 cursor-pointer transition">
                                    <button
                                        onClick={() => toggleCategory(cat.id)}
                                        className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
                                    >
                                        {isCollapsed ? (
                                            <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                        ) : (
                                            <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                        )}
                                        <span className="text-xs font-bold text-slate-300 uppercase tracking-wide truncate">
                                            {cat.name}
                                        </span>
                                        {cat.isPrivate && (
                                            <Lock className="w-3 h-3 text-amber-400/80 shrink-0" />
                                        )}
                                    </button>

                                    {canManageChannels && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onOpenCreateChannel(cat.id);
                                            }}
                                            title={`Add channel to ${cat.name}`}
                                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>

                                {/* Channels under Category */}
                                {!isCollapsed && (
                                    <div className="space-y-0.5 pl-2">
                                        {channels.length === 0 ? (
                                            <div className="px-3 py-1.5 text-[11px] text-slate-600 italic">
                                                No channels in category
                                            </div>
                                        ) : (
                                            channels.map((ch) => {
                                                const isActive =
                                                    activeNavSection === "channels" &&
                                                    activeChannelId === ch.id;
                                                const unread = unreadCounts[ch.id] || 0;

                                                return (
                                                    <div
                                                        key={ch.id}
                                                        className={`group/channel flex items-center justify-between px-2.5 py-1.5 rounded-xl cursor-pointer transition ${
                                                            isActive
                                                                ? "bg-indigo-600/20 text-white font-medium"
                                                                : unread > 0
                                                                ? "text-slate-100 font-semibold hover:bg-slate-900/70"
                                                                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/50"
                                                        }`}
                                                        onClick={() => onSelectChannel(ch)}
                                                    >
                                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                                            {getChannelIcon(ch.channelType)}
                                                            <span className="text-sm truncate">
                                                                {ch.name}
                                                            </span>
                                                            {ch.isPrivate && (
                                                                <Lock className="w-3 h-3 text-slate-500 shrink-0" />
                                                            )}
                                                        </div>

                                                        {/* Right Side: Unread Badge or Settings Cog */}
                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                            {unread > 0 && (
                                                                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-indigo-600 text-white rounded-full">
                                                                    {unread > 99 ? "99+" : unread}
                                                                </span>
                                                            )}
                                                            {canManageChannels && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        onOpenChannelSettings(ch);
                                                                    }}
                                                                    className="opacity-0 group-hover/channel:opacity-100 p-1 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded transition"
                                                                    title="Channel Settings"
                                                                >
                                                                    <Settings className="w-3.5 h-3.5" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* Current Member Footer */}
            {currentMember && (
                <div className="p-3 border-t border-slate-800/80 bg-slate-950/60 flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center font-bold text-xs text-indigo-300 uppercase shrink-0">
                            {currentMember.user?.firstName?.[0] || "U"}
                        </div>
                        <div className="min-w-0">
                            <div className="text-xs font-semibold text-slate-200 truncate">
                                {currentMember.user?.firstName} {currentMember.user?.lastName}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">
                                @{currentMember.user?.username}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </aside>
    );
};
