// Backend/src/services/relationship/relationshipService.ts
import { pool, query } from "../../database/client.js";
import { getBlockState } from "./blockService.js";
import { dispatchNotification } from "../notification/quotaService.js";
import { relationshipEvents } from "./relationshipEvents.js";
import type {
    CanonicalPair,
    RelationshipStateResult,
    RelationshipActionResponse,
    ViewerRelationshipState,
} from "./relationshipTypes.js";

export const DECLINE_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24-hour re-request cooldown after decline

/**
 * Returns canonical ordering where userLowId < userHighId
 */
export function getCanonicalPair(userA: string, userB: string): CanonicalPair {
    if (!userA || !userB || userA === userB) {
        throw new Error("Invalid relationship pair: users must be distinct valid IDs");
    }
    return userA < userB
        ? { userLowId: userA, userHighId: userB }
        : { userLowId: userB, userHighId: userA };
}

/**
 * Generates numeric advisory lock key for a canonical pair
 */
function getCanonicalPairLockKey(userLowId: string, userHighId: string): string {
    const combined = `${userLowId}:${userHighId}`;
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
        hash = ((hash << 5) - hash) + combined.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash).toString();
}

/**
 * Resolves the viewer-specific relationship state with target user.
 * Follows strict state resolution hierarchy:
 * 1. Self check
 * 2. Block checks (directional)
 * 3. Connected check
 * 4. Pending check (incoming vs outgoing)
 * 5. Decline cooldown check
 * 6. None (permitted to request)
 */
export async function resolveRelationshipState(
    viewerId: string,
    targetUserId: string
): Promise<RelationshipStateResult> {
    // 1. Self Check
    if (viewerId === targetUserId) {
        return {
            state: "unavailable",
            relationshipId: null,
            requestedBy: null,
            targetUserId,
            canRequest: false,
            canAccept: false,
            canDecline: false,
            canCancel: false,
            canRemove: false,
            canBlock: false,
            canUnblock: false,
        };
    }

    // 2. Block Check
    const blockCheck = await getBlockState(viewerId, targetUserId);
    if (blockCheck.isBlocked) {
        return {
            state: blockCheck.blockState,
            relationshipId: null,
            requestedBy: null,
            targetUserId,
            canRequest: false,
            canAccept: false,
            canDecline: false,
            canCancel: false,
            canRemove: false,
            canBlock: blockCheck.blockState === "blocked_by_them",
            canUnblock: blockCheck.blockState === "blocked_by_me",
        };
    }

    // 3. Fetch Relationship Record
    const { userLowId, userHighId } = getCanonicalPair(viewerId, targetUserId);
    const relRes = await query(
        `SELECT id, status, requested_by, responded_at, last_action_at
         FROM user_relationships
         WHERE user_low_id = $1 AND user_high_id = $2
         LIMIT 1;`,
        [userLowId, userHighId]
    );

    if (relRes.rows.length === 0) {
        return {
            state: "none",
            relationshipId: null,
            requestedBy: null,
            targetUserId,
            canRequest: true,
            canAccept: false,
            canDecline: false,
            canCancel: false,
            canRemove: false,
            canBlock: true,
            canUnblock: false,
        };
    }

    const rel = relRes.rows[0];

    // 4. Connected State
    if (rel.status === "connected") {
        return {
            state: "connected",
            relationshipId: rel.id,
            requestedBy: rel.requested_by,
            targetUserId,
            canRequest: false,
            canAccept: false,
            canDecline: false,
            canCancel: false,
            canRemove: true,
            canBlock: true,
            canUnblock: false,
        };
    }

    // 5. Pending State
    if (rel.status === "pending") {
        const isOutgoing = rel.requested_by === viewerId;
        return {
            state: isOutgoing ? "outgoing_pending" : "incoming_pending",
            relationshipId: rel.id,
            requestedBy: rel.requested_by,
            targetUserId,
            canRequest: false,
            canAccept: !isOutgoing,
            canDecline: !isOutgoing,
            canCancel: isOutgoing,
            canRemove: false,
            canBlock: true,
            canUnblock: false,
        };
    }

    // 6. Declined State with Cooldown
    if (rel.status === "declined") {
        const respondedAtMs = rel.responded_at ? new Date(rel.responded_at).getTime() : 0;
        const elapsedMs = Date.now() - respondedAtMs;
        const cooldownRemainingMs = DECLINE_COOLDOWN_MS - elapsedMs;

        if (cooldownRemainingMs > 0) {
            return {
                state: "cooldown_active",
                relationshipId: rel.id,
                requestedBy: rel.requested_by,
                targetUserId,
                canRequest: false,
                canAccept: false,
                canDecline: false,
                canCancel: false,
                canRemove: false,
                canBlock: true,
                canUnblock: false,
                cooldownRemainingMs,
                nextAllowedRequestAt: new Date(respondedAtMs + DECLINE_COOLDOWN_MS).toISOString(),
            };
        }
    }

    // 7. Cancelled or Removed or Expired Cooldown -> permits new request
    return {
        state: "none",
        relationshipId: rel.id,
        requestedBy: null,
        targetUserId,
        canRequest: true,
        canAccept: false,
        canDecline: false,
        canCancel: false,
        canRemove: false,
        canBlock: true,
        canUnblock: false,
    };
}

/**
 * High-performance batch resolver for viewer-specific relationship states.
 * Solves the N+1 problem on feeds, explore, and search pages by resolving all relationships
 * in exactly 1-2 indexed queries rather than N individual queries.
 */
export async function resolveRelationshipStatesBatch(
    viewerId: string,
    targetUserIds: string[]
): Promise<Record<string, RelationshipStateResult>> {
    const results: Record<string, RelationshipStateResult> = {};
    if (!viewerId || !Array.isArray(targetUserIds) || targetUserIds.length === 0) {
        return results;
    }

    const validUuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const resolvedIdToInputMap = new Map<string, string[]>();
    const uuidsToQuery = new Set<string>();
    const usernamesToLookup = new Set<string>();

    for (const input of targetUserIds) {
        if (!input || typeof input !== "string") continue;
        const trimmed = input.trim();
        if (trimmed === viewerId) {
            results[trimmed] = {
                state: "unavailable",
                relationshipId: null,
                requestedBy: null,
                targetUserId: viewerId,
                canRequest: false,
                canAccept: false,
                canDecline: false,
                canCancel: false,
                canRemove: false,
                canBlock: false,
                canUnblock: false,
            };
            continue;
        }

        if (validUuidRegex.test(trimmed)) {
            uuidsToQuery.add(trimmed);
            const list = resolvedIdToInputMap.get(trimmed) || [];
            list.push(trimmed);
            resolvedIdToInputMap.set(trimmed, list);
        } else {
            usernamesToLookup.add(trimmed.toLowerCase());
        }
    }

    // Resolve any usernames to UUIDs
    if (usernamesToLookup.size > 0) {
        try {
            const uRes = await query(
                `SELECT id, username FROM users WHERE LOWER(username) = ANY($1);`,
                [Array.from(usernamesToLookup)]
            );
            for (const row of uRes.rows) {
                uuidsToQuery.add(row.id);
                const list = resolvedIdToInputMap.get(row.id) || [];
                list.push(row.username);
                list.push(row.username.toLowerCase());
                list.push(row.id);
                resolvedIdToInputMap.set(row.id, list);
            }
        } catch (err) {
            console.error("resolveRelationshipStatesBatch username lookup error:", err);
        }
    }

    const targetUuidList = Array.from(uuidsToQuery);
    if (targetUuidList.length === 0) {
        return results;
    }

    try {
        // 1. Single query for directional blocks between viewer and targets
        const blockRes = await query(
            `SELECT blocker_id, blocked_id
             FROM user_blocks
             WHERE (blocker_id = $1 AND blocked_id = ANY($2::uuid[]))
                OR (blocked_id = $1 AND blocker_id = ANY($2::uuid[]));`,
            [viewerId, targetUuidList]
        );

        const blockMap = new Map<string, "blocked_by_me" | "blocked_by_them">();
        for (const row of blockRes.rows) {
            if (row.blocker_id === viewerId) {
                blockMap.set(row.blocked_id, "blocked_by_me");
            } else {
                blockMap.set(row.blocker_id, "blocked_by_them");
            }
        }

        // 2. Single query for canonical relationships between viewer and targets
        const relRes = await query(
            `SELECT id, user_low_id, user_high_id, status, requested_by, responded_at, last_action_at
             FROM user_relationships
             WHERE (user_low_id = $1 AND user_high_id = ANY($2::uuid[]))
                OR (user_high_id = $1 AND user_low_id = ANY($2::uuid[]));`,
            [viewerId, targetUuidList]
        );

        const relMap = new Map<string, any>();
        for (const row of relRes.rows) {
            const otherId = row.user_low_id === viewerId ? row.user_high_id : row.user_low_id;
            relMap.set(otherId, row);
        }

        // 3. Resolve state for each target in-memory
        for (const targetId of targetUuidList) {
            let stateResult: RelationshipStateResult;

            const blockState = blockMap.get(targetId);
            if (blockState) {
                stateResult = {
                    state: blockState,
                    relationshipId: null,
                    requestedBy: null,
                    targetUserId: targetId,
                    canRequest: false,
                    canAccept: false,
                    canDecline: false,
                    canCancel: false,
                    canRemove: false,
                    canBlock: blockState === "blocked_by_them",
                    canUnblock: blockState === "blocked_by_me",
                };
            } else {
                const rel = relMap.get(targetId);
                if (!rel) {
                    stateResult = {
                        state: "none",
                        relationshipId: null,
                        requestedBy: null,
                        targetUserId: targetId,
                        canRequest: true,
                        canAccept: false,
                        canDecline: false,
                        canCancel: false,
                        canRemove: false,
                        canBlock: true,
                        canUnblock: false,
                    };
                } else if (rel.status === "connected") {
                    stateResult = {
                        state: "connected",
                        relationshipId: rel.id,
                        requestedBy: rel.requested_by,
                        targetUserId: targetId,
                        canRequest: false,
                        canAccept: false,
                        canDecline: false,
                        canCancel: false,
                        canRemove: true,
                        canBlock: true,
                        canUnblock: false,
                    };
                } else if (rel.status === "pending") {
                    const isOutgoing = rel.requested_by === viewerId;
                    stateResult = {
                        state: isOutgoing ? "outgoing_pending" : "incoming_pending",
                        relationshipId: rel.id,
                        requestedBy: rel.requested_by,
                        targetUserId: targetId,
                        canRequest: false,
                        canAccept: !isOutgoing,
                        canDecline: !isOutgoing,
                        canCancel: isOutgoing,
                        canRemove: false,
                        canBlock: true,
                        canUnblock: false,
                    };
                } else if (rel.status === "declined") {
                    const respondedAtMs = rel.responded_at ? new Date(rel.responded_at).getTime() : 0;
                    const elapsedMs = Date.now() - respondedAtMs;
                    const cooldownRemainingMs = DECLINE_COOLDOWN_MS - elapsedMs;

                    if (cooldownRemainingMs > 0) {
                        stateResult = {
                            state: "cooldown_active",
                            relationshipId: rel.id,
                            requestedBy: rel.requested_by,
                            targetUserId: targetId,
                            canRequest: false,
                            canAccept: false,
                            canDecline: false,
                            canCancel: false,
                            canRemove: false,
                            canBlock: true,
                            canUnblock: false,
                            cooldownRemainingMs,
                            nextAllowedRequestAt: new Date(respondedAtMs + DECLINE_COOLDOWN_MS).toISOString(),
                        };
                    } else {
                        stateResult = {
                            state: "none",
                            relationshipId: rel.id,
                            requestedBy: null,
                            targetUserId: targetId,
                            canRequest: true,
                            canAccept: false,
                            canDecline: false,
                            canCancel: false,
                            canRemove: false,
                            canBlock: true,
                            canUnblock: false,
                        };
                    }
                } else {
                    stateResult = {
                        state: "none",
                        relationshipId: rel.id,
                        requestedBy: null,
                        targetUserId: targetId,
                        canRequest: true,
                        canAccept: false,
                        canDecline: false,
                        canCancel: false,
                        canRemove: false,
                        canBlock: true,
                        canUnblock: false,
                    };
                }
            }

            const inputs = resolvedIdToInputMap.get(targetId) || [targetId];
            for (const key of inputs) {
                results[key] = stateResult;
            }
        }
    } catch (err) {
        console.error("resolveRelationshipStatesBatch query error:", err);
    }

    return results;
}

/**
 * Initiates a connection request from actor to target user.
 * Concurrency-safe, prevents duplicates and reciprocal requests.
 */
export async function requestConnection(
    actorId: string,
    targetUserId: string,
    actorProfile?: { username?: string; firstName?: string; lastName?: string; avatarUrl?: string | null }
): Promise<RelationshipActionResponse> {
    if (actorId === targetUserId) {
        return {
            success: false,
            outcome: "self_connection_rejected",
            state: "unavailable",
            message: "You cannot connect with yourself.",
        };
    }

    // Verify target user exists
    const targetCheck = await query(`SELECT id, username, email FROM users WHERE id = $1 LIMIT 1;`, [targetUserId]);
    if (targetCheck.rows.length === 0) {
        return {
            success: false,
            outcome: "user_not_found",
            state: "unavailable",
            message: "Target user not found.",
        };
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN;");

        // Canonical pair lock for atomic operation
        const { userLowId, userHighId } = getCanonicalPair(actorId, targetUserId);
        const lockKey = getCanonicalPairLockKey(userLowId, userHighId);
        await client.query(`SELECT pg_advisory_xact_lock($1::bigint);`, [lockKey]);

        // Check blocks inside transaction
        const blockRes = await client.query(
            `SELECT blocker_id FROM user_blocks
             WHERE (blocker_id = $1 AND blocked_id = $2)
                OR (blocker_id = $2 AND blocked_id = $1)
             LIMIT 1;`,
            [actorId, targetUserId]
        );
        if (blockRes.rows.length > 0) {
            await client.query("ROLLBACK;");
            const isBlocker = blockRes.rows[0].blocker_id === actorId;
            relationshipEvents.logEvent("relationship_action_denied", {
                actorId,
                targetUserId,
                reason: isBlocker ? "blocked_by_me" : "blocked_by_them",
            });
            return {
                success: false,
                outcome: "blocked",
                state: isBlocker ? "blocked_by_me" : "blocked_by_them",
                message: isBlocker ? "You have blocked this user." : "This user is unavailable.",
            };
        }

        // Check existing relationship record
        const relRes = await client.query(
            `SELECT id, status, requested_by, responded_at
             FROM user_relationships
             WHERE user_low_id = $1 AND user_high_id = $2
             FOR UPDATE;`,
            [userLowId, userHighId]
        );

        let relationshipId: string;

        if (relRes.rows.length > 0) {
            const rel = relRes.rows[0];

            if (rel.status === "connected") {
                await client.query("COMMIT;");
                return {
                    success: true,
                    outcome: "already_connected",
                    state: "connected",
                    relationshipId: rel.id,
                    message: "You are already connected with this user.",
                };
            }

            if (rel.status === "pending") {
                await client.query("COMMIT;");
                if (rel.requested_by === actorId) {
                    return {
                        success: true,
                        outcome: "already_pending",
                        state: "outgoing_pending",
                        relationshipId: rel.id,
                        message: "Connection request has already been sent.",
                    };
                } else {
                    // Reciprocal request scenario: target already sent request to actor!
                    return {
                        success: true,
                        outcome: "incoming_request_exists",
                        state: "incoming_pending",
                        relationshipId: rel.id,
                        message: "This user has already sent you a connection request. You can accept it.",
                    };
                }
            }

            if (rel.status === "declined") {
                const respondedAtMs = rel.responded_at ? new Date(rel.responded_at).getTime() : 0;
                const elapsedMs = Date.now() - respondedAtMs;
                const remainingMs = DECLINE_COOLDOWN_MS - elapsedMs;

                if (remainingMs > 0) {
                    await client.query("ROLLBACK;");
                    relationshipEvents.logEvent("relationship_action_denied", {
                        actorId,
                        targetUserId,
                        reason: "cooldown_active",
                    });
                    return {
                        success: false,
                        outcome: "cooldown_active",
                        state: "cooldown_active",
                        relationshipId: rel.id,
                        retryAfter: Math.ceil(remainingMs / 1000),
                        message: `Cannot send connection request yet. Cooldown active for ${Math.ceil(remainingMs / (1000 * 60 * 60))} more hours.`,
                    };
                }
            }

            // Transition existing row to pending
            const updateRes = await client.query(
                `UPDATE user_relationships
                 SET status = 'pending',
                     requested_by = $1,
                     responded_at = NULL,
                     last_action_at = CURRENT_TIMESTAMP,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $2
                 RETURNING id;`,
                [actorId, rel.id]
            );
            relationshipId = updateRes.rows[0].id;
        } else {
            // Insert brand new relationship
            const insertRes = await client.query(
                `INSERT INTO user_relationships (
                    user_low_id,
                    user_high_id,
                    status,
                    requested_by,
                    created_at,
                    updated_at,
                    last_action_at
                ) VALUES ($1, $2, 'pending', $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                RETURNING id;`,
                [userLowId, userHighId, actorId]
            );
            relationshipId = insertRes.rows[0].id;
        }

        await client.query("COMMIT;");

        // Dispatch idempotent notification to target user
        const actorDisplayName = actorProfile?.firstName
            ? `${actorProfile.firstName} ${actorProfile.lastName || ""}`.trim()
            : actorProfile?.username || "A developer";

        await dispatchNotification({
            recipientId: targetUserId,
            actorId,
            title: "New Connection Request",
            body: `${actorDisplayName} sent you a connection request.`,
            notificationType: "connection_request",
            relationshipId,
            metadata: {
                actorId,
                username: actorProfile?.username || "",
                displayName: actorDisplayName,
                avatarUrl: actorProfile?.avatarUrl || null,
            },
            idempotencyKey: `req-${actorId}-${targetUserId}-${relationshipId}`,
            isUserInitiated: false,
        });

        relationshipEvents.logEvent("relationship_request_sent", {
            actorId,
            targetUserId,
            relationshipId,
        });

        return {
            success: true,
            outcome: "request_sent",
            state: "outgoing_pending",
            relationshipId,
            message: "Connection request sent successfully.",
        };
    } catch (err: any) {
        await client.query("ROLLBACK;");
        console.error("requestConnection error:", err);
        throw err;
    } finally {
        client.release();
    }
}

/**
 * Accepts an incoming connection request.
 * Only the intended recipient can accept.
 */
export async function acceptConnection(
    actorId: string,
    targetUserId: string,
    actorProfile?: { username?: string; firstName?: string; lastName?: string }
): Promise<RelationshipActionResponse> {
    const { userLowId, userHighId } = getCanonicalPair(actorId, targetUserId);
    const client = await pool.connect();

    try {
        await client.query("BEGIN;");

        const lockKey = getCanonicalPairLockKey(userLowId, userHighId);
        await client.query(`SELECT pg_advisory_xact_lock($1::bigint);`, [lockKey]);

        // Check blocks
        const blockRes = await client.query(
            `SELECT blocker_id FROM user_blocks
             WHERE (blocker_id = $1 AND blocked_id = $2)
                OR (blocker_id = $2 AND blocked_id = $1)
             LIMIT 1;`,
            [actorId, targetUserId]
        );
        if (blockRes.rows.length > 0) {
            await client.query("ROLLBACK;");
            return {
                success: false,
                outcome: "blocked",
                state: "unavailable",
                message: "Cannot accept connection with blocked user.",
            };
        }

        const relRes = await client.query(
            `SELECT id, status, requested_by
             FROM user_relationships
             WHERE user_low_id = $1 AND user_high_id = $2
             FOR UPDATE;`,
            [userLowId, userHighId]
        );

        if (relRes.rows.length === 0) {
            await client.query("ROLLBACK;");
            return {
                success: false,
                outcome: "no_request_found",
                state: "none",
                message: "No connection request found to accept.",
            };
        }

        const rel = relRes.rows[0];

        // Already connected check
        if (rel.status === "connected") {
            await client.query("COMMIT;");
            return {
                success: true,
                outcome: "already_connected",
                state: "connected",
                relationshipId: rel.id,
                message: "You are already connected.",
            };
        }

        // Must be in pending state
        if (rel.status !== "pending") {
            await client.query("ROLLBACK;");
            return {
                success: false,
                outcome: "invalid_status",
                state: "none",
                message: `Cannot accept request with status '${rel.status}'.`,
            };
        }

        // Authorization: ONLY recipient can accept! Requester cannot accept their own request.
        if (rel.requested_by === actorId) {
            await client.query("ROLLBACK;");
            return {
                success: false,
                outcome: "unauthorized",
                state: "outgoing_pending",
                message: "You cannot accept your own outgoing connection request.",
            };
        }

        // Transition to connected
        await client.query(
            `UPDATE user_relationships
             SET status = 'connected',
                 responded_at = CURRENT_TIMESTAMP,
                 last_action_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1;`,
            [rel.id]
        );

        await client.query("COMMIT;");

        // Dispatch idempotent notification to requester
        const actorDisplayName = actorProfile?.firstName
            ? `${actorProfile.firstName} ${actorProfile.lastName || ""}`.trim()
            : actorProfile?.username || "A developer";

        await dispatchNotification({
            recipientId: targetUserId,
            actorId,
            title: "Connection Request Accepted",
            body: `${actorDisplayName} accepted your connection request. You are now connected!`,
            notificationType: "connection_accepted",
            relationshipId: rel.id,
            metadata: {
                actorId,
                username: actorProfile?.username || "",
                displayName: actorDisplayName,
            },
            idempotencyKey: `acc-${rel.id}`,
            isUserInitiated: false,
        });

        relationshipEvents.logEvent("relationship_request_accepted", {
            actorId,
            targetUserId,
            relationshipId: rel.id,
        });

        return {
            success: true,
            outcome: "connection_accepted",
            state: "connected",
            relationshipId: rel.id,
            message: "Connection accepted successfully.",
        };
    } catch (err: any) {
        await client.query("ROLLBACK;");
        console.error("acceptConnection error:", err);
        throw err;
    } finally {
        client.release();
    }
}

/**
 * Declines an incoming connection request.
 * Only the intended recipient can decline.
 */
export async function declineConnection(
    actorId: string,
    targetUserId: string
): Promise<RelationshipActionResponse> {
    const { userLowId, userHighId } = getCanonicalPair(actorId, targetUserId);
    const client = await pool.connect();

    try {
        await client.query("BEGIN;");

        const lockKey = getCanonicalPairLockKey(userLowId, userHighId);
        await client.query(`SELECT pg_advisory_xact_lock($1::bigint);`, [lockKey]);

        const relRes = await client.query(
            `SELECT id, status, requested_by
             FROM user_relationships
             WHERE user_low_id = $1 AND user_high_id = $2
             FOR UPDATE;`,
            [userLowId, userHighId]
        );

        if (relRes.rows.length === 0 || relRes.rows[0].status !== "pending") {
            await client.query("ROLLBACK;");
            return {
                success: false,
                outcome: "no_pending_request",
                state: "none",
                message: "No pending connection request found to decline.",
            };
        }

        const rel = relRes.rows[0];

        // Only recipient can decline
        if (rel.requested_by === actorId) {
            await client.query("ROLLBACK;");
            return {
                success: false,
                outcome: "unauthorized",
                state: "outgoing_pending",
                message: "You cannot decline your own connection request. Use cancel instead.",
            };
        }

        await client.query(
            `UPDATE user_relationships
             SET status = 'declined',
                 responded_at = CURRENT_TIMESTAMP,
                 last_action_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1;`,
            [rel.id]
        );

        await client.query("COMMIT;");

        relationshipEvents.logEvent("relationship_request_declined", {
            actorId,
            targetUserId,
            relationshipId: rel.id,
        });

        return {
            success: true,
            outcome: "request_declined",
            state: "none",
            relationshipId: rel.id,
            message: "Connection request declined.",
        };
    } catch (err: any) {
        await client.query("ROLLBACK;");
        console.error("declineConnection error:", err);
        throw err;
    } finally {
        client.release();
    }
}

/**
 * Cancels an outgoing pending connection request.
 * Only the requester can cancel.
 */
export async function cancelConnection(
    actorId: string,
    targetUserId: string
): Promise<RelationshipActionResponse> {
    const { userLowId, userHighId } = getCanonicalPair(actorId, targetUserId);
    const client = await pool.connect();

    try {
        await client.query("BEGIN;");

        const lockKey = getCanonicalPairLockKey(userLowId, userHighId);
        await client.query(`SELECT pg_advisory_xact_lock($1::bigint);`, [lockKey]);

        const relRes = await client.query(
            `SELECT id, status, requested_by
             FROM user_relationships
             WHERE user_low_id = $1 AND user_high_id = $2
             FOR UPDATE;`,
            [userLowId, userHighId]
        );

        if (relRes.rows.length === 0 || relRes.rows[0].status !== "pending") {
            await client.query("ROLLBACK;");
            return {
                success: false,
                outcome: "no_pending_request",
                state: "none",
                message: "No pending outgoing request found to cancel.",
            };
        }

        const rel = relRes.rows[0];

        // Only requester can cancel
        if (rel.requested_by !== actorId) {
            await client.query("ROLLBACK;");
            return {
                success: false,
                outcome: "unauthorized",
                state: "incoming_pending",
                message: "You cannot cancel an incoming request. Use decline instead.",
            };
        }

        await client.query(
            `UPDATE user_relationships
             SET status = 'cancelled',
                 last_action_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1;`,
            [rel.id]
        );

        await client.query("COMMIT;");

        relationshipEvents.logEvent("relationship_request_cancelled", {
            actorId,
            targetUserId,
            relationshipId: rel.id,
        });

        return {
            success: true,
            outcome: "request_cancelled",
            state: "none",
            relationshipId: rel.id,
            message: "Connection request cancelled.",
        };
    } catch (err: any) {
        await client.query("ROLLBACK;");
        console.error("cancelConnection error:", err);
        throw err;
    } finally {
        client.release();
    }
}

/**
 * Removes an established connection.
 * Either party can end the connection.
 */
export async function removeConnection(
    actorId: string,
    targetUserId: string
): Promise<RelationshipActionResponse> {
    const { userLowId, userHighId } = getCanonicalPair(actorId, targetUserId);
    const client = await pool.connect();

    try {
        await client.query("BEGIN;");

        const lockKey = getCanonicalPairLockKey(userLowId, userHighId);
        await client.query(`SELECT pg_advisory_xact_lock($1::bigint);`, [lockKey]);

        const relRes = await client.query(
            `SELECT id, status
             FROM user_relationships
             WHERE user_low_id = $1 AND user_high_id = $2
             FOR UPDATE;`,
            [userLowId, userHighId]
        );

        if (relRes.rows.length === 0 || relRes.rows[0].status !== "connected") {
            await client.query("ROLLBACK;");
            return {
                success: false,
                outcome: "not_connected",
                state: "none",
                message: "No active connection found to remove.",
            };
        }

        const rel = relRes.rows[0];

        await client.query(
            `UPDATE user_relationships
             SET status = 'removed',
                 last_action_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1;`,
            [rel.id]
        );

        await client.query("COMMIT;");

        relationshipEvents.logEvent("connection_removed", {
            actorId,
            targetUserId,
            relationshipId: rel.id,
        });

        return {
            success: true,
            outcome: "connection_removed",
            state: "none",
            relationshipId: rel.id,
            message: "Connection removed successfully.",
        };
    } catch (err: any) {
        await client.query("ROLLBACK;");
        console.error("removeConnection error:", err);
        throw err;
    } finally {
        client.release();
    }
}

/**
 * Retrieves paginated connections for user's Settings view.
 */
export async function getUserConnections(
    userId: string,
    limit = 20,
    cursor?: string,
    searchQuery?: string
): Promise<{
    connections: Array<{
        relationshipId: string;
        connectedUserId: string;
        username: string;
        displayName: string;
        avatarUrl: string | null;
        headline: string | null;
        college: string | null;
        connectedAt: string;
    }>;
    nextCursor: string | null;
    totalCount: number;
}> {
    // 1. Total count of active connections
    const countRes = await query(
        `SELECT COUNT(*)::int AS count
         FROM user_relationships r
         WHERE (r.user_low_id = $1 OR r.user_high_id = $1)
           AND r.status = 'connected';`,
        [userId]
    );
    const totalCount = countRes.rows[0]?.count ?? 0;

    // 2. Fetch connections joined with peer user details
    let queryStr = `
        SELECT
            r.id AS relationship_id,
            r.last_action_at AS connected_at,
            CASE WHEN r.user_low_id = $1 THEN r.user_high_id ELSE r.user_low_id END AS connected_user_id,
            u.username,
            COALESCE(u.firstname || ' ' || u.lastname, u.username) AS display_name,
            u.avatar_url,
            u.headline,
            u.college
        FROM user_relationships r
        JOIN users u ON u.id = (CASE WHEN r.user_low_id = $1 THEN r.user_high_id ELSE r.user_low_id END)
        WHERE (r.user_low_id = $1 OR r.user_high_id = $1)
          AND r.status = 'connected'
    `;
    const params: any[] = [userId];

    if (searchQuery && searchQuery.trim()) {
        params.push(`%${searchQuery.trim().toLowerCase()}%`);
        queryStr += ` AND (LOWER(u.username) LIKE $${params.length} OR LOWER(u.firstname) LIKE $${params.length} OR LOWER(u.lastname) LIKE $${params.length})`;
    }

    if (cursor) {
        params.push(cursor);
        queryStr += ` AND r.last_action_at < $${params.length}::timestamptz `;
    }

    params.push(limit + 1);
    queryStr += ` ORDER BY r.last_action_at DESC LIMIT $${params.length};`;

    const res = await query(queryStr, params);

    const hasMore = res.rows.length > limit;
    const items = hasMore ? res.rows.slice(0, limit) : res.rows;
    const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].connected_at : null;

    const connections = items.map((r) => ({
        relationshipId: r.relationship_id,
        connectedUserId: r.connected_user_id,
        username: r.username,
        displayName: r.display_name,
        avatarUrl: r.avatar_url,
        headline: r.headline,
        college: r.college,
        connectedAt: r.connected_at.toISOString ? r.connected_at.toISOString() : r.connected_at,
    }));

    return {
        connections,
        nextCursor,
        totalCount,
    };
}
