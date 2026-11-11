// Backend/src/services/workspace/workspaceRecognitionService.ts
import { pool, query } from "../../database/client.js";
import { WorkspaceService } from "./workspaceService.js";
import { WorkspaceRepository } from "../../repositories/workspaceRepository.js";
import { WorkspaceRedisService } from "../../redis/workspaceRedis.js";
import { workspaceEventBus } from "./workspaceChannelService.js";
import { WorkspaceNotificationService } from "./workspaceNotificationService.js";
import type {
    WorkspaceRecognitionPolicy,
    WorkspaceRecognitionCategory,
    WorkspaceRecognitionBudget,
    WorkspaceRecognitionLedgerEntry,
    AwardOrbitsDTO,
    ReverseAwardDTO,
    MemberRecognitionSummary,
    LeaderboardPeriod,
    ThreeLeaderboardsResponse,
} from "../../types/workspaceTypes.js";

export class WorkspaceRecognitionService {
    /**
     * Executes an atomic award transaction with complete zero-trust validation.
     */
    static async awardOrbits(
        workspaceId: string,
        issuerUserId: string,
        dto: AwardOrbitsDTO,
        reqMeta: { ipAddress?: string; userAgent?: string } = {}
    ): Promise<WorkspaceRecognitionLedgerEntry> {
        // 1. Authenticate issuer and resolve canonical workspace context
        const ctx = await WorkspaceService.resolveContext(workspaceId, issuerUserId);
        if (!ctx || ctx.member.isSuspended || ctx.member.membershipStatus !== "active") {
            throw new Error("Unauthorized: Active workspace membership required to award Orbits.");
        }

        // 2. Validate policy is enabled
        const policy = await WorkspaceRepository.getRecognitionPolicy(workspaceId);
        if (!policy.isEnabled) {
            throw new Error("Orbix Recognition is currently disabled for this workspace.");
        }

        // 3. Idempotency Check
        if (dto.idempotencyKey) {
            const existing = await WorkspaceRepository.findRecognitionByIdempotencyKey(
                workspaceId,
                dto.idempotencyKey
            );
            if (existing) {
                return existing;
            }
        }

        // 4. Resolve and validate recipient
        if (dto.recipientUserId === issuerUserId) {
            throw new Error("Invalid award: Members cannot award Orbits to themselves.");
        }

        const recipientMember = await WorkspaceRepository.findMember(workspaceId, dto.recipientUserId);
        if (!recipientMember || recipientMember.workspaceId !== workspaceId) {
            throw new Error("Recipient is not a member of this workspace.");
        }
        if (recipientMember.isSuspended || recipientMember.membershipStatus !== "active") {
            throw new Error("Cannot award Orbits to a suspended or inactive member.");
        }

        // 5. Zero-Trust Authority & Hierarchy Validation
        const isOwner = ctx.isOwner;
        const isWorkspaceManager = ctx.isWorkspaceManager || (ctx.isAdmin && !isOwner);
        const recipientRank = recipientMember.role?.rank ?? 200;

        if (!isOwner && !isWorkspaceManager) {
            // Check if explicitly delegated recognition:award permission
            if (!ctx.permissions.includes("recognition:award")) {
                throw new Error("Unauthorized: You do not possess authority to award Orbits.");
            }
        }

        // Hierarchy rule: Workspace Manager cannot award Club Owner or users with equal/higher rank
        if (!isOwner && isWorkspaceManager) {
            if (recipientMember.role?.slug === "owner" || recipientRank >= 1000) {
                throw new Error("Authority restriction: Workspace Managers cannot award points to the Club Owner.");
            }
            if (recipientRank >= 800) {
                throw new Error("Authority restriction: Cannot award users with equal or superior managerial rank.");
            }
        }

        // 6. Validate Points Amount
        const amount = dto.amount;
        if (!Number.isInteger(amount) || amount <= 0) {
            throw new Error("Award amount must be a positive integer.");
        }
        if (amount < policy.minPointsPerAward) {
            throw new Error(`Minimum award amount is ${policy.minPointsPerAward} Orbits.`);
        }
        if (amount > policy.maxPointsPerAward) {
            throw new Error(`Maximum single award amount is ${policy.maxPointsPerAward} Orbits.`);
        }

        // 7. Validate Appreciation Reason Quality
        const trimmedReason = (dto.reason || "").trim();
        if (trimmedReason.length < policy.minReasonLength) {
            throw new Error(`Appreciation reason must be at least ${policy.minReasonLength} characters.`);
        }
        if (trimmedReason.length > 500) {
            throw new Error("Appreciation reason cannot exceed 500 characters.");
        }

        // 8. Validate Category
        const category = await WorkspaceRepository.findRecognitionCategoryBySlugOrId(
            workspaceId,
            dto.categorySlugOrId
        );
        if (!category || !category.isActive) {
            throw new Error("Invalid or inactive recognition category selected.");
        }

        // 9. Optional Linked Task Verification
        if (policy.requireTaskLink && !dto.linkedTaskId) {
            throw new Error("Policy requirement: Every recognition award must link a completed task.");
        }
        if (dto.linkedTaskId) {
            const task = await WorkspaceRepository.findTaskById(workspaceId, dto.linkedTaskId);
            if (!task) {
                throw new Error("Linked task not found in this workspace.");
            }
        }

        // 10. Date formatting for window bounds
        const now = new Date();
        const yearMonth = now.toISOString().slice(0, 7);
        const dateStr = now.toISOString().slice(0, 10);

        // 11. Rate Limit: Daily Issuer Awards
        const dailyCount = await WorkspaceRepository.getIssuerDailyAwardCount(
            null,
            workspaceId,
            issuerUserId,
            dateStr
        );
        if (dailyCount >= policy.dailyAwardLimitPerIssuer && !isOwner) {
            throw new Error(`Daily award velocity limit reached (${policy.dailyAwardLimitPerIssuer} awards/day).`);
        }

        // 12. Anti-Collusion: Recipient Monthly Inflow Cap
        const currentInflow = await WorkspaceRepository.getRecipientMonthlyInflow(
            null,
            workspaceId,
            dto.recipientUserId,
            yearMonth
        );
        if (currentInflow + amount > policy.recipientMonthlyCap) {
            const remaining = Math.max(0, policy.recipientMonthlyCap - currentInflow);
            throw new Error(`Recipient monthly allowance exceeded. Remaining capacity: ${remaining} Orbits.`);
        }

        // 13. Atomic Database Transaction
        const client = await pool.connect();
        try {
            await client.query("BEGIN;");

            // Consume Workspace Manager Budget if not supreme Owner
            if (!isOwner && isWorkspaceManager) {
                await WorkspaceRepository.consumeRecognitionBudget(
                    client,
                    workspaceId,
                    issuerUserId,
                    yearMonth,
                    amount
                );
            }

            // Insert Ledger Entry
            const ledgerEntry = await WorkspaceRepository.insertRecognitionLedgerEntry(client, {
                workspaceId,
                recipientId: dto.recipientUserId,
                issuerId: issuerUserId,
                departmentId: dto.departmentId || recipientMember.departmentId || null,
                transactionType: "award",
                pointsDelta: amount,
                categoryId: category.id,
                appreciationReason: trimmedReason,
                linkedTaskId: dto.linkedTaskId || null,
                linkedMilestoneId: dto.linkedMilestoneId || null,
                evidenceUrl: dto.evidenceUrl || null,
                idempotencyKey: dto.idempotencyKey || null,
                visibility: dto.visibility || "workspace",
                ipAddress: reqMeta.ipAddress || null,
                userAgent: reqMeta.userAgent || null,
            });

            // Update Period Aggregates
            await WorkspaceRepository.adjustRecognitionAggregates(
                client,
                workspaceId,
                dto.recipientUserId,
                amount,
                false
            );

            // Insert Outbox Event
            await WorkspaceRepository.createOutboxEvent(
                {
                    workspaceId,
                    eventType: "recognition:awarded",
                    payload: {
                        awardId: ledgerEntry.id,
                        recipientId: dto.recipientUserId,
                        issuerId: issuerUserId,
                        amount,
                        categoryId: category.id,
                        categoryName: category.name,
                        reason: trimmedReason,
                        createdAt: ledgerEntry.createdAt,
                    },
                },
                client
            );

            await client.query("COMMIT;");

            // 14. Realtime Broadcast & In-App Notification
            workspaceEventBus.emit(workspaceId, "recognition:awarded", {
                awardId: ledgerEntry.id,
                recipientId: dto.recipientUserId,
                issuerId: issuerUserId,
                amount,
                categoryName: category.name,
                reason: trimmedReason,
            });

            // In-app notification to recipient
            const issuerName = ctx.member.user?.firstName 
                ? `${ctx.member.user.firstName} ${ctx.member.user.lastName || ""}`.trim()
                : (ctx.member.user?.username || "A workspace leader");

            WorkspaceRepository.createNotification({
                workspaceId,
                recipientId: dto.recipientUserId,
                actorId: issuerUserId,
                eventType: "recognition_awarded",
                resourceType: "recognition",
                resourceId: ledgerEntry.id,
                title: `You received +${amount} Orbits!`,
                message: `${issuerName} recognized you for ${category.name}: "${trimmedReason}"`,
                destinationUrl: `/workspace/${workspaceId}/recognition`,
                metadata: {
                    awardId: ledgerEntry.id,
                    amount,
                    categoryId: category.id,
                    categoryName: category.name,
                },
            }).catch((err) => console.warn("[RecognitionService] Notification failed:", err.message));

            // Leaderboard milestone notification (prevent spam, only for top ranks <= 3)
            WorkspaceRepository.getMemberRecognitionSummary(workspaceId, dto.recipientUserId)
                .then((newSummary) => {
                    if (newSummary.contributorRank && newSummary.contributorRank <= 3) {
                        WorkspaceRepository.createNotification({
                            workspaceId,
                            recipientId: dto.recipientUserId,
                            actorId: issuerUserId,
                            eventType: "recognition_rank_changed",
                            resourceType: "recognition",
                            resourceId: ledgerEntry.id,
                            title: "Leaderboard Milestone!",
                            message: `Congratulations! You reached rank #${newSummary.contributorRank} on the Workspace Recognition Leaderboard!`,
                            destinationUrl: `/workspace/${workspaceId}/recognition`,
                            metadata: {
                                newRank: newSummary.contributorRank,
                                totalOrbits: newSummary.totalOrbitsEarned,
                            },
                        }).catch(() => {});
                    }
                })
                .catch(() => {});

            return ledgerEntry;
        } catch (err) {
            await client.query("ROLLBACK;");
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Executes an audited compensating reversal for an erroneous award.
     */
    static async reverseAward(
        workspaceId: string,
        actorUserId: string,
        awardId: string,
        dto: ReverseAwardDTO,
        reqMeta: { ipAddress?: string; userAgent?: string } = {}
    ): Promise<{ reversalEntry: WorkspaceRecognitionLedgerEntry; originalEntry: WorkspaceRecognitionLedgerEntry }> {
        const ctx = await WorkspaceService.resolveContext(workspaceId, actorUserId);
        if (!ctx || ctx.member.isSuspended || ctx.member.membershipStatus !== "active") {
            throw new Error("Unauthorized to perform recognition reversals.");
        }

        const original = await WorkspaceRepository.findRecognitionLedgerEntryById(workspaceId, awardId);
        if (!original) {
            throw new Error("Original recognition award not found.");
        }

        // Authority: Must be Club Owner OR original issuer
        const isOwner = ctx.isOwner;
        const isOriginalIssuer = original.issuerId === actorUserId;
        if (!isOwner && !isOriginalIssuer) {
            throw new Error("Only the Club Owner or the original award issuer has authority to reverse this award.");
        }

        const reversalReason = (dto.reversalReason || "").trim();
        if (reversalReason.length < 10) {
            throw new Error("A detailed reversal reason of at least 10 characters is mandatory.");
        }

        const client = await pool.connect();
        try {
            await client.query("BEGIN;");

            const result = await WorkspaceRepository.reverseRecognitionAward(
                client,
                workspaceId,
                awardId,
                actorUserId,
                reversalReason,
                dto.idempotencyKey || null,
                reqMeta.ipAddress || null,
                reqMeta.userAgent || null
            );

            await client.query("COMMIT;");

            // Realtime Broadcast
            workspaceEventBus.emit(workspaceId, "recognition:reversed", {
                originalAwardId: awardId,
                reversalId: result.reversalEntry.id,
                recipientId: original.recipientId,
                pointsDelta: -original.pointsDelta,
                reversedBy: actorUserId,
            });

            return result;
        } catch (err) {
            await client.query("ROLLBACK;");
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Retrieves recognition policy for workspace.
     */
    static async getPolicy(workspaceId: string, actorUserId: string): Promise<WorkspaceRecognitionPolicy> {
        const ctx = await WorkspaceService.resolveContext(workspaceId, actorUserId);
        if (!ctx) throw new Error("Unauthorized: Workspace membership required.");
        return WorkspaceRepository.getRecognitionPolicy(workspaceId);
    }

    /**
     * Updates recognition policy (Club Owner only).
     */
    static async updatePolicy(
        workspaceId: string,
        actorUserId: string,
        updates: Partial<WorkspaceRecognitionPolicy>
    ): Promise<WorkspaceRecognitionPolicy> {
        const ctx = await WorkspaceService.resolveContext(workspaceId, actorUserId);
        if (!ctx || !ctx.isOwner) {
            throw new Error("Only the Club Owner has authority to modify recognition policies and limits.");
        }
        return WorkspaceRepository.updateRecognitionPolicy(null, workspaceId, updates, actorUserId);
    }

    /**
     * Lists active recognition categories.
     */
    static async getCategories(workspaceId: string, actorUserId: string): Promise<WorkspaceRecognitionCategory[]> {
        const ctx = await WorkspaceService.resolveContext(workspaceId, actorUserId);
        if (!ctx) throw new Error("Unauthorized: Workspace membership required.");
        return WorkspaceRepository.listRecognitionCategories(workspaceId, true);
    }

    /**
     * Lists recognition history with role-aware and visibility-aware scoping.
     */
    static async getLedgerHistory(
        workspaceId: string,
        actorUserId: string,
        options: {
            recipientId?: string;
            issuerId?: string;
            departmentId?: string;
            categoryId?: string;
            limit?: number;
            offset?: number;
        } = {}
    ): Promise<{ entries: WorkspaceRecognitionLedgerEntry[]; total: number }> {
        const ctx = await WorkspaceService.resolveContext(workspaceId, actorUserId);
        if (!ctx || ctx.member.isSuspended) throw new Error("Unauthorized: Workspace membership required.");

        const policy = await WorkspaceRepository.getRecognitionPolicy(workspaceId);
        const isOwnerOrManager = ctx.isOwner || ctx.isWorkspaceManager || (ctx.member.role?.rank ?? 0) >= 800;

        return WorkspaceRepository.listRecognitionLedger(workspaceId, {
            ...options,
            viewerUserId: actorUserId,
            canViewAllPrivate: isOwnerOrManager,
            isWorkspaceVisible: policy.isWorkspaceVisible,
        });
    }

    /**
     * Retrieves a single recognition award by ID, enforcing strict zero-trust visibility checks.
     */
    static async getAwardById(
        workspaceId: string,
        actorUserId: string,
        awardId: string
    ): Promise<WorkspaceRecognitionLedgerEntry> {
        const ctx = await WorkspaceService.resolveContext(workspaceId, actorUserId);
        if (!ctx || ctx.member.isSuspended) throw new Error("Unauthorized: Workspace membership required.");

        const award = await WorkspaceRepository.getRecognitionAwardById(workspaceId, awardId);
        if (!award) {
            throw new Error("Recognition award not found.");
        }

        // Privacy Check: if award is recipient_only / private
        const isPrivate = award.visibility === "recipient_only" || award.visibility === "private";
        if (isPrivate) {
            const isRecipient = award.recipientId === actorUserId;
            const isIssuer = award.issuerId === actorUserId;
            const isOwnerOrManager = ctx.isOwner || ctx.isWorkspaceManager || (ctx.member.role?.rank ?? 0) >= 800;

            if (!isRecipient && !isIssuer && !isOwnerOrManager) {
                throw new Error("Access denied: This recognition award is private.");
            }
        }

        return award;
    }

    /**
     * Retrieves department-level recognition totals, member contributions, and rankings.
     */
    static async getDepartmentRecognition(
        workspaceId: string,
        actorUserId: string,
        departmentId: string
    ) {
        const ctx = await WorkspaceService.resolveContext(workspaceId, actorUserId);
        if (!ctx || ctx.member.isSuspended) throw new Error("Unauthorized: Workspace membership required.");

        const isOwnerOrManager = ctx.isOwner || ctx.isWorkspaceManager || (ctx.member.role?.rank ?? 0) >= 800;
        const memberDeptIds = [
            ctx.member.departmentId,
            ...(ctx.member.departments?.map((d: any) => d.id) || []),
        ].filter(Boolean);

        if (!isOwnerOrManager && !memberDeptIds.includes(departmentId)) {
            throw new Error("Access denied: You can only view recognition for your assigned department.");
        }

        return WorkspaceRepository.getDepartmentRecognitionSummary(workspaceId, departmentId);
    }

    /**
     * Retrieves a member's compact recognition profile for club workspace displays.
     */
    static async getMemberRecognitionProfile(
        workspaceId: string,
        actorUserId: string,
        targetUserId: string
    ) {
        const ctx = await WorkspaceService.resolveContext(workspaceId, actorUserId);
        if (!ctx || ctx.member.isSuspended) throw new Error("Unauthorized: Workspace membership required.");

        const targetMember = await WorkspaceRepository.findMemberByUserId(workspaceId, targetUserId);
        if (!targetMember) throw new Error("Workspace member not found.");

        const summary = await WorkspaceRepository.getMemberRecognitionSummary(workspaceId, targetUserId);
        
        // Filter recent awards for visibility
        const isSelf = actorUserId === targetUserId;
        const isOwnerOrManager = ctx.isOwner || ctx.isWorkspaceManager || (ctx.member.role?.rank ?? 0) >= 800;
        const visibleAwards = (summary.recentAwards || []).filter((award: any) => {
            if (isSelf || isOwnerOrManager) return true;
            return award.visibility === "workspace";
        });

        return {
            userId: targetMember.userId,
            name: `${targetMember.user?.firstName || ""} ${targetMember.user?.lastName || ""}`.trim() || targetMember.user?.username || "Teammate",
            username: targetMember.user?.username || "",
            avatarUrl: targetMember.user?.avatarUrl,
            roleTitle: targetMember.roleTitle || targetMember.role?.name || "Member",
            department: targetMember.department ? {
                id: targetMember.department.id,
                name: targetMember.department.name,
                color: targetMember.department.color,
            } : null,
            totalOrbitsEarned: summary.totalOrbitsEarned,
            contributorRank: summary.contributorRank,
            awardsReceivedCount: summary.awardsReceivedCount,
            recentAwards: visibleAwards,
        };
    }

    /**
     * Appends an appreciation note to an existing recognition award and notifies the recipient.
     */
    static async addAppreciationNote(
        workspaceId: string,
        actorUserId: string,
        awardId: string,
        note: string
    ) {
        const ctx = await WorkspaceService.resolveContext(workspaceId, actorUserId);
        if (!ctx || ctx.member.isSuspended) throw new Error("Unauthorized: Workspace membership required.");

        const award = await WorkspaceRepository.getRecognitionAwardById(workspaceId, awardId);
        if (!award) throw new Error("Recognition award not found.");

        const isOwnerOrManager = ctx.isOwner || ctx.isWorkspaceManager || (ctx.member.role?.rank ?? 0) >= 800;
        const isIssuer = award.issuerId === actorUserId;

        if (!isOwnerOrManager && !isIssuer) {
            throw new Error("Unauthorized: Only workspace managers or the award issuer can add appreciation notes.");
        }

        const trimmedNote = (note || "").trim();
        if (trimmedNote.length < 5) {
            throw new Error("Appreciation note must be at least 5 characters.");
        }

        const noteRecord = await WorkspaceRepository.addRecognitionNote(workspaceId, awardId, actorUserId, trimmedNote);

        // Notify recipient about the manager's appreciation note
        const authorName = `${ctx.member.user?.firstName || ""} ${ctx.member.user?.lastName || ""}`.trim() || ctx.member.user?.username || "A workspace leader";
        WorkspaceRepository.createNotification({
            workspaceId,
            recipientId: award.recipientId,
            actorId: actorUserId,
            eventType: "recognition_note_added",
            resourceType: "recognition",
            resourceId: awardId,
            title: "Manager Appreciation Note Added",
            message: `${authorName} added an appreciation note to your award: "${trimmedNote.slice(0, 100)}"`,
            destinationUrl: `/workspace/${workspaceId}/recognition`,
            metadata: {
                awardId,
                noteId: noteRecord.id,
            },
        }).catch((err) => console.warn("[RecognitionService] Note notification failed:", err.message));

        return noteRecord;
    }

    /**
     * Lists appreciation notes on a specific award.
     */
    static async getAwardNotes(
        workspaceId: string,
        actorUserId: string,
        awardId: string
    ) {
        const ctx = await WorkspaceService.resolveContext(workspaceId, actorUserId);
        if (!ctx || ctx.member.isSuspended) throw new Error("Unauthorized: Workspace membership required.");

        // Check award visibility first
        await this.getAwardById(workspaceId, actorUserId, awardId);

        return WorkspaceRepository.listRecognitionNotes(workspaceId, awardId);
    }

    /**
     * Retrieves the authenticated member's recognition summary.
     */
    static async getMyRecognitionSummary(
        workspaceId: string,
        userId: string
    ): Promise<MemberRecognitionSummary> {
        const ctx = await WorkspaceService.resolveContext(workspaceId, userId);
        if (!ctx || ctx.member.isSuspended) throw new Error("Unauthorized: Workspace membership required.");

        const summary = await WorkspaceRepository.getMemberRecognitionSummary(workspaceId, userId);
        summary.canAward = ctx.isOwner || ctx.isWorkspaceManager || (ctx.isAdmin && !ctx.isOwner) || ctx.permissions.includes("recognition:award");
        return summary;
    }

    /**
     * Allocates or adjusts monthly award budget for a Workspace Manager (Club Owner only).
     */
    static async allocateManagerBudget(
        workspaceId: string,
        actorUserId: string,
        managerUserId: string,
        allocatedBudget: number,
        yearMonth: string = new Date().toISOString().slice(0, 7)
    ): Promise<WorkspaceRecognitionBudget> {
        const ctx = await WorkspaceService.resolveContext(workspaceId, actorUserId);
        if (!ctx || !ctx.isOwner) {
            throw new Error("Only the Club Owner has authority to allocate recognition budgets.");
        }

        if (!Number.isInteger(allocatedBudget) || allocatedBudget < 0) {
            throw new Error("Allocated budget must be a non-negative integer.");
        }

        const budget = await WorkspaceRepository.getOrCreateRecognitionBudget(
            null,
            workspaceId,
            managerUserId,
            yearMonth,
            allocatedBudget
        );

        const updateRes = await query(
            `UPDATE public.workspace_recognition_budgets
             SET allocated_budget = $1, allocated_by = $2, updated_at = NOW()
             WHERE id = $3
             RETURNING
                id,
                workspace_id AS "workspaceId",
                user_id AS "userId",
                year_month AS "yearMonth",
                allocated_budget AS "allocatedBudget",
                used_budget AS "usedBudget",
                (allocated_budget - used_budget) AS "remainingBudget",
                allocated_by AS "allocatedBy",
                created_at AS "createdAt",
                updated_at AS "updatedAt";`,
            [allocatedBudget, actorUserId, budget.id]
        );

        return updateRes.rows[0];
    }

    /**
     * Lists manager award budgets for the workspace.
     */
    static async listBudgets(
        workspaceId: string,
        actorUserId: string,
        yearMonth: string = new Date().toISOString().slice(0, 7)
    ) {
        const ctx = await WorkspaceService.resolveContext(workspaceId, actorUserId);
        if (!ctx || ctx.member.isSuspended) throw new Error("Unauthorized: Workspace membership required.");

        if (ctx.isOwner) {
            return WorkspaceRepository.listRecognitionBudgets(workspaceId, yearMonth);
        }

        // For Workspace Manager, return only their budget
        const budget = await WorkspaceRepository.getOrCreateRecognitionBudget(null, workspaceId, actorUserId, yearMonth);
        return [{
            ...budget,
            user: {
                id: ctx.member.userId,
                username: ctx.member.user?.username || "",
                firstName: ctx.member.user?.firstName || "",
                lastName: ctx.member.user?.lastName || "",
                avatarUrl: ctx.member.user?.avatarUrl,
                roleTitle: ctx.member.roleTitle,
            },
        }];
    }

    /**
     * Retrieves analytics overview for recognition.
     */
    static async getAnalytics(workspaceId: string, actorUserId: string) {
        const ctx = await WorkspaceService.resolveContext(workspaceId, actorUserId);
        if (!ctx || ctx.member.isSuspended) throw new Error("Unauthorized: Workspace membership required.");
        return WorkspaceRepository.getRecognitionAnalytics(workspaceId);
    }

    /**
     * Updates an appreciation category (Club Owner only).
     */
    static async updateCategory(
        workspaceId: string,
        actorUserId: string,
        categoryId: string,
        updates: { isActive?: boolean; name?: string; description?: string; icon?: string }
    ) {
        const ctx = await WorkspaceService.resolveContext(workspaceId, actorUserId);
        if (!ctx || !ctx.isOwner) {
            throw new Error("Only the Club Owner has authority to modify recognition categories.");
        }
        return WorkspaceRepository.updateRecognitionCategory(workspaceId, categoryId, updates);
    }
}
