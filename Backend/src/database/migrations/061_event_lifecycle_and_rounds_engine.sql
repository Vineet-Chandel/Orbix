-- ============================================================
-- Migration 061: Event Lifecycle, Stages, Submissions & Evaluation Engine
-- ============================================================
-- Enhances Orbix with multi-round hackathons/events, timeline stages,
-- stage submission forms, Cloudinary asset tracking, rubrics & judging,
-- participant advancement, audit logs, and communication history.
-- Idempotent: safe to run multiple times.
-- ============================================================

-- 1. Event Timeline Stages
CREATE TABLE IF NOT EXISTS public.club_event_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.club_events(id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES public.verified_clubs(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'custom',
    description TEXT,
    instructions TEXT,
    stage_order INT NOT NULL DEFAULT 1,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
    status VARCHAR(30) NOT NULL DEFAULT 'scheduled'
        CHECK (status IN ('draft', 'scheduled', 'active', 'paused', 'evaluating', 'completed', 'cancelled')),
    eligibility_type VARCHAR(50) NOT NULL DEFAULT 'all_registered'
        CHECK (eligibility_type IN ('all_registered', 'accepted_only', 'shortlisted_only', 'selected_teams_only', 'custom')),
    eligible_team_ids JSONB DEFAULT '[]'::jsonb,
    eligible_user_ids JSONB DEFAULT '[]'::jsonb,
    action_type VARCHAR(50) NOT NULL DEFAULT 'none'
        CHECK (action_type IN ('registration', 'submit_idea', 'upload_docs', 'submit_project', 'submit_links', 'attend_live', 'view_results', 'internal_review', 'none')),
    requirements JSONB NOT NULL DEFAULT '{
        "allowResubmission": true,
        "maxSubmissions": 1,
        "teamSubmissionOnly": false,
        "leaderOnlySubmit": true,
        "allMembersCanView": true,
        "lateSubmissionPolicy": "disallow",
        "requireApprovalToAdvance": false
    }'::jsonb,
    banner_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (ends_at >= starts_at)
);

CREATE INDEX IF NOT EXISTS idx_event_stages_event_order 
    ON public.club_event_stages(event_id, stage_order);
CREATE INDEX IF NOT EXISTS idx_event_stages_status_dates 
    ON public.club_event_stages(status, starts_at, ends_at);

-- 2. Stage Dynamic Submission Forms
CREATE TABLE IF NOT EXISTS public.club_event_stage_forms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stage_id UUID NOT NULL REFERENCES public.club_event_stages(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES public.club_events(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    fields JSONB NOT NULL DEFAULT '[]'::jsonb,
    allowed_file_types JSONB DEFAULT '["pdf","png","jpg","jpeg","docx","pptx","zip"]'::jsonb,
    max_file_size_bytes BIGINT DEFAULT 26214400,
    max_files INT DEFAULT 5,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_stage_form UNIQUE (stage_id)
);

CREATE INDEX IF NOT EXISTS idx_event_stage_forms_stage 
    ON public.club_event_stage_forms(stage_id);
CREATE INDEX IF NOT EXISTS idx_event_stage_forms_event 
    ON public.club_event_stage_forms(event_id);

-- 3. Participant & Team Stage Submissions
CREATE TABLE IF NOT EXISTS public.club_event_stage_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stage_id UUID NOT NULL REFERENCES public.club_event_stages(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES public.club_events(id) ON DELETE CASCADE,
    registration_id UUID NOT NULL REFERENCES public.club_event_registrations(id) ON DELETE CASCADE,
    team_id UUID REFERENCES public.club_event_teams(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title VARCHAR(300),
    description TEXT,
    answers JSONB DEFAULT '{}'::jsonb,
    github_url TEXT,
    live_url TEXT,
    video_url TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'submitted'
        CHECK (status IN ('draft', 'submitted', 'under_review', 'evaluated', 'shortlisted', 'disqualified')),
    version INT NOT NULL DEFAULT 1,
    receipt_code VARCHAR(50) NOT NULL DEFAULT ('SUB-' || upper(substr(md5(random()::text), 1, 8))),
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_participant_stage_submission UNIQUE (stage_id, registration_id)
);

CREATE INDEX IF NOT EXISTS idx_stage_submissions_stage_status 
    ON public.club_event_stage_submissions(stage_id, status);
CREATE INDEX IF NOT EXISTS idx_stage_submissions_team 
    ON public.club_event_stage_submissions(team_id);
CREATE INDEX IF NOT EXISTS idx_stage_submissions_user 
    ON public.club_event_stage_submissions(user_id);

-- 4. Submission Media & Cloudinary Assets Metadata
CREATE TABLE IF NOT EXISTS public.club_event_submission_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL REFERENCES public.club_event_stage_submissions(id) ON DELETE CASCADE,
    stage_id UUID NOT NULL REFERENCES public.club_event_stages(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES public.club_events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    cloudinary_public_id TEXT NOT NULL,
    cloudinary_url TEXT NOT NULL,
    cloudinary_secure_url TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    file_format VARCHAR(20) NOT NULL,
    mime_type VARCHAR(100),
    file_size_bytes BIGINT NOT NULL DEFAULT 0,
    resource_type VARCHAR(30) NOT NULL DEFAULT 'raw',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_submission_assets_submission 
    ON public.club_event_submission_assets(submission_id);

-- 5. Judging Criteria / Rubrics
CREATE TABLE IF NOT EXISTS public.club_event_judging_criteria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stage_id UUID NOT NULL REFERENCES public.club_event_stages(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES public.club_events(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    max_score NUMERIC(5,2) NOT NULL DEFAULT 10.00,
    weight_percent NUMERIC(5,2) NOT NULL DEFAULT 25.00,
    sort_order INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_judging_criteria_stage 
    ON public.club_event_judging_criteria(stage_id, sort_order);

-- 6. Assigned Judges
CREATE TABLE IF NOT EXISTS public.club_event_judges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.club_events(id) ON DELETE CASCADE,
    stage_id UUID REFERENCES public.club_event_stages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name VARCHAR(150),
    email VARCHAR(255),
    role VARCHAR(50) DEFAULT 'judge',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_judge_stage UNIQUE (stage_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_judges_user 
    ON public.club_event_judges(user_id);
CREATE INDEX IF NOT EXISTS idx_event_judges_stage 
    ON public.club_event_judges(stage_id);

-- 7. Submission Evaluations & Scores
CREATE TABLE IF NOT EXISTS public.club_event_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stage_id UUID NOT NULL REFERENCES public.club_event_stages(id) ON DELETE CASCADE,
    submission_id UUID NOT NULL REFERENCES public.club_event_stage_submissions(id) ON DELETE CASCADE,
    judge_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    scores JSONB NOT NULL DEFAULT '{}'::jsonb,
    total_score NUMERIC(7,2) NOT NULL DEFAULT 0,
    weighted_score NUMERIC(7,2) NOT NULL DEFAULT 0,
    feedback TEXT,
    private_notes TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'submitted'
        CHECK (status IN ('draft', 'submitted')),
    evaluated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_judge_submission UNIQUE (submission_id, judge_id)
);

CREATE INDEX IF NOT EXISTS idx_evaluations_submission 
    ON public.club_event_evaluations(submission_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_judge 
    ON public.club_event_evaluations(judge_id);

-- 8. Participant Advancement & Shortlisting
CREATE TABLE IF NOT EXISTS public.club_event_stage_advancements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.club_events(id) ON DELETE CASCADE,
    from_stage_id UUID NOT NULL REFERENCES public.club_event_stages(id) ON DELETE CASCADE,
    to_stage_id UUID NOT NULL REFERENCES public.club_event_stages(id) ON DELETE CASCADE,
    registration_id UUID NOT NULL REFERENCES public.club_event_registrations(id) ON DELETE CASCADE,
    team_id UUID REFERENCES public.club_event_teams(id) ON DELETE SET NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'shortlisted'
        CHECK (status IN ('shortlisted', 'advanced', 'eliminated', 'winner', 'runner_up')),
    rank INT,
    award_title VARCHAR(150),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_stage_advancement UNIQUE (from_stage_id, to_stage_id, registration_id)
);

CREATE INDEX IF NOT EXISTS idx_stage_advancements_to_stage 
    ON public.club_event_stage_advancements(to_stage_id, status);
CREATE INDEX IF NOT EXISTS idx_stage_advancements_registration 
    ON public.club_event_stage_advancements(registration_id);

-- 9. Automated Communication Logs
CREATE TABLE IF NOT EXISTS public.club_event_communication_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.club_events(id) ON DELETE CASCADE,
    stage_id UUID REFERENCES public.club_event_stages(id) ON DELETE SET NULL,
    trigger_type VARCHAR(50) NOT NULL,
    recipient_email VARCHAR(255) NOT NULL,
    recipient_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    subject TEXT NOT NULL,
    idempotency_key VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'sent'
        CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
    provider_message_id TEXT,
    error_message TEXT,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_comm_logs_event 
    ON public.club_event_communication_logs(event_id, trigger_type);
CREATE INDEX IF NOT EXISTS idx_comm_logs_idempotency 
    ON public.club_event_communication_logs(idempotency_key);

-- 10. Audit History
CREATE TABLE IF NOT EXISTS public.club_event_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.club_events(id) ON DELETE CASCADE,
    stage_id UUID REFERENCES public.club_event_stages(id) ON DELETE SET NULL,
    actor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(100),
    old_state JSONB,
    new_state JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_event_audit_logs_event 
    ON public.club_event_audit_logs(event_id, created_at DESC);
