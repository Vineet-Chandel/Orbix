// Backend/src/services/workspace/workspaceHistoryHelpers.ts
import type {
    WorkspaceHistoryItem,
    WorkspaceHistorySource,
} from "../../types/workspaceTypes.js";

const SENSITIVE_KEY_PATTERN =
    /password|passphrase|secret|token|hash|credential|api[_-]?key|private[_-]?key|auth[_-]?header|authorization|cookie|jwt|otp|pin/i;

const UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface DecodedHistoryCursor {
    createdAt: string;
    sourceRank: 0 | 1;
    id: string;
}

/**
 * Recursively strips or redacts sensitive credentials/tokens/secrets before
 * storing or exposing operational/audit event payloads.
 */
export function sanitizeHistoryPayload(value: unknown, depth = 0): any {
    if (value === null || value === undefined) return value;
    if (depth > 6) return "[TRUNCATED]";

    if (Array.isArray(value)) {
        return value.map((item) => sanitizeHistoryPayload(item, depth + 1));
    }

    if (typeof value === "object") {
        const record = value as Record<string, unknown>;
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(record)) {
            if (SENSITIVE_KEY_PATTERN.test(k)) {
                out[k] = "[REDACTED]";
            } else {
                out[k] = sanitizeHistoryPayload(v, depth + 1);
            }
        }
        return out;
    }

    return value;
}

export function encodeHistoryCursor(cursor: DecodedHistoryCursor): string {
    return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeHistoryCursor(rawCursor?: string | null): DecodedHistoryCursor | null {
    if (!rawCursor || typeof rawCursor !== "string") return null;
    try {
        const parsed = JSON.parse(Buffer.from(rawCursor, "base64url").toString("utf8"));
        if (!parsed || typeof parsed !== "object") return null;
        if (typeof parsed.createdAt !== "string" || Number.isNaN(Date.parse(parsed.createdAt))) {
            return null;
        }
        if (parsed.sourceRank !== 0 && parsed.sourceRank !== 1) {
            return null;
        }
        if (typeof parsed.id !== "string" || !UUID_REGEX.test(parsed.id)) {
            return null;
        }
        return {
            createdAt: parsed.createdAt,
            sourceRank: parsed.sourceRank,
            id: parsed.id,
        };
    } catch {
        return null;
    }
}

export function normalizeTargetType(raw?: string | null): string {
    if (!raw) return "workspace";
    const lower = raw.toLowerCase().trim();
    const map: Record<string, string> = {
        workspace_member: "member",
        member: "member",
        department_member: "department_member",
        workspace_role: "role",
        role: "role",
        workspace_department: "department",
        department: "department",
        workspace_channel: "channel",
        channel: "channel",
        channel_category: "channel_category",
        workspace_task: "task",
        task: "task",
        workspace_file: "file",
        file: "file",
        document: "document",
        invitation: "invitation",
        workspace_manager: "workspace_manager",
        recognition: "recognition",
        workspace: "workspace",
        thread: "thread",
    };
    return map[lower] || lower.replace(/^workspace_/, "");
}

export function expandTargetTypeFilter(targetType?: string | null): string[] | null {
    if (!targetType || !targetType.trim()) return null;
    const norm = normalizeTargetType(targetType);
    const aliases: Record<string, string[]> = {
        member: ["member", "workspace_member", "department_member"],
        role: ["role", "workspace_role"],
        department: ["department", "workspace_department", "department_member"],
        channel: ["channel", "workspace_channel", "channel_category"],
        task: ["task", "workspace_task"],
        file: ["file", "workspace_file", "document"],
        document: ["document", "file", "workspace_file"],
        invitation: ["invitation"],
        workspace_manager: ["workspace_manager"],
        recognition: ["recognition"],
        workspace: ["workspace"],
    };
    return aliases[norm] || [targetType.trim(), norm];
}

export function deriveHistoryCategory(eventOrAction: string, targetType?: string | null): string {
    const val = (eventOrAction || "").toLowerCase();
    const tType = normalizeTargetType(targetType);

    if (val.startsWith("task:") || val.startsWith("task_") || tType === "task") return "task";
    if (val.startsWith("role:") || val.startsWith("role_") || val.startsWith("roles_") || tType === "role") return "role";
    if (
        val.startsWith("department:") ||
        val.startsWith("department_") ||
        val.startsWith("departments_") ||
        tType === "department" ||
        tType === "department_member"
    ) {
        return "department";
    }
    if (
        val.startsWith("channel:") ||
        val.startsWith("channel_") ||
        val.startsWith("channels_") ||
        val === "discussion_started" ||
        tType === "channel" ||
        tType === "channel_category"
    ) {
        return "channel";
    }
    if (val.startsWith("document:") || val === "document_shared" || tType === "document") return "document";
    if (val.startsWith("file:") || val.startsWith("file_") || tType === "file") return "file";
    if (val.startsWith("recognition:") || val.startsWith("recognition_") || tType === "recognition") return "recognition";
    if (
        val.startsWith("member:") ||
        val.startsWith("member_") ||
        val.startsWith("invitation_") ||
        val.startsWith("workspace_manager_") ||
        val === "role_changed" ||
        tType === "member" ||
        tType === "invitation" ||
        tType === "workspace_manager"
    ) {
        return "member";
    }
    if (val.startsWith("workspace:") || val.startsWith("workspace_") || tType === "workspace") return "workspace";
    return "security";
}

export function formatActorName(actor?: {
    firstName?: string | null;
    lastName?: string | null;
    username?: string | null;
} | null): string {
    if (!actor) return "System";
    const full = `${actor.firstName || ""} ${actor.lastName || ""}`.trim();
    return full || actor.username || "Workspace Member";
}

export function formatHistorySummary(params: {
    source: WorkspaceHistorySource;
    eventType: string;
    title?: string | null;
    description?: string | null;
    targetType?: string | null;
    details?: Record<string, any> | null;
}): string {
    const { source, eventType, title, description, targetType, details } = params;
    const meta = details || {};
    const quotedTitle = title || meta.title || meta.name || meta.fileName || meta.newFileName;

    // 1. Operational Activity Event Summaries
    switch (eventType) {
        case "task:created":
        case "task_created":
            return quotedTitle ? `Created task "${quotedTitle}"` : "Created a task";
        case "task:assigned":
        case "task_assigned":
            return quotedTitle ? `Updated assignees on task "${quotedTitle}"` : "Assigned task";
        case "task:status_changed":
            return quotedTitle
                ? `Moved task "${quotedTitle}"${meta.toStatus ? ` to ${String(meta.toStatus).replace(/_/g, " ")}` : ""}`
                : `Changed task status${meta.toStatus ? ` to ${String(meta.toStatus).replace(/_/g, " ")}` : ""}`;
        case "task:submitted":
        case "task_submitted":
            return quotedTitle ? `Submitted deliverable for "${quotedTitle}"` : "Submitted task deliverable";
        case "task:approved":
        case "task_approved":
            return quotedTitle ? `Approved deliverable on "${quotedTitle}"` : "Approved task deliverable";
        case "task:changes_requested":
            return quotedTitle ? `Requested revisions on "${quotedTitle}"` : "Requested task revisions";
        case "task:comment":
        case "task_comment":
            return quotedTitle ? `Commented on task "${quotedTitle}"` : "Commented on a task";
        case "task:archived":
            return quotedTitle ? `Archived task "${quotedTitle}"` : "Archived a task";
        case "member:joined":
        case "member_joined":
            return "Joined the workspace";
        case "member:invited":
            return meta.email ? `Invited ${meta.email} to the workspace` : "Sent a workspace invitation";
        case "member:invitation_revoked":
            return meta.email ? `Revoked invitation for ${meta.email}` : "Revoked a pending invitation";
        case "member:role_updated":
        case "role_changed":
            return meta.newRole
                ? `Updated member role to ${meta.newRole}`
                : meta.newRoleName
                ? `Updated member role to ${meta.newRoleName}`
                : "Updated member role";
        case "member:removed":
            return meta.targetName ? `Removed ${meta.targetName} from workspace` : "Removed a workspace member";
        case "member:suspended":
            return meta.targetName ? `Suspended member ${meta.targetName}` : "Suspended a workspace member";
        case "member:unsuspended":
            return meta.targetName ? `Restored member ${meta.targetName}` : "Restored a suspended member";
        case "member:manager_updated":
            return quotedTitle || "Updated Workspace Manager designation";
        case "department:created":
        case "department_created":
            return quotedTitle ? `Created department "${quotedTitle}"` : "Created a department";
        case "department:updated":
            return quotedTitle ? `Updated department "${quotedTitle}"` : "Updated department settings";
        case "department:archived":
            return quotedTitle ? `Archived department "${quotedTitle}"` : "Archived a department";
        case "department:restored":
            return quotedTitle ? `Restored department "${quotedTitle}"` : "Restored a department";
        case "department:member_added":
            return quotedTitle || "Added member to department";
        case "department:member_removed":
            return quotedTitle || "Removed member from department";
        case "channel:created":
        case "channel_created":
            return quotedTitle ? `Created channel #${quotedTitle}` : "Created a channel";
        case "channel:updated":
            return quotedTitle ? `Updated channel #${quotedTitle}` : "Updated channel settings";
        case "channel:deleted":
            return quotedTitle ? `Deleted channel #${quotedTitle}` : "Deleted a channel";
        case "document:uploaded":
        case "document_shared":
            return quotedTitle ? `Uploaded document "${quotedTitle}"` : "Uploaded a document";
        case "file:uploaded":
            return quotedTitle ? `Uploaded file "${quotedTitle}"` : "Uploaded a file";
        case "file:updated":
            return quotedTitle ? `Updated file "${quotedTitle}"` : "Updated a file";
        case "file:removed":
            return quotedTitle ? `Removed file "${quotedTitle}"` : "Removed a file";
        case "recognition:awarded":
            return meta.amount
                ? `Awarded +${meta.amount} Orbits${meta.recipientName ? ` to ${meta.recipientName}` : ""}`
                : quotedTitle || "Issued recognition award";
        case "recognition:reversed":
            return quotedTitle || "Reversed a recognition award";
        case "workspace:announcement":
            return title || description || "Posted workspace announcement";
    }

    // 2. Administrative Audit Summaries
    switch (eventType) {
        case "member_promoted":
            return meta.newRole
                ? `Promoted member${meta.targetName ? ` ${meta.targetName}` : ""} to ${meta.newRole}`
                : "Promoted workspace member";
        case "member_demoted":
            return meta.newRole
                ? `Changed member role${meta.targetName ? ` for ${meta.targetName}` : ""} to ${meta.newRole}`
                : "Demoted workspace member";
        case "member_removed":
            return "Removed member from workspace";
        case "member_suspended":
            return "Suspended workspace member access";
        case "member_unsuspended":
            return "Restored workspace member access";
        case "member_custom_permissions_updated":
            return "Updated member custom permission overrides";
        case "invitation_created":
            return meta.email ? `Created invitation for ${meta.email}` : "Created workspace invitation";
        case "invitation_accepted":
            return meta.email ? `Accepted invitation (${meta.email})` : "Accepted workspace invitation";
        case "invitation_revoked":
            return meta.email ? `Revoked invitation for ${meta.email}` : "Revoked workspace invitation";
        case "workspace_manager_appointed":
            return "Appointed Workspace Manager";
        case "workspace_manager_revoked":
            return "Revoked Workspace Manager designation";
        case "role_created":
            return meta.name ? `Created role "${meta.name}"` : "Created custom role";
        case "role_updated":
            return meta.name ? `Updated role "${meta.name}"` : "Updated custom role";
        case "role_deleted":
            return meta.name ? `Deleted role "${meta.name}"` : "Deleted custom role";
        case "roles_reordered":
            return "Reordered role hierarchy";
        case "department_created":
            return meta.name ? `Created department "${meta.name}"` : "Created department";
        case "department_updated":
            return meta.name ? `Updated department "${meta.name}"` : "Updated department";
        case "department_archived":
            return "Archived department";
        case "department_restored":
            return "Restored department";
        case "departments_reordered":
            return "Reordered departments";
        case "department_member_added":
            return "Added member to department";
        case "department_member_removed":
            return "Removed member from department";
        case "department_member_role_updated":
            return "Updated department member role";
        case "channel_created":
            return meta.name ? `Created channel #${meta.name}` : "Created channel";
        case "channel_updated":
            return meta.name ? `Updated channel #${meta.name}` : "Updated channel";
        case "channel_deleted":
            return "Deleted channel";
        case "channels_reordered":
            return "Reordered channels";
        case "channel_category_created":
            return meta.name ? `Created channel category "${meta.name}"` : "Created channel category";
        case "channel_category_updated":
            return meta.name ? `Updated channel category "${meta.name}"` : "Updated channel category";
        case "channel_category_deleted":
            return "Deleted channel category";
        case "channel_override_updated":
        case "category_override_updated":
        case "permission_override_deleted":
            return "Modified channel permission override";
        case "file_uploaded":
            return meta.fileName ? `Uploaded file "${meta.fileName}"` : "Uploaded workspace file";
        case "file_renamed":
            return meta.newFileName ? `Renamed file to "${meta.newFileName}"` : "Renamed workspace file";
        case "file_replaced":
            return meta.newFileName ? `Replaced file with "${meta.newFileName}"` : "Replaced workspace file";
        case "file_deleted":
            return meta.fileName ? `Deleted file "${meta.fileName}"` : "Deleted workspace file";
        case "workspace_provisioned":
            return "Provisioned workspace";
        case "workspace_settings_updated":
            return "Updated workspace settings";
        case "template_applied":
            return "Applied workspace template";
    }

    if (title && title.trim()) return title.trim();
    if (description && description.trim()) return description.trim();
    const cleanedEvent = eventType.replace(/[:_]/g, " ");
    if (source === "audit") {
        return `Administrative action: ${cleanedEvent}${targetType ? ` (${normalizeTargetType(targetType)})` : ""}`;
    }
    return `Performed ${cleanedEvent}`;
}

export function canNavigateForResource(
    resourceType?: string | null,
    resourceId?: string | null
): boolean {
    if (!resourceId || !UUID_REGEX.test(resourceId)) return false;
    const norm = normalizeTargetType(resourceType);
    return ["task", "department", "member", "channel", "file", "document", "recognition"].includes(norm);
}

/**
 * Helper to derive a consistent resource target label from an item's payload.
 */
export function deriveTargetLabel(
    targetType?: string | null,
    title?: string | null,
    details?: Record<string, any> | null
): string | undefined {
    const meta = details || {};
    const norm = normalizeTargetType(targetType);
    if (norm === "member" || norm === "workspace_manager") {
        return meta.targetName || meta.email || title || undefined;
    }
    if (norm === "channel" || norm === "channel_category") {
        return meta.name ? `#${meta.name}` : title ? `#${title}` : undefined;
    }
    return title || meta.title || meta.name || meta.fileName || meta.newFileName || meta.email || undefined;
}

export function buildEmptyHistoryItem(): WorkspaceHistoryItem {
    return {
        id: "",
        source: "activity",
        eventType: "",
        category: "workspace",
        actor: { id: null, name: "System" },
        summary: "",
        createdAt: new Date().toISOString(),
        permissions: { canInspect: false, canNavigate: false },
    };
}
