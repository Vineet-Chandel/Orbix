// Frontend/src/app/Club/TeamWorkspace/WorkspaceShell.tsx
import React, { useState, useEffect, useCallback } from "react";
import {
    Users,
    Hash,
    Shield,
    Activity,
    AlertTriangle,
    Radio,
    RefreshCw,
    FolderKanban,
    Mail,
    UserCog,
    Clock,
    ListTodo,
    CheckCircle2,
    Search,
    ShieldAlert,
    Menu,
} from "lucide-react";
import { workspaceApi } from "../../../api/workspaceApi";
import { useToast } from "../../../context/ToastContext";
import { OrbixLoader } from "../../../components/ui/loader";
import type {
    TeamWorkspace,
    WorkspaceMember,
    WorkspaceRole,
    WorkspaceDepartment,
    WorkspaceChannelCategory,
    WorkspaceChannel,
    WorkspaceThread,
    WorkspaceSearchResultItem,
    MemberCapabilityResolution,
} from "../../../types/workspace";
import { DepartmentOverviewView } from "./Departments/DepartmentOverviewView";
import { MemberDirectoryView } from "./Members/MemberDirectoryView";
import { InvitationsOverviewView } from "./Invitations/InvitationsOverviewView";
import { WorkspaceManagerModal } from "./Manager/WorkspaceManagerModal";
import { WorkspaceSidebar } from "./Sidebar/WorkspaceSidebar";
import { ChannelView } from "./Channels/ChannelView";
import { ThreadSidebar } from "./Threads/ThreadSidebar";
import { CreateCategoryModal } from "./Modals/CreateCategoryModal";
import { CreateChannelModal } from "./Modals/CreateChannelModal";
import { ChannelSettingsModal } from "./Modals/ChannelSettingsModal";
import { TasksBoardView } from "./Tasks/TasksBoardView";
import { MyTasksView } from "./Tasks/MyTasksView";
import { NotificationBell } from "./Notifications/NotificationBell";
import { WorkspaceOverviewView } from "./Dashboard/WorkspaceOverviewView";
import { ActivityFeedView } from "./Activity/ActivityFeedView";
import { AuditLogView } from "./Audit/AuditLogView";
import { WorkspaceSearchModal } from "./Search/WorkspaceSearchModal";

interface WorkspaceShellProps {
    club: {
        id: string;
        name: string;
        slug: string;
        logo_url?: string | null;
        college_name?: string;
    };
    onOpenMobileSidebar?: () => void;
    clubSelector?: React.ReactNode;
    initialSection?: string;
}

export const WorkspaceShell: React.FC<WorkspaceShellProps> = ({
    club,
    onOpenMobileSidebar,
    clubSelector,
    initialSection,
}) => {
    const toast = useToast();

    // Data States
    const [workspace, setWorkspace] = useState<TeamWorkspace | null>(null);
    const [currentMember, setCurrentMember] = useState<WorkspaceMember | null>(null);
    const [capabilities, setCapabilities] = useState<MemberCapabilityResolution | null>(null);
    const [roles, setRoles] = useState<WorkspaceRole[]>([]);
    const [members, setMembers] = useState<WorkspaceMember[]>([]);
    const [departments, setDepartments] = useState<WorkspaceDepartment[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Active Navigation Sub-tab
    const [activeSection, setActiveSection] = useState<
        "overview" | "departments" | "roster" | "invitations" | "channels" | "all-tasks" | "my-tasks" | "activity" | "audit"
    >(() => (initialSection as any) || "overview");

    useEffect(() => {
        if (initialSection) {
            setActiveSection(initialSection as any);
        }
    }, [initialSection]);

    // Phase 08 States: Search Modal
    const [isSearchOpen, setIsSearchOpen] = useState(false);

    // Phase 04 States: Channels & Messaging
    const [categories, setCategories] = useState<WorkspaceChannelCategory[]>([]);
    const [activeChannel, setActiveChannel] = useState<WorkspaceChannel | null>(null);
    const [activeThread, setActiveThread] = useState<WorkspaceThread | null>(null);
    const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

    // Modals
    const [isCreateCategoryOpen, setIsCreateCategoryOpen] = useState(false);
    const [isCreateChannelOpen, setIsCreateChannelOpen] = useState(false);
    const [selectedCategoryForChannel, setSelectedCategoryForChannel] = useState<string | null>(null);
    const [isChannelSettingsOpen, setIsChannelSettingsOpen] = useState(false);
    const [settingsChannel, setSettingsChannel] = useState<WorkspaceChannel | null>(null);

    // Modal state for Member Suspension
    const [suspendingMember, setSuspendingMember] = useState<WorkspaceMember | null>(null);
    const [suspendReason, setSuspendReason] = useState("");
    const [isSubmittingSuspension, setIsSubmittingSuspension] = useState(false);

    // Workspace Manager Modal
    const [isManagerModalOpen, setIsManagerModalOpen] = useState(false);

    // Load Categories & Channels
    const loadCategories = useCallback(async () => {
        try {
            const [catRes, unreadRes] = await Promise.all([
                workspaceApi.getCategories(club.id),
                workspaceApi.getUnreadCounts(club.id),
            ]);
            if (catRes.success && catRes.categories) {
                setCategories(catRes.categories);
                setActiveChannel((prev) => {
                    if (prev) {
                        // Keep current if still exists
                        const allChans = catRes.categories.flatMap((c) => c.channels || []);
                        const found = allChans.find((c) => c.id === prev.id);
                        return found || allChans[0] || null;
                    }
                    const firstChan = catRes.categories.flatMap((c) => c.channels || [])[0];
                    return firstChan || null;
                });
            }
            if (unreadRes.success && unreadRes.unreadCounts) {
                setUnreadCounts(unreadRes.unreadCounts);
            }
        } catch (err) {
            console.error("Failed to load categories/channels:", err);
        }
    }, [club.id]);

    // Load Workspace Data
    const loadWorkspace = useCallback(async (isRefresh = false) => {
        try {
            if (isRefresh) setRefreshing(true);
            else setLoading(true);

            const res = await workspaceApi.getWorkspace(club.id);
            if (res.success) {
                setWorkspace(res.workspace);
                setCurrentMember(res.currentMember);
                if (res.capabilities) {
                    setCapabilities(res.capabilities);
                }
                setRoles(res.roles || []);

                // Load members, departments, and channels concurrently
                const [memRes, deptRes] = await Promise.all([
                    workspaceApi.getMembers({ clubId: club.id }),
                    workspaceApi.getDepartments(club.id, true),
                ]);

                if (memRes.success) {
                    setMembers(memRes.members || []);
                }
                if (deptRes.success) {
                    setDepartments(deptRes.departments || []);
                }

                await loadCategories();

                if (res.isNew) {
                    toast.success("Team Workspace successfully provisioned for your chapter!");
                }
            }
        } catch (err: any) {
            console.error("Workspace load error:", err);
            toast.error(err.message || "Failed to load Team Workspace.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [club.id, toast, loadCategories]);

    useEffect(() => {
        loadWorkspace();
    }, [loadWorkspace]);

    // Realtime SSE event stream setup
    useEffect(() => {
        if (!workspace?.id) return;

        // Establish SSE connection
        const baseUrl = import.meta.env.VITE_API_URL || "";
        const sseUrl = `${baseUrl}/api/club/workspace/realtime/stream?clubId=${club.id}`;
        
        let eventSource: EventSource | null = null;
        try {
            eventSource = new EventSource(sseUrl, { withCredentials: true });

            eventSource.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.event === "message:new") {
                        // Refresh unread counts
                        workspaceApi.getUnreadCounts(club.id).then((res) => {
                            if (res.success && res.unreadCounts) {
                                setUnreadCounts(res.unreadCounts);
                            }
                        });
                    } else if (data.event?.startsWith("channel:") || data.event?.startsWith("category:")) {
                        loadCategories();
                    }
                } catch (e) {
                    // Ignore heartbeat parse errors
                }
            };

            eventSource.onerror = () => {
                // Browser auto-reconnects SSE
            };
        } catch (err) {
            console.error("SSE stream error:", err);
        }

        return () => {
            if (eventSource) {
                eventSource.close();
            }
        };
    }, [workspace?.id, club.id, loadCategories]);

    // Phase 08: Global Cmd+K / Ctrl+K keyboard shortcut for Search
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                setIsSearchOpen((prev) => !prev);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    // Phase 08: Search Result Navigation Handler
    const handleSelectSearchResult = (item: WorkspaceSearchResultItem) => {
        switch (item.type) {
            case "task":
                setActiveSection("all-tasks");
                break;
            case "channel": {
                const foundChan = categories.flatMap((c) => c.channels || []).find((c) => c.id === item.id);
                if (foundChan) {
                    setActiveChannel(foundChan);
                }
                setActiveSection("channels");
                break;
            }
            case "message": {
                if (item.metadata?.channelId) {
                    const chan = categories.flatMap((c) => c.channels || []).find((c) => c.id === item.metadata?.channelId);
                    if (chan) setActiveChannel(chan);
                }
                setActiveSection("channels");
                break;
            }
            case "member":
                setActiveSection("roster");
                break;
            case "department":
                setActiveSection("departments");
                break;
            case "file":
                if (item.destinationUrl) {
                    window.open(item.destinationUrl, "_blank");
                }
                break;
        }
    };

    // Handle Suspension Action
    const handleToggleSuspension = async () => {
        if (!suspendingMember) return;
        try {
            setIsSubmittingSuspension(true);
            const willSuspend = !suspendingMember.isSuspended;
            const res = await workspaceApi.setMemberSuspension(
                suspendingMember.userId,
                willSuspend,
                suspendReason,
                club.id
            );

            if (res.success) {
                toast.success(res.message);
                setSuspendingMember(null);
                setSuspendReason("");
                await loadWorkspace(true);
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to alter suspension status.");
        } finally {
            setIsSubmittingSuspension(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-[450px] flex flex-col items-center justify-center p-8 text-black">
                <OrbixLoader size="lg" />
                <p className="mt-4 font-bold text-sm text-neutral-600">Initializing Team Workspace...</p>
            </div>
        );
    }

    if (!workspace) {
        return (
            <div className="bg-white border-2 border-black rounded-xl p-8 shadow-neo text-center max-w-lg mx-auto my-12">
                <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
                <h3 className="text-xl font-black">Workspace Unavailable</h3>
                <p className="text-neutral-600 text-sm mt-2">
                    Could not retrieve or provision a workspace for {club.name}. Ensure you have administrator rights.
                </p>
                <button
                    onClick={() => loadWorkspace()}
                    className="mt-4 px-4 py-2 bg-[#A6FF70] hover:bg-[#95F55D] text-black font-bold text-sm border-2 border-black rounded-lg shadow-neo-sm"
                >
                    Retry Initialization
                </button>
            </div>
        );
    }

    const isOwner = Boolean(
        currentMember?.role?.slug === "owner" ||
        currentMember?.role?.rank === 1000 ||
        capabilities?.isOwner
    );
    const isAdmin = Boolean(
        isOwner ||
        (currentMember?.role?.rank || 0) >= 800 ||
        capabilities?.isAdmin
    );
    const isWorkspaceManager = Boolean(
        (workspace.managerUserId && workspace.managerUserId === currentMember?.userId) ||
        capabilities?.isWorkspaceManager
    );
    const canManageChannels = Boolean(
        isAdmin ||
        (isWorkspaceManager && Boolean((workspace.managerPermissions as any)?.can_manage_channels)) ||
        capabilities?.capabilities.channels.manage
    );
    const managerMember = members.find((m) => m.userId === workspace.managerUserId);

    return (
        <div className="w-full space-y-6">
            {/* Top Workspace Header Card */}
            <div className="bg-white border-2 border-black rounded-2xl p-6 shadow-neo">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-xl border-2 border-black bg-[#A6FF70] flex items-center justify-center font-black text-2xl shadow-neo-sm overflow-hidden">
                            {club.logo_url ? (
                                <img src={club.logo_url} alt={workspace.name} className="w-full h-full object-cover" />
                            ) : (
                                workspace.name.charAt(0)
                            )}
                        </div>
                        <div>
                            <div className="flex items-center gap-2.5 flex-wrap">
                                <h1 className="text-2xl font-black text-black tracking-tight">{workspace.name}</h1>
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-black bg-emerald-100 text-emerald-800 border border-black rounded-full">
                                    <Radio className="w-3 h-3 text-emerald-600 animate-pulse" />
                                    Active Workspace
                                </span>
                                {managerMember && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-black bg-yellow-100 text-yellow-800 border border-black rounded-full">
                                        <UserCog className="w-3 h-3 text-yellow-700" />
                                        Manager: @{managerMember.user?.username}
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-neutral-600 mt-1 font-medium">
                                Chapter: <strong className="text-black">{club.name}</strong> • College: {club.college_name || "Campus Chapter"}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2.5 self-start md:self-auto flex-wrap">
                        {onOpenMobileSidebar && (
                            <button
                                onClick={onOpenMobileSidebar}
                                className="lg:hidden px-2.5 py-1.5 bg-white hover:bg-neutral-100 text-black border-2 border-black rounded-xl text-xs font-black shadow-neo-xs transition-all flex items-center gap-1.5"
                                title="Open Navigation Menu"
                            >
                                <Menu className="w-3.5 h-3.5" />
                                <span>Menu</span>
                            </button>
                        )}
                        {clubSelector}
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 border-2 border-black rounded-xl text-xs font-bold shadow-neo-xs">
                            <Shield className="w-3.5 h-3.5 text-blue-600" />
                            <span>Your Role: {currentMember?.roleTitle || "Member"}</span>
                        </div>

                        {/* Owner Workspace Manager Designation Button */}
                        {isOwner && (
                            <button
                                onClick={() => setIsManagerModalOpen(true)}
                                className="px-3 py-1.5 bg-yellow-200 hover:bg-yellow-300 text-black border-2 border-black rounded-xl text-xs font-black shadow-neo-xs transition-all flex items-center gap-1.5"
                                title="Appoint or configure Workspace Manager"
                            >
                                <UserCog className="w-3.5 h-3.5" />
                                <span>Workspace Manager</span>
                            </button>
                        )}

                        {/* Quick Search */}
                        <button
                            onClick={() => setIsSearchOpen(true)}
                            className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border-2 border-black rounded-xl text-xs font-bold shadow-neo-xs transition-all flex items-center gap-1.5"
                            title="Search Workspace (⌘K)"
                        >
                            <Search className="w-3.5 h-3.5 text-neutral-600" />
                            <span className="hidden sm:inline">Search</span>
                            <kbd className="px-1.5 py-0.2 text-[10px] font-mono bg-white border border-neutral-300 rounded text-neutral-600">
                                ⌘K
                            </kbd>
                        </button>

                        {/* Notification Bell */}
                        <div className="bg-neutral-900 border-2 border-black rounded-xl shadow-neo-xs flex items-center justify-center">
                            <NotificationBell clubId={club.id} />
                        </div>

                        <button
                            onClick={() => loadWorkspace(true)}
                            disabled={refreshing}
                            className="p-2 bg-neutral-100 hover:bg-neutral-200 border-2 border-black rounded-xl shadow-neo-xs transition-all active:translate-x-[1px] active:translate-y-[1px]"
                            title="Refresh Workspace"
                        >
                            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
                        </button>
                    </div>
                </div>

                {/* Sub-Navigation Tabs */}
                <div className="flex items-center gap-2 mt-6 pt-5 border-t-2 border-black flex-wrap">
                    <button
                        onClick={() => setActiveSection("overview")}
                        className={`px-4 py-2 text-xs font-black rounded-xl border-2 border-black transition-all flex items-center gap-2 ${
                            activeSection === "overview"
                                ? "bg-[#A6FF70] shadow-neo-sm translate-x-[1px] translate-y-[1px]"
                                : "bg-white hover:bg-neutral-50 shadow-neo-xs"
                        }`}
                    >
                        <Activity className="w-3.5 h-3.5" />
                        Workspace Overview
                    </button>

                    <button
                        onClick={() => setActiveSection("departments")}
                        className={`px-4 py-2 text-xs font-black rounded-xl border-2 border-black transition-all flex items-center gap-2 ${
                            activeSection === "departments"
                                ? "bg-[#A6FF70] shadow-neo-sm translate-x-[1px] translate-y-[1px]"
                                : "bg-white hover:bg-neutral-50 shadow-neo-xs"
                        }`}
                    >
                        <FolderKanban className="w-3.5 h-3.5" />
                        Departments ({departments.length})
                    </button>

                    <button
                        onClick={() => setActiveSection("roster")}
                        className={`px-4 py-2 text-xs font-black rounded-xl border-2 border-black transition-all flex items-center gap-2 ${
                            activeSection === "roster"
                                ? "bg-[#A6FF70] shadow-neo-sm translate-x-[1px] translate-y-[1px]"
                                : "bg-white hover:bg-neutral-50 shadow-neo-xs"
                        }`}
                    >
                        <Users className="w-3.5 h-3.5" />
                        Member Roster ({members.length})
                    </button>

                    {(capabilities ? capabilities.navigation.canViewInvitations : (isAdmin || isWorkspaceManager)) && (
                        <button
                            onClick={() => setActiveSection("invitations")}
                            className={`px-4 py-2 text-xs font-black rounded-xl border-2 border-black transition-all flex items-center gap-2 ${
                                activeSection === "invitations"
                                    ? "bg-[#A6FF70] shadow-neo-sm translate-x-[1px] translate-y-[1px]"
                                    : "bg-white hover:bg-neutral-50 shadow-neo-xs"
                            }`}
                        >
                            <Mail className="w-3.5 h-3.5" />
                            Invitations
                        </button>
                    )}

                    <button
                        onClick={() => setActiveSection("channels")}
                        className={`px-4 py-2 text-xs font-black rounded-xl border-2 border-black transition-all flex items-center gap-2 ${
                            activeSection === "channels"
                                ? "bg-[#A6FF70] shadow-neo-sm translate-x-[1px] translate-y-[1px]"
                                : "bg-white hover:bg-neutral-50 shadow-neo-xs"
                        }`}
                    >
                        <Hash className="w-3.5 h-3.5" />
                        Channels & Chat
                    </button>

                    {(capabilities ? capabilities.navigation.canViewAllTasks : true) && (
                        <button
                            onClick={() => setActiveSection("all-tasks")}
                            className={`px-4 py-2 text-xs font-black rounded-xl border-2 border-black transition-all flex items-center gap-2 ${
                                activeSection === "all-tasks"
                                    ? "bg-[#A6FF70] shadow-neo-sm translate-x-[1px] translate-y-[1px]"
                                    : "bg-white hover:bg-neutral-50 shadow-neo-xs"
                            }`}
                        >
                            <ListTodo className="w-3.5 h-3.5" />
                            All Tasks
                        </button>
                    )}

                    <button
                        onClick={() => setActiveSection("my-tasks")}
                        className={`px-4 py-2 text-xs font-black rounded-xl border-2 border-black transition-all flex items-center gap-2 ${
                            activeSection === "my-tasks"
                                ? "bg-[#A6FF70] shadow-neo-sm translate-x-[1px] translate-y-[1px]"
                                : "bg-white hover:bg-neutral-50 shadow-neo-xs"
                        }`}
                    >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        My Tasks
                    </button>

                    <button
                        onClick={() => setActiveSection("activity")}
                        className={`px-4 py-2 text-xs font-black rounded-xl border-2 border-black transition-all flex items-center gap-2 ${
                            activeSection === "activity"
                                ? "bg-[#A6FF70] shadow-neo-sm translate-x-[1px] translate-y-[1px]"
                                : "bg-white hover:bg-neutral-50 shadow-neo-xs"
                        }`}
                    >
                        <Activity className="w-3.5 h-3.5" />
                        Activity Log
                    </button>

                    {(capabilities ? capabilities.navigation.canViewAuditLogs : isAdmin) && (
                        <button
                            onClick={() => setActiveSection("audit")}
                            className={`px-4 py-2 text-xs font-black rounded-xl border-2 border-black transition-all flex items-center gap-2 ${
                                activeSection === "audit"
                                    ? "bg-[#A6FF70] shadow-neo-sm translate-x-[1px] translate-y-[1px]"
                                    : "bg-white hover:bg-neutral-50 shadow-neo-xs"
                            }`}
                        >
                            <Shield className="w-3.5 h-3.5" />
                            Audit Trail
                        </button>
                    )}
                </div>
            </div>

            {/* Section Access Authorization Enforcement */}
            {capabilities && !capabilities.navigation.allowedTabs.includes(activeSection) ? (
                <div className="bg-[#FAF6EE] border-2 border-black rounded-2xl p-8 text-center shadow-neo max-w-lg mx-auto my-8 animate-in fade-in duration-150">
                    <div className="w-14 h-14 bg-rose-100 border-2 border-black rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-neo-xs">
                        <ShieldAlert className="w-7 h-7 text-rose-600" />
                    </div>
                    <h3 className="text-xl font-black text-black">Section Restricted</h3>
                    <p className="text-xs font-bold text-neutral-600 mt-2 max-w-sm mx-auto leading-relaxed">
                        You do not possess permission to access the "{activeSection}" module in this workspace.
                    </p>
                    <button
                        onClick={() => setActiveSection("overview")}
                        className="mt-5 px-5 py-2.5 bg-[#A6FF70] hover:bg-[#95F55D] text-black font-black text-xs border-2 border-black rounded-xl shadow-neo-sm transition active:translate-x-[1px] active:translate-y-[1px]"
                    >
                        Return to Workspace Overview
                    </button>
                </div>
            ) : (
                <>
                    {/* SECTION 1: OVERVIEW (PHASE 08) */}
            {activeSection === "overview" && (
                <WorkspaceOverviewView
                    clubId={club.id}
                    departments={departments}
                    isAdmin={isAdmin}
                    capabilities={capabilities}
                    onNavigateToSection={(sec) => setActiveSection(sec)}
                    onSelectDepartment={() => {
                        setActiveSection("departments");
                    }}
                />
            )}

            {/* SECTION 2: DEPARTMENTS */}
            {activeSection === "departments" && (
                <DepartmentOverviewView
                    clubId={club.id}
                    departments={departments}
                    allMembers={members}
                    isAdmin={isAdmin}
                    capabilities={capabilities}
                    onReload={() => loadWorkspace(true)}
                />
            )}

            {/* SECTION 3: ROSTER */}
            {activeSection === "roster" && (
                <MemberDirectoryView
                    workspace={workspace}
                    members={members}
                    roles={roles}
                    departments={departments}
                    currentMember={currentMember}
                    clubId={club.id}
                    onRefresh={() => loadWorkspace(true)}
                    onToggleSuspension={(m) => setSuspendingMember(m)}
                />
            )}

            {/* SECTION 4: INVITATIONS */}
            {activeSection === "invitations" && (
                <InvitationsOverviewView
                    clubId={club.id}
                    roles={roles}
                    departments={departments}
                    currentMember={currentMember}
                />
            )}

            {/* SECTION 5: CHANNELS & REALTIME COLLABORATION (PHASE 04) */}
            {activeSection === "channels" && (
                <div className="flex h-[720px] max-h-[calc(100vh-200px)] rounded-2xl border-2 border-black overflow-hidden shadow-neo bg-white">
                    {/* Left Channels Sidebar */}
                    <WorkspaceSidebar
                        categories={categories}
                        activeChannelId={activeChannel?.id || null}
                        activeNavSection={activeSection}
                        unreadCounts={unreadCounts}
                        currentMember={currentMember}
                        canManageChannels={canManageChannels}
                        isAdmin={isAdmin}
                        onSelectChannel={(ch) => {
                            setActiveChannel(ch);
                            setActiveThread(null);
                            setActiveSection("channels");
                        }}
                        onSelectNavSection={(sec) => {
                            if (sec === "overview") setActiveSection("overview");
                            else if (sec === "members") setActiveSection("roster");
                            else if (sec === "all-tasks") setActiveSection("all-tasks");
                            else if (sec === "my-tasks") setActiveSection("my-tasks");
                            else if (sec === "activity") setActiveSection("activity");
                            else if (sec === "audit") setActiveSection("audit");
                            else {
                                setActiveSection("overview");
                            }
                        }}
                        onOpenCreateCategory={() => setIsCreateCategoryOpen(true)}
                        onOpenCreateChannel={(catId) => {
                            setSelectedCategoryForChannel(catId || null);
                            setIsCreateChannelOpen(true);
                        }}
                        onOpenChannelSettings={(ch) => {
                            setSettingsChannel(ch);
                            setIsChannelSettingsOpen(true);
                        }}
                        onOpenSearch={() => setIsSearchOpen(true)}
                    />

                    {/* Center Active Channel View */}
                    {activeChannel ? (
                        <ChannelView
                            key={activeChannel.id}
                            channel={activeChannel}
                            clubId={club.id}
                            currentMember={currentMember}
                            canManageChannels={canManageChannels}
                            onOpenThread={(th) => setActiveThread(th)}
                            onChannelUpdated={(updated) => {
                                setActiveChannel(updated);
                                loadCategories();
                            }}
                        />
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#FAF6EE]">
                            <div className="w-14 h-14 rounded-2xl bg-[#FFE566] border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-center text-black mb-3">
                                <Hash className="w-7 h-7 text-black" />
                            </div>
                            <p className="text-base font-black text-black">Select a channel to start messaging</p>
                            <p className="text-xs font-semibold text-neutral-600 mt-1">Or create a new channel in the sidebar to collaborate</p>
                            {canManageChannels && (
                                <button
                                    onClick={() => setIsCreateChannelOpen(true)}
                                    className="mt-4 px-4 py-2 bg-[#A6FF70] hover:bg-[#92f25a] text-black border-2 border-black text-xs font-black rounded-xl shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition"
                                >
                                    + Create Channel
                                </button>
                            )}
                        </div>
                    )}

                    {/* Right Thread Sidebar (if active) */}
                    {activeThread && activeChannel && (
                        <ThreadSidebar
                            key={activeThread.id}
                            thread={activeThread}
                            channelId={activeChannel.id}
                            clubId={club.id}
                            currentMember={currentMember}
                            canManageThreads={canManageChannels}
                            onClose={() => setActiveThread(null)}
                            onThreadUpdated={(updated) => setActiveThread(updated)}
                        />
                    )}
                </div>
            )}

            {/* SECTION 6: ALL TASKS (PHASE 05) */}
            {activeSection === "all-tasks" && (
                <div className="h-[720px] max-h-[calc(100vh-200px)] flex flex-col rounded-2xl border-2 border-black overflow-hidden shadow-neo">
                    <TasksBoardView
                        clubId={club.id}
                        departments={departments}
                        members={members}
                        roles={roles}
                        currentMember={currentMember}
                        canCreateTasks={canManageChannels || isOwner || Boolean(currentMember?.role?.permissions.includes("tasks:create"))}
                    />
                </div>
            )}

            {/* SECTION 7: MY TASKS (PHASE 05) */}
            {activeSection === "my-tasks" && (
                <div className="h-[720px] max-h-[calc(100vh-200px)] flex flex-col rounded-2xl border-2 border-black overflow-hidden shadow-neo">
                    <MyTasksView
                        clubId={club.id}
                        currentMember={currentMember}
                        allMembers={members}
                        departments={departments}
                        roles={roles}
                    />
                </div>
            )}

            {/* SECTION 8: ACTIVITY FEED (PHASE 08) */}
            {activeSection === "activity" && (
                <ActivityFeedView
                    clubId={club.id}
                    departments={departments}
                    members={members}
                    onNavigate={(url) => {
                        window.location.href = url;
                    }}
                />
            )}

            {/* SECTION 9: AUDIT LOG VIEWER (PHASE 08) */}
            {activeSection === "audit" && (
                <AuditLogView
                    clubId={club.id}
                    isAdmin={isAdmin}
                />
            )}
            </>
            )}

            {/* Phase 04 Modals */}
            <CreateCategoryModal
                isOpen={isCreateCategoryOpen}
                onClose={() => setIsCreateCategoryOpen(false)}
                clubId={club.id}
                departments={departments}
                roles={roles}
                members={members}
                onCategoryCreated={() => {
                    loadCategories();
                }}
            />

            <CreateChannelModal
                isOpen={isCreateChannelOpen}
                onClose={() => {
                    setIsCreateChannelOpen(false);
                    setSelectedCategoryForChannel(null);
                }}
                clubId={club.id}
                categories={categories}
                departments={departments}
                roles={roles}
                members={members}
                defaultCategoryId={selectedCategoryForChannel}
                onChannelCreated={(ch) => {
                    setActiveChannel(ch);
                    loadCategories();
                }}
            />

            {settingsChannel && (
                <ChannelSettingsModal
                    isOpen={isChannelSettingsOpen}
                    onClose={() => {
                        setIsChannelSettingsOpen(false);
                        setSettingsChannel(null);
                    }}
                    clubId={club.id}
                    channel={settingsChannel}
                    categories={categories}
                    departments={departments}
                    roles={roles}
                    members={members}
                    canManageChannel={canManageChannels}
                    onChannelUpdated={(updated) => {
                        if (activeChannel?.id === updated.id) {
                            setActiveChannel(updated);
                        }
                        loadCategories();
                    }}
                    onChannelDeleted={(channelId) => {
                        if (activeChannel?.id === channelId) {
                            setActiveChannel(null);
                        }
                        loadCategories();
                    }}
                />
            )}

            {/* Suspension Confirmation Modal */}
            {suspendingMember && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
                    <div className="bg-white border-2 border-black rounded-2xl max-w-md w-full p-6 shadow-neo animate-in fade-in zoom-in-95">
                        <div className="flex items-center gap-3 text-amber-600 mb-3">
                            <AlertTriangle className="w-6 h-6" />
                            <h4 className="text-lg font-black text-black">
                                {suspendingMember.isSuspended ? "Re-activate Member" : "Suspend Member from Workspace"}
                            </h4>
                        </div>

                        <p className="text-xs text-neutral-700 leading-relaxed">
                            {suspendingMember.isSuspended
                                ? `Re-activating will restore @${suspendingMember.user?.username}'s ability to collaborate in this workspace.`
                                : `Suspending @${suspendingMember.user?.username} revokes their workspace permissions and channel access immediately. Their global Orbix account remains completely unaffected.`}
                        </p>

                        {!suspendingMember.isSuspended && (
                            <div className="mt-4">
                                <label className="block text-xs font-black uppercase text-neutral-600 mb-1">
                                    Reason for suspension (optional)
                                </label>
                                <textarea
                                    value={suspendReason}
                                    onChange={(e) => setSuspendReason(e.target.value)}
                                    placeholder="Enter operational reason for audit record..."
                                    rows={2}
                                    className="w-full p-2.5 text-xs font-semibold border-2 border-black rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                                />
                            </div>
                        )}

                        <div className="flex items-center justify-end gap-2.5 mt-6 pt-4 border-t-2 border-black">
                            <button
                                onClick={() => setSuspendingMember(null)}
                                disabled={isSubmittingSuspension}
                                className="px-4 py-2 text-xs font-black bg-neutral-100 hover:bg-neutral-200 border-2 border-black rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleToggleSuspension}
                                disabled={isSubmittingSuspension}
                                className={`px-4 py-2 text-xs font-black border-2 border-black rounded-lg shadow-neo-xs flex items-center gap-1.5 ${
                                    suspendingMember.isSuspended
                                        ? "bg-[#A6FF70] hover:bg-[#95F55D] text-black"
                                        : "bg-red-500 hover:bg-red-600 text-white"
                                }`}
                            >
                                {isSubmittingSuspension && <Clock className="w-3.5 h-3.5 animate-spin" />}
                                {suspendingMember.isSuspended ? "Confirm Re-activation" : "Confirm Suspension"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Workspace Manager Modal */}
            {isOwner && (
                <WorkspaceManagerModal
                    isOpen={isManagerModalOpen}
                    onClose={() => setIsManagerModalOpen(false)}
                    workspace={workspace}
                    members={members}
                    clubId={club.id}
                    onSuccess={() => loadWorkspace(true)}
                />
            )}

            {/* Unified Workspace Search Modal (Phase 08) */}
            <WorkspaceSearchModal
                isOpen={isSearchOpen}
                onClose={() => setIsSearchOpen(false)}
                clubId={club.id}
                onSelectResult={handleSelectSearchResult}
            />
        </div>
    );
};

export default WorkspaceShell;
