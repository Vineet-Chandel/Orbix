// Frontend/src/app/Club/TeamWorkspace/WorkspaceHistory/utils/historyEventRegistry.tsx
import React from "react";
import {
    Activity,
    Shield,
    CheckSquare,
    Users,
    FolderKanban,
    Hash,
    FileText,
    Sparkles,
    Lock,
    Settings,
    Mail,
} from "lucide-react";
import type { NeoSelectOption } from "../../../../../components/NeoSelect";
import type { WorkspaceHistoryItem } from "../../../../../types/workspace";

export type WorkspaceNavigationSection =
    | "overview"
    | "departments"
    | "roster"
    | "invitations"
    | "channels"
    | "all-tasks"
    | "my-tasks"
    | "resources"
    | "recognition"
    | "history"
    | "roles"
    | "settings";

export const HISTORY_CATEGORY_OPTIONS: NeoSelectOption[] = [
    { value: "", label: "All Categories" },
    { value: "task", label: "Tasks" },
    { value: "member", label: "Members & Invitations" },
    { value: "department", label: "Departments" },
    { value: "role", label: "Roles & Permissions" },
    { value: "channel", label: "Channels & Chat" },
    { value: "file", label: "Files & Resources" },
    { value: "recognition", label: "Recognition & Orbits" },
    { value: "workspace", label: "Workspace & Security" },
];

export const HISTORY_TARGET_OPTIONS: NeoSelectOption[] = [
    { value: "", label: "All Targets" },
    { value: "task", label: "Task" },
    { value: "member", label: "Member" },
    { value: "department", label: "Department" },
    { value: "department_member", label: "Department Member" },
    { value: "role", label: "Role" },
    { value: "invitation", label: "Invitation" },
    { value: "channel", label: "Channel" },
    { value: "workspace_file", label: "File / Resource" },
    { value: "recognition", label: "Recognition" },
    { value: "workspace", label: "Workspace" },
];

export interface HistoryVisualMeta {
    badgeLabel: string;
    badgeClass: string;
    iconBgClass: string;
    icon: React.ReactNode;
}

export function getHistoryVisualMeta(item: WorkspaceHistoryItem): HistoryVisualMeta {
    const isAudit = item.source === "audit";
    const category = (item.category || "").toLowerCase();
    const eventType = (item.eventType || "").toLowerCase();

    let icon: React.ReactNode = isAudit ? (
        <Shield className="w-4 h-4 text-black" />
    ) : (
        <Activity className="w-4 h-4 text-black" />
    );
    let iconBgClass = isAudit ? "bg-[#FFE566]" : "bg-[#A6FF70]";

    if (category === "task" || eventType.startsWith("task")) {
        icon = <CheckSquare className="w-4 h-4 text-black" />;
        iconBgClass = isAudit ? "bg-[#FFE566]" : "bg-emerald-200";
    } else if (category === "role" || eventType.startsWith("role") || eventType.includes("permission")) {
        icon = <Lock className="w-4 h-4 text-black" />;
        iconBgClass = "bg-rose-200";
    } else if (eventType.includes("invitation")) {
        icon = <Mail className="w-4 h-4 text-black" />;
        iconBgClass = "bg-amber-200";
    } else if (category === "member" || eventType.startsWith("member")) {
        icon = <Users className="w-4 h-4 text-black" />;
        iconBgClass = isAudit ? "bg-[#FFE566]" : "bg-sky-200";
    } else if (category === "department" || eventType.startsWith("department")) {
        icon = <FolderKanban className="w-4 h-4 text-black" />;
        iconBgClass = "bg-indigo-200";
    } else if (category === "channel" || eventType.startsWith("channel")) {
        icon = <Hash className="w-4 h-4 text-black" />;
        iconBgClass = "bg-cyan-200";
    } else if (category === "file" || eventType.startsWith("file") || eventType.startsWith("document")) {
        icon = <FileText className="w-4 h-4 text-black" />;
        iconBgClass = "bg-violet-200";
    } else if (category === "recognition" || eventType.startsWith("recognition")) {
        icon = <Sparkles className="w-4 h-4 text-black" />;
        iconBgClass = "bg-[#FFE566]";
    } else if (category === "workspace") {
        icon = <Settings className="w-4 h-4 text-black" />;
        iconBgClass = "bg-neutral-200";
    }

    return {
        badgeLabel: isAudit ? "AUDIT" : "ACTIVITY",
        badgeClass: isAudit
            ? "bg-black text-[#FFE566] border-black"
            : "bg-white text-black border-black",
        iconBgClass,
        icon,
    };
}

export function resolveSectionFromTarget(
    target?: WorkspaceHistoryItem["target"],
    isClubContext?: boolean
): WorkspaceNavigationSection | null {
    if (!target?.type) return null;
    const normalized = target.type.toLowerCase();
    switch (normalized) {
        case "task":
            return isClubContext ? "all-tasks" : "all-tasks";
        case "department":
        case "department_member":
            return "departments";
        case "member":
        case "workspace_member":
        case "workspace_manager":
            return "roster";
        case "invitation":
            return "invitations";
        case "role":
            return "roles";
        case "channel":
        case "channel_category":
            return "channels";
        case "file":
        case "workspace_file":
        case "resource":
            return "resources";
        case "recognition":
            return "recognition";
        case "workspace":
            return "settings";
        default:
            return null;
    }
}

export function formatHistoryRelativeTime(isoDate: string): string {
    const dt = new Date(isoDate);
    if (Number.isNaN(dt.getTime())) return isoDate;
    const diffMs = Date.now() - dt.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return "just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDays = Math.floor(diffHr / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return dt.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}
