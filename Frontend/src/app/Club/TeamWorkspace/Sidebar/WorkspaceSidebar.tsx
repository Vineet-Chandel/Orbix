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
    activeNavSection?: string;
    unreadCounts: Record<string, number>;
    currentMember: WorkspaceMember | null;
    canManageChannels: boolean;
    isAdmin?: boolean;
    onSelectChannel: (channel: WorkspaceChannel) => void;
    onSelectNavSection?: (section: any) => void;
    onOpenCreateCategory: () => void;
    onOpenCreateChannel: (categoryId?: string | null) => void;
    onOpenChannelSettings: (channel: WorkspaceChannel) => void;
    onOpenSearch?: () => void;
}

export const WorkspaceSidebar: React.FC<WorkspaceSidebarProps> = ({
    categories,
    activeChannelId,
    unreadCounts,
    currentMember,
    canManageChannels,
    onSelectChannel,
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

    const getChannelIcon = (type: WorkspaceChannelType, isActive: boolean) => {
        const iconClasses = `w-4 h-4 shrink-0 ${isActive ? "text-black" : "text-neutral-700"}`;
        switch (type) {
            case "announcement":
                return <Volume2 className={iconClasses} />;
            case "forum":
                return <MessageSquare className={iconClasses} />;
            case "task_discussion":
                return <CheckSquare className={iconClasses} />;
            case "text":
            default:
                return <Hash className={iconClasses} />;
        }
    };

    return (
        <aside className="w-64 sm:w-72 bg-[#FAF6EE] border-r-2 border-black flex flex-col h-full select-none shrink-0">
            {/* Quick Search Header */}
            {onOpenSearch && (
                <div className="p-3 border-b-2 border-black bg-white">
                    <button
                        onClick={onOpenSearch}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-black bg-white hover:bg-[#FFE566] text-black border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition"
                    >
                        <span className="flex items-center gap-2">
                            <Search className="w-3.5 h-3.5 text-black" />
                            <span>Quick Search...</span>
                        </span>
                        <kbd className="px-1.5 py-0.5 text-[10px] font-black bg-[#FAF6EE] border border-black text-black rounded shadow-[1px_1px_0px_#000]">
                            ⌘K
                        </kbd>
                    </button>
                </div>
            )}

            {/* Channels Header with Add Category action */}
            <div className="px-3.5 pt-3.5 pb-2 flex items-center justify-between">
                <span className="text-[11px] font-black text-neutral-600 uppercase tracking-wider">
                    Channels & Discussions
                </span>
                {canManageChannels && (
                    <button
                        onClick={onOpenCreateCategory}
                        title="Create Channel Category"
                        className="p-1 rounded-lg text-black bg-white hover:bg-[#A6FF70] border-2 border-black shadow-[1.5px_1.5px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition"
                    >
                        <Plus className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>

            {/* Scrollable Categories & Channels List */}
            <div className="flex-1 overflow-y-auto px-2.5 pb-4 space-y-3">
                {categories.length === 0 ? (
                    <div className="p-5 text-center bg-white border-2 border-black rounded-xl shadow-[2px_2px_0px_#000] my-2">
                        <p className="text-xs font-bold text-neutral-600">No channels yet.</p>
                        {canManageChannels && (
                            <button
                                onClick={() => onOpenCreateChannel(null)}
                                className="mt-2.5 px-3 py-1.5 text-xs font-black text-black bg-[#A6FF70] hover:bg-[#92f25a] border-2 border-black rounded-lg shadow-[1.5px_1.5px_0px_#000] transition active:translate-x-[1px] active:translate-y-[1px]"
                            >
                                + Create Channel
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
                                <div className="group flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-black/5 cursor-pointer transition">
                                    <button
                                        onClick={() => toggleCategory(cat.id)}
                                        className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
                                    >
                                        {isCollapsed ? (
                                            <ChevronRight className="w-3.5 h-3.5 text-black shrink-0" />
                                        ) : (
                                            <ChevronDown className="w-3.5 h-3.5 text-black shrink-0" />
                                        )}
                                        <span className="text-xs font-black text-neutral-800 uppercase tracking-wide truncate">
                                            {cat.name}
                                        </span>
                                        {cat.isPrivate && (
                                            <Lock className="w-3 h-3 text-neutral-700 shrink-0" />
                                        )}
                                    </button>

                                    {canManageChannels && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onOpenCreateChannel(cat.id);
                                            }}
                                            title={`Add channel to ${cat.name}`}
                                            className="opacity-0 group-hover:opacity-100 p-1 text-black hover:bg-[#FFE566] border border-black rounded transition"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>

                                {/* Channels under Category */}
                                {!isCollapsed && (
                                    <div className="space-y-1 pl-1">
                                        {channels.length === 0 ? (
                                            <div className="px-3 py-1 text-[11px] font-medium text-neutral-500 italic">
                                                No channels in category
                                            </div>
                                        ) : (
                                            channels.map((ch) => {
                                                const isActive = activeChannelId === ch.id;
                                                const unread = unreadCounts[ch.id] || 0;

                                                return (
                                                    <div
                                                        key={ch.id}
                                                        className={`group/channel flex items-center justify-between px-2.5 py-1.5 rounded-xl cursor-pointer transition ${
                                                            isActive
                                                                ? "bg-[#A6FF70] text-black font-black border-2 border-black shadow-[2px_2px_0px_#000]"
                                                                : unread > 0
                                                                ? "bg-white text-black font-black border-2 border-black/30 hover:border-black hover:bg-white"
                                                                : "text-neutral-800 font-bold hover:bg-white hover:text-black hover:border-2 hover:border-black/20 border-2 border-transparent"
                                                        }`}
                                                        onClick={() => onSelectChannel(ch)}
                                                    >
                                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                                            {getChannelIcon(ch.channelType, isActive)}
                                                            <span className="text-xs truncate">
                                                                {ch.name}
                                                            </span>
                                                            {ch.isPrivate && (
                                                                <Lock className="w-3 h-3 text-neutral-600 shrink-0" />
                                                            )}
                                                        </div>

                                                        {/* Right Side: Unread Badge or Settings Cog */}
                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                            {unread > 0 && (
                                                                <span className="px-1.5 py-0.5 text-[10px] font-black bg-[#FFE566] text-black border border-black rounded-full shadow-[1px_1px_0px_#000]">
                                                                    {unread > 99 ? "99+" : unread}
                                                                </span>
                                                            )}
                                                            {canManageChannels && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        onOpenChannelSettings(ch);
                                                                    }}
                                                                    className="opacity-0 group-hover/channel:opacity-100 p-1 text-black hover:bg-white border border-transparent hover:border-black rounded transition"
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
                <div className="p-3 border-t-2 border-black bg-white flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-[#FFE566] border-2 border-black shadow-[1.5px_1.5px_0px_#000] flex items-center justify-center font-black text-xs text-black uppercase shrink-0">
                            {currentMember.user?.firstName?.[0] || "U"}
                        </div>
                        <div className="min-w-0">
                            <div className="text-xs font-black text-black truncate">
                                {currentMember.user?.firstName} {currentMember.user?.lastName}
                            </div>
                            <div className="text-[10px] font-bold text-neutral-500 truncate">
                                @{currentMember.user?.username}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </aside>
    );
};
