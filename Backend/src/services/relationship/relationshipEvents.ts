// Backend/src/services/relationship/relationshipEvents.ts

export type RelationshipEventType =
    | 'relationship_request_sent'
    | 'relationship_request_received'
    | 'relationship_request_accepted'
    | 'relationship_request_declined'
    | 'relationship_request_cancelled'
    | 'connection_removed'
    | 'user_blocked'
    | 'user_unblocked'
    | 'notification_limit_reached'
    | 'relationship_action_denied';

interface EventPayload {
    actorId?: string | undefined;
    targetUserId?: string | undefined;
    relationshipId?: string | undefined;
    reason?: string | undefined;
    metadata?: Record<string, any> | undefined;
}

class RelationshipEventService {
    private eventCounts: Record<string, number> = {};

    public logEvent(type: RelationshipEventType, payload: EventPayload): void {
        this.eventCounts[type] = (this.eventCounts[type] || 0) + 1;
        // Structured log for operational observability
        console.log(`[RELATIONSHIP_EVENT] ${type}`, {
            timestamp: new Date().toISOString(),
            ...payload,
        });
    }

    public getMetrics(): Record<string, number> {
        return { ...this.eventCounts };
    }
}

export const relationshipEvents = new RelationshipEventService();
