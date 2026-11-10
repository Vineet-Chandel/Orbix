// Backend/src/services/workspace/workspaceChannelService.ts
import { EventEmitter } from "events";
import { query } from "../../database/client.js";
import { WorkspaceRepository } from "../../repositories/workspaceRepository.js";
import { WorkspaceService } from "./workspaceService.js";
import type {
    WorkspaceChannel,
    WorkspaceChannelCategory,
    WorkspaceChannelOverride,
    WorkspaceMessage,
    WorkspaceThread,
    WorkspaceChannelType,
} from "../../types/workspaceTypes.js";

// Global real-time event bus for workspace channels
export const workspaceEventBus = new EventEmitter();
workspaceEventBus.setMaxListeners(200);

export class WorkspaceChannelService {
    // =========================================================================
    // 1. AUTHORIZATION & ACCESS CONTROL (PRIVATE CHANNELS)
    // =========================================================================

    /**
     * Determines whether a user has permission to view a channel.
     * Enforces strict hierarchy, department membership, and role/member overrides.
     * Acceptance Criteria: Unauthorized users receive false, and callers return 404.
     */
    static async canViewChannel(
        workspaceId: string,
        channelId: string,
        userId: string
    ): Promise<boolean> {
        const ctx = await WorkspaceService.resolveContext(workspaceId, userId);
        if (!ctx || ctx.member.isSuspended) return false;

        // Owner (1000) and Admins (800+) always have access
        if (ctx.isOwner || ctx.isAdmin) return true;

        // Workspace Manager with can_manage_channels
        if (ctx.isWorkspaceManager && (ctx.workspace.managerPermissions as any)?.can_manage_channels) {
            return true;
        }

        const channel = await WorkspaceRepository.findChannelById(workspaceId, channelId);
        if (!channel || channel.isArchived) return false;

        // 1. Department isolation check
        if (channel.departmentId) {
            const userDepts = ctx.member.departments || [];
            const inDept =
                ctx.member.departmentId === channel.departmentId ||
                userDepts.some((d) => d.id === channel.departmentId) ||
                ctx.leadDepartmentIds.includes(channel.departmentId);

            if (!inDept && channel.isPrivate) {
                return false;
            }
        }

        // 2. Overrides evaluation (Channel-level overrides take precedence over Category overrides)
        const channelOverrides = await WorkspaceRepository.getOverridesForChannel(workspaceId, channelId);
        let effectiveOverrides = channelOverrides;

        if (channel.isCategorySynced && channel.categoryId) {
            const categoryOverrides = await WorkspaceRepository.getOverridesForCategory(workspaceId, channel.categoryId);
            // Category overrides serve as base, channel overrides augment/override
            effectiveOverrides = [...categoryOverrides, ...channelOverrides];
        }

        // Member-specific override check
        const memberOverride = effectiveOverrides.find((o) => o.memberId === ctx.member.id);
        if (memberOverride) {
            const allows = memberOverride.allowPermissions || [];
            const denies = memberOverride.denyPermissions || [];
            if (denies.includes("view_channel")) return false;
            if (allows.includes("view_channel")) return true;
        }

        // Role-specific overrides check
        const roleOverride = effectiveOverrides.find((o) => o.roleId === ctx.member.roleId);
        if (roleOverride) {
            const allows = roleOverride.allowPermissions || [];
            const denies = roleOverride.denyPermissions || [];
            if (denies.includes("view_channel")) return false;
            if (allows.includes("view_channel")) return true;
        }

        // If the channel is flagged private and no explicit allow was granted:
        if (channel.isPrivate) {
            return false;
        }

        // Public channel default
        return true;
    }

    /**
     * Determines whether a user can post messages in a channel.
     */
    static async canPostInChannel(
        workspaceId: string,
        channelId: string,
        userId: string
    ): Promise<boolean> {
        const canView = await this.canViewChannel(workspaceId, channelId, userId);
        if (!canView) return false;

        const ctx = await WorkspaceService.resolveContext(workspaceId, userId);
        if (!ctx || ctx.member.isSuspended) return false;
        if (ctx.isOwner || ctx.isAdmin) return true;

        const channel = await WorkspaceRepository.findChannelById(workspaceId, channelId);
        if (!channel) return false;

        // Announcement channels only allow owner, admin, manager, or leads
        if (channel.channelType === "announcement") {
            const isLead = channel.departmentId ? ctx.leadDepartmentIds.includes(channel.departmentId) : false;
            return isLead || (ctx.isWorkspaceManager && (ctx.workspace.managerPermissions as any)?.can_manage_channels);
        }

        return true;
    }

    /**
     * Determines whether a user can create or reply in threads.
     */
    static async canPostInThread(
        workspaceId: string,
        channelId: string,
        threadId: string,
        userId: string
    ): Promise<boolean> {
        const canView = await this.canViewChannel(workspaceId, channelId, userId);
        if (!canView) return false;

        const thread = await WorkspaceRepository.findThreadById(workspaceId, threadId);
        if (!thread || thread.isLocked || thread.isArchived) {
            const ctx = await WorkspaceService.resolveContext(workspaceId, userId);
            if (!ctx?.isAdmin && !ctx?.isOwner) return false;
        }

        return true;
    }

    // =========================================================================
    // 2. CATEGORIES MANAGEMENT
    // =========================================================================

    static async createCategory(
        workspaceId: string,
        actorUserId: string,
        data: {
            name: string;
            departmentId?: string | null;
            displayOrder?: number;
            isPrivate?: boolean;
        },
        reqMeta: { ipAddress?: string; userAgent?: string } = {}
    ): Promise<WorkspaceChannelCategory> {
        const ctx = await WorkspaceService.resolveContext(workspaceId, actorUserId);
        if (!ctx || (!ctx.isAdmin && !ctx.isWorkspaceManager)) {
            throw new Error("Unauthorized to create channel categories.");
        }

        const category = await WorkspaceRepository.createCategory(null, {
            workspaceId,
            name: data.name.trim(),
            departmentId: data.departmentId || null,
            displayOrder: data.displayOrder ?? 0,
            isPrivate: data.isPrivate ?? false,
        });

        await WorkspaceRepository.logAudit(null, {
            workspaceId,
            actorId: actorUserId,
            action: "channel_category_created",
            targetType: "channel_category",
            targetId: category.id,
            details: { name: category.name, departmentId: category.departmentId },
            ipAddress: reqMeta.ipAddress || null,
            userAgent: reqMeta.userAgent || null,
        });

        this.broadcastEvent(workspaceId, "category:created", { category });
        return category;
    }

    static async listCategoriesWithChannels(
        workspaceId: string,
        actorUserId: string,
        departmentId?: string | null
    ): Promise<WorkspaceChannelCategory[]> {
        return this.listCategories(workspaceId, actorUserId, departmentId);
    }

    static async listCategories(
        workspaceId: string,
        actorUserId: string,
        departmentId?: string | null
    ): Promise<WorkspaceChannelCategory[]> {
        const categories = await WorkspaceRepository.listCategories(workspaceId, departmentId);
        const allChannels = await WorkspaceRepository.listChannels(workspaceId, {
            includeArchived: false,
        });

        // Filter channels user is authorized to view
        const authorizedChannels: WorkspaceChannel[] = [];
        for (const ch of allChannels) {
            const canView = await this.canViewChannel(workspaceId, ch.id, actorUserId);
            if (canView) {
                authorizedChannels.push(ch);
            }
        }

        // Attach channels to parent categories
        const unreadCounts = await WorkspaceRepository.getChannelUnreadCounts(workspaceId, actorUserId);

        const populatedCategories: WorkspaceChannelCategory[] = categories.map((cat) => {
            const catChannels = authorizedChannels
                .filter((ch) => ch.categoryId === cat.id)
                .map((ch) => ({
                    ...ch,
                    unreadCount: unreadCounts[ch.id] || 0,
                }));

            return {
                ...cat,
                channels: catChannels,
            };
        });

        return populatedCategories;
    }

    static async updateCategory(
        workspaceId: string,
        actorUserId: string,
        categoryId: string,
        data: {
            name?: string;
            displayOrder?: number;
            departmentId?: string | null;
            isPrivate?: boolean;
        },
        reqMeta: { ipAddress?: string; userAgent?: string } = {}
    ): Promise<WorkspaceChannelCategory> {
        const ctx = await WorkspaceService.resolveContext(workspaceId, actorUserId);
        if (!ctx || (!ctx.isAdmin && !ctx.isWorkspaceManager)) {
            throw new Error("Unauthorized to update channel category.");
        }

        const updated = await WorkspaceRepository.updateCategory(workspaceId, categoryId, data);
        if (!updated) throw new Error("Category not found.");

        await WorkspaceRepository.logAudit(null, {
            workspaceId,
            actorId: actorUserId,
            action: "channel_category_updated",
            targetType: "channel_category",
            targetId: categoryId,
            details: data,
            ipAddress: reqMeta.ipAddress || null,
            userAgent: reqMeta.userAgent || null,
        });

        this.broadcastEvent(workspaceId, "category:updated", { category: updated });
        return updated;
    }

    static async deleteCategory(
        workspaceId: string,
        actorUserId: string,
        categoryId: string,
        reqMeta: { ipAddress?: string; userAgent?: string } = {}
    ): Promise<boolean> {
        const ctx = await WorkspaceService.resolveContext(workspaceId, actorUserId);
        if (!ctx || (!ctx.isAdmin && !ctx.isWorkspaceManager)) {
            throw new Error("Unauthorized to delete channel category.");
        }

        const success = await WorkspaceRepository.deleteCategory(workspaceId, categoryId);
        if (success) {
            await WorkspaceRepository.logAudit(null, {
                workspaceId,
                actorId: actorUserId,
                action: "channel_category_deleted",
                targetType: "channel_category",
                targetId: categoryId,
                details: {},
                ipAddress: reqMeta.ipAddress || null,
                userAgent: reqMeta.userAgent || null,
            });
            this.broadcastEvent(workspaceId, "category:deleted", { categoryId });
        }
        return success;
    }

    // =========================================================================
    // 3. CHANNELS MANAGEMENT
    // =========================================================================

    static async createChannel(
        workspaceId: string,
        actorUserId: string,
        data: {
            name: string;
            topic?: string | null;
            categoryId?: string | null;
            departmentId?: string | null;
            channelType?: WorkspaceChannelType;
            isPrivate?: boolean;
            isCategorySynced?: boolean;
            allowedRoleIds?: string[];
            allowedMemberIds?: string[];
        },
        reqMeta: { ipAddress?: string; userAgent?: string } = {}
    ): Promise<WorkspaceChannel> {
        const ctx = await WorkspaceService.resolveContext(workspaceId, actorUserId);
        if (!ctx || (!ctx.isAdmin && !ctx.isWorkspaceManager && !ctx.permissions.includes("channels:create"))) {
            throw new Error("Unauthorized to create channels in this workspace.");
        }

        // Generate sanitized slug
        const rawSlug = data.name
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "");

        let slug = rawSlug || "channel";
        const existingSlug = await WorkspaceRepository.findChannelBySlug(workspaceId, slug);
        if (existingSlug) {
            slug = `${slug}-${Date.now().toString(36)}`;
        }

        const channel = await WorkspaceRepository.createChannel(null, {
            workspaceId,
            categoryId: data.categoryId || null,
            departmentId: data.departmentId || null,
            name: data.name.trim(),
            slug,
            topic: data.topic || null,
            channelType: data.channelType || "text",
            isPrivate: data.isPrivate ?? false,
            isCategorySynced: data.isCategorySynced ?? true,
            createdBy: actorUserId,
        });

        // If category synced, inherit category overrides immediately
        if (channel.categoryId && channel.isCategorySynced) {
            await WorkspaceRepository.syncChannelWithCategory(workspaceId, channel.id, channel.categoryId);
        }

        // If private channel with explicit allowed roles/members, insert allowed overrides
        if (channel.isPrivate) {
            if (data.allowedRoleIds) {
                for (const rId of data.allowedRoleIds) {
                    await WorkspaceRepository.setChannelOverride(workspaceId, {
                        channelId: channel.id,
                        roleId: rId,
                        allowPermissions: ["view_channel", "send_messages", "send_thread_messages"],
                    });
                }
            }
            if (data.allowedMemberIds) {
                for (const mId of data.allowedMemberIds) {
                    await WorkspaceRepository.setChannelOverride(workspaceId, {
                        channelId: channel.id,
                        memberId: mId,
                        allowPermissions: ["view_channel", "send_messages", "send_thread_messages"],
                    });
                }
            }
        }

        await WorkspaceRepository.logAudit(null, {
            workspaceId,
            actorId: actorUserId,
            action: "channel_created",
            targetType: "channel",
            targetId: channel.id,
            details: { name: channel.name, slug: channel.slug, isPrivate: channel.isPrivate },
            ipAddress: reqMeta.ipAddress || null,
            userAgent: reqMeta.userAgent || null,
        });

        this.broadcastEvent(workspaceId, "channel:created", { channel });
        return channel;
    }

    static async getChannelDetails(
        workspaceId: string,
        actorUserId: string,
        channelId: string
    ): Promise<WorkspaceChannel & { overrides?: WorkspaceChannelOverride[] }> {
        const canView = await this.canViewChannel(workspaceId, channelId, actorUserId);
        if (!canView) {
            throw new Error("Channel not found or you do not have permission to view this channel.");
        }

        const channel = await WorkspaceRepository.findChannelById(workspaceId, channelId);
        if (!channel) throw new Error("Channel not found.");

        const overrides = await WorkspaceRepository.getOverridesForChannel(workspaceId, channelId);
        return {
            ...channel,
            overrides,
        };
    }

    static async updateChannel(
        workspaceId: string,
        actorUserId: string,
        channelId: string,
        data: Partial<WorkspaceChannel> & { syncWithNewCategory?: boolean },
        reqMeta: { ipAddress?: string; userAgent?: string } = {}
    ): Promise<WorkspaceChannel> {
        const ctx = await WorkspaceService.resolveContext(workspaceId, actorUserId);
        if (!ctx || (!ctx.isAdmin && !ctx.isWorkspaceManager && !ctx.permissions.includes("channels:manage"))) {
            throw new Error("Unauthorized to edit channel settings.");
        }

        const existing = await WorkspaceRepository.findChannelById(workspaceId, channelId);
        if (!existing) throw new Error("Channel not found.");

        // If category is changing and syncWithNewCategory is requested
        if (data.categoryId && data.categoryId !== existing.categoryId && data.syncWithNewCategory) {
            data.isCategorySynced = true;
            await WorkspaceRepository.syncChannelWithCategory(workspaceId, channelId, data.categoryId);
        }

        const updated = await WorkspaceRepository.updateChannel(workspaceId, channelId, data);
        if (!updated) throw new Error("Failed to update channel.");

        await WorkspaceRepository.logAudit(null, {
            workspaceId,
            actorId: actorUserId,
            action: "channel_updated",
            targetType: "channel",
            targetId: channelId,
            details: data,
            ipAddress: reqMeta.ipAddress || null,
            userAgent: reqMeta.userAgent || null,
        });

        this.broadcastEvent(workspaceId, "channel:updated", { channel: updated });
        return updated;
    }

    static async deleteChannel(
        workspaceId: string,
        actorUserId: string,
        channelId: string,
        reqMeta: { ipAddress?: string; userAgent?: string } = {}
    ): Promise<boolean> {
        const ctx = await WorkspaceService.resolveContext(workspaceId, actorUserId);
        if (!ctx || (!ctx.isAdmin && !ctx.isWorkspaceManager)) {
            throw new Error("Unauthorized to delete channel.");
        }

        const success = await WorkspaceRepository.deleteChannel(workspaceId, channelId);
        if (success) {
            await WorkspaceRepository.logAudit(null, {
                workspaceId,
                actorId: actorUserId,
                action: "channel_deleted",
                targetType: "channel",
                targetId: channelId,
                details: {},
                ipAddress: reqMeta.ipAddress || null,
                userAgent: reqMeta.userAgent || null,
            });
            this.broadcastEvent(workspaceId, "channel:deleted", { channelId });
        }
        return success;
    }

    // =========================================================================
    // 4. CATEGORY PERMISSION SYNCHRONIZATION
    // =========================================================================

    static async setChannelOverride(
        workspaceId: string,
        actorUserId: string,
        channelId: string,
        overrideData: {
            roleId?: string | null;
            memberId?: string | null;
            allowPermissions?: string[];
            denyPermissions?: string[];
        },
        reqMeta: { ipAddress?: string; userAgent?: string } = {}
    ): Promise<WorkspaceChannelOverride> {
        const ctx = await WorkspaceService.resolveContext(workspaceId, actorUserId);
        if (!ctx || (!ctx.isAdmin && !ctx.isWorkspaceManager)) {
            throw new Error("Unauthorized to configure channel permission overrides.");
        }

        // Setting an explicit channel override un-syncs the channel from parent category
        await WorkspaceRepository.updateChannel(workspaceId, channelId, { isCategorySynced: false });

        const override = await WorkspaceRepository.setChannelOverride(workspaceId, {
            channelId,
            ...overrideData,
        });

        await WorkspaceRepository.logAudit(null, {
            workspaceId,
            actorId: actorUserId,
            action: "channel_override_configured",
            targetType: "channel_override",
            targetId: override.id,
            details: overrideData,
            ipAddress: reqMeta.ipAddress || null,
            userAgent: reqMeta.userAgent || null,
        });

        return override;
    }

    static async setCategoryOverride(
        workspaceId: string,
        actorUserId: string,
        categoryId: string,
        overrideData: {
            roleId?: string | null;
            memberId?: string | null;
            allowPermissions?: string[];
            denyPermissions?: string[];
        },
        reqMeta: { ipAddress?: string; userAgent?: string } = {}
    ): Promise<WorkspaceChannelOverride> {
        const ctx = await WorkspaceService.resolveContext(workspaceId, actorUserId);
        if (!ctx || (!ctx.isAdmin && !ctx.isWorkspaceManager)) {
            throw new Error("Unauthorized to configure category permission overrides.");
        }

        const override = await WorkspaceRepository.setCategoryOverride(workspaceId, {
            categoryId,
            ...overrideData,
        });

        await WorkspaceRepository.logAudit(null, {
            workspaceId,
            actorId: actorUserId,
            action: "category_override_configured",
            targetType: "category_override",
            targetId: override.id,
            details: overrideData,
            ipAddress: reqMeta.ipAddress || null,
            userAgent: reqMeta.userAgent || null,
        });

        return override;
    }

    static async syncChannelWithCategory(
        workspaceId: string,
        actorUserId: string,
        channelId: string,
        reqMeta: { ipAddress?: string; userAgent?: string } = {}
    ): Promise<boolean> {
        const ctx = await WorkspaceService.resolveContext(workspaceId, actorUserId);
        if (!ctx || (!ctx.isAdmin && !ctx.isWorkspaceManager)) {
            throw new Error("Unauthorized to synchronize channel permissions.");
        }

        const channel = await WorkspaceRepository.findChannelById(workspaceId, channelId);
        if (!channel || !channel.categoryId) {
            throw new Error("Channel does not have a parent category to sync with.");
        }

        await WorkspaceRepository.syncChannelWithCategory(workspaceId, channelId, channel.categoryId);

        await WorkspaceRepository.logAudit(null, {
            workspaceId,
            actorId: actorUserId,
            action: "channel_synced_with_category",
            targetType: "channel",
            targetId: channelId,
            details: { categoryId: channel.categoryId },
            ipAddress: reqMeta.ipAddress || null,
            userAgent: reqMeta.userAgent || null,
        });

        return true;
    }

    // =========================================================================
    // 5. MESSAGING & REACTIONS
    // =========================================================================

    static async sendMessage(
        workspaceId: string,
        actorUserId: string,
        channelId: string,
        data: {
            content: string;
            messageType?: "text" | "announcement" | "system";
            parentMessageId?: string | null;
            threadId?: string | null;
            attachments?: Array<{
                fileName: string;
                fileSizeBytes: number;
                mimeType: string;
                cloudinaryUrl: string;
                cloudinarySecureUrl: string;
                cloudinaryPublicId: string;
            }>;
        },
        reqMeta: { ipAddress?: string; userAgent?: string } = {}
    ): Promise<WorkspaceMessage> {
        // Enforce authorization
        if (data.threadId) {
            const canThread = await this.canPostInThread(workspaceId, channelId, data.threadId, actorUserId);
            if (!canThread) throw new Error("Unauthorized to post in this thread.");
        } else {
            const canPost = await this.canPostInChannel(workspaceId, channelId, actorUserId);
            if (!canPost) throw new Error("Unauthorized to post in this channel.");
        }

        const ctx = await WorkspaceService.resolveContext(workspaceId, actorUserId);
        if (!ctx) throw new Error("Sender is not a workspace member.");

        // Extract mentions (@username, @role, @everyone)
        const mentions = this.extractMentions(data.content);

        const message = await WorkspaceRepository.createMessage(null, {
            workspaceId,
            channelId,
            senderId: actorUserId,
            senderMemberId: ctx.member.id,
            content: data.content.trim(),
            messageType: data.messageType || "text",
            parentMessageId: data.parentMessageId || null,
            threadId: data.threadId || null,
            mentions,
        });

        // Insert attachments if present
        if (data.attachments && data.attachments.length > 0) {
            for (const att of data.attachments) {
                await query(
                    `INSERT INTO public.workspace_files (
                        workspace_id,
                        uploader_id,
                        channel_id,
                        message_id,
                        file_name,
                        file_size_bytes,
                        mime_type,
                        cloudinary_public_id,
                        cloudinary_url,
                        cloudinary_secure_url,
                        purpose
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'attachment'
                    );`,
                    [
                        workspaceId,
                        actorUserId,
                        channelId,
                        message.id,
                        att.fileName,
                        att.fileSizeBytes,
                        att.mimeType,
                        att.cloudinaryPublicId,
                        att.cloudinaryUrl,
                        att.cloudinarySecureUrl,
                    ]
                );
            }
        }

        // Fetch populated message
        const populatedMessage = await WorkspaceRepository.findMessageById(workspaceId, message.id);
        const finalMessage = populatedMessage || message;

        // Broadcast real-time SSE event to authorized members
        this.broadcastEvent(workspaceId, "message:new", {
            channelId,
            message: finalMessage,
        });

        return finalMessage;
    }

    static async listMessages(
        workspaceId: string,
        actorUserId: string,
        channelId: string,
        options: {
            threadId?: string | null;
            before?: string;
            after?: string;
            limit?: number;
        } = {}
    ): Promise<WorkspaceMessage[]> {
        // Enforce authorization: unauthorized users receive 404 / error
        const canView = await this.canViewChannel(workspaceId, channelId, actorUserId);
        if (!canView) {
            throw new Error("Channel not found or you do not have permission to view messages.");
        }

        return await WorkspaceRepository.listMessages(workspaceId, channelId, options);
    }

    static async editMessage(
        workspaceId: string,
        actorUserId: string,
        messageId: string,
        content: string
    ): Promise<WorkspaceMessage> {
        const msg = await WorkspaceRepository.findMessageById(workspaceId, messageId);
        if (!msg) throw new Error("Message not found.");

        if (msg.senderId !== actorUserId) {
            throw new Error("You can only edit your own messages.");
        }

        const updated = await WorkspaceRepository.updateMessage(workspaceId, messageId, actorUserId, content.trim());
        if (!updated) throw new Error("Failed to edit message.");

        this.broadcastEvent(workspaceId, "message:updated", {
            channelId: msg.channelId,
            message: updated,
        });

        return updated;
    }

    static async deleteMessage(
        workspaceId: string,
        actorUserId: string,
        messageId: string
    ): Promise<boolean> {
        const msg = await WorkspaceRepository.findMessageById(workspaceId, messageId);
        if (!msg) throw new Error("Message not found.");

        const ctx = await WorkspaceService.resolveContext(workspaceId, actorUserId);
        const isAuthor = msg.senderId === actorUserId;
        const canDeleteAny = ctx?.isAdmin || ctx?.isOwner || ctx?.permissions.includes("messages:delete_any") || false;

        if (!isAuthor && !canDeleteAny) {
            throw new Error("Unauthorized to delete this message.");
        }

        const deleted = await WorkspaceRepository.deleteMessage(workspaceId, messageId, actorUserId, canDeleteAny);
        if (deleted) {
            this.broadcastEvent(workspaceId, "message:deleted", {
                channelId: msg.channelId,
                messageId,
            });
        }
        return deleted;
    }

    static async togglePinMessage(
        workspaceId: string,
        actorUserId: string,
        messageId: string,
        isPinned: boolean
    ): Promise<boolean> {
        const msg = await WorkspaceRepository.findMessageById(workspaceId, messageId);
        if (!msg) throw new Error("Message not found.");

        const ctx = await WorkspaceService.resolveContext(workspaceId, actorUserId);
        if (!ctx || (!ctx.isAdmin && !ctx.isOwner && !ctx.permissions.includes("messages:pin"))) {
            throw new Error("Unauthorized to pin messages in this channel.");
        }

        const pinned = await WorkspaceRepository.setPinnedMessage(workspaceId, messageId, actorUserId, isPinned);
        if (pinned) {
            this.broadcastEvent(workspaceId, "message:pinned", {
                channelId: msg.channelId,
                messageId,
                isPinned,
            });
        }
        return pinned;
    }

    static async toggleReaction(
        workspaceId: string,
        actorUserId: string,
        messageId: string,
        emoji: string
    ): Promise<boolean> {
        const msg = await WorkspaceRepository.findMessageById(workspaceId, messageId);
        if (!msg) throw new Error("Message not found.");

        const canView = await this.canViewChannel(workspaceId, msg.channelId, actorUserId);
        if (!canView) throw new Error("Unauthorized to interact with this message.");

        // Check if user already reacted with this emoji
        const existing = await query(
            `SELECT 1 FROM public.workspace_message_reactions
             WHERE message_id = $1 AND user_id = $2 AND emoji = $3;`,
            [messageId, actorUserId, emoji]
        );

        let added = false;
        if (existing.rows.length > 0) {
            await WorkspaceRepository.removeReaction(workspaceId, messageId, actorUserId, emoji);
        } else {
            await WorkspaceRepository.addReaction(workspaceId, messageId, actorUserId, emoji);
            added = true;
        }

        this.broadcastEvent(workspaceId, added ? "reaction:added" : "reaction:removed", {
            channelId: msg.channelId,
            messageId,
            userId: actorUserId,
            emoji,
        });

        return added;
    }

    // =========================================================================
    // 6. THREADS
    // =========================================================================

    static async createThread(
        workspaceId: string,
        actorUserId: string,
        channelId: string,
        parentMessageId: string,
        name: string,
        reqMeta: { ipAddress?: string; userAgent?: string } = {}
    ): Promise<WorkspaceThread> {
        const canView = await this.canViewChannel(workspaceId, channelId, actorUserId);
        if (!canView) throw new Error("Unauthorized to create threads in this channel.");

        const parentMsg = await WorkspaceRepository.findMessageById(workspaceId, parentMessageId);
        if (!parentMsg) throw new Error("Parent message not found.");

        const thread = await WorkspaceRepository.createThread(null, {
            workspaceId,
            channelId,
            parentMessageId,
            name: name.trim(),
            creatorId: actorUserId,
        });

        await WorkspaceRepository.logAudit(null, {
            workspaceId,
            actorId: actorUserId,
            action: "thread_created",
            targetType: "thread",
            targetId: thread.id,
            details: { name: thread.name, channelId, parentMessageId },
            ipAddress: reqMeta.ipAddress || null,
            userAgent: reqMeta.userAgent || null,
        });

        this.broadcastEvent(workspaceId, "thread:created", {
            channelId,
            thread,
        });

        return thread;
    }

    static async getThread(
        workspaceId: string,
        actorUserId: string,
        threadId: string
    ): Promise<WorkspaceThread> {
        const thread = await WorkspaceRepository.findThreadById(workspaceId, threadId);
        if (!thread) throw new Error("Thread not found.");

        // Thread strictly inherits access from its parent channel
        const canView = await this.canViewChannel(workspaceId, thread.channelId, actorUserId);
        if (!canView) {
            throw new Error("Thread not found or you do not have permission to view this thread.");
        }

        return thread;
    }

    static async updateThread(
        workspaceId: string,
        actorUserId: string,
        threadId: string,
        data: { name?: string; isLocked?: boolean; isArchived?: boolean },
        reqMeta: { ipAddress?: string; userAgent?: string } = {}
    ): Promise<WorkspaceThread> {
        const thread = await this.getThread(workspaceId, actorUserId, threadId);
        const ctx = await WorkspaceService.resolveContext(workspaceId, actorUserId);

        const isCreator = thread.creatorId === actorUserId;
        const canManage = ctx?.isAdmin || ctx?.isOwner || ctx?.permissions.includes("threads:manage");

        if (!isCreator && !canManage) {
            throw new Error("Unauthorized to modify this thread.");
        }

        const updated = await WorkspaceRepository.updateThread(workspaceId, threadId, data, actorUserId);
        if (!updated) throw new Error("Failed to update thread.");

        this.broadcastEvent(workspaceId, "thread:updated", {
            channelId: thread.channelId,
            thread: updated,
        });

        return updated;
    }

    static async listThreads(
        workspaceId: string,
        actorUserId: string,
        channelId: string,
        includeArchived = false
    ): Promise<WorkspaceThread[]> {
        const canView = await this.canViewChannel(workspaceId, channelId, actorUserId);
        if (!canView) {
            throw new Error("Channel not found or you do not have permission to view threads.");
        }

        return await WorkspaceRepository.listThreadsForChannel(workspaceId, channelId, includeArchived);
    }

    // =========================================================================
    // 7. READ RECEIPTS & SEARCH
    // =========================================================================

    static async markChannelRead(
        workspaceId: string,
        actorUserId: string,
        channelId: string,
        lastReadMessageId?: string | null
    ): Promise<void> {
        const canView = await this.canViewChannel(workspaceId, channelId, actorUserId);
        if (!canView) return;

        await WorkspaceRepository.markChannelRead(channelId, actorUserId, lastReadMessageId);
    }

    static async getUnreadCounts(
        workspaceId: string,
        actorUserId: string
    ): Promise<Record<string, number>> {
        return await WorkspaceRepository.getChannelUnreadCounts(workspaceId, actorUserId);
    }

    static async searchMessages(
        workspaceId: string,
        actorUserId: string,
        queryText: string,
        limit = 30
    ): Promise<WorkspaceMessage[]> {
        const rawResults = await WorkspaceRepository.searchMessages(workspaceId, queryText, undefined, limit);
        // Strict privacy filter: unauthorized channels are excluded from search results
        const filtered: WorkspaceMessage[] = [];
        for (const msg of rawResults) {
            const allowed = await this.canViewChannel(workspaceId, msg.channelId, actorUserId);
            if (allowed) {
                filtered.push(msg);
            }
        }
        return filtered;
    }

    // =========================================================================
    // 8. REALTIME EVENT EMISSION & SSE STREAM
    // =========================================================================

    private static broadcastEvent(workspaceId: string, event: string, payload: any) {
        workspaceEventBus.emit(`workspace:${workspaceId}`, {
            event,
            payload,
            timestamp: new Date().toISOString(),
        });
    }

    private static extractMentions(content: string) {
        const userMatches = content.match(/@([a-zA-Z0-9_]+)/g) || [];
        const users = userMatches.map((m) => m.slice(1).toLowerCase());
        const everyone = content.includes("@everyone") || content.includes("@channel");

        return {
            users,
            roles: [],
            everyone,
        };
    }
}
