import { apiClient } from "./apiClient";
import type { ConfiguredStage } from "../app/Club/TimelineBuilder/types";

export const fetchEventStages = async (eventId: string): Promise<{ success: boolean; stages: any[] }> => {
    return await apiClient.get<{ success: boolean; stages: any[] }>(`/club/events/${eventId}/stages`);
};

export const eventLifecycleApi = {
    // 1. Stage & Timeline Management
    async getStages(eventId: string): Promise<ConfiguredStage[]> {
        const res = await apiClient.get<{ success: boolean; stages: any[] }>(`/club/events/${eventId}/stages`);
        return (res.stages || []).map((s: any) => ({
            id: s.id,
            name: s.name,
            type: s.type,
            description: s.description || "",
            instructions: s.instructions || "",
            stageOrder: s.stage_order,
            startsAt: s.starts_at,
            endsAt: s.ends_at,
            timezone: s.timezone,
            status: s.status,
            eligibilityType: s.eligibility_type,
            actionType: s.action_type,
            requirements: s.requirements || {
                allowResubmission: true,
                maxSubmissions: 1,
                teamSubmissionOnly: false,
                leaderOnlySubmit: true,
                allMembersCanView: true,
                lateSubmissionPolicy: "disallow",
                requireApprovalToAdvance: false,
            },
            bannerUrl: s.banner_url,
        }));
    },

    async batchCreateStages(eventId: string, stages: Partial<ConfiguredStage>[]): Promise<any[]> {
        const res = await apiClient.post<{ success: boolean; stages: any[] }>(`/club/events/${eventId}/stages/batch`, {
            stages: stages.map((s, idx) => ({
                name: s.name,
                type: s.type,
                description: s.description,
                instructions: s.instructions,
                stageOrder: s.stageOrder || idx + 1,
                startsAt: s.startsAt,
                endsAt: s.endsAt,
                timezone: s.timezone || "Asia/Kolkata",
                eligibilityType: s.eligibilityType,
                actionType: s.actionType,
                requirements: s.requirements,
                bannerUrl: s.bannerUrl,
            })),
        });
        return res.stages || [];
    },

    async updateStage(eventId: string, stageId: string, updates: Partial<ConfiguredStage>): Promise<any> {
        const res = await apiClient.patch<{ success: boolean; stage: any }>(
            `/club/events/${eventId}/stages/${stageId}`,
            updates
        );
        return res.stage;
    },

    async deleteStage(eventId: string, stageId: string): Promise<boolean> {
        const res = await apiClient.delete<{ success: boolean }>(`/club/events/${eventId}/stages/${stageId}`);
        return res.success;
    },

    async reorderStages(eventId: string, stageOrders: { id: string; stageOrder: number }[]): Promise<boolean> {
        const res = await apiClient.post<{ success: boolean }>(`/club/events/${eventId}/stages/reorder`, {
            stageOrders,
        });
        return res.success;
    },

    async manualStageOverride(
        eventId: string,
        stageId: string,
        action: "pause" | "resume" | "extend" | "close" | "reopen",
        payload?: { newEndsAt?: string; note?: string }
    ): Promise<any> {
        const res = await apiClient.post<{ success: boolean; stage: any }>(
            `/club/events/${eventId}/stages/${stageId}/override`,
            { action, ...payload }
        );
        return res.stage;
    },

    // 2. Dynamic Stage Deliverables & Forms
    async getStageForm(eventId: string, stageId: string): Promise<any | null> {
        const res = await apiClient.get<{ success: boolean; form: any }>(
            `/club/events/${eventId}/stages/${stageId}/form`
        );
        return res.form;
    },

    async saveStageForm(eventId: string, stageId: string, formData: any): Promise<any> {
        const res = await apiClient.put<{ success: boolean; form: any }>(
            `/club/events/${eventId}/stages/${stageId}/form`,
            formData
        );
        return res.form;
    },

    async getStageSubmissions(eventId: string, stageId: string): Promise<any[]> {
        const res = await apiClient.get<{ success: boolean; submissions: any[] }>(
            `/club/events/${eventId}/stages/${stageId}/submissions`
        );
        return res.submissions || [];
    },

    // 3. Evaluation & Judging
    async getJudgingCriteria(eventId: string, stageId: string): Promise<any[]> {
        const res = await apiClient.get<{ success: boolean; criteria: any[] }>(
            `/club/events/${eventId}/stages/${stageId}/criteria`
        );
        return res.criteria || [];
    },

    async saveJudgingCriteria(eventId: string, stageId: string, criteria: any[]): Promise<any[]> {
        const res = await apiClient.put<{ success: boolean; criteria: any[] }>(
            `/club/events/${eventId}/stages/${stageId}/criteria`,
            { criteria }
        );
        return res.criteria || [];
    },

    async getAssignedJudges(eventId: string, stageId: string): Promise<any[]> {
        const res = await apiClient.get<{ success: boolean; judges: any[] }>(
            `/club/events/${eventId}/stages/${stageId}/judges`
        );
        return res.judges || [];
    },

    async assignJudges(eventId: string, stageId: string, judges: any[]): Promise<any[]> {
        const res = await apiClient.post<{ success: boolean; judges: any[] }>(
            `/club/events/${eventId}/stages/${stageId}/judges`,
            { judges }
        );
        return res.judges || [];
    },

    async shortlistAndAdvance(eventId: string, stageId: string, toStageId: string, advancements: any[]): Promise<any[]> {
        const res = await apiClient.post<{ success: boolean; advancements: any[] }>(
            `/club/events/${eventId}/stages/${stageId}/shortlist`,
            { toStageId, advancements }
        );
        return res.advancements || [];
    },

    async getStageAdvancements(eventId: string, stageId: string): Promise<any[]> {
        const res = await apiClient.get<{ success: boolean; advancements: any[] }>(
            `/club/events/${eventId}/stages/${stageId}/advancements`
        );
        return res.advancements || [];
    },

    // 4. Participant APIs
    async getPublicTimeline(eventId: string): Promise<ConfiguredStage[]> {
        const res = await apiClient.get<{ success: boolean; stages: any[] }>(`/events/${eventId}/timeline`);
        return (res.stages || []).map((s: any) => ({
            id: s.id,
            name: s.name,
            type: s.type,
            description: s.description || "",
            instructions: s.instructions || "",
            stageOrder: s.stage_order,
            startsAt: s.starts_at,
            endsAt: s.ends_at,
            timezone: s.timezone,
            status: s.status,
            eligibilityType: s.eligibility_type,
            actionType: s.action_type,
            requirements: s.requirements,
            bannerUrl: s.banner_url,
        }));
    },

    async getMyStageSubmission(eventId: string, stageId: string): Promise<{ submission: any | null; registrationId: string | null }> {
        const res = await apiClient.get<{ success: boolean; submission: any | null; registrationId: string | null }>(
            `/events/${eventId}/stages/${stageId}/my-submission`
        );
        return res;
    },

    async requestUploadSignature(eventId: string, stageId: string, filename: string, format: string): Promise<any> {
        const res = await apiClient.post<{ success: boolean }>(
            `/events/${eventId}/stages/${stageId}/upload-signature`,
            { filename, format }
        );
        return res;
    },

    async submitStageDeliverable(eventId: string, stageId: string, payload: any): Promise<any> {
        const res = await apiClient.post<{ success: boolean; submission: any }>(
            `/events/${eventId}/stages/${stageId}/submit`,
            payload
        );
        return res.submission;
    },

    // 5. Judge API
    async submitEvaluation(stageId: string, submissionId: string, scores: Record<string, number>, feedback?: string, privateNotes?: string): Promise<any> {
        const res = await apiClient.post<{ success: boolean; evaluation: any }>(
            `/judging/stages/${stageId}/submissions/${submissionId}/evaluate`,
            { scores, feedback, privateNotes }
        );
        return res.evaluation;
    },
};