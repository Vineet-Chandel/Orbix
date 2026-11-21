// Backend/src/services/relationship/relationshipTypes.ts

export type RelationshipStatus = 'pending' | 'connected' | 'declined' | 'cancelled' | 'removed';

export type ViewerRelationshipState =
    | 'none'
    | 'outgoing_pending'
    | 'incoming_pending'
    | 'connected'
    | 'blocked_by_me'
    | 'blocked_by_them'
    | 'cooldown_active'
    | 'unavailable';

export interface CanonicalPair {
    userLowId: string;
    userHighId: string;
}

export interface UserRelationshipRow {
    id: string;
    user_low_id: string;
    user_high_id: string;
    status: RelationshipStatus;
    requested_by: string;
    created_at: Date;
    updated_at: Date;
    responded_at: Date | null;
    last_action_at: Date;
}

export interface UserBlockRow {
    id: string;
    blocker_id: string;
    blocked_id: string;
    reason: string | null;
    created_at: Date;
}

export interface RelationshipStateResult {
    state: ViewerRelationshipState;
    relationshipId: string | null;
    requestedBy: string | null;
    targetUserId: string;
    canRequest: boolean;
    canAccept: boolean;
    canDecline: boolean;
    canCancel: boolean;
    canRemove: boolean;
    canBlock: boolean;
    canUnblock: boolean;
    cooldownRemainingMs?: number;
    nextAllowedRequestAt?: string;
}

export interface RelationshipActionResponse {
    success: boolean;
    outcome: string;
    state: ViewerRelationshipState;
    message: string;
    relationshipId?: string | null | undefined;
    retryAfter?: number | undefined;
}
