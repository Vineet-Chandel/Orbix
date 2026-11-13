export type StageType =
    | "registration"
    | "team_formation"
    | "submission"
    | "screening"
    | "evaluation"
    | "shortlisting"
    | "development"
    | "presentation"
    | "offline_finale"
    | "results"
    | "certificates"
    | "custom";

export type StageEligibility =
    | "all_registered"
    | "accepted_only"
    | "shortlisted_only"
    | "selected_teams_only"
    | "custom";

export type StageActionType =
    | "registration"
    | "submit_idea"
    | "upload_docs"
    | "submit_project"
    | "submit_links"
    | "attend_live"
    | "view_results"
    | "internal_review"
    | "none";

export interface StageRequirements {
    allowResubmission: boolean;
    maxSubmissions: number;
    teamSubmissionOnly: boolean;
    leaderOnlySubmit: boolean;
    allMembersCanView: boolean;
    lateSubmissionPolicy: "disallow" | "allow_with_flag" | "allow_grace_period";
    requireApprovalToAdvance: boolean;
    isElimination?: boolean;
    requiresSubmission?: boolean;
}

export interface StageSubmissionField {
    id: string;
    label: string;
    type: "text" | "textarea" | "url" | "github" | "video" | "file" | "select" | "checkbox";
    description?: string;
    required: boolean;
    placeholder?: string;
    allowedExtensions?: string[];
    maxSizeBytes?: number;
    options?: string[];
}

export interface StageSubmissionFormConfig {
    title: string;
    description?: string;
    fields: StageSubmissionField[];
    allowedFileTypes: string[];
    maxFileSizeBytes: number;
    maxFiles: number;
}

export interface ConfiguredStage {
    id: string;
    name: string;
    type: StageType;
    description: string;
    instructions: string;
    stageOrder: number;
    startsAt: string;
    endsAt: string;
    timezone: string;
    status?: "draft" | "scheduled" | "active" | "paused" | "evaluating" | "completed" | "cancelled";
    eligibilityType: StageEligibility;
    eligibleTeamIds?: string[];
    eligibleUserIds?: string[];
    actionType: StageActionType;
    requirements: StageRequirements;
    bannerUrl?: string;
    formConfig?: StageSubmissionFormConfig;
}
