export const CERTIFICATE_CATEGORY_POLICY: Record<string, {
    position?: string;
    role?: string;
    autoSelect: boolean;
    customAchievement?: boolean;
}> = {
    participation: { autoSelect: true },
    attendance: { autoSelect: true },
    completion: { autoSelect: true },
    winner: { position: "1st Place", autoSelect: false },
    first_runner_up: { position: "2nd Place", autoSelect: false },
    second_runner_up: { position: "3rd Place", autoSelect: false },
    finalist: { position: "Finalist", autoSelect: false },
    best_innovation: { position: "Best Innovation", autoSelect: false },
    best_project: { position: "Best Project", autoSelect: false },
    best_performer: { position: "Best Performer", autoSelect: false },
    speaker: { role: "Speaker", autoSelect: false },
    mentor: { role: "Mentor", autoSelect: false },
    judge: { role: "Judge", autoSelect: false },
    volunteer: { role: "Volunteer", autoSelect: false },
    organizer: { role: "Organizer", autoSelect: false },
    custom: { customAchievement: true, autoSelect: false },
};

export function getCertificateCategoryPolicy(category: string) {
    return CERTIFICATE_CATEGORY_POLICY[category] || { autoSelect: false };
}

// Apply at both the UI and API boundary so hidden or stale fields cannot leak
// into an unrelated credential after the organizer changes categories.
export function normalizeCertificateCategoryFields<T extends {
    certificateType?: string;
    awardPosition?: string;
    recipients?: Array<{ customPosition?: string; customRole?: string }>;
    teamSnapshots?: Array<{ members: Array<{ customPosition?: string }> }>;
}>(payload: T): T {
    if (payload.certificateType && !CERTIFICATE_CATEGORY_POLICY[payload.certificateType]) return payload;
    const policy = getCertificateCategoryPolicy(payload.certificateType || "participation");
    const position = policy.customAchievement ? payload.awardPosition?.trim() || undefined : policy.position;
    return {
        ...payload,
        awardPosition: position,
        recipients: payload.recipients?.map((recipient) => ({
            ...recipient,
            customPosition: position,
            customRole: policy.role,
        })),
        teamSnapshots: payload.teamSnapshots?.map((team) => ({
            ...team,
            members: team.members.map((member) => ({ ...member, customPosition: position })),
        })),
    };
}
