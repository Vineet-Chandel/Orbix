-- =========================================================================
-- ORBIX ENTERPRISE PRODUCTION DATABASE DDL SCHEMA
-- System: Orbix Developer Ecosystem & Campus Platform
-- Dialect: PostgreSQL (v14+ / Supabase / Neon / AWS Aurora / Cloud SQL)
-- Total Tables: 131
-- Generated At: 2026-11-13T14:13:27.283Z
-- Purpose: Complete, self-contained, idempotent database bootstrap script.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. POSTGRESQL EXTENSIONS
-- -------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- -------------------------------------------------------------------------
-- 3. TABLE DEFINITIONS (Columns, Primary Keys, Unique & Check Constraints)
-- -------------------------------------------------------------------------

-- Table: account_change_challenges
CREATE TABLE IF NOT EXISTS public.account_change_challenges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    operation_id uuid NOT NULL,
    user_id uuid NOT NULL,
    challenge_type character varying(50) NOT NULL,
    destination character varying(255) NOT NULL,
    otp_hash character varying(64) NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying,
    attempts integer DEFAULT 0,
    ip_address character varying(45),
    user_agent text,
    resend_count integer DEFAULT 0,
    last_resent_at timestamp with time zone,
    expires_at timestamp with time zone NOT NULL,
    consumed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT account_change_challenges_pkey PRIMARY KEY (id)
);

-- Table: account_change_history
CREATE TABLE IF NOT EXISTS public.account_change_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    operation_id uuid,
    change_type character varying(30) NOT NULL,
    old_value character varying(255) NOT NULL,
    new_value character varying(255) NOT NULL,
    ip_address character varying(45),
    user_agent text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT account_change_history_pkey PRIMARY KEY (id),
    CONSTRAINT account_change_history_operation_id_key UNIQUE (operation_id)
);

-- Table: account_change_operations
CREATE TABLE IF NOT EXISTS public.account_change_operations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    change_type character varying(30) NOT NULL,
    current_value character varying(255) NOT NULL,
    requested_value character varying(255) NOT NULL,
    stage character varying(50) NOT NULL,
    old_challenge_id uuid,
    new_challenge_id uuid,
    attempts integer DEFAULT 0,
    expires_at timestamp with time zone NOT NULL,
    completed_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    cancellation_reason text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT account_change_operations_pkey PRIMARY KEY (id)
);

-- Table: account_data_exports
CREATE TABLE IF NOT EXISTS public.account_data_exports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    export_id character varying(64) NOT NULL,
    requested_categories text[] DEFAULT '{}'::text[] NOT NULL,
    sha256_checksum character varying(64) NOT NULL,
    file_size_bytes integer NOT NULL,
    record_counts jsonb DEFAULT '{}'::jsonb NOT NULL,
    ip_address character varying(45),
    user_agent text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    expires_at timestamp with time zone DEFAULT (CURRENT_TIMESTAMP + '48:00:00'::interval) NOT NULL,
    CONSTRAINT account_data_exports_pkey PRIMARY KEY (id),
    CONSTRAINT account_data_exports_export_id_key UNIQUE (export_id)
);

-- Table: account_deletion_requests
CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    status character varying(30) DEFAULT 'scheduled'::character varying NOT NULL,
    reason text,
    grace_period_days integer DEFAULT 7 NOT NULL,
    scheduled_for timestamp with time zone DEFAULT (now() + '7 days'::interval) NOT NULL,
    cancelled_at timestamp with time zone,
    completed_at timestamp with time zone,
    requested_ip character varying(45),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    user_email_hash character varying(64),
    purge_log jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT account_deletion_requests_status_check CHECK (((status)::text = ANY ((ARRAY['scheduled'::character varying, 'processing'::character varying, 'completed'::character varying, 'cancelled'::character varying])::text[]))),
    CONSTRAINT account_deletion_requests_pkey PRIMARY KEY (id)
);

-- Table: account_entitlements
CREATE TABLE IF NOT EXISTS public.account_entitlements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    entitlement_key character varying(100) NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    scope character varying(50) DEFAULT 'standard'::character varying,
    quota_limit integer,
    effective_from timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone,
    source character varying(50) DEFAULT 'system'::character varying,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT account_entitlements_pkey PRIMARY KEY (id),
    CONSTRAINT account_entitlements_user_id_entitlement_key_key UNIQUE (user_id, entitlement_key)
);

-- Table: account_restrictions
CREATE TABLE IF NOT EXISTS public.account_restrictions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    restriction_type character varying(100) NOT NULL,
    affected_resource character varying(100),
    reason_code character varying(100),
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    starts_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT account_restrictions_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'expired'::character varying, 'revoked'::character varying])::text[]))),
    CONSTRAINT account_restrictions_pkey PRIMARY KEY (id)
);

-- Table: account_security_events
CREATE TABLE IF NOT EXISTS public.account_security_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    session_id character varying(128),
    event_type character varying(60) NOT NULL,
    title character varying(150) NOT NULL,
    description text NOT NULL,
    severity character varying(20) DEFAULT 'info'::character varying NOT NULL,
    ip_address_masked character varying(64),
    location_summary character varying(200),
    device_summary character varying(150),
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT account_security_events_pkey PRIMARY KEY (id)
);

-- Table: account_status_history
CREATE TABLE IF NOT EXISTS public.account_status_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    previous_status character varying(50),
    new_status character varying(50) NOT NULL,
    action character varying(50) NOT NULL,
    reason_code character varying(100),
    public_explanation text,
    internal_note text,
    restrictions_before jsonb DEFAULT '[]'::jsonb,
    restrictions_after jsonb DEFAULT '[]'::jsonb,
    actor_id uuid,
    actor_role character varying(50),
    effective_from timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT account_status_history_pkey PRIMARY KEY (id)
);

-- Table: account_statuses
CREATE TABLE IF NOT EXISTS public.account_statuses (
    user_id uuid NOT NULL,
    standing character varying(50) DEFAULT 'good_standing'::character varying NOT NULL,
    severity character varying(20) DEFAULT 'none'::character varying NOT NULL,
    public_reason_code character varying(100),
    public_reason text,
    internal_reason text,
    restrictions jsonb DEFAULT '[]'::jsonb,
    effective_from timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    last_reviewed_at timestamp with time zone,
    next_review_at timestamp with time zone,
    updated_by uuid,
    source character varying(20) DEFAULT 'system'::character varying,
    version integer DEFAULT 1,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT account_statuses_severity_check CHECK (((severity)::text = ANY ((ARRAY['none'::character varying, 'low'::character varying, 'medium'::character varying, 'high'::character varying, 'critical'::character varying])::text[]))),
    CONSTRAINT account_statuses_source_check CHECK (((source)::text = ANY ((ARRAY['system'::character varying, 'manual_admin'::character varying, 'automated_rule'::character varying])::text[]))),
    CONSTRAINT account_statuses_standing_check CHECK (((standing)::text = ANY ((ARRAY['good_standing'::character varying, 'warning'::character varying, 'under_review'::character varying, 'restricted'::character varying, 'suspended'::character varying, 'deactivated'::character varying])::text[]))),
    CONSTRAINT account_statuses_pkey PRIMARY KEY (user_id)
);

-- Table: blog_likes
CREATE TABLE IF NOT EXISTS public.blog_likes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    hoster character varying(120) NOT NULL,
    blog_name character varying(120) NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT blog_likes_pkey PRIMARY KEY (id),
    CONSTRAINT uq_blog_likes_publication_user UNIQUE (hoster, blog_name, user_id)
);

-- Table: certificate_audit_logs
CREATE TABLE IF NOT EXISTS public.certificate_audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    club_id uuid,
    actor_user_id uuid,
    action character varying(100) NOT NULL,
    entity_type character varying(50) NOT NULL,
    entity_id character varying(100),
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT certificate_audit_logs_pkey PRIMARY KEY (id)
);

-- Table: certificate_batches
CREATE TABLE IF NOT EXISTS public.certificate_batches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    club_id uuid NOT NULL,
    event_id uuid,
    template_id uuid,
    template_version integer DEFAULT 1 NOT NULL,
    title character varying(255) NOT NULL,
    certificate_type character varying(50) DEFAULT 'participation'::character varying NOT NULL,
    issuance_source character varying(50) DEFAULT 'event'::character varying NOT NULL,
    total_recipients integer DEFAULT 0 NOT NULL,
    successful_count integer DEFAULT 0 NOT NULL,
    failed_count integer DEFAULT 0 NOT NULL,
    status character varying(30) DEFAULT 'completed'::character varying NOT NULL,
    error_log jsonb DEFAULT '[]'::jsonb,
    batch_payload jsonb DEFAULT '{}'::jsonb,
    idempotency_key character varying(128),
    issued_by_user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT certificate_batches_issuance_source_check CHECK (((issuance_source)::text = ANY ((ARRAY['event'::character varying, 'team'::character varying, 'manual'::character varying, 'csv'::character varying])::text[]))),
    CONSTRAINT certificate_batches_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'validating'::character varying, 'queued'::character varying, 'processing'::character varying, 'completed'::character varying, 'partially_completed'::character varying, 'partially_failed'::character varying, 'failed'::character varying, 'cancelled'::character varying])::text[]))),
    CONSTRAINT certificate_batches_pkey PRIMARY KEY (id)
);

-- Table: certificate_templates
CREATE TABLE IF NOT EXISTS public.certificate_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    club_id uuid,
    is_system boolean DEFAULT false NOT NULL,
    name character varying(255) NOT NULL,
    category character varying(100) DEFAULT 'event'::character varying NOT NULL,
    design jsonb DEFAULT '{}'::jsonb NOT NULL,
    background_asset_url text,
    background_fit character varying(20) DEFAULT 'cover'::character varying,
    orientation character varying(20) DEFAULT 'landscape'::character varying NOT NULL,
    page_width integer DEFAULT 842 NOT NULL,
    page_height integer DEFAULT 595 NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    status character varying(30) DEFAULT 'published'::character varying NOT NULL,
    thumbnail_url text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT certificate_templates_background_fit_check CHECK (((background_fit)::text = ANY ((ARRAY['cover'::character varying, 'contain'::character varying, 'stretch'::character varying])::text[]))),
    CONSTRAINT certificate_templates_orientation_check CHECK (((orientation)::text = ANY ((ARRAY['landscape'::character varying, 'portrait'::character varying])::text[]))),
    CONSTRAINT certificate_templates_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'published'::character varying, 'archived'::character varying])::text[]))),
    CONSTRAINT certificate_templates_pkey PRIMARY KEY (id)
);

-- Table: club_access_events
CREATE TABLE IF NOT EXISTS public.club_access_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    club_id uuid NOT NULL,
    user_id uuid NOT NULL,
    membership_id uuid,
    session_id character varying(128),
    action character varying(60) NOT NULL,
    user_role_at_time character varying(40) DEFAULT 'member'::character varying NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT club_access_events_pkey PRIMARY KEY (id)
);

-- Table: club_achievements
CREATE TABLE IF NOT EXISTS public.club_achievements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    club_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    achievement_date text,
    issuer text,
    image_url text,
    external_link text,
    display_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    achievement_type character varying(50),
    CONSTRAINT club_achievements_pkey PRIMARY KEY (id)
);

-- Table: club_certificates
CREATE TABLE IF NOT EXISTS public.club_certificates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    club_id uuid NOT NULL,
    user_id uuid NOT NULL,
    event_id uuid,
    title character varying(255) NOT NULL,
    certificate_type character varying(50) DEFAULT 'participation'::character varying NOT NULL,
    recipient_name character varying(255) NOT NULL,
    recipient_email character varying(255),
    description text,
    credential_code character varying(64) NOT NULL,
    signer_name character varying(150),
    signer_role character varying(150),
    issued_by_user_id uuid,
    issue_date timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    template_id uuid,
    template_version integer DEFAULT 1,
    batch_id uuid,
    team_id uuid,
    design_snapshot jsonb DEFAULT '{}'::jsonb,
    recipient_snapshot jsonb DEFAULT '{}'::jsonb,
    pdf_url text,
    preview_url text,
    sha256_hash character varying(64),
    is_revoked boolean DEFAULT false NOT NULL,
    revoked_at timestamp with time zone,
    revocation_reason text,
    revoked_by_user_id uuid,
    verification_count integer DEFAULT 0 NOT NULL,
    last_verified_at timestamp with time zone,
    CONSTRAINT club_certificates_pkey PRIMARY KEY (id),
    CONSTRAINT club_certificates_credential_code_key UNIQUE (credential_code)
);

-- Table: club_conversations
CREATE TABLE IF NOT EXISTS public.club_conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    club_id uuid NOT NULL,
    user_id uuid NOT NULL,
    subject character varying(100) DEFAULT 'General Inquiry'::character varying NOT NULL,
    status character varying(30) DEFAULT 'open'::character varying NOT NULL,
    is_read_by_club boolean DEFAULT false NOT NULL,
    is_read_by_user boolean DEFAULT true NOT NULL,
    last_message_preview text,
    last_message_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT club_conversations_status_check CHECK (((status)::text = ANY ((ARRAY['open'::character varying, 'closed'::character varying, 'archived'::character varying])::text[]))),
    CONSTRAINT club_conversations_pkey PRIMARY KEY (id),
    CONSTRAINT unique_club_user_conversation UNIQUE (club_id, user_id)
);

-- Table: club_coordinators
CREATE TABLE IF NOT EXISTS public.club_coordinators (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    club_id uuid NOT NULL,
    linked_user_id uuid,
    name text NOT NULL,
    department text,
    role text NOT NULL,
    image_url text,
    is_primary boolean DEFAULT false NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    is_public boolean DEFAULT true NOT NULL,
    contact_email text,
    linkedin_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT club_coordinators_pkey PRIMARY KEY (id)
);

-- Table: club_credibility_appeals
CREATE TABLE IF NOT EXISTS public.club_credibility_appeals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    club_id uuid NOT NULL,
    ledger_id uuid NOT NULL,
    reason text NOT NULL,
    evidence_attachments jsonb DEFAULT '[]'::jsonb,
    appeal_status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    reviewer_id uuid,
    review_decision character varying(20),
    reviewer_reason text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    reviewed_at timestamp with time zone,
    CONSTRAINT club_credibility_appeals_appeal_status_check CHECK (((appeal_status)::text = ANY ((ARRAY['pending'::character varying, 'under_review'::character varying, 'approved'::character varying, 'rejected'::character varying])::text[]))),
    CONSTRAINT club_credibility_appeals_pkey PRIMARY KEY (id)
);

-- Table: club_credibility_ledger
CREATE TABLE IF NOT EXISTS public.club_credibility_ledger (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    club_id uuid NOT NULL,
    event_id uuid,
    source_action character varying(50) NOT NULL,
    reason_code character varying(60) NOT NULL,
    outcome_quality numeric(5,2) NOT NULL,
    evidence_weight numeric(5,2) NOT NULL,
    score_before numeric(5,2) NOT NULL,
    score_after numeric(5,2) NOT NULL,
    score_delta numeric(5,2) NOT NULL,
    evidence_confidence numeric(3,2) DEFAULT 1.00 NOT NULL,
    factor_breakdown jsonb DEFAULT '{}'::jsonb NOT NULL,
    evidence_references jsonb DEFAULT '{}'::jsonb,
    status character varying(20) DEFAULT 'confirmed'::character varying NOT NULL,
    reversal_reference_id uuid,
    actor_id uuid,
    actor_type character varying(20) DEFAULT 'club_admin'::character varying NOT NULL,
    idempotency_key character varying(128),
    scoring_version character varying(20) DEFAULT 'v1.0'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    finalised_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT club_credibility_ledger_actor_type_check CHECK (((actor_type)::text = ANY ((ARRAY['club_admin'::character varying, 'system'::character varying, 'platform_admin'::character varying])::text[]))),
    CONSTRAINT club_credibility_ledger_evidence_confidence_check CHECK (((evidence_confidence >= 0.1) AND (evidence_confidence <= 1.0))),
    CONSTRAINT club_credibility_ledger_evidence_weight_check CHECK (((evidence_weight >= (0)::numeric) AND (evidence_weight <= (20)::numeric))),
    CONSTRAINT club_credibility_ledger_outcome_quality_check CHECK (((outcome_quality >= (0)::numeric) AND (outcome_quality <= (100)::numeric))),
    CONSTRAINT club_credibility_ledger_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'confirmed'::character varying, 'reversed'::character varying])::text[]))),
    CONSTRAINT club_credibility_ledger_pkey PRIMARY KEY (id),
    CONSTRAINT club_credibility_ledger_idempotency_key_key UNIQUE (idempotency_key)
);

-- Table: club_credibility_snapshots
CREATE TABLE IF NOT EXISTS public.club_credibility_snapshots (
    club_id uuid NOT NULL,
    current_score numeric(5,2) DEFAULT 50.00 NOT NULL,
    lifetime_score numeric(5,2) DEFAULT 50.00 NOT NULL,
    recent_score numeric(5,2) DEFAULT 50.00 NOT NULL,
    score_level character varying(20) DEFAULT 'developing'::character varying NOT NULL,
    confidence_level character varying(20) DEFAULT 'low'::character varying NOT NULL,
    is_provisional boolean DEFAULT true NOT NULL,
    total_verified_events integer DEFAULT 0 NOT NULL,
    total_verified_incidents integer DEFAULT 0 NOT NULL,
    successful_event_streak integer DEFAULT 0 NOT NULL,
    total_evidence_weight numeric(8,2) DEFAULT 0 NOT NULL,
    dimensional_scores jsonb DEFAULT '{"communication": 50, "eventDelivery": 50, "scheduleReliability": 50, "certificateIntegrity": 50, "participantExperience": 50, "cancellationReliability": 50}'::jsonb NOT NULL,
    scoring_version character varying(20) DEFAULT 'v1.0'::character varying NOT NULL,
    last_calculated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT club_credibility_snapshots_confidence_level_check CHECK (((confidence_level)::text = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying])::text[]))),
    CONSTRAINT club_credibility_snapshots_current_score_check CHECK (((current_score >= (0)::numeric) AND (current_score <= (100)::numeric))),
    CONSTRAINT club_credibility_snapshots_lifetime_score_check CHECK (((lifetime_score >= (0)::numeric) AND (lifetime_score <= (100)::numeric))),
    CONSTRAINT club_credibility_snapshots_recent_score_check CHECK (((recent_score >= (0)::numeric) AND (recent_score <= (100)::numeric))),
    CONSTRAINT club_credibility_snapshots_score_level_check CHECK (((score_level)::text = ANY ((ARRAY['critical'::character varying, 'developing'::character varying, 'reliable'::character varying, 'trusted'::character varying, 'exceptional'::character varying])::text[]))),
    CONSTRAINT club_credibility_snapshots_pkey PRIMARY KEY (club_id)
);

-- Table: club_event_audit_logs
CREATE TABLE IF NOT EXISTS public.club_event_audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    stage_id uuid,
    actor_id uuid NOT NULL,
    action character varying(100) NOT NULL,
    entity_type character varying(50) NOT NULL,
    entity_id character varying(100),
    old_state jsonb,
    new_state jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT club_event_audit_logs_pkey PRIMARY KEY (id)
);

-- Table: club_event_communication_logs
CREATE TABLE IF NOT EXISTS public.club_event_communication_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    stage_id uuid,
    trigger_type character varying(50) NOT NULL,
    recipient_email character varying(255) NOT NULL,
    recipient_user_id uuid,
    subject text NOT NULL,
    idempotency_key character varying(255) NOT NULL,
    status character varying(30) DEFAULT 'sent'::character varying NOT NULL,
    provider_message_id text,
    error_message text,
    sent_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT club_event_communication_logs_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'sent'::character varying, 'failed'::character varying, 'skipped'::character varying])::text[]))),
    CONSTRAINT club_event_communication_logs_pkey PRIMARY KEY (id),
    CONSTRAINT club_event_communication_logs_idempotency_key_key UNIQUE (idempotency_key)
);

-- Table: club_event_creation_history
CREATE TABLE IF NOT EXISTS public.club_event_creation_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    club_id uuid NOT NULL,
    event_id uuid,
    scope character varying(32) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT club_event_creation_history_pkey PRIMARY KEY (id)
);

-- Table: club_event_evaluations
CREATE TABLE IF NOT EXISTS public.club_event_evaluations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    stage_id uuid NOT NULL,
    submission_id uuid NOT NULL,
    judge_id uuid NOT NULL,
    scores jsonb DEFAULT '{}'::jsonb NOT NULL,
    total_score numeric(7,2) DEFAULT 0 NOT NULL,
    weighted_score numeric(7,2) DEFAULT 0 NOT NULL,
    feedback text,
    private_notes text,
    status character varying(30) DEFAULT 'submitted'::character varying NOT NULL,
    evaluated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT club_event_evaluations_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'submitted'::character varying])::text[]))),
    CONSTRAINT club_event_evaluations_pkey PRIMARY KEY (id),
    CONSTRAINT unique_judge_submission UNIQUE (submission_id, judge_id)
);

-- Table: club_event_form_versions
CREATE TABLE IF NOT EXISTS public.club_event_form_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    form_id uuid NOT NULL,
    event_id uuid NOT NULL,
    version_number integer NOT NULL,
    title text NOT NULL,
    description text,
    header_image_url text,
    header_image_public_id text,
    structure jsonb DEFAULT '{"sections": []}'::jsonb NOT NULL,
    settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    theme_settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    change_summary text,
    is_published boolean DEFAULT false NOT NULL,
    published_by uuid,
    created_by uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    published_at timestamp with time zone,
    CONSTRAINT club_event_form_versions_pkey PRIMARY KEY (id),
    CONSTRAINT unique_form_version UNIQUE (form_id, version_number)
);

-- Table: club_event_forms
CREATE TABLE IF NOT EXISTS public.club_event_forms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    club_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    header_image_url text,
    header_image_public_id text,
    theme_settings jsonb DEFAULT '{"fontFamily": "sans", "accentColor": "#38BDF8", "headerPosition": "center"}'::jsonb NOT NULL,
    settings jsonb DEFAULT '{"isOpen": true, "maxResponses": null, "requireLogin": true, "closedMessage": "Registrations are currently closed for this event.", "showProgressBar": true, "limitOneResponse": true, "allowEditResponse": false, "confirmationMessage": "Your registration has been submitted successfully!", "notifyOnRegistration": true}'::jsonb NOT NULL,
    structure jsonb DEFAULT '{"sections": []}'::jsonb NOT NULL,
    is_published boolean DEFAULT true NOT NULL,
    schema_version integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    created_by uuid,
    current_draft_version_id uuid,
    published_version_id uuid,
    default_settings jsonb DEFAULT '{"isOpen": true, "maxResponses": null, "requireLogin": true, "closedMessage": "Registrations are currently closed for this event.", "showProgressBar": true, "limitOneResponse": true, "allowEditResponse": false, "confirmationMessage": "Your registration has been submitted successfully!", "notifyOnRegistration": true}'::jsonb NOT NULL,
    version_count integer DEFAULT 1 NOT NULL,
    published_at timestamp with time zone,
    CONSTRAINT club_event_forms_pkey PRIMARY KEY (id),
    CONSTRAINT unique_event_form UNIQUE (event_id)
);

-- Table: club_event_judges
CREATE TABLE IF NOT EXISTS public.club_event_judges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    stage_id uuid,
    user_id uuid NOT NULL,
    name character varying(150),
    email character varying(255),
    role character varying(50) DEFAULT 'judge'::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT club_event_judges_pkey PRIMARY KEY (id),
    CONSTRAINT unique_judge_stage UNIQUE (stage_id, user_id)
);

-- Table: club_event_judging_criteria
CREATE TABLE IF NOT EXISTS public.club_event_judging_criteria (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    stage_id uuid NOT NULL,
    event_id uuid NOT NULL,
    title character varying(200) NOT NULL,
    description text,
    max_score numeric(5,2) DEFAULT 10.00 NOT NULL,
    weight_percent numeric(5,2) DEFAULT 25.00 NOT NULL,
    sort_order integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT club_event_judging_criteria_pkey PRIMARY KEY (id)
);

-- Table: club_event_likes
CREATE TABLE IF NOT EXISTS public.club_event_likes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT club_event_likes_pkey PRIMARY KEY (id),
    CONSTRAINT unique_event_user_like UNIQUE (event_id, user_id)
);

-- Table: club_event_registrations
CREATE TABLE IF NOT EXISTS public.club_event_registrations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    club_id uuid NOT NULL,
    user_id uuid NOT NULL,
    status character varying(30) DEFAULT 'pending'::character varying NOT NULL,
    registered_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    checked_in_at timestamp with time zone,
    ticket_code character varying(50) DEFAULT ('ORB-'::text || upper(substr(md5((random())::text), 1, 8))) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    applicant_name character varying(150),
    applicant_email character varying(255),
    department character varying(100),
    year_of_study character varying(50),
    roll_number character varying(100),
    phone_number character varying(30),
    notes text,
    answers jsonb DEFAULT '{}'::jsonb,
    reviewed_at timestamp with time zone,
    reviewed_by_user_id uuid,
    review_notes text,
    form_id uuid,
    form_response jsonb DEFAULT '{}'::jsonb,
    file_attachments jsonb DEFAULT '[]'::jsonb,
    is_attendee_under_18 boolean DEFAULT false,
    guardian_name character varying(255),
    guardian_email character varying(255),
    guardian_phone character varying(50),
    guardian_relationship character varying(100),
    guardian_consent_status character varying(50) DEFAULT 'not_required'::character varying,
    guardian_consent_token character varying(128),
    guardian_consent_token_expires_at timestamp with time zone,
    guardian_consent_verified_at timestamp with time zone,
    guardian_consent_ip character varying(100),
    guardian_consent_user_agent text,
    form_version_id uuid,
    idempotency_key text,
    last_updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    quiz_score numeric(7,2) DEFAULT NULL::numeric,
    quiz_max_score numeric(7,2) DEFAULT NULL::numeric,
    quiz_graded_answers jsonb,
    quiz_grades_released boolean DEFAULT false,
    institution_id uuid,
    institution_name character varying(500),
    university_name character varying(500),
    campus_name character varying(255),
    institution_city character varying(150),
    institution_state character varying(100),
    institution_verification_status character varying(50) DEFAULT 'unverified'::character varying,
    is_unlisted_institution boolean DEFAULT false,
    team_id uuid,
    team_role character varying(20) DEFAULT NULL::character varying,
    CONSTRAINT club_event_registrations_guardian_status_check CHECK (((guardian_consent_status)::text = ANY ((ARRAY['not_required'::character varying, 'pending_verification'::character varying, 'verified'::character varying, 'rejected'::character varying, 'withdrawn'::character varying])::text[]))),
    CONSTRAINT club_event_registrations_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'registered'::character varying, 'attended'::character varying, 'waitlisted'::character varying, 'rejected'::character varying, 'cancelled'::character varying, 'blocked'::character varying])::text[]))),
    CONSTRAINT club_event_registrations_pkey PRIMARY KEY (id),
    CONSTRAINT unique_event_user_registration UNIQUE (event_id, user_id)
);

-- Table: club_event_response_drafts
CREATE TABLE IF NOT EXISTS public.club_event_response_drafts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    form_id uuid,
    form_version_id uuid,
    user_id uuid NOT NULL,
    answers jsonb DEFAULT '{}'::jsonb NOT NULL,
    file_attachments jsonb DEFAULT '[]'::jsonb NOT NULL,
    current_section_index integer DEFAULT 0 NOT NULL,
    section_history jsonb DEFAULT '[0]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT club_event_response_drafts_pkey PRIMARY KEY (id),
    CONSTRAINT unique_user_event_draft UNIQUE (event_id, user_id)
);

-- Table: club_event_stage_advancements
CREATE TABLE IF NOT EXISTS public.club_event_stage_advancements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    from_stage_id uuid NOT NULL,
    to_stage_id uuid NOT NULL,
    registration_id uuid NOT NULL,
    team_id uuid,
    status character varying(30) DEFAULT 'shortlisted'::character varying NOT NULL,
    rank integer,
    award_title character varying(150),
    notes text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT club_event_stage_advancements_status_check CHECK (((status)::text = ANY ((ARRAY['shortlisted'::character varying, 'advanced'::character varying, 'eliminated'::character varying, 'winner'::character varying, 'runner_up'::character varying])::text[]))),
    CONSTRAINT club_event_stage_advancements_pkey PRIMARY KEY (id),
    CONSTRAINT unique_stage_advancement UNIQUE (from_stage_id, to_stage_id, registration_id)
);

-- Table: club_event_stage_forms
CREATE TABLE IF NOT EXISTS public.club_event_stage_forms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    stage_id uuid NOT NULL,
    event_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    fields jsonb DEFAULT '[]'::jsonb NOT NULL,
    allowed_file_types jsonb DEFAULT '["pdf", "png", "jpg", "jpeg", "docx", "pptx", "zip"]'::jsonb,
    max_file_size_bytes bigint DEFAULT 26214400,
    max_files integer DEFAULT 5,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT club_event_stage_forms_pkey PRIMARY KEY (id),
    CONSTRAINT unique_stage_form UNIQUE (stage_id)
);

-- Table: club_event_stage_submissions
CREATE TABLE IF NOT EXISTS public.club_event_stage_submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    stage_id uuid NOT NULL,
    event_id uuid NOT NULL,
    registration_id uuid NOT NULL,
    team_id uuid,
    user_id uuid NOT NULL,
    title character varying(300),
    description text,
    answers jsonb DEFAULT '{}'::jsonb,
    github_url text,
    live_url text,
    video_url text,
    status character varying(30) DEFAULT 'submitted'::character varying NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    receipt_code character varying(50) DEFAULT ('SUB-'::text || upper(substr(md5((random())::text), 1, 8))) NOT NULL,
    submitted_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT club_event_stage_submissions_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'submitted'::character varying, 'under_review'::character varying, 'evaluated'::character varying, 'shortlisted'::character varying, 'disqualified'::character varying])::text[]))),
    CONSTRAINT club_event_stage_submissions_pkey PRIMARY KEY (id),
    CONSTRAINT unique_participant_stage_submission UNIQUE (stage_id, registration_id)
);

-- Table: club_event_stages
CREATE TABLE IF NOT EXISTS public.club_event_stages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    club_id uuid NOT NULL,
    name character varying(200) NOT NULL,
    type character varying(50) DEFAULT 'custom'::character varying NOT NULL,
    description text,
    instructions text,
    stage_order integer DEFAULT 1 NOT NULL,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone NOT NULL,
    timezone character varying(50) DEFAULT 'Asia/Kolkata'::character varying NOT NULL,
    status character varying(30) DEFAULT 'scheduled'::character varying NOT NULL,
    eligibility_type character varying(50) DEFAULT 'all_registered'::character varying NOT NULL,
    eligible_team_ids jsonb DEFAULT '[]'::jsonb,
    eligible_user_ids jsonb DEFAULT '[]'::jsonb,
    action_type character varying(50) DEFAULT 'none'::character varying NOT NULL,
    requirements jsonb DEFAULT '{"maxSubmissions": 1, "leaderOnlySubmit": true, "allMembersCanView": true, "allowResubmission": true, "teamSubmissionOnly": false, "lateSubmissionPolicy": "disallow", "requireApprovalToAdvance": false}'::jsonb NOT NULL,
    banner_url text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT club_event_stages_action_type_check CHECK (((action_type)::text = ANY ((ARRAY['registration'::character varying, 'submit_idea'::character varying, 'upload_docs'::character varying, 'submit_project'::character varying, 'submit_links'::character varying, 'attend_live'::character varying, 'view_results'::character varying, 'internal_review'::character varying, 'none'::character varying])::text[]))),
    CONSTRAINT club_event_stages_check CHECK ((ends_at >= starts_at)),
    CONSTRAINT club_event_stages_eligibility_type_check CHECK (((eligibility_type)::text = ANY ((ARRAY['all_registered'::character varying, 'accepted_only'::character varying, 'shortlisted_only'::character varying, 'selected_teams_only'::character varying, 'custom'::character varying])::text[]))),
    CONSTRAINT club_event_stages_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'scheduled'::character varying, 'active'::character varying, 'paused'::character varying, 'evaluating'::character varying, 'completed'::character varying, 'cancelled'::character varying])::text[]))),
    CONSTRAINT club_event_stages_pkey PRIMARY KEY (id)
);

-- Table: club_event_submission_assets
CREATE TABLE IF NOT EXISTS public.club_event_submission_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    submission_id uuid NOT NULL,
    stage_id uuid NOT NULL,
    event_id uuid NOT NULL,
    user_id uuid NOT NULL,
    cloudinary_public_id text NOT NULL,
    cloudinary_url text NOT NULL,
    cloudinary_secure_url text NOT NULL,
    original_filename text NOT NULL,
    file_format character varying(20) NOT NULL,
    mime_type character varying(100),
    file_size_bytes bigint DEFAULT 0 NOT NULL,
    resource_type character varying(30) DEFAULT 'raw'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT club_event_submission_assets_pkey PRIMARY KEY (id)
);

-- Table: club_event_team_invitations
CREATE TABLE IF NOT EXISTS public.club_event_team_invitations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    team_id uuid NOT NULL,
    event_id uuid NOT NULL,
    inviter_user_id uuid NOT NULL,
    invitee_user_id uuid NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    responded_at timestamp with time zone,
    CONSTRAINT club_event_team_invitations_pkey PRIMARY KEY (id)
);

-- Table: club_event_team_members
CREATE TABLE IF NOT EXISTS public.club_event_team_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    team_id uuid NOT NULL,
    event_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role character varying(20) DEFAULT 'member'::character varying NOT NULL,
    joined_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT club_event_team_members_pkey PRIMARY KEY (id)
);

-- Table: club_event_teams
CREATE TABLE IF NOT EXISTS public.club_event_teams (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    club_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    code character varying(20) NOT NULL,
    leader_id uuid NOT NULL,
    status character varying(30) DEFAULT 'forming'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT club_event_teams_pkey PRIMARY KEY (id),
    CONSTRAINT club_event_teams_code_key UNIQUE (code)
);

-- Table: club_events
CREATE TABLE IF NOT EXISTS public.club_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    club_id uuid NOT NULL,
    title text NOT NULL,
    slug text NOT NULL,
    summary text,
    description text,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone,
    timezone character varying(50) DEFAULT 'Asia/Kolkata'::character varying NOT NULL,
    location_type character varying(20) DEFAULT 'in_person'::character varying NOT NULL,
    venue_or_location text,
    registration_url text,
    cover_image_url text,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    published_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    capacity integer,
    registered_count integer DEFAULT 0 NOT NULL,
    eligibility character varying(50) DEFAULT 'open_to_all'::character varying,
    scope character varying(20) DEFAULT 'CAMPUS'::character varying NOT NULL,
    is_team_event boolean DEFAULT false NOT NULL,
    min_team_size integer DEFAULT 1 NOT NULL,
    max_team_size integer DEFAULT 4 NOT NULL,
    CONSTRAINT club_events_check CHECK (((ends_at IS NULL) OR (ends_at >= starts_at))),
    CONSTRAINT club_events_location_type_check CHECK (((location_type)::text = ANY ((ARRAY['in_person'::character varying, 'online'::character varying, 'virtual'::character varying, 'hybrid'::character varying])::text[]))),
    CONSTRAINT club_events_scope_check CHECK (((scope)::text = ANY ((ARRAY['CAMPUS'::character varying, 'PAN_INDIA'::character varying])::text[]))),
    CONSTRAINT club_events_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'published'::character varying, 'completed'::character varying, 'cancelled'::character varying])::text[]))),
    CONSTRAINT club_events_title_check CHECK (((length(btrim(title)) >= 3) AND (length(btrim(title)) <= 200))),
    CONSTRAINT club_events_pkey PRIMARY KEY (id),
    CONSTRAINT unique_club_event_slug UNIQUE (club_id, slug)
);

-- Table: club_form_media_assets
CREATE TABLE IF NOT EXISTS public.club_form_media_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    form_id uuid,
    event_id uuid,
    uploader_user_id uuid,
    public_id text NOT NULL,
    secure_url text NOT NULL,
    resource_type text DEFAULT 'image'::text NOT NULL,
    format text,
    bytes integer,
    width integer,
    height integer,
    asset_purpose text DEFAULT 'question_image'::text NOT NULL,
    question_id text,
    response_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT club_form_media_assets_pkey PRIMARY KEY (id),
    CONSTRAINT club_form_media_assets_public_id_key UNIQUE (public_id)
);

-- Table: club_memberships
CREATE TABLE IF NOT EXISTS public.club_memberships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    club_id uuid NOT NULL,
    user_id uuid NOT NULL,
    access_role character varying(30) DEFAULT 'member'::character varying NOT NULL,
    club_role character varying(30) DEFAULT 'member'::character varying NOT NULL,
    title character varying(100) DEFAULT 'Member'::character varying NOT NULL,
    status character varying(30) DEFAULT 'active'::character varying NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    invited_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT club_memberships_pkey PRIMARY KEY (id)
);

-- Table: club_message_action_logs
CREATE TABLE IF NOT EXISTS public.club_message_action_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    club_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT club_message_action_logs_pkey PRIMARY KEY (id)
);

-- Table: club_messages
CREATE TABLE IF NOT EXISTS public.club_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    club_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    sender_type character varying(20) NOT NULL,
    body text NOT NULL,
    is_muted_delivery boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT club_messages_body_check CHECK (((length(btrim(body)) >= 1) AND (length(btrim(body)) <= 5000))),
    CONSTRAINT club_messages_sender_type_check CHECK (((sender_type)::text = ANY ((ARRAY['user'::character varying, 'club'::character varying])::text[]))),
    CONSTRAINT club_messages_pkey PRIMARY KEY (id)
);

-- Table: club_team_invitations
CREATE TABLE IF NOT EXISTS public.club_team_invitations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    club_id uuid NOT NULL,
    team_id uuid,
    invited_user_id uuid NOT NULL,
    invited_by_user_id uuid,
    inviter_user_id uuid,
    access_role character varying(30) DEFAULT 'member'::character varying NOT NULL,
    club_role character varying(30) DEFAULT 'member'::character varying NOT NULL,
    title character varying(100) DEFAULT 'Member'::character varying NOT NULL,
    team_role character varying(30) DEFAULT 'member'::character varying NOT NULL,
    team_title character varying(100) DEFAULT 'Member'::character varying NOT NULL,
    position_title character varying(100) DEFAULT 'Member'::character varying NOT NULL,
    status character varying(30) DEFAULT 'pending'::character varying NOT NULL,
    token character varying(120),
    notification_id uuid,
    invitation_message text,
    expires_at timestamp with time zone DEFAULT (now() + '7 days'::interval) NOT NULL,
    responded_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT club_team_invitations_pkey PRIMARY KEY (id)
);

-- Table: club_team_members
CREATE TABLE IF NOT EXISTS public.club_team_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    team_id uuid NOT NULL,
    club_id uuid NOT NULL,
    user_id uuid NOT NULL,
    club_membership_id uuid,
    team_role character varying(30) DEFAULT 'member'::character varying NOT NULL,
    team_title character varying(100) DEFAULT 'Member'::character varying NOT NULL,
    status character varying(30) DEFAULT 'active'::character varying NOT NULL,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    assigned_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    position_title character varying(100) DEFAULT 'Member'::character varying NOT NULL,
    CONSTRAINT club_team_members_pkey PRIMARY KEY (id)
);

-- Table: club_teams
CREATE TABLE IF NOT EXISTS public.club_teams (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    club_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    slug character varying(120),
    description text,
    responsibilities text,
    lead_user_id uuid,
    co_lead_user_id uuid,
    status character varying(30) DEFAULT 'active'::character varying NOT NULL,
    is_archived boolean DEFAULT false NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT club_teams_pkey PRIMARY KEY (id)
);

-- Table: club_user_moderation
CREATE TABLE IF NOT EXISTS public.club_user_moderation (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    club_id uuid NOT NULL,
    user_id uuid NOT NULL,
    is_muted boolean DEFAULT false NOT NULL,
    muted_at timestamp with time zone,
    muted_by uuid,
    mute_reason text,
    is_blocked boolean DEFAULT false NOT NULL,
    blocked_at timestamp with time zone,
    blocked_by uuid,
    block_reason text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT club_user_moderation_pkey PRIMARY KEY (id),
    CONSTRAINT unique_club_user_moderation UNIQUE (club_id, user_id)
);

-- Table: club_verification_requests
CREATE TABLE IF NOT EXISTS public.club_verification_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    auth_user_id uuid NOT NULL,
    club_name text NOT NULL,
    college_name text NOT NULL,
    college_city text NOT NULL,
    college_state text NOT NULL,
    college_country text DEFAULT 'India'::text NOT NULL,
    club_category text NOT NULL,
    club_description text,
    contact_person_name text NOT NULL,
    contact_person_role text NOT NULL,
    contact_email text NOT NULL,
    college_official_email text,
    contact_phone text,
    college_website_url text,
    club_website_url text,
    club_social_url text,
    terms_accepted boolean DEFAULT false NOT NULL,
    terms_version text NOT NULL,
    privacy_policy_accepted boolean DEFAULT false NOT NULL,
    privacy_policy_version text NOT NULL,
    consent_recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    college_contact_status text DEFAULT 'not_started'::text NOT NULL,
    club_existence_confirmed boolean DEFAULT false NOT NULL,
    college_authorization_confirmed boolean DEFAULT false NOT NULL,
    representative_authority_confirmed boolean DEFAULT false NOT NULL,
    last_college_contacted_at timestamp with time zone,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    internal_notes text,
    submitted_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    verified_club_id uuid,
    college_id uuid,
    is_email_verified boolean DEFAULT false,
    is_phone_verified boolean DEFAULT false,
    phone_verified_at timestamp with time zone,
    CONSTRAINT club_verification_requests_club_category_check CHECK ((club_category = ANY (ARRAY['coding'::text, 'technology'::text, 'ai_ml'::text, 'robotics'::text, 'entrepreneurship'::text, 'cultural'::text, 'sports'::text, 'other'::text]))),
    CONSTRAINT club_verification_requests_club_name_check CHECK (((length(btrim(club_name)) >= 2) AND (length(btrim(club_name)) <= 120))),
    CONSTRAINT club_verification_requests_club_social_url_check CHECK (((club_social_url IS NULL) OR (club_social_url ~* '^https?://'::text))),
    CONSTRAINT club_verification_requests_club_website_url_check CHECK (((club_website_url IS NULL) OR (club_website_url ~* '^https?://'::text))),
    CONSTRAINT club_verification_requests_college_contact_status_check CHECK ((college_contact_status = ANY (ARRAY['not_started'::text, 'contacted'::text, 'confirmed'::text, 'not_found'::text, 'no_response'::text]))),
    CONSTRAINT club_verification_requests_college_name_check CHECK (((length(btrim(college_name)) >= 2) AND (length(btrim(college_name)) <= 200))),
    CONSTRAINT club_verification_requests_college_website_url_check CHECK (((college_website_url IS NULL) OR (college_website_url ~* '^https?://'::text))),
    CONSTRAINT club_verification_requests_privacy_policy_accepted_check CHECK ((privacy_policy_accepted IS TRUE)),
    CONSTRAINT club_verification_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'under_review'::text, 'needs_information'::text, 'rejected'::text, 'ready_for_promotion'::text, 'approved'::text]))),
    CONSTRAINT club_verification_requests_terms_accepted_check CHECK ((terms_accepted IS TRUE)),
    CONSTRAINT club_verification_requests_pkey PRIMARY KEY (id)
);

-- Table: college_verification_email_tokens
CREATE TABLE IF NOT EXISTS public.college_verification_email_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    verification_id uuid,
    user_id uuid NOT NULL,
    institution_email character varying(255) NOT NULL,
    token_hash character varying(64) NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    verified_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT college_verification_email_tokens_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'verified'::character varying, 'expired'::character varying])::text[]))),
    CONSTRAINT college_verification_email_tokens_pkey PRIMARY KEY (id)
);

-- Table: college_verification_phone_otps
CREATE TABLE IF NOT EXISTS public.college_verification_phone_otps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    verification_id uuid,
    user_id uuid NOT NULL,
    phone character varying(30) NOT NULL,
    otp_hash character varying(64) NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    attempts integer DEFAULT 0,
    expires_at timestamp with time zone NOT NULL,
    verified_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT college_verification_phone_otps_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'verified'::character varying, 'expired'::character varying])::text[]))),
    CONSTRAINT college_verification_phone_otps_pkey PRIMARY KEY (id)
);

-- Table: college_verifications
CREATE TABLE IF NOT EXISTS public.college_verifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    college_id uuid NOT NULL,
    status character varying(30) DEFAULT 'PENDING'::character varying NOT NULL,
    document_type character varying(50) NOT NULL,
    document_paths jsonb DEFAULT '[]'::jsonb NOT NULL,
    extracted_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    student_name character varying(255),
    enrollment_number character varying(100),
    course_name character varying(255),
    academic_year character varying(100),
    institution_email character varying(255),
    email_verified_at timestamp with time zone,
    phone_number character varying(30),
    phone_verified_at timestamp with time zone,
    ocr_confidence numeric(5,2) DEFAULT 0.00,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    rejection_reason text,
    reviewer_notes text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT college_verifications_status_check CHECK (((status)::text = ANY ((ARRAY['NOT_VERIFIED'::character varying, 'PENDING'::character varying, 'PROCESSING'::character varying, 'APPROVED'::character varying, 'REJECTED'::character varying, 'INVALIDATED'::character varying])::text[]))),
    CONSTRAINT college_verifications_pkey PRIMARY KEY (id)
);

-- Table: email_verification_otps
CREATE TABLE IF NOT EXISTS public.email_verification_otps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    email character varying(255) NOT NULL,
    otp_hash character varying(64) NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying,
    attempts integer DEFAULT 0,
    ip_address character varying(45),
    user_agent text,
    expires_at timestamp with time zone NOT NULL,
    verified_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT email_verification_otps_pkey PRIMARY KEY (id)
);

-- Table: help_faq_feedback
CREATE TABLE IF NOT EXISTS public.help_faq_feedback (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    faq_id uuid NOT NULL,
    user_id uuid,
    ip_address character varying(45),
    is_helpful boolean NOT NULL,
    feedback_text text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT help_faq_feedback_pkey PRIMARY KEY (id),
    CONSTRAINT help_faq_feedback_faq_id_user_id_key UNIQUE (faq_id, user_id)
);

-- Table: help_faqs
CREATE TABLE IF NOT EXISTS public.help_faqs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug character varying(120) NOT NULL,
    category character varying(50) NOT NULL,
    question character varying(300) NOT NULL,
    answer text NOT NULL,
    helpful_count integer DEFAULT 0,
    not_helpful_count integer DEFAULT 0,
    is_published boolean DEFAULT true,
    order_index integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT help_faqs_pkey PRIMARY KEY (id),
    CONSTRAINT help_faqs_slug_key UNIQUE (slug)
);

-- Table: help_ticket_attachments
CREATE TABLE IF NOT EXISTS public.help_ticket_attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_id uuid NOT NULL,
    file_name character varying(255) NOT NULL,
    file_size_bytes integer NOT NULL,
    mime_type character varying(100) NOT NULL,
    storage_path text NOT NULL,
    download_url text NOT NULL,
    uploaded_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT help_ticket_attachments_pkey PRIMARY KEY (id)
);

-- Table: help_ticket_messages
CREATE TABLE IF NOT EXISTS public.help_ticket_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_id uuid NOT NULL,
    sender_id uuid,
    sender_type character varying(20) NOT NULL,
    sender_name character varying(100),
    message text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT help_ticket_messages_sender_type_check CHECK (((sender_type)::text = ANY ((ARRAY['user'::character varying, 'support'::character varying, 'system'::character varying])::text[]))),
    CONSTRAINT help_ticket_messages_pkey PRIMARY KEY (id)
);

-- Table: help_tickets
CREATE TABLE IF NOT EXISTS public.help_tickets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_number character varying(32) NOT NULL,
    user_id uuid,
    username character varying(100),
    contact_email character varying(255) NOT NULL,
    category character varying(50) NOT NULL,
    subject character varying(200) NOT NULL,
    description text NOT NULL,
    priority character varying(20) DEFAULT 'normal'::character varying NOT NULL,
    status character varying(30) DEFAULT 'open'::character varying NOT NULL,
    system_info jsonb DEFAULT '{}'::jsonb,
    attachment_url text,
    resolution_note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved_at timestamp with time zone,
    assigned_to uuid,
    assigned_team character varying(50) DEFAULT 'general'::character varying,
    internal_notes text,
    last_response_at timestamp with time zone,
    closed_at timestamp with time zone,
    closed_by uuid,
    CONSTRAINT help_tickets_category_check CHECK (((category)::text = ANY ((ARRAY['bug_report'::character varying, 'sync_issue'::character varying, 'college_verification'::character varying, 'feature_request'::character varying, 'general_inquiry'::character varying])::text[]))),
    CONSTRAINT help_tickets_priority_check CHECK (((priority)::text = ANY ((ARRAY['low'::character varying, 'normal'::character varying, 'high'::character varying, 'urgent'::character varying])::text[]))),
    CONSTRAINT help_tickets_status_check CHECK (((status)::text = ANY ((ARRAY['open'::character varying, 'acknowledged'::character varying, 'in_progress'::character varying, 'investigating'::character varying, 'waiting_on_user'::character varying, 'resolved'::character varying, 'closed'::character varying])::text[]))),
    CONSTRAINT help_tickets_pkey PRIMARY KEY (id),
    CONSTRAINT help_tickets_ticket_number_key UNIQUE (ticket_number)
);

-- Table: institution_aliases
CREATE TABLE IF NOT EXISTS public.institution_aliases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    institution_id uuid NOT NULL,
    alias character varying(255) NOT NULL,
    alias_type character varying(50) DEFAULT 'abbreviation'::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT institution_aliases_pkey PRIMARY KEY (id),
    CONSTRAINT unique_inst_alias UNIQUE (institution_id, alias)
);

-- Table: institution_rankings
CREATE TABLE IF NOT EXISTS public.institution_rankings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    institution_id uuid NOT NULL,
    ranking_body character varying(50) NOT NULL,
    year integer NOT NULL,
    category character varying(100) NOT NULL,
    rank character varying(50) NOT NULL,
    score numeric(6,2),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT institution_rankings_pkey PRIMARY KEY (id),
    CONSTRAINT unique_inst_ranking UNIQUE (institution_id, ranking_body, year, category)
);

-- Table: institution_regulatory_ids
CREATE TABLE IF NOT EXISTS public.institution_regulatory_ids (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    institution_id uuid NOT NULL,
    regulator character varying(50) NOT NULL,
    identifier character varying(100) NOT NULL,
    status character varying(50),
    valid_from date,
    valid_until date,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT institution_regulatory_ids_pkey PRIMARY KEY (id),
    CONSTRAINT unique_institution_regulator UNIQUE (institution_id, regulator, identifier)
);

-- Table: institution_sources
CREATE TABLE IF NOT EXISTS public.institution_sources (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    institution_id uuid NOT NULL,
    source_name character varying(200) NOT NULL,
    source_url text,
    source_record_id character varying(100),
    source_publication_year character varying(20),
    retrieval_date date DEFAULT CURRENT_DATE NOT NULL,
    verification_result character varying(50) DEFAULT 'confirmed'::character varying NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT institution_sources_verification_result_check CHECK (((verification_result)::text = ANY ((ARRAY['confirmed'::character varying, 'partial'::character varying, 'conflicting'::character varying, 'unverified'::character varying])::text[]))),
    CONSTRAINT institution_sources_pkey PRIMARY KEY (id)
);

-- Table: institution_verification_requests
CREATE TABLE IF NOT EXISTS public.institution_verification_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    submitted_by_user_id uuid,
    submitted_by_username character varying(100),
    institution_name character varying(500) NOT NULL,
    institution_website character varying(500),
    supporting_reference text,
    status character varying(30) DEFAULT 'pending'::character varying NOT NULL,
    admin_notes text,
    resolved_institution_id uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT institution_verification_requests_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'under_review'::character varying, 'approved'::character varying, 'rejected'::character varying, 'duplicate'::character varying])::text[]))),
    CONSTRAINT institution_verification_requests_pkey PRIMARY KEY (id)
);

-- Table: institutions
CREATE TABLE IF NOT EXISTS public.institutions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    official_name character varying(500) NOT NULL,
    normalized_name character varying(500) NOT NULL,
    aliases text[] DEFAULT '{}'::text[],
    aishe_code character varying(50),
    state character varying(100),
    district character varying(150),
    city character varying(150),
    institution_type character varying(100),
    website character varying(500),
    verification_status character varying(30) DEFAULT 'unverified'::character varying NOT NULL,
    verification_basis text,
    is_active boolean DEFAULT true NOT NULL,
    last_verified_at timestamp with time zone,
    source_year character varying(20),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    parent_university character varying(500),
    parent_university_id uuid,
    subtype character varying(100),
    CONSTRAINT institutions_verification_status_check CHECK (((verification_status)::text = ANY ((ARRAY['verified'::character varying, 'needs_review'::character varying, 'unverified'::character varying, 'inactive'::character varying])::text[]))),
    CONSTRAINT institutions_pkey PRIMARY KEY (id),
    CONSTRAINT institutions_aishe_code_key UNIQUE (aishe_code)
);

-- Table: leaderboard_entries
CREATE TABLE IF NOT EXISTS public.leaderboard_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    username character varying(100) NOT NULL,
    score integer DEFAULT 0,
    orbix_score integer DEFAULT 0,
    total_solved integer DEFAULT 0,
    total_contests integer DEFAULT 0,
    global_rank integer,
    is_verified boolean DEFAULT false,
    is_public boolean DEFAULT true,
    college_id uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT leaderboard_entries_pkey PRIMARY KEY (id),
    CONSTRAINT leaderboard_entries_user_id_key UNIQUE (user_id),
    CONSTRAINT leaderboard_entries_username_key UNIQUE (username)
);

-- Table: phone_verification_otps
CREATE TABLE IF NOT EXISTS public.phone_verification_otps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    phone character varying(30) NOT NULL,
    otp_hash character varying(64) NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying,
    attempts integer DEFAULT 0,
    ip_address character varying(45),
    user_agent text,
    expires_at timestamp with time zone NOT NULL,
    verified_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    firebase_uid text,
    auth_provider character varying(50) DEFAULT 'firebase'::character varying,
    CONSTRAINT phone_verification_otps_pkey PRIMARY KEY (id)
);

-- Table: photo_cleanup_queue
CREATE TABLE IF NOT EXISTS public.photo_cleanup_queue (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    public_id text NOT NULL,
    reason character varying(50) NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    last_error text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT photo_cleanup_queue_pkey PRIMARY KEY (id)
);

-- Table: photo_upload_intents
CREATE TABLE IF NOT EXISTS public.photo_upload_intents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    username character varying(100),
    user_email character varying(255),
    public_id text NOT NULL,
    signature text NOT NULL,
    timestamp bigint NOT NULL,
    folder text NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT photo_upload_intents_pkey PRIMARY KEY (id),
    CONSTRAINT photo_upload_intents_public_id_key UNIQUE (public_id)
);

-- Table: privacy_request_audit
CREATE TABLE IF NOT EXISTS public.privacy_request_audit (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    request_type character varying(50) NOT NULL,
    details jsonb DEFAULT '{}'::jsonb,
    ip_address character varying(45),
    user_agent text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT privacy_request_audit_pkey PRIMARY KEY (id)
);

-- Table: recruiter_messages
CREATE TABLE IF NOT EXISTS public.recruiter_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    recipient_user_id uuid,
    recipient_username character varying(100) NOT NULL,
    recipient_email character varying(255),
    sender_name character varying(150) NOT NULL,
    sender_email character varying(255) NOT NULL,
    communication_email character varying(255),
    company character varying(200),
    message text NOT NULL,
    status character varying(50) DEFAULT 'delivered'::character varying,
    is_read boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT recruiter_messages_pkey PRIMARY KEY (id)
);

-- Table: resume_analyses
CREATE TABLE IF NOT EXISTS public.resume_analyses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    resume_upload_id uuid,
    user_id uuid,
    username character varying(100) NOT NULL,
    analyzer_version character varying(50) DEFAULT 'v1.0-orbix-intelligence'::character varying NOT NULL,
    model_identifier character varying(100),
    extracted_fields jsonb DEFAULT '{}'::jsonb NOT NULL,
    findings jsonb DEFAULT '[]'::jsonb NOT NULL,
    score_breakdown jsonb DEFAULT '{}'::jsonb NOT NULL,
    extraction_confidence_score numeric(5,2) DEFAULT 0.00 NOT NULL,
    profile_comparison jsonb DEFAULT '{}'::jsonb NOT NULL,
    analysis_status character varying(50) DEFAULT 'completed'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    resume_id uuid,
    version_id uuid,
    overall_score integer DEFAULT 0,
    checks_summary jsonb DEFAULT '{}'::jsonb,
    job_match_report jsonb,
    source_type character varying(50) DEFAULT 'structured'::character varying,
    source_filename character varying(255),
    source_filesize integer,
    CONSTRAINT resume_analyses_pkey PRIMARY KEY (id)
);

-- Table: resume_cleanup_queue
CREATE TABLE IF NOT EXISTS public.resume_cleanup_queue (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    public_id text NOT NULL,
    resource_type character varying(20) DEFAULT 'raw'::character varying NOT NULL,
    reason character varying(50) NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    last_error text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT resume_cleanup_queue_pkey PRIMARY KEY (id)
);

-- Table: resume_profile_sync_reviews
CREATE TABLE IF NOT EXISTS public.resume_profile_sync_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    resume_upload_id uuid,
    user_id uuid,
    username character varying(100) NOT NULL,
    review_status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    proposed_changes jsonb DEFAULT '[]'::jsonb NOT NULL,
    selected_changes jsonb DEFAULT '[]'::jsonb,
    result_summary jsonb DEFAULT '{}'::jsonb,
    reviewed_at timestamp with time zone,
    synchronized_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT resume_profile_sync_reviews_pkey PRIMARY KEY (id)
);

-- Table: resume_upload_intents
CREATE TABLE IF NOT EXISTS public.resume_upload_intents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    username character varying(100),
    user_email character varying(255),
    public_id text NOT NULL,
    signature text NOT NULL,
    timestamp bigint NOT NULL,
    folder text NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT resume_upload_intents_pkey PRIMARY KEY (id),
    CONSTRAINT resume_upload_intents_public_id_key UNIQUE (public_id)
);

-- Table: resume_uploads
CREATE TABLE IF NOT EXISTS public.resume_uploads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    username character varying(100) NOT NULL,
    storage_reference text NOT NULL,
    storage_provider character varying(50) DEFAULT 'cloudinary'::character varying NOT NULL,
    original_filename character varying(255) NOT NULL,
    validated_mime_type character varying(100) NOT NULL,
    file_size integer NOT NULL,
    checksum character varying(64) NOT NULL,
    processing_status character varying(50) DEFAULT 'uploaded'::character varying NOT NULL,
    ai_consent_granted boolean DEFAULT false,
    ai_consent_timestamp timestamp with time zone,
    error_message text,
    retention_status character varying(50) DEFAULT 'active'::character varying,
    sync_review_status character varying(50) DEFAULT 'pending'::character varying,
    uploaded_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    analysis_completed_at timestamp with time zone,
    CONSTRAINT resume_uploads_pkey PRIMARY KEY (id)
);

-- Table: resume_versions
CREATE TABLE IF NOT EXISTS public.resume_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    resume_id uuid NOT NULL,
    user_id uuid,
    username character varying(100) NOT NULL,
    version_number integer DEFAULT 1 NOT NULL,
    version_label character varying(100) DEFAULT 'Initial Draft'::character varying NOT NULL,
    target_role character varying(255),
    company_name character varying(255),
    job_description text,
    content jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT resume_versions_pkey PRIMARY KEY (id)
);

-- Table: schema_migrations
CREATE TABLE IF NOT EXISTS public.schema_migrations (
    version character varying(255) NOT NULL,
    applied_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT schema_migrations_pkey PRIMARY KEY (version)
);

-- Table: team_workspaces
CREATE TABLE IF NOT EXISTS public.team_workspaces (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    club_id uuid NOT NULL,
    owner_id uuid NOT NULL,
    name character varying(120) NOT NULL,
    slug character varying(150) NOT NULL,
    description text,
    icon_url text,
    workspace_status character varying(30) DEFAULT 'active'::character varying NOT NULL,
    schema_version integer DEFAULT 1 NOT NULL,
    settings jsonb DEFAULT '{"theme": "neo", "max_members": 250, "allow_member_invites": true}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    manager_user_id uuid,
    manager_appointed_at timestamp with time zone,
    manager_permissions jsonb DEFAULT '[]'::jsonb,
    CONSTRAINT team_workspaces_workspace_status_check CHECK (((workspace_status)::text = ANY ((ARRAY['active'::character varying, 'suspended'::character varying, 'archived'::character varying])::text[]))),
    CONSTRAINT team_workspaces_pkey PRIMARY KEY (id),
    CONSTRAINT uq_team_workspaces_club_id UNIQUE (club_id),
    CONSTRAINT uq_team_workspaces_slug UNIQUE (slug)
);

-- Table: user_blocks
CREATE TABLE IF NOT EXISTS public.user_blocks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    blocker_id uuid NOT NULL,
    blocked_id uuid NOT NULL,
    reason character varying(255),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT check_no_self_block CHECK ((blocker_id <> blocked_id)),
    CONSTRAINT user_blocks_pkey PRIMARY KEY (id),
    CONSTRAINT unique_user_block UNIQUE (blocker_id, blocked_id)
);

-- Table: user_github_installations
CREATE TABLE IF NOT EXISTS public.user_github_installations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    installation_id character varying(100) NOT NULL,
    account_login character varying(150) NOT NULL,
    account_type character varying(50) DEFAULT 'User'::character varying,
    repository_selection character varying(50) DEFAULT 'selected'::character varying,
    permissions jsonb DEFAULT '{"contents": "read", "metadata": "read"}'::jsonb,
    encrypted_access_token text,
    token_expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT user_github_installations_pkey PRIMARY KEY (id),
    CONSTRAINT uq_user_installation UNIQUE (user_id, installation_id)
);

-- Table: user_legal_consents
CREATE TABLE IF NOT EXISTS public.user_legal_consents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    document_type character varying(50) NOT NULL,
    document_version character varying(32) DEFAULT 'v1.0'::character varying NOT NULL,
    action character varying(50) DEFAULT 'accepted'::character varying NOT NULL,
    ip_address character varying(100),
    user_agent text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT user_legal_consents_pkey PRIMARY KEY (id)
);

-- Table: user_links
CREATE TABLE IF NOT EXISTS public.user_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    username character varying(100),
    portal character varying(50) NOT NULL,
    portal_username character varying(100) NOT NULL,
    link text NOT NULL,
    raw_input text,
    verified boolean DEFAULT true,
    display_name character varying(150),
    avatar_url text,
    stats jsonb DEFAULT '[]'::jsonb,
    is_public boolean DEFAULT true,
    last_sync_status character varying(50) DEFAULT 'valid'::character varying,
    last_sync_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_error text,
    snapshot jsonb DEFAULT '{}'::jsonb,
    retry_count integer DEFAULT 0,
    CONSTRAINT user_links_pkey PRIMARY KEY (id),
    CONSTRAINT unique_user_portal UNIQUE (username, portal)
);

-- Table: user_notifications
CREATE TABLE IF NOT EXISTS public.user_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    username character varying(100) NOT NULL,
    title character varying(200) NOT NULL,
    body text NOT NULL,
    type character varying(50) DEFAULT 'hire_inquiry'::character varying,
    metadata jsonb DEFAULT '{}'::jsonb,
    is_read boolean DEFAULT false,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    recipient_id uuid,
    actor_id uuid,
    relationship_id uuid,
    notification_type character varying(100),
    idempotency_key character varying(255),
    is_user_initiated boolean DEFAULT false NOT NULL,
    delivery_status character varying(50) DEFAULT 'delivered'::character varying NOT NULL,
    CONSTRAINT user_notifications_pkey PRIMARY KEY (id),
    CONSTRAINT user_notifications_idempotency_key_key UNIQUE (idempotency_key)
);

-- Table: user_privacy_preferences
CREATE TABLE IF NOT EXISTS public.user_privacy_preferences (
    user_id uuid NOT NULL,
    anonymous_telemetry_enabled boolean DEFAULT false NOT NULL,
    public_profile_visibility character varying(20) DEFAULT 'public'::character varying NOT NULL,
    resume_visibility character varying(30) DEFAULT 'private'::character varying NOT NULL,
    recruiter_contact_allowed boolean DEFAULT true NOT NULL,
    activity_visibility character varying(30) DEFAULT 'all'::character varying NOT NULL,
    consent_version character varying(20) DEFAULT 'v1.0'::character varying,
    updated_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT user_privacy_preferences_activity_visibility_check CHECK (((activity_visibility)::text = ANY ((ARRAY['all'::character varying, 'milestones_only'::character varying, 'private'::character varying])::text[]))),
    CONSTRAINT user_privacy_preferences_public_profile_visibility_check CHECK (((public_profile_visibility)::text = ANY ((ARRAY['public'::character varying, 'private'::character varying])::text[]))),
    CONSTRAINT user_privacy_preferences_resume_visibility_check CHECK (((resume_visibility)::text = ANY ((ARRAY['private'::character varying, 'public'::character varying, 'shared_only'::character varying])::text[]))),
    CONSTRAINT user_privacy_preferences_pkey PRIMARY KEY (user_id)
);

-- Table: user_projects
CREATE TABLE IF NOT EXISTS public.user_projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title character varying(150) NOT NULL,
    slug character varying(180) NOT NULL,
    tagline character varying(255),
    description text,
    category character varying(50) DEFAULT 'Full-Stack'::character varying,
    status character varying(20) DEFAULT 'draft'::character varying,
    is_published boolean DEFAULT false,
    is_pinned boolean DEFAULT false,
    display_order integer DEFAULT 0 NOT NULL,
    repo_url text,
    repo_name character varying(150),
    repo_stars integer DEFAULT 0,
    repo_forks integer DEFAULT 0,
    repo_license character varying(100),
    repo_language character varying(60),
    repo_pushed_at timestamp with time zone,
    live_url text,
    demo_video_url text,
    documentation_url text,
    image_url text,
    gallery_images jsonb DEFAULT '[]'::jsonb,
    technologies jsonb DEFAULT '[]'::jsonb,
    features jsonb DEFAULT '[]'::jsonb,
    external_links jsonb DEFAULT '[]'::jsonb,
    architecture_notes text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_repo_private boolean DEFAULT false,
    hide_repo_url boolean DEFAULT false,
    project_type character varying(60) DEFAULT 'Web application'::character varying,
    development_status character varying(40) DEFAULT 'Completed'::character varying,
    full_overview text,
    story jsonb DEFAULT '{}'::jsonb,
    categorized_technologies jsonb DEFAULT '{}'::jsonb,
    contribution jsonb DEFAULT '{}'::jsonb,
    additional_details jsonb DEFAULT '{}'::jsonb,
    api_doc_url text,
    figma_url text,
    raw_extracted_data jsonb DEFAULT '{}'::jsonb,
    field_overrides jsonb DEFAULT '{}'::jsonb,
    last_synced_at timestamp with time zone,
    sync_metadata jsonb DEFAULT '{"lastCheckAt": null, "pendingDiffCount": 0}'::jsonb,
    short_description text,
    repository_provider character varying(50) DEFAULT 'github'::character varying,
    repository_owner character varying(100),
    repository_visibility character varying(20) DEFAULT 'public'::character varying,
    repository_metadata jsonb DEFAULT '{}'::jsonb,
    extraction_status character varying(30) DEFAULT 'completed'::character varying,
    extraction_completeness integer DEFAULT 100,
    show_on_profile boolean DEFAULT true,
    repository_link_visibility character varying(20) DEFAULT 'visible'::character varying,
    CONSTRAINT user_projects_extraction_completeness_check CHECK (((extraction_completeness >= 0) AND (extraction_completeness <= 100))),
    CONSTRAINT user_projects_extraction_status_check CHECK (((extraction_status)::text = ANY ((ARRAY['pending'::character varying, 'analyzing'::character varying, 'completed'::character varying, 'manual'::character varying, 'incomplete'::character varying, 'error'::character varying])::text[]))),
    CONSTRAINT user_projects_repository_link_visibility_check CHECK (((repository_link_visibility)::text = ANY ((ARRAY['visible'::character varying, 'hidden'::character varying])::text[]))),
    CONSTRAINT user_projects_repository_visibility_check CHECK (((repository_visibility)::text = ANY ((ARRAY['public'::character varying, 'private'::character varying, 'internal'::character varying])::text[]))),
    CONSTRAINT user_projects_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'published'::character varying])::text[]))),
    CONSTRAINT user_projects_pkey PRIMARY KEY (id)
);

-- Table: user_relationship_action_logs
CREATE TABLE IF NOT EXISTS public.user_relationship_action_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_id uuid NOT NULL,
    target_id uuid NOT NULL,
    action_type character varying(30) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT user_relationship_action_logs_action_type_check CHECK (((action_type)::text = ANY ((ARRAY['request'::character varying, 'block'::character varying])::text[]))),
    CONSTRAINT user_relationship_action_logs_pkey PRIMARY KEY (id)
);

-- Table: user_relationships
CREATE TABLE IF NOT EXISTS public.user_relationships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_low_id uuid NOT NULL,
    user_high_id uuid NOT NULL,
    status character varying(30) NOT NULL,
    requested_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    responded_at timestamp with time zone,
    last_action_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT check_canonical_order CHECK ((user_low_id < user_high_id)),
    CONSTRAINT check_requester_in_pair CHECK (((requested_by = user_low_id) OR (requested_by = user_high_id))),
    CONSTRAINT user_relationships_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'connected'::character varying, 'declined'::character varying, 'cancelled'::character varying, 'removed'::character varying])::text[]))),
    CONSTRAINT user_relationships_pkey PRIMARY KEY (id),
    CONSTRAINT unique_canonical_pair UNIQUE (user_low_id, user_high_id)
);

-- Table: user_resumes
CREATE TABLE IF NOT EXISTS public.user_resumes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    username character varying(100) NOT NULL,
    title character varying(255) DEFAULT 'My Developer Resume'::character varying NOT NULL,
    target_role character varying(255) DEFAULT 'Full Stack Engineer'::character varying,
    template_id character varying(50) DEFAULT 'ats_clean_single'::character varying,
    content jsonb DEFAULT '{}'::jsonb NOT NULL,
    completeness_score integer DEFAULT 0,
    is_primary boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT user_resumes_pkey PRIMARY KEY (id)
);

-- Table: user_sessions
CREATE TABLE IF NOT EXISTS public.user_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    session_id character varying(128) NOT NULL,
    device_id_hash character varying(64) NOT NULL,
    device_name character varying(100) NOT NULL,
    device_type character varying(30) DEFAULT 'desktop'::character varying NOT NULL,
    browser character varying(50) NOT NULL,
    browser_version character varying(30),
    operating_system character varying(50) NOT NULL,
    operating_system_version character varying(30),
    user_agent_summary text,
    raw_user_agent text,
    ip_address_masked character varying(64) NOT NULL,
    ip_address_hash character varying(64) NOT NULL,
    city character varying(100),
    region character varying(100),
    country character varying(100),
    country_code character varying(10),
    location_summary character varying(200),
    login_method character varying(40) DEFAULT 'password'::character varying NOT NULL,
    is_mfa_authenticated boolean DEFAULT false NOT NULL,
    is_new_device boolean DEFAULT false NOT NULL,
    risk_level character varying(20) DEFAULT 'low'::character varying NOT NULL,
    risk_reasons text[] DEFAULT '{}'::text[],
    status character varying(30) DEFAULT 'active'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_active_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    revocation_reason character varying(100),
    CONSTRAINT user_sessions_pkey PRIMARY KEY (id),
    CONSTRAINT user_sessions_session_id_key UNIQUE (session_id)
);

-- Table: users
CREATE TABLE IF NOT EXISTS public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    username character varying(20) NOT NULL,
    firstname character varying(50) NOT NULL,
    middlename character varying(50),
    lastname character varying(50) NOT NULL,
    email character varying(255) NOT NULL,
    password character varying(255),
    termsaccepted boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    college_id uuid,
    account_type character varying(20) DEFAULT 'personal'::character varying NOT NULL,
    is_phone_verified boolean DEFAULT false,
    phone_verified_at timestamp with time zone,
    phone character varying(30),
    phone_confirmed_at timestamp with time zone,
    pending_email character varying(255),
    pending_email_operation_id uuid,
    username_updated_at timestamp with time zone,
    is_email_verified boolean DEFAULT false,
    email_verified_at timestamp with time zone,
    is_two_factor_enabled boolean DEFAULT false,
    two_factor_enabled_at timestamp with time zone,
    staff_role character varying(50) DEFAULT 'user'::character varying,
    google_id character varying(255),
    github_id character varying(255),
    auth_provider character varying(50) DEFAULT 'local'::character varying,
    terms_version character varying(32) DEFAULT 'v1.0'::character varying,
    terms_accepted_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    privacy_policy_accepted boolean DEFAULT true,
    privacy_policy_version character varying(32) DEFAULT 'v1.0'::character varying,
    privacy_policy_accepted_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    is_age_18_confirmed boolean DEFAULT true,
    age_confirmed_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    is_college_verified boolean DEFAULT false,
    college_verified_at timestamp with time zone,
    headline character varying(255),
    bio text,
    avatar_url text DEFAULT 'https://res.cloudinary.com/dj0ivep44/image/upload/v1793017168/avatar_pasprg.png'::text,
    cover_image_url text,
    website character varying(255),
    linkedin character varying(255),
    github character varying(255),
    custom_link character varying(255),
    location character varying(150),
    skills jsonb DEFAULT '[]'::jsonb,
    links jsonb DEFAULT '[]'::jsonb,
    is_public boolean DEFAULT true,
    photo_url text,
    photo_public_id text,
    previous_photo_url text,
    previous_photo_public_id text,
    college character varying(255) DEFAULT NULL::character varying,
    college_updated_at timestamp with time zone,
    orbix_score integer DEFAULT 0,
    orbix_score_breakdown jsonb DEFAULT '{}'::jsonb,
    orbix_score_version character varying(20) DEFAULT 'v1.0.0'::character varying,
    orbix_score_updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    is_verified_coder boolean DEFAULT false,
    streak integer DEFAULT 0,
    total_solved integer DEFAULT 0,
    total_contests integer DEFAULT 0,
    platform_ratings jsonb DEFAULT '{}'::jsonb,
    is_open_to_work boolean DEFAULT false,
    is_hireable boolean DEFAULT false,
    resume_url text,
    resume_public_id text,
    resume_filename character varying(255),
    resume_filesize integer,
    resume_updated_at timestamp with time zone,
    is_resume_public boolean DEFAULT true,
    resume_metadata jsonb DEFAULT '{}'::jsonb,
    roll_number character varying(100),
    department character varying(100),
    year_of_study character varying(50),
    CONSTRAINT users_account_type_check CHECK (((account_type)::text = ANY ((ARRAY['personal'::character varying, 'club'::character varying, 'admin'::character varying])::text[]))),
    CONSTRAINT users_pkey PRIMARY KEY (id),
    CONSTRAINT users_email_key UNIQUE (email),
    CONSTRAINT users_username_key UNIQUE (username)
);

-- Table: verified_clubs
CREATE TABLE IF NOT EXISTS public.verified_clubs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    auth_user_id uuid NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    category character varying(50) NOT NULL,
    college_name text NOT NULL,
    college_city text NOT NULL,
    college_state text NOT NULL,
    college_country text DEFAULT 'India'::text NOT NULL,
    short_description text,
    about text,
    logo_url text,
    cover_image_url text,
    website_url text,
    public_email text,
    social_links jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    verified_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    college_id uuid,
    founded_year integer,
    operating_status character varying(30) DEFAULT 'active'::character varying NOT NULL,
    mission text,
    vision text,
    focus_areas jsonb DEFAULT '[]'::jsonb NOT NULL,
    contact_phone text,
    publication_status character varying(20) DEFAULT 'published'::character varying NOT NULL,
    profile_visibility character varying(20) DEFAULT 'public'::character varying NOT NULL,
    recruitment_status character varying(20) DEFAULT 'closed'::character varying NOT NULL,
    recruitment_announcement text,
    recruitment_url text,
    links jsonb DEFAULT '[]'::jsonb NOT NULL,
    visibility character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    category_updated_at timestamp with time zone,
    CONSTRAINT verified_clubs_name_check CHECK (((length(btrim(name)) >= 2) AND (length(btrim(name)) <= 120))),
    CONSTRAINT verified_clubs_profile_visibility_check CHECK (((profile_visibility)::text = ANY ((ARRAY['public'::character varying, 'unlisted'::character varying, 'private'::character varying])::text[]))),
    CONSTRAINT verified_clubs_publication_status_check CHECK (((publication_status)::text = ANY ((ARRAY['draft'::character varying, 'published'::character varying, 'hidden'::character varying])::text[]))),
    CONSTRAINT verified_clubs_recruitment_status_check CHECK (((recruitment_status)::text = ANY ((ARRAY['open'::character varying, 'closed'::character varying, 'upcoming'::character varying])::text[]))),
    CONSTRAINT verified_clubs_slug_check CHECK ((slug ~* '^[a-z0-9]+(-[a-z0-9]+)*$'::text)),
    CONSTRAINT verified_clubs_unified_visibility_check CHECK (((visibility)::text = ANY ((ARRAY['draft'::character varying, 'public'::character varying, 'unlisted'::character varying, 'private'::character varying, 'archived'::character varying])::text[]))),
    CONSTRAINT verified_clubs_pkey PRIMARY KEY (id),
    CONSTRAINT verified_clubs_auth_user_id_key UNIQUE (auth_user_id),
    CONSTRAINT verified_clubs_slug_key UNIQUE (slug)
);

-- Table: workspace_activity_feed
CREATE TABLE IF NOT EXISTS public.workspace_activity_feed (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    department_id uuid,
    actor_id uuid NOT NULL,
    event_type character varying(64) NOT NULL,
    resource_type character varying(32) NOT NULL,
    resource_id character varying(128) NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    is_restricted boolean DEFAULT false NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    correlation_id uuid,
    CONSTRAINT workspace_activity_feed_pkey PRIMARY KEY (id)
);

-- Table: workspace_audit_logs
CREATE TABLE IF NOT EXISTS public.workspace_audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    actor_id uuid,
    action character varying(80) NOT NULL,
    target_type character varying(50) NOT NULL,
    target_id uuid,
    details jsonb DEFAULT '{}'::jsonb,
    ip_address character varying(50),
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    correlation_id uuid,
    CONSTRAINT workspace_audit_logs_pkey PRIMARY KEY (id)
);

-- Table: workspace_channel_categories
CREATE TABLE IF NOT EXISTS public.workspace_channel_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    name character varying(80) NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    department_id uuid,
    is_private boolean DEFAULT false NOT NULL,
    CONSTRAINT workspace_channel_categories_pkey PRIMARY KEY (id)
);

-- Table: workspace_channel_overrides
CREATE TABLE IF NOT EXISTS public.workspace_channel_overrides (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    category_id uuid,
    channel_id uuid,
    role_id uuid,
    member_id uuid,
    allow_permissions jsonb DEFAULT '[]'::jsonb NOT NULL,
    deny_permissions jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT check_override_scope CHECK ((((category_id IS NOT NULL) AND (channel_id IS NULL)) OR ((category_id IS NULL) AND (channel_id IS NOT NULL)))),
    CONSTRAINT check_override_subject CHECK ((((role_id IS NOT NULL) AND (member_id IS NULL)) OR ((role_id IS NULL) AND (member_id IS NOT NULL)))),
    CONSTRAINT workspace_channel_overrides_pkey PRIMARY KEY (id)
);

-- Table: workspace_channel_read_states
CREATE TABLE IF NOT EXISTS public.workspace_channel_read_states (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    member_id uuid NOT NULL,
    channel_id uuid,
    last_read_at timestamp with time zone DEFAULT now() NOT NULL,
    unread_mention_count integer DEFAULT 0 NOT NULL,
    notification_preferences jsonb DEFAULT '{"muted": false, "desktop_push": true, "email_digest": true}'::jsonb,
    CONSTRAINT workspace_notifications_pkey PRIMARY KEY (id),
    CONSTRAINT uq_workspace_member_channel_notif UNIQUE (member_id, channel_id)
);

-- Table: workspace_channel_reads
CREATE TABLE IF NOT EXISTS public.workspace_channel_reads (
    channel_id uuid NOT NULL,
    user_id uuid NOT NULL,
    last_read_message_id uuid,
    last_read_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT workspace_channel_reads_pkey PRIMARY KEY (channel_id, user_id)
);

-- Table: workspace_channels
CREATE TABLE IF NOT EXISTS public.workspace_channels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    category_id uuid,
    department_id uuid,
    name character varying(80) NOT NULL,
    slug character varying(100) NOT NULL,
    topic text,
    channel_type character varying(30) DEFAULT 'text'::character varying NOT NULL,
    is_private boolean DEFAULT false NOT NULL,
    is_archived boolean DEFAULT false NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_category_synced boolean DEFAULT true NOT NULL,
    position integer DEFAULT 0 NOT NULL,
    default_slowmode_seconds integer DEFAULT 0 NOT NULL,
    CONSTRAINT workspace_channels_channel_type_check CHECK (((channel_type)::text = ANY ((ARRAY['text'::character varying, 'announcement'::character varying, 'forum'::character varying, 'task_discussion'::character varying, 'department'::character varying, 'private'::character varying])::text[]))),
    CONSTRAINT workspace_channels_pkey PRIMARY KEY (id),
    CONSTRAINT uq_workspace_channel_slug UNIQUE (workspace_id, slug)
);

-- Table: workspace_department_members
CREATE TABLE IF NOT EXISTS public.workspace_department_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    department_id uuid NOT NULL,
    member_id uuid NOT NULL,
    user_id uuid NOT NULL,
    department_role character varying(50) DEFAULT 'member'::character varying NOT NULL,
    role_title character varying(100) DEFAULT 'Department Member'::character varying,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    assigned_by uuid,
    CONSTRAINT workspace_department_members_department_role_check CHECK (((department_role)::text = ANY ((ARRAY['lead'::character varying, 'co_lead'::character varying, 'member'::character varying])::text[]))),
    CONSTRAINT workspace_department_members_pkey PRIMARY KEY (id),
    CONSTRAINT uq_dept_member UNIQUE (department_id, member_id)
);

-- Table: workspace_department_transfers
CREATE TABLE IF NOT EXISTS public.workspace_department_transfers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    user_id uuid NOT NULL,
    from_department_id uuid,
    to_department_id uuid NOT NULL,
    transferred_by uuid NOT NULL,
    reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT workspace_department_transfers_pkey PRIMARY KEY (id)
);

-- Table: workspace_departments
CREATE TABLE IF NOT EXISTS public.workspace_departments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    club_team_id uuid,
    name character varying(100) NOT NULL,
    slug character varying(120) NOT NULL,
    description text,
    lead_user_id uuid,
    color character varying(30) DEFAULT '#2563eb'::character varying,
    display_order integer DEFAULT 0 NOT NULL,
    status character varying(30) DEFAULT 'active'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    icon character varying(50) DEFAULT 'Folder'::character varying,
    co_lead_user_ids jsonb DEFAULT '[]'::jsonb,
    CONSTRAINT workspace_departments_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'archived'::character varying])::text[]))),
    CONSTRAINT workspace_departments_pkey PRIMARY KEY (id),
    CONSTRAINT uq_workspace_department_slug UNIQUE (workspace_id, slug)
);

-- Table: workspace_email_deliveries
CREATE TABLE IF NOT EXISTS public.workspace_email_deliveries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    recipient_id uuid NOT NULL,
    recipient_email character varying(255) NOT NULL,
    email_type character varying(64) NOT NULL,
    idempotency_key character varying(255) NOT NULL,
    resend_id character varying(128),
    status character varying(32) DEFAULT 'queued'::character varying NOT NULL,
    retry_count integer DEFAULT 0 NOT NULL,
    error text,
    sent_at timestamp with time zone,
    delivered_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT workspace_email_deliveries_status_check CHECK (((status)::text = ANY ((ARRAY['queued'::character varying, 'sent'::character varying, 'delivered'::character varying, 'bounced'::character varying, 'complained'::character varying, 'failed'::character varying])::text[]))),
    CONSTRAINT workspace_email_deliveries_pkey PRIMARY KEY (id),
    CONSTRAINT workspace_email_deliveries_idempotency_key_key UNIQUE (idempotency_key)
);

-- Table: workspace_file_upload_intents
CREATE TABLE IF NOT EXISTS public.workspace_file_upload_intents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    user_id uuid NOT NULL,
    department_id uuid,
    parent_resource_type character varying(50) NOT NULL,
    parent_resource_id uuid,
    public_id text NOT NULL,
    folder text NOT NULL,
    original_filename character varying(255) NOT NULL,
    expected_mime_type character varying(120) NOT NULL,
    expected_size_bytes bigint NOT NULL,
    delivery_type character varying(30) DEFAULT 'authenticated'::character varying NOT NULL,
    resource_type character varying(30) DEFAULT 'auto'::character varying NOT NULL,
    status character varying(30) DEFAULT 'pending'::character varying NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    registered_at timestamp with time zone,
    CONSTRAINT workspace_file_upload_intents_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'registered'::character varying, 'expired'::character varying, 'cancelled'::character varying])::text[]))),
    CONSTRAINT workspace_file_upload_intents_pkey PRIMARY KEY (id)
);

-- Table: workspace_files
CREATE TABLE IF NOT EXISTS public.workspace_files (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    uploader_id uuid NOT NULL,
    channel_id uuid,
    task_id uuid,
    file_name character varying(255) NOT NULL,
    file_size_bytes bigint NOT NULL,
    mime_type character varying(120) NOT NULL,
    cloudinary_public_id text NOT NULL,
    cloudinary_url text NOT NULL,
    cloudinary_secure_url text NOT NULL,
    resource_type character varying(20) DEFAULT 'auto'::character varying NOT NULL,
    purpose character varying(50) DEFAULT 'attachment'::character varying NOT NULL,
    is_archived boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    message_id uuid,
    department_id uuid,
    submission_id uuid,
    cloudinary_asset_id text,
    delivery_type character varying(30) DEFAULT 'authenticated'::character varying NOT NULL,
    format character varying(30),
    checksum character varying(64),
    parent_resource_type character varying(50) DEFAULT 'attachment'::character varying NOT NULL,
    parent_resource_id uuid,
    asset_status character varying(30) DEFAULT 'active'::character varying NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT workspace_files_asset_status_check CHECK (((asset_status)::text = ANY ((ARRAY['active'::character varying, 'archived'::character varying, 'quarantined'::character varying])::text[]))),
    CONSTRAINT workspace_files_pkey PRIMARY KEY (id)
);

-- Table: workspace_invitations
CREATE TABLE IF NOT EXISTS public.workspace_invitations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    inviter_id uuid NOT NULL,
    email character varying(255) NOT NULL,
    invited_user_id uuid,
    role_id uuid NOT NULL,
    department_id uuid,
    token_hash character varying(128) NOT NULL,
    status character varying(30) DEFAULT 'pending'::character varying NOT NULL,
    invitation_message text,
    expires_at timestamp with time zone DEFAULT (now() + '7 days'::interval) NOT NULL,
    accepted_at timestamp with time zone,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT workspace_invitations_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'accepted'::character varying, 'revoked'::character varying, 'expired'::character varying])::text[]))),
    CONSTRAINT workspace_invitations_pkey PRIMARY KEY (id)
);

-- Table: workspace_members
CREATE TABLE IF NOT EXISTS public.workspace_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    user_id uuid NOT NULL,
    club_membership_id uuid,
    department_id uuid,
    role_id uuid NOT NULL,
    role_title character varying(100) DEFAULT 'Member'::character varying NOT NULL,
    membership_status character varying(30) DEFAULT 'active'::character varying NOT NULL,
    is_suspended boolean DEFAULT false NOT NULL,
    suspended_at timestamp with time zone,
    suspended_reason text,
    suspended_by uuid,
    invited_by uuid,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    last_active_at timestamp with time zone,
    custom_permissions jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT workspace_members_membership_status_check CHECK (((membership_status)::text = ANY ((ARRAY['invitation_pending'::character varying, 'active'::character varying, 'suspended'::character varying, 'removed'::character varying])::text[]))),
    CONSTRAINT workspace_members_pkey PRIMARY KEY (id),
    CONSTRAINT uq_workspace_member_user UNIQUE (workspace_id, user_id)
);

-- Table: workspace_message_reactions
CREATE TABLE IF NOT EXISTS public.workspace_message_reactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    message_id uuid NOT NULL,
    user_id uuid NOT NULL,
    emoji character varying(32) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT workspace_message_reactions_pkey PRIMARY KEY (id),
    CONSTRAINT uq_msg_reaction UNIQUE (message_id, user_id, emoji)
);

-- Table: workspace_messages
CREATE TABLE IF NOT EXISTS public.workspace_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    channel_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    sender_member_id uuid NOT NULL,
    parent_message_id uuid,
    thread_id uuid,
    content text NOT NULL,
    message_type character varying(30) DEFAULT 'text'::character varying NOT NULL,
    is_pinned boolean DEFAULT false NOT NULL,
    pinned_at timestamp with time zone,
    pinned_by uuid,
    is_edited boolean DEFAULT false NOT NULL,
    edited_at timestamp with time zone,
    is_deleted boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    mentions jsonb DEFAULT '{"roles": [], "users": [], "everyone": false}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    sender_type character varying(20) DEFAULT 'member'::character varying NOT NULL,
    CONSTRAINT chk_workspace_messages_sender_type CHECK (((sender_type)::text = ANY ((ARRAY['member'::character varying, 'club'::character varying])::text[]))),
    CONSTRAINT workspace_messages_message_type_check CHECK (((message_type)::text = ANY ((ARRAY['text'::character varying, 'system'::character varying, 'announcement'::character varying, 'thread_starter'::character varying])::text[]))),
    CONSTRAINT workspace_messages_pkey PRIMARY KEY (id)
);

-- Table: workspace_notification_preferences
CREATE TABLE IF NOT EXISTS public.workspace_notification_preferences (
    workspace_id uuid NOT NULL,
    user_id uuid NOT NULL,
    email_task_assigned boolean DEFAULT true NOT NULL,
    email_task_reminders boolean DEFAULT true NOT NULL,
    email_mentions boolean DEFAULT true NOT NULL,
    email_discussions boolean DEFAULT true NOT NULL,
    email_digest_frequency character varying(20) DEFAULT 'instant'::character varying NOT NULL,
    muted_until timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT workspace_notification_preferences_email_digest_frequency_check CHECK (((email_digest_frequency)::text = ANY ((ARRAY['instant'::character varying, 'daily'::character varying, 'none'::character varying])::text[]))),
    CONSTRAINT workspace_notification_preferences_pkey PRIMARY KEY (workspace_id, user_id)
);

-- Table: workspace_notifications
CREATE TABLE IF NOT EXISTS public.workspace_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    recipient_id uuid NOT NULL,
    actor_id uuid,
    event_type character varying(64) NOT NULL,
    resource_type character varying(32) NOT NULL,
    resource_id character varying(128) NOT NULL,
    title character varying(255) NOT NULL,
    message text NOT NULL,
    destination_url character varying(512) NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_read boolean DEFAULT false NOT NULL,
    read_at timestamp with time zone,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT workspace_notifications_pkey1 PRIMARY KEY (id)
);

-- Table: workspace_outbox_events
CREATE TABLE IF NOT EXISTS public.workspace_outbox_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    event_type character varying(64) NOT NULL,
    payload jsonb NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    retry_count integer DEFAULT 0 NOT NULL,
    error_message text,
    published_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT workspace_outbox_events_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'processing'::character varying, 'published'::character varying, 'failed'::character varying])::text[]))),
    CONSTRAINT workspace_outbox_events_pkey PRIMARY KEY (id)
);

-- Table: workspace_permission_overrides
CREATE TABLE IF NOT EXISTS public.workspace_permission_overrides (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    member_id uuid,
    department_id uuid,
    permission_key character varying(100) NOT NULL,
    is_granted boolean NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT check_override_target CHECK ((((member_id IS NOT NULL) AND (department_id IS NULL)) OR ((member_id IS NULL) AND (department_id IS NOT NULL)))),
    CONSTRAINT workspace_permission_overrides_pkey PRIMARY KEY (id)
);

-- Table: workspace_recognition_budgets
CREATE TABLE IF NOT EXISTS public.workspace_recognition_budgets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    user_id uuid NOT NULL,
    year_month character varying(7) NOT NULL,
    allocated_budget integer DEFAULT 500 NOT NULL,
    used_budget integer DEFAULT 0 NOT NULL,
    allocated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_used_budget_lte_allocated CHECK ((used_budget <= allocated_budget)),
    CONSTRAINT workspace_recognition_budgets_allocated_budget_check CHECK ((allocated_budget >= 0)),
    CONSTRAINT workspace_recognition_budgets_used_budget_check CHECK ((used_budget >= 0)),
    CONSTRAINT workspace_recognition_budgets_pkey PRIMARY KEY (id),
    CONSTRAINT workspace_recognition_budgets_workspace_id_user_id_year_mon_key UNIQUE (workspace_id, user_id, year_month)
);

-- Table: workspace_recognition_categories
CREATE TABLE IF NOT EXISTS public.workspace_recognition_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    name character varying(80) NOT NULL,
    slug character varying(80) NOT NULL,
    description text NOT NULL,
    icon character varying(50) DEFAULT 'Award'::character varying NOT NULL,
    is_system boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT workspace_recognition_categories_pkey PRIMARY KEY (id),
    CONSTRAINT workspace_recognition_categories_workspace_id_slug_key UNIQUE (workspace_id, slug)
);

-- Table: workspace_recognition_ledger
CREATE TABLE IF NOT EXISTS public.workspace_recognition_ledger (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    recipient_id uuid NOT NULL,
    issuer_id uuid NOT NULL,
    department_id uuid,
    transaction_type character varying(20) NOT NULL,
    points_delta integer NOT NULL,
    category_id uuid NOT NULL,
    appreciation_reason text NOT NULL,
    linked_task_id uuid,
    linked_milestone_id character varying(100),
    evidence_url text,
    reference_award_id uuid,
    idempotency_key character varying(120),
    status character varying(20) DEFAULT 'completed'::character varying NOT NULL,
    is_reversed boolean DEFAULT false NOT NULL,
    reversal_reason text,
    reversed_at timestamp with time zone,
    reversed_by uuid,
    ip_address character varying(45),
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    visibility character varying(30) DEFAULT 'workspace'::character varying NOT NULL,
    CONSTRAINT chk_points_delta_type CHECK (((((transaction_type)::text = 'award'::text) AND (points_delta > 0)) OR (((transaction_type)::text = 'reversal'::text) AND (points_delta < 0)))),
    CONSTRAINT chk_recognition_no_self_awards CHECK ((issuer_id <> recipient_id)),
    CONSTRAINT workspace_recognition_ledger_status_check CHECK (((status)::text = ANY ((ARRAY['completed'::character varying, 'reversed'::character varying])::text[]))),
    CONSTRAINT workspace_recognition_ledger_transaction_type_check CHECK (((transaction_type)::text = ANY ((ARRAY['award'::character varying, 'reversal'::character varying])::text[]))),
    CONSTRAINT workspace_recognition_ledger_visibility_check CHECK (((visibility)::text = ANY ((ARRAY['workspace'::character varying, 'recipient_only'::character varying, 'private'::character varying])::text[]))),
    CONSTRAINT workspace_recognition_ledger_pkey PRIMARY KEY (id)
);

-- Table: workspace_recognition_notes
CREATE TABLE IF NOT EXISTS public.workspace_recognition_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    award_id uuid NOT NULL,
    author_id uuid NOT NULL,
    note text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT workspace_recognition_notes_pkey PRIMARY KEY (id)
);

-- Table: workspace_recognition_period_aggregates
CREATE TABLE IF NOT EXISTS public.workspace_recognition_period_aggregates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    user_id uuid NOT NULL,
    period_type character varying(20) NOT NULL,
    period_key character varying(30) NOT NULL,
    total_orbits_received integer DEFAULT 0 NOT NULL,
    total_orbits_given integer DEFAULT 0 NOT NULL,
    awards_count integer DEFAULT 0 NOT NULL,
    last_award_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT workspace_recognition_period_aggreg_total_orbits_received_check CHECK ((total_orbits_received >= 0)),
    CONSTRAINT workspace_recognition_period_aggregate_total_orbits_given_check CHECK ((total_orbits_given >= 0)),
    CONSTRAINT workspace_recognition_period_aggregates_awards_count_check CHECK ((awards_count >= 0)),
    CONSTRAINT workspace_recognition_period_aggregates_period_type_check CHECK (((period_type)::text = ANY ((ARRAY['weekly'::character varying, 'monthly'::character varying, 'all_time'::character varying])::text[]))),
    CONSTRAINT workspace_recognition_period_aggregates_pkey PRIMARY KEY (id),
    CONSTRAINT workspace_recognition_period__workspace_id_user_id_period_t_key UNIQUE (workspace_id, user_id, period_type, period_key)
);

-- Table: workspace_recognition_policies
CREATE TABLE IF NOT EXISTS public.workspace_recognition_policies (
    workspace_id uuid NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    point_unit_name character varying(50) DEFAULT 'Orbits'::character varying NOT NULL,
    min_points_per_award integer DEFAULT 5 NOT NULL,
    max_points_per_award integer DEFAULT 50 NOT NULL,
    manager_monthly_budget integer DEFAULT 500 NOT NULL,
    recipient_monthly_cap integer DEFAULT 150 NOT NULL,
    daily_award_limit_per_issuer integer DEFAULT 5 NOT NULL,
    require_task_link boolean DEFAULT false NOT NULL,
    require_evidence_link boolean DEFAULT false NOT NULL,
    min_reason_length integer DEFAULT 15 NOT NULL,
    is_workspace_visible boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    dpi_weight_approved_tasks numeric(5,2) DEFAULT 35.00 NOT NULL,
    dpi_weight_on_time numeric(5,2) DEFAULT 35.00 NOT NULL,
    dpi_weight_participation numeric(5,2) DEFAULT 20.00 NOT NULL,
    dpi_weight_recognition numeric(5,2) DEFAULT 10.00 NOT NULL,
    dpi_recognition_cap_per_member integer DEFAULT 50 NOT NULL,
    dpi_min_tasks_sample integer DEFAULT 1 NOT NULL,
    dpi_formula_version character varying(20) DEFAULT 'v1.0'::character varying NOT NULL,
    CONSTRAINT workspace_recognition_polici_daily_award_limit_per_issuer_check CHECK ((daily_award_limit_per_issuer > 0)),
    CONSTRAINT workspace_recognition_policies_check CHECK ((max_points_per_award >= min_points_per_award)),
    CONSTRAINT workspace_recognition_policies_check1 CHECK ((recipient_monthly_cap >= max_points_per_award)),
    CONSTRAINT workspace_recognition_policies_manager_monthly_budget_check CHECK ((manager_monthly_budget >= 0)),
    CONSTRAINT workspace_recognition_policies_min_points_per_award_check CHECK ((min_points_per_award > 0)),
    CONSTRAINT workspace_recognition_policies_min_reason_length_check CHECK ((min_reason_length >= 5)),
    CONSTRAINT workspace_recognition_policies_pkey PRIMARY KEY (workspace_id)
);

-- Table: workspace_roles
CREATE TABLE IF NOT EXISTS public.workspace_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    name character varying(60) NOT NULL,
    slug character varying(80) NOT NULL,
    description text,
    rank integer DEFAULT 100 NOT NULL,
    is_system boolean DEFAULT false NOT NULL,
    color character varying(30) DEFAULT '#000000'::character varying,
    permissions jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT workspace_roles_pkey PRIMARY KEY (id),
    CONSTRAINT uq_workspace_role_slug UNIQUE (workspace_id, slug)
);

-- Table: workspace_task_activity
CREATE TABLE IF NOT EXISTS public.workspace_task_activity (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    task_id uuid NOT NULL,
    actor_id uuid NOT NULL,
    action character varying(50) NOT NULL,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT workspace_task_activity_pkey PRIMARY KEY (id)
);

-- Table: workspace_task_assignments
CREATE TABLE IF NOT EXISTS public.workspace_task_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    task_id uuid NOT NULL,
    member_id uuid NOT NULL,
    user_id uuid NOT NULL,
    assigned_by uuid NOT NULL,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    unassigned_at timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT workspace_task_assignments_pkey PRIMARY KEY (id)
);

-- Table: workspace_task_comments
CREATE TABLE IF NOT EXISTS public.workspace_task_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    task_id uuid NOT NULL,
    author_id uuid NOT NULL,
    parent_comment_id uuid,
    content text NOT NULL,
    mentions jsonb DEFAULT '[]'::jsonb NOT NULL,
    attachments jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_edited boolean DEFAULT false NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT workspace_task_comments_pkey PRIMARY KEY (id)
);

-- Table: workspace_task_reviews
CREATE TABLE IF NOT EXISTS public.workspace_task_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    task_id uuid NOT NULL,
    submission_id uuid NOT NULL,
    reviewer_id uuid NOT NULL,
    decision character varying(30) NOT NULL,
    comments text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT workspace_task_reviews_decision_check CHECK (((decision)::text = ANY ((ARRAY['approved'::character varying, 'changes_requested'::character varying])::text[]))),
    CONSTRAINT workspace_task_reviews_pkey PRIMARY KEY (id)
);

-- Table: workspace_task_submissions
CREATE TABLE IF NOT EXISTS public.workspace_task_submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    task_id uuid NOT NULL,
    submitted_by uuid NOT NULL,
    content text NOT NULL,
    attachments jsonb DEFAULT '[]'::jsonb NOT NULL,
    status character varying(30) DEFAULT 'pending'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT workspace_task_submissions_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'changes_requested'::character varying])::text[]))),
    CONSTRAINT workspace_task_submissions_pkey PRIMARY KEY (id)
);

-- Table: workspace_task_watchers
CREATE TABLE IF NOT EXISTS public.workspace_task_watchers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    task_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT workspace_task_watchers_pkey PRIMARY KEY (id),
    CONSTRAINT uq_workspace_task_watchers UNIQUE (task_id, user_id)
);

-- Table: workspace_tasks
CREATE TABLE IF NOT EXISTS public.workspace_tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    department_id uuid,
    creator_id uuid NOT NULL,
    title character varying(200) NOT NULL,
    description text,
    status character varying(30) DEFAULT 'draft'::character varying NOT NULL,
    priority character varying(20) DEFAULT 'medium'::character varying NOT NULL,
    due_date timestamp with time zone,
    custom_fields jsonb DEFAULT '{}'::jsonb,
    display_order integer DEFAULT 0 NOT NULL,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    start_date timestamp with time zone,
    assigned_role_id uuid,
    checklist jsonb DEFAULT '[]'::jsonb NOT NULL,
    reference_links jsonb DEFAULT '[]'::jsonb NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    is_restricted boolean DEFAULT false NOT NULL,
    is_archived boolean DEFAULT false NOT NULL,
    archived_at timestamp with time zone,
    archived_by uuid,
    CONSTRAINT workspace_tasks_priority_check CHECK (((priority)::text = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying, 'urgent'::character varying])::text[]))),
    CONSTRAINT workspace_tasks_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'assigned'::character varying, 'in_progress'::character varying, 'blocked'::character varying, 'submitted'::character varying, 'changes_requested'::character varying, 'approved'::character varying, 'completed'::character varying, 'archived'::character varying, 'cancelled'::character varying])::text[]))),
    CONSTRAINT workspace_tasks_pkey PRIMARY KEY (id)
);

-- Table: workspace_thread_participants
CREATE TABLE IF NOT EXISTS public.workspace_thread_participants (
    thread_id uuid NOT NULL,
    user_id uuid NOT NULL,
    last_read_at timestamp with time zone DEFAULT now() NOT NULL,
    is_muted boolean DEFAULT false NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT workspace_thread_participants_pkey PRIMARY KEY (thread_id, user_id)
);

-- Table: workspace_threads
CREATE TABLE IF NOT EXISTS public.workspace_threads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    channel_id uuid NOT NULL,
    parent_message_id uuid NOT NULL,
    name character varying(120) NOT NULL,
    creator_id uuid NOT NULL,
    is_locked boolean DEFAULT false NOT NULL,
    locked_at timestamp with time zone,
    locked_by uuid,
    is_archived boolean DEFAULT false NOT NULL,
    archived_at timestamp with time zone,
    archived_by uuid,
    message_count integer DEFAULT 0 NOT NULL,
    last_message_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT workspace_threads_pkey PRIMARY KEY (id),
    CONSTRAINT uq_thread_parent_message UNIQUE (parent_message_id)
);

-- Table: workspace_webhook_events
CREATE TABLE IF NOT EXISTS public.workspace_webhook_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider character varying(32) DEFAULT 'resend'::character varying NOT NULL,
    provider_event_id character varying(255) NOT NULL,
    event_type character varying(64) NOT NULL,
    payload jsonb NOT NULL,
    processed_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT workspace_webhook_events_pkey PRIMARY KEY (id),
    CONSTRAINT workspace_webhook_events_provider_event_id_key UNIQUE (provider_event_id)
);

-- -------------------------------------------------------------------------
-- 4. FOREIGN KEY CONSTRAINTS (Referential Integrity)
-- -------------------------------------------------------------------------

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'account_change_challenges_operation_id_fkey' AND conrelid = 'public.account_change_challenges'::regclass
    ) THEN
        ALTER TABLE public.account_change_challenges ADD CONSTRAINT account_change_challenges_operation_id_fkey FOREIGN KEY (operation_id) REFERENCES account_change_operations(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'account_deletion_requests_user_id_fkey' AND conrelid = 'public.account_deletion_requests'::regclass
    ) THEN
        ALTER TABLE public.account_deletion_requests ADD CONSTRAINT account_deletion_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'account_entitlements_updated_by_fkey' AND conrelid = 'public.account_entitlements'::regclass
    ) THEN
        ALTER TABLE public.account_entitlements ADD CONSTRAINT account_entitlements_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'account_entitlements_user_id_fkey' AND conrelid = 'public.account_entitlements'::regclass
    ) THEN
        ALTER TABLE public.account_entitlements ADD CONSTRAINT account_entitlements_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'account_restrictions_created_by_fkey' AND conrelid = 'public.account_restrictions'::regclass
    ) THEN
        ALTER TABLE public.account_restrictions ADD CONSTRAINT account_restrictions_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'account_restrictions_user_id_fkey' AND conrelid = 'public.account_restrictions'::regclass
    ) THEN
        ALTER TABLE public.account_restrictions ADD CONSTRAINT account_restrictions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'account_security_events_user_id_fkey' AND conrelid = 'public.account_security_events'::regclass
    ) THEN
        ALTER TABLE public.account_security_events ADD CONSTRAINT account_security_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'account_status_history_actor_id_fkey' AND conrelid = 'public.account_status_history'::regclass
    ) THEN
        ALTER TABLE public.account_status_history ADD CONSTRAINT account_status_history_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'account_status_history_user_id_fkey' AND conrelid = 'public.account_status_history'::regclass
    ) THEN
        ALTER TABLE public.account_status_history ADD CONSTRAINT account_status_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'account_statuses_updated_by_fkey' AND conrelid = 'public.account_statuses'::regclass
    ) THEN
        ALTER TABLE public.account_statuses ADD CONSTRAINT account_statuses_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'account_statuses_user_id_fkey' AND conrelid = 'public.account_statuses'::regclass
    ) THEN
        ALTER TABLE public.account_statuses ADD CONSTRAINT account_statuses_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'blog_likes_user_id_fkey' AND conrelid = 'public.blog_likes'::regclass
    ) THEN
        ALTER TABLE public.blog_likes ADD CONSTRAINT blog_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'certificate_audit_logs_actor_user_id_fkey' AND conrelid = 'public.certificate_audit_logs'::regclass
    ) THEN
        ALTER TABLE public.certificate_audit_logs ADD CONSTRAINT certificate_audit_logs_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'certificate_audit_logs_club_id_fkey' AND conrelid = 'public.certificate_audit_logs'::regclass
    ) THEN
        ALTER TABLE public.certificate_audit_logs ADD CONSTRAINT certificate_audit_logs_club_id_fkey FOREIGN KEY (club_id) REFERENCES verified_clubs(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'certificate_batches_club_id_fkey' AND conrelid = 'public.certificate_batches'::regclass
    ) THEN
        ALTER TABLE public.certificate_batches ADD CONSTRAINT certificate_batches_club_id_fkey FOREIGN KEY (club_id) REFERENCES verified_clubs(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'certificate_batches_event_id_fkey' AND conrelid = 'public.certificate_batches'::regclass
    ) THEN
        ALTER TABLE public.certificate_batches ADD CONSTRAINT certificate_batches_event_id_fkey FOREIGN KEY (event_id) REFERENCES club_events(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'certificate_batches_issued_by_user_id_fkey' AND conrelid = 'public.certificate_batches'::regclass
    ) THEN
        ALTER TABLE public.certificate_batches ADD CONSTRAINT certificate_batches_issued_by_user_id_fkey FOREIGN KEY (issued_by_user_id) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'certificate_batches_template_id_fkey' AND conrelid = 'public.certificate_batches'::regclass
    ) THEN
        ALTER TABLE public.certificate_batches ADD CONSTRAINT certificate_batches_template_id_fkey FOREIGN KEY (template_id) REFERENCES certificate_templates(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'certificate_templates_club_id_fkey' AND conrelid = 'public.certificate_templates'::regclass
    ) THEN
        ALTER TABLE public.certificate_templates ADD CONSTRAINT certificate_templates_club_id_fkey FOREIGN KEY (club_id) REFERENCES verified_clubs(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'certificate_templates_created_by_fkey' AND conrelid = 'public.certificate_templates'::regclass
    ) THEN
        ALTER TABLE public.certificate_templates ADD CONSTRAINT certificate_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_access_events_club_id_fkey' AND conrelid = 'public.club_access_events'::regclass
    ) THEN
        ALTER TABLE public.club_access_events ADD CONSTRAINT club_access_events_club_id_fkey FOREIGN KEY (club_id) REFERENCES verified_clubs(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_access_events_membership_id_fkey' AND conrelid = 'public.club_access_events'::regclass
    ) THEN
        ALTER TABLE public.club_access_events ADD CONSTRAINT club_access_events_membership_id_fkey FOREIGN KEY (membership_id) REFERENCES club_memberships(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_access_events_session_id_fkey' AND conrelid = 'public.club_access_events'::regclass
    ) THEN
        ALTER TABLE public.club_access_events ADD CONSTRAINT club_access_events_session_id_fkey FOREIGN KEY (session_id) REFERENCES user_sessions(session_id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_access_events_user_id_fkey' AND conrelid = 'public.club_access_events'::regclass
    ) THEN
        ALTER TABLE public.club_access_events ADD CONSTRAINT club_access_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_achievements_club_id_fkey' AND conrelid = 'public.club_achievements'::regclass
    ) THEN
        ALTER TABLE public.club_achievements ADD CONSTRAINT club_achievements_club_id_fkey FOREIGN KEY (club_id) REFERENCES verified_clubs(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_certificates_batch_id_fkey' AND conrelid = 'public.club_certificates'::regclass
    ) THEN
        ALTER TABLE public.club_certificates ADD CONSTRAINT club_certificates_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES certificate_batches(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_certificates_club_id_fkey' AND conrelid = 'public.club_certificates'::regclass
    ) THEN
        ALTER TABLE public.club_certificates ADD CONSTRAINT club_certificates_club_id_fkey FOREIGN KEY (club_id) REFERENCES verified_clubs(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_certificates_event_id_fkey' AND conrelid = 'public.club_certificates'::regclass
    ) THEN
        ALTER TABLE public.club_certificates ADD CONSTRAINT club_certificates_event_id_fkey FOREIGN KEY (event_id) REFERENCES club_events(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_certificates_issued_by_user_id_fkey' AND conrelid = 'public.club_certificates'::regclass
    ) THEN
        ALTER TABLE public.club_certificates ADD CONSTRAINT club_certificates_issued_by_user_id_fkey FOREIGN KEY (issued_by_user_id) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_certificates_revoked_by_user_id_fkey' AND conrelid = 'public.club_certificates'::regclass
    ) THEN
        ALTER TABLE public.club_certificates ADD CONSTRAINT club_certificates_revoked_by_user_id_fkey FOREIGN KEY (revoked_by_user_id) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_certificates_team_id_fkey' AND conrelid = 'public.club_certificates'::regclass
    ) THEN
        ALTER TABLE public.club_certificates ADD CONSTRAINT club_certificates_team_id_fkey FOREIGN KEY (team_id) REFERENCES club_teams(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_certificates_template_id_fkey' AND conrelid = 'public.club_certificates'::regclass
    ) THEN
        ALTER TABLE public.club_certificates ADD CONSTRAINT club_certificates_template_id_fkey FOREIGN KEY (template_id) REFERENCES certificate_templates(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_certificates_user_id_fkey' AND conrelid = 'public.club_certificates'::regclass
    ) THEN
        ALTER TABLE public.club_certificates ADD CONSTRAINT club_certificates_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_conversations_club_id_fkey' AND conrelid = 'public.club_conversations'::regclass
    ) THEN
        ALTER TABLE public.club_conversations ADD CONSTRAINT club_conversations_club_id_fkey FOREIGN KEY (club_id) REFERENCES verified_clubs(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_conversations_user_id_fkey' AND conrelid = 'public.club_conversations'::regclass
    ) THEN
        ALTER TABLE public.club_conversations ADD CONSTRAINT club_conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_coordinators_club_id_fkey' AND conrelid = 'public.club_coordinators'::regclass
    ) THEN
        ALTER TABLE public.club_coordinators ADD CONSTRAINT club_coordinators_club_id_fkey FOREIGN KEY (club_id) REFERENCES verified_clubs(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_coordinators_linked_user_id_fkey' AND conrelid = 'public.club_coordinators'::regclass
    ) THEN
        ALTER TABLE public.club_coordinators ADD CONSTRAINT club_coordinators_linked_user_id_fkey FOREIGN KEY (linked_user_id) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_credibility_appeals_club_id_fkey' AND conrelid = 'public.club_credibility_appeals'::regclass
    ) THEN
        ALTER TABLE public.club_credibility_appeals ADD CONSTRAINT club_credibility_appeals_club_id_fkey FOREIGN KEY (club_id) REFERENCES verified_clubs(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_credibility_appeals_ledger_id_fkey' AND conrelid = 'public.club_credibility_appeals'::regclass
    ) THEN
        ALTER TABLE public.club_credibility_appeals ADD CONSTRAINT club_credibility_appeals_ledger_id_fkey FOREIGN KEY (ledger_id) REFERENCES club_credibility_ledger(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_credibility_appeals_reviewer_id_fkey' AND conrelid = 'public.club_credibility_appeals'::regclass
    ) THEN
        ALTER TABLE public.club_credibility_appeals ADD CONSTRAINT club_credibility_appeals_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_credibility_ledger_actor_id_fkey' AND conrelid = 'public.club_credibility_ledger'::regclass
    ) THEN
        ALTER TABLE public.club_credibility_ledger ADD CONSTRAINT club_credibility_ledger_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_credibility_ledger_club_id_fkey' AND conrelid = 'public.club_credibility_ledger'::regclass
    ) THEN
        ALTER TABLE public.club_credibility_ledger ADD CONSTRAINT club_credibility_ledger_club_id_fkey FOREIGN KEY (club_id) REFERENCES verified_clubs(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_credibility_ledger_event_id_fkey' AND conrelid = 'public.club_credibility_ledger'::regclass
    ) THEN
        ALTER TABLE public.club_credibility_ledger ADD CONSTRAINT club_credibility_ledger_event_id_fkey FOREIGN KEY (event_id) REFERENCES club_events(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_credibility_ledger_reversal_reference_id_fkey' AND conrelid = 'public.club_credibility_ledger'::regclass
    ) THEN
        ALTER TABLE public.club_credibility_ledger ADD CONSTRAINT club_credibility_ledger_reversal_reference_id_fkey FOREIGN KEY (reversal_reference_id) REFERENCES club_credibility_ledger(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_credibility_snapshots_club_id_fkey' AND conrelid = 'public.club_credibility_snapshots'::regclass
    ) THEN
        ALTER TABLE public.club_credibility_snapshots ADD CONSTRAINT club_credibility_snapshots_club_id_fkey FOREIGN KEY (club_id) REFERENCES verified_clubs(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_event_audit_logs_actor_id_fkey' AND conrelid = 'public.club_event_audit_logs'::regclass
    ) THEN
        ALTER TABLE public.club_event_audit_logs ADD CONSTRAINT club_event_audit_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_event_audit_logs_event_id_fkey' AND conrelid = 'public.club_event_audit_logs'::regclass
    ) THEN
        ALTER TABLE public.club_event_audit_logs ADD CONSTRAINT club_event_audit_logs_event_id_fkey FOREIGN KEY (event_id) REFERENCES club_events(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_event_audit_logs_stage_id_fkey' AND conrelid = 'public.club_event_audit_logs'::regclass
    ) THEN
        ALTER TABLE public.club_event_audit_logs ADD CONSTRAINT club_event_audit_logs_stage_id_fkey FOREIGN KEY (stage_id) REFERENCES club_event_stages(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_event_communication_logs_event_id_fkey' AND conrelid = 'public.club_event_communication_logs'::regclass
    ) THEN
        ALTER TABLE public.club_event_communication_logs ADD CONSTRAINT club_event_communication_logs_event_id_fkey FOREIGN KEY (event_id) REFERENCES club_events(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_event_communication_logs_recipient_user_id_fkey' AND conrelid = 'public.club_event_communication_logs'::regclass
    ) THEN
        ALTER TABLE public.club_event_communication_logs ADD CONSTRAINT club_event_communication_logs_recipient_user_id_fkey FOREIGN KEY (recipient_user_id) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_event_communication_logs_stage_id_fkey' AND conrelid = 'public.club_event_communication_logs'::regclass
    ) THEN
        ALTER TABLE public.club_event_communication_logs ADD CONSTRAINT club_event_communication_logs_stage_id_fkey FOREIGN KEY (stage_id) REFERENCES club_event_stages(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_event_creation_history_club_id_fkey' AND conrelid = 'public.club_event_creation_history'::regclass
    ) THEN
        ALTER TABLE public.club_event_creation_history ADD CONSTRAINT club_event_creation_history_club_id_fkey FOREIGN KEY (club_id) REFERENCES verified_clubs(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_event_evaluations_judge_id_fkey' AND conrelid = 'public.club_event_evaluations'::regclass
    ) THEN
        ALTER TABLE public.club_event_evaluations ADD CONSTRAINT club_event_evaluations_judge_id_fkey FOREIGN KEY (judge_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_event_evaluations_stage_id_fkey' AND conrelid = 'public.club_event_evaluations'::regclass
    ) THEN
        ALTER TABLE public.club_event_evaluations ADD CONSTRAINT club_event_evaluations_stage_id_fkey FOREIGN KEY (stage_id) REFERENCES club_event_stages(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_event_evaluations_submission_id_fkey' AND conrelid = 'public.club_event_evaluations'::regclass
    ) THEN
        ALTER TABLE public.club_event_evaluations ADD CONSTRAINT club_event_evaluations_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES club_event_stage_submissions(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_event_form_versions_created_by_fkey' AND conrelid = 'public.club_event_form_versions'::regclass
    ) THEN
        ALTER TABLE public.club_event_form_versions ADD CONSTRAINT club_event_form_versions_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_event_form_versions_event_id_fkey' AND conrelid = 'public.club_event_form_versions'::regclass
    ) THEN
        ALTER TABLE public.club_event_form_versions ADD CONSTRAINT club_event_form_versions_event_id_fkey FOREIGN KEY (event_id) REFERENCES club_events(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_event_form_versions_form_id_fkey' AND conrelid = 'public.club_event_form_versions'::regclass
    ) THEN
        ALTER TABLE public.club_event_form_versions ADD CONSTRAINT club_event_form_versions_form_id_fkey FOREIGN KEY (form_id) REFERENCES club_event_forms(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_event_form_versions_published_by_fkey' AND conrelid = 'public.club_event_form_versions'::regclass
    ) THEN
        ALTER TABLE public.club_event_form_versions ADD CONSTRAINT club_event_form_versions_published_by_fkey FOREIGN KEY (published_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_event_forms_club_id_fkey' AND conrelid = 'public.club_event_forms'::regclass
    ) THEN
        ALTER TABLE public.club_event_forms ADD CONSTRAINT club_event_forms_club_id_fkey FOREIGN KEY (club_id) REFERENCES verified_clubs(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_event_forms_created_by_fkey' AND conrelid = 'public.club_event_forms'::regclass
    ) THEN
        ALTER TABLE public.club_event_forms ADD CONSTRAINT club_event_forms_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_event_forms_event_id_fkey' AND conrelid = 'public.club_event_forms'::regclass
    ) THEN
        ALTER TABLE public.club_event_forms ADD CONSTRAINT club_event_forms_event_id_fkey FOREIGN KEY (event_id) REFERENCES club_events(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_event_judges_event_id_fkey' AND conrelid = 'public.club_event_judges'::regclass
    ) THEN
        ALTER TABLE public.club_event_judges ADD CONSTRAINT club_event_judges_event_id_fkey FOREIGN KEY (event_id) REFERENCES club_events(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_event_judges_stage_id_fkey' AND conrelid = 'public.club_event_judges'::regclass
    ) THEN
        ALTER TABLE public.club_event_judges ADD CONSTRAINT club_event_judges_stage_id_fkey FOREIGN KEY (stage_id) REFERENCES club_event_stages(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_event_judges_user_id_fkey' AND conrelid = 'public.club_event_judges'::regclass
    ) THEN
        ALTER TABLE public.club_event_judges ADD CONSTRAINT club_event_judges_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_event_judging_criteria_event_id_fkey' AND conrelid = 'public.club_event_judging_criteria'::regclass
    ) THEN
        ALTER TABLE public.club_event_judging_criteria ADD CONSTRAINT club_event_judging_criteria_event_id_fkey FOREIGN KEY (event_id) REFERENCES club_events(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_event_judging_criteria_stage_id_fkey' AND conrelid = 'public.club_event_judging_criteria'::regclass
    ) THEN
        ALTER TABLE public.club_event_judging_criteria ADD CONSTRAINT club_event_judging_criteria_stage_id_fkey FOREIGN KEY (stage_id) REFERENCES club_event_stages(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_event_likes_event_id_fkey' AND conrelid = 'public.club_event_likes'::regclass
    ) THEN
        ALTER TABLE public.club_event_likes ADD CONSTRAINT club_event_likes_event_id_fkey FOREIGN KEY (event_id) REFERENCES club_events(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_event_likes_user_id_fkey' AND conrelid = 'public.club_event_likes'::regclass
    ) THEN
        ALTER TABLE public.club_event_likes ADD CONSTRAINT club_event_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_event_registrations_club_id_fkey' AND conrelid = 'public.club_event_registrations'::regclass
    ) THEN
        ALTER TABLE public.club_event_registrations ADD CONSTRAINT club_event_registrations_club_id_fkey FOREIGN KEY (club_id) REFERENCES verified_clubs(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_event_registrations_event_id_fkey' AND conrelid = 'public.club_event_registrations'::regclass
    ) THEN
        ALTER TABLE public.club_event_registrations ADD CONSTRAINT club_event_registrations_event_id_fkey FOREIGN KEY (event_id) REFERENCES club_events(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_event_registrations_form_id_fkey' AND conrelid = 'public.club_event_registrations'::regclass
    ) THEN
        ALTER TABLE public.club_event_registrations ADD CONSTRAINT club_event_registrations_form_id_fkey FOREIGN KEY (form_id) REFERENCES club_event_forms(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_event_registrations_form_version_id_fkey' AND conrelid = 'public.club_event_registrations'::regclass
    ) THEN
        ALTER TABLE public.club_event_registrations ADD CONSTRAINT club_event_registrations_form_version_id_fkey FOREIGN KEY (form_version_id) REFERENCES club_event_form_versions(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_event_registrations_institution_id_fkey' AND conrelid = 'public.club_event_registrations'::regclass
    ) THEN
        ALTER TABLE public.club_event_registrations ADD CONSTRAINT club_event_registrations_institution_id_fkey FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_event_registrations_reviewed_by_user_id_fkey' AND conrelid = 'public.club_event_registrations'::regclass
    ) THEN
        ALTER TABLE public.club_event_registrations ADD CONSTRAINT club_event_registrations_reviewed_by_user_id_fkey FOREIGN KEY (reviewed_by_user_id) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_event_registrations_team_id_fkey' AND conrelid = 'public.club_event_registrations'::regclass
    ) THEN
        ALTER TABLE public.club_event_registrations ADD CONSTRAINT club_event_registrations_team_id_fkey FOREIGN KEY (team_id) REFERENCES club_event_teams(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_event_registrations_user_id_fkey' AND conrelid = 'public.club_event_registrations'::regclass
    ) THEN
        ALTER TABLE public.club_event_registrations ADD CONSTRAINT club_event_registrations_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_event_response_drafts_event_id_fkey' AND conrelid = 'public.club_event_response_drafts'::regclass
    ) THEN
        ALTER TABLE public.club_event_response_drafts ADD CONSTRAINT club_event_response_drafts_event_id_fkey FOREIGN KEY (event_id) REFERENCES club_events(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_event_response_drafts_form_id_fkey' AND conrelid = 'public.club_event_response_drafts'::regclass
    ) THEN
        ALTER TABLE public.club_event_response_drafts ADD CONSTRAINT club_event_response_drafts_form_id_fkey FOREIGN KEY (form_id) REFERENCES club_event_forms(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_event_response_drafts_form_version_id_fkey' AND conrelid = 'public.club_event_response_drafts'::regclass
    ) THEN
        ALTER TABLE public.club_event_response_drafts ADD CONSTRAINT club_event_response_drafts_form_version_id_fkey FOREIGN KEY (form_version_id) REFERENCES club_event_form_versions(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_event_response_drafts_user_id_fkey' AND conrelid = 'public.club_event_response_drafts'::regclass
    ) THEN
        ALTER TABLE public.club_event_response_drafts ADD CONSTRAINT club_event_response_drafts_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_event_stage_advancements_event_id_fkey' AND conrelid = 'public.club_event_stage_advancements'::regclass
    ) THEN
        ALTER TABLE public.club_event_stage_advancements ADD CONSTRAINT club_event_stage_advancements_event_id_fkey FOREIGN KEY (event_id) REFERENCES club_events(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_event_stage_advancements_from_stage_id_fkey' AND conrelid = 'public.club_event_stage_advancements'::regclass
    ) THEN
        ALTER TABLE public.club_event_stage_advancements ADD CONSTRAINT club_event_stage_advancements_from_stage_id_fkey FOREIGN KEY (from_stage_id) REFERENCES club_event_stages(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_event_stage_advancements_registration_id_fkey' AND conrelid = 'public.club_event_stage_advancements'::regclass
    ) THEN
        ALTER TABLE public.club_event_stage_advancements ADD CONSTRAINT club_event_stage_advancements_registration_id_fkey FOREIGN KEY (registration_id) REFERENCES club_event_registrations(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_event_stage_advancements_to_stage_id_fkey' AND conrelid = 'public.club_event_stage_advancements'::regclass
    ) THEN
        ALTER TABLE public.club_event_stage_advancements ADD CONSTRAINT club_event_stage_advancements_to_stage_id_fkey FOREIGN KEY (to_stage_id) REFERENCES club_event_stages(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_event_stage_forms_event_id_fkey' AND conrelid = 'public.club_event_stage_forms'::regclass
    ) THEN
        ALTER TABLE public.club_event_stage_forms ADD CONSTRAINT club_event_stage_forms_event_id_fkey FOREIGN KEY (event_id) REFERENCES club_events(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_event_stage_forms_stage_id_fkey' AND conrelid = 'public.club_event_stage_forms'::regclass
    ) THEN
        ALTER TABLE public.club_event_stage_forms ADD CONSTRAINT club_event_stage_forms_stage_id_fkey FOREIGN KEY (stage_id) REFERENCES club_event_stages(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_event_stage_submissions_event_id_fkey' AND conrelid = 'public.club_event_stage_submissions'::regclass
    ) THEN
        ALTER TABLE public.club_event_stage_submissions ADD CONSTRAINT club_event_stage_submissions_event_id_fkey FOREIGN KEY (event_id) REFERENCES club_events(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_event_stage_submissions_registration_id_fkey' AND conrelid = 'public.club_event_stage_submissions'::regclass
    ) THEN
        ALTER TABLE public.club_event_stage_submissions ADD CONSTRAINT club_event_stage_submissions_registration_id_fkey FOREIGN KEY (registration_id) REFERENCES club_event_registrations(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_event_stage_submissions_stage_id_fkey' AND conrelid = 'public.club_event_stage_submissions'::regclass
    ) THEN
        ALTER TABLE public.club_event_stage_submissions ADD CONSTRAINT club_event_stage_submissions_stage_id_fkey FOREIGN KEY (stage_id) REFERENCES club_event_stages(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_event_stage_submissions_user_id_fkey' AND conrelid = 'public.club_event_stage_submissions'::regclass
    ) THEN
        ALTER TABLE public.club_event_stage_submissions ADD CONSTRAINT club_event_stage_submissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_event_stages_club_id_fkey' AND conrelid = 'public.club_event_stages'::regclass
    ) THEN
        ALTER TABLE public.club_event_stages ADD CONSTRAINT club_event_stages_club_id_fkey FOREIGN KEY (club_id) REFERENCES verified_clubs(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_event_stages_event_id_fkey' AND conrelid = 'public.club_event_stages'::regclass
    ) THEN
        ALTER TABLE public.club_event_stages ADD CONSTRAINT club_event_stages_event_id_fkey FOREIGN KEY (event_id) REFERENCES club_events(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_event_submission_assets_event_id_fkey' AND conrelid = 'public.club_event_submission_assets'::regclass
    ) THEN
        ALTER TABLE public.club_event_submission_assets ADD CONSTRAINT club_event_submission_assets_event_id_fkey FOREIGN KEY (event_id) REFERENCES club_events(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_event_submission_assets_stage_id_fkey' AND conrelid = 'public.club_event_submission_assets'::regclass
    ) THEN
        ALTER TABLE public.club_event_submission_assets ADD CONSTRAINT club_event_submission_assets_stage_id_fkey FOREIGN KEY (stage_id) REFERENCES club_event_stages(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_event_submission_assets_submission_id_fkey' AND conrelid = 'public.club_event_submission_assets'::regclass
    ) THEN
        ALTER TABLE public.club_event_submission_assets ADD CONSTRAINT club_event_submission_assets_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES club_event_stage_submissions(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_event_submission_assets_user_id_fkey' AND conrelid = 'public.club_event_submission_assets'::regclass
    ) THEN
        ALTER TABLE public.club_event_submission_assets ADD CONSTRAINT club_event_submission_assets_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_event_team_invitations_event_id_fkey' AND conrelid = 'public.club_event_team_invitations'::regclass
    ) THEN
        ALTER TABLE public.club_event_team_invitations ADD CONSTRAINT club_event_team_invitations_event_id_fkey FOREIGN KEY (event_id) REFERENCES club_events(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_event_team_invitations_invitee_user_id_fkey' AND conrelid = 'public.club_event_team_invitations'::regclass
    ) THEN
        ALTER TABLE public.club_event_team_invitations ADD CONSTRAINT club_event_team_invitations_invitee_user_id_fkey FOREIGN KEY (invitee_user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_event_team_invitations_inviter_user_id_fkey' AND conrelid = 'public.club_event_team_invitations'::regclass
    ) THEN
        ALTER TABLE public.club_event_team_invitations ADD CONSTRAINT club_event_team_invitations_inviter_user_id_fkey FOREIGN KEY (inviter_user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_event_team_invitations_team_id_fkey' AND conrelid = 'public.club_event_team_invitations'::regclass
    ) THEN
        ALTER TABLE public.club_event_team_invitations ADD CONSTRAINT club_event_team_invitations_team_id_fkey FOREIGN KEY (team_id) REFERENCES club_event_teams(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_event_team_members_event_id_fkey' AND conrelid = 'public.club_event_team_members'::regclass
    ) THEN
        ALTER TABLE public.club_event_team_members ADD CONSTRAINT club_event_team_members_event_id_fkey FOREIGN KEY (event_id) REFERENCES club_events(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_event_team_members_team_id_fkey' AND conrelid = 'public.club_event_team_members'::regclass
    ) THEN
        ALTER TABLE public.club_event_team_members ADD CONSTRAINT club_event_team_members_team_id_fkey FOREIGN KEY (team_id) REFERENCES club_event_teams(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_event_team_members_user_id_fkey' AND conrelid = 'public.club_event_team_members'::regclass
    ) THEN
        ALTER TABLE public.club_event_team_members ADD CONSTRAINT club_event_team_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_event_teams_club_id_fkey' AND conrelid = 'public.club_event_teams'::regclass
    ) THEN
        ALTER TABLE public.club_event_teams ADD CONSTRAINT club_event_teams_club_id_fkey FOREIGN KEY (club_id) REFERENCES verified_clubs(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_event_teams_event_id_fkey' AND conrelid = 'public.club_event_teams'::regclass
    ) THEN
        ALTER TABLE public.club_event_teams ADD CONSTRAINT club_event_teams_event_id_fkey FOREIGN KEY (event_id) REFERENCES club_events(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_event_teams_leader_id_fkey' AND conrelid = 'public.club_event_teams'::regclass
    ) THEN
        ALTER TABLE public.club_event_teams ADD CONSTRAINT club_event_teams_leader_id_fkey FOREIGN KEY (leader_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_events_club_id_fkey' AND conrelid = 'public.club_events'::regclass
    ) THEN
        ALTER TABLE public.club_events ADD CONSTRAINT club_events_club_id_fkey FOREIGN KEY (club_id) REFERENCES verified_clubs(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_form_media_assets_event_id_fkey' AND conrelid = 'public.club_form_media_assets'::regclass
    ) THEN
        ALTER TABLE public.club_form_media_assets ADD CONSTRAINT club_form_media_assets_event_id_fkey FOREIGN KEY (event_id) REFERENCES club_events(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_form_media_assets_form_id_fkey' AND conrelid = 'public.club_form_media_assets'::regclass
    ) THEN
        ALTER TABLE public.club_form_media_assets ADD CONSTRAINT club_form_media_assets_form_id_fkey FOREIGN KEY (form_id) REFERENCES club_event_forms(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_form_media_assets_response_id_fkey' AND conrelid = 'public.club_form_media_assets'::regclass
    ) THEN
        ALTER TABLE public.club_form_media_assets ADD CONSTRAINT club_form_media_assets_response_id_fkey FOREIGN KEY (response_id) REFERENCES club_event_registrations(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_form_media_assets_uploader_user_id_fkey' AND conrelid = 'public.club_form_media_assets'::regclass
    ) THEN
        ALTER TABLE public.club_form_media_assets ADD CONSTRAINT club_form_media_assets_uploader_user_id_fkey FOREIGN KEY (uploader_user_id) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_memberships_club_id_fkey' AND conrelid = 'public.club_memberships'::regclass
    ) THEN
        ALTER TABLE public.club_memberships ADD CONSTRAINT club_memberships_club_id_fkey FOREIGN KEY (club_id) REFERENCES verified_clubs(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_memberships_invited_by_fkey' AND conrelid = 'public.club_memberships'::regclass
    ) THEN
        ALTER TABLE public.club_memberships ADD CONSTRAINT club_memberships_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_memberships_user_id_fkey' AND conrelid = 'public.club_memberships'::regclass
    ) THEN
        ALTER TABLE public.club_memberships ADD CONSTRAINT club_memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_message_action_logs_club_id_fkey' AND conrelid = 'public.club_message_action_logs'::regclass
    ) THEN
        ALTER TABLE public.club_message_action_logs ADD CONSTRAINT club_message_action_logs_club_id_fkey FOREIGN KEY (club_id) REFERENCES verified_clubs(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_message_action_logs_user_id_fkey' AND conrelid = 'public.club_message_action_logs'::regclass
    ) THEN
        ALTER TABLE public.club_message_action_logs ADD CONSTRAINT club_message_action_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_messages_club_id_fkey' AND conrelid = 'public.club_messages'::regclass
    ) THEN
        ALTER TABLE public.club_messages ADD CONSTRAINT club_messages_club_id_fkey FOREIGN KEY (club_id) REFERENCES verified_clubs(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_messages_conversation_id_fkey' AND conrelid = 'public.club_messages'::regclass
    ) THEN
        ALTER TABLE public.club_messages ADD CONSTRAINT club_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES club_conversations(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_messages_sender_id_fkey' AND conrelid = 'public.club_messages'::regclass
    ) THEN
        ALTER TABLE public.club_messages ADD CONSTRAINT club_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_team_invitations_club_id_fkey' AND conrelid = 'public.club_team_invitations'::regclass
    ) THEN
        ALTER TABLE public.club_team_invitations ADD CONSTRAINT club_team_invitations_club_id_fkey FOREIGN KEY (club_id) REFERENCES verified_clubs(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_team_invitations_invited_by_user_id_fkey' AND conrelid = 'public.club_team_invitations'::regclass
    ) THEN
        ALTER TABLE public.club_team_invitations ADD CONSTRAINT club_team_invitations_invited_by_user_id_fkey FOREIGN KEY (invited_by_user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_team_invitations_invited_user_id_fkey' AND conrelid = 'public.club_team_invitations'::regclass
    ) THEN
        ALTER TABLE public.club_team_invitations ADD CONSTRAINT club_team_invitations_invited_user_id_fkey FOREIGN KEY (invited_user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_team_invitations_inviter_user_id_fkey' AND conrelid = 'public.club_team_invitations'::regclass
    ) THEN
        ALTER TABLE public.club_team_invitations ADD CONSTRAINT club_team_invitations_inviter_user_id_fkey FOREIGN KEY (inviter_user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_team_invitations_notification_id_fkey' AND conrelid = 'public.club_team_invitations'::regclass
    ) THEN
        ALTER TABLE public.club_team_invitations ADD CONSTRAINT club_team_invitations_notification_id_fkey FOREIGN KEY (notification_id) REFERENCES user_notifications(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_team_invitations_team_id_fkey' AND conrelid = 'public.club_team_invitations'::regclass
    ) THEN
        ALTER TABLE public.club_team_invitations ADD CONSTRAINT club_team_invitations_team_id_fkey FOREIGN KEY (team_id) REFERENCES club_teams(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_team_members_assigned_by_fkey' AND conrelid = 'public.club_team_members'::regclass
    ) THEN
        ALTER TABLE public.club_team_members ADD CONSTRAINT club_team_members_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_team_members_club_id_fkey' AND conrelid = 'public.club_team_members'::regclass
    ) THEN
        ALTER TABLE public.club_team_members ADD CONSTRAINT club_team_members_club_id_fkey FOREIGN KEY (club_id) REFERENCES verified_clubs(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_team_members_club_membership_id_fkey' AND conrelid = 'public.club_team_members'::regclass
    ) THEN
        ALTER TABLE public.club_team_members ADD CONSTRAINT club_team_members_club_membership_id_fkey FOREIGN KEY (club_membership_id) REFERENCES club_memberships(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_team_members_team_id_fkey' AND conrelid = 'public.club_team_members'::regclass
    ) THEN
        ALTER TABLE public.club_team_members ADD CONSTRAINT club_team_members_team_id_fkey FOREIGN KEY (team_id) REFERENCES club_teams(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_team_members_user_id_fkey' AND conrelid = 'public.club_team_members'::regclass
    ) THEN
        ALTER TABLE public.club_team_members ADD CONSTRAINT club_team_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_teams_club_id_fkey' AND conrelid = 'public.club_teams'::regclass
    ) THEN
        ALTER TABLE public.club_teams ADD CONSTRAINT club_teams_club_id_fkey FOREIGN KEY (club_id) REFERENCES verified_clubs(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_teams_co_lead_user_id_fkey' AND conrelid = 'public.club_teams'::regclass
    ) THEN
        ALTER TABLE public.club_teams ADD CONSTRAINT club_teams_co_lead_user_id_fkey FOREIGN KEY (co_lead_user_id) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_teams_created_by_fkey' AND conrelid = 'public.club_teams'::regclass
    ) THEN
        ALTER TABLE public.club_teams ADD CONSTRAINT club_teams_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_teams_lead_user_id_fkey' AND conrelid = 'public.club_teams'::regclass
    ) THEN
        ALTER TABLE public.club_teams ADD CONSTRAINT club_teams_lead_user_id_fkey FOREIGN KEY (lead_user_id) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_user_moderation_blocked_by_fkey' AND conrelid = 'public.club_user_moderation'::regclass
    ) THEN
        ALTER TABLE public.club_user_moderation ADD CONSTRAINT club_user_moderation_blocked_by_fkey FOREIGN KEY (blocked_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_user_moderation_club_id_fkey' AND conrelid = 'public.club_user_moderation'::regclass
    ) THEN
        ALTER TABLE public.club_user_moderation ADD CONSTRAINT club_user_moderation_club_id_fkey FOREIGN KEY (club_id) REFERENCES verified_clubs(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_user_moderation_muted_by_fkey' AND conrelid = 'public.club_user_moderation'::regclass
    ) THEN
        ALTER TABLE public.club_user_moderation ADD CONSTRAINT club_user_moderation_muted_by_fkey FOREIGN KEY (muted_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_user_moderation_user_id_fkey' AND conrelid = 'public.club_user_moderation'::regclass
    ) THEN
        ALTER TABLE public.club_user_moderation ADD CONSTRAINT club_user_moderation_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_verification_requests_auth_user_id_fkey' AND conrelid = 'public.club_verification_requests'::regclass
    ) THEN
        ALTER TABLE public.club_verification_requests ADD CONSTRAINT club_verification_requests_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_verification_requests_college_id_fkey' AND conrelid = 'public.club_verification_requests'::regclass
    ) THEN
        ALTER TABLE public.club_verification_requests ADD CONSTRAINT club_verification_requests_college_id_fkey FOREIGN KEY (college_id) REFERENCES institutions(id);
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_verification_requests_reviewed_by_fkey' AND conrelid = 'public.club_verification_requests'::regclass
    ) THEN
        ALTER TABLE public.club_verification_requests ADD CONSTRAINT club_verification_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'club_verification_requests_verified_club_id_fkey' AND conrelid = 'public.club_verification_requests'::regclass
    ) THEN
        ALTER TABLE public.club_verification_requests ADD CONSTRAINT club_verification_requests_verified_club_id_fkey FOREIGN KEY (verified_club_id) REFERENCES verified_clubs(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'college_verification_email_tokens_user_id_fkey' AND conrelid = 'public.college_verification_email_tokens'::regclass
    ) THEN
        ALTER TABLE public.college_verification_email_tokens ADD CONSTRAINT college_verification_email_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'college_verification_email_tokens_verification_id_fkey' AND conrelid = 'public.college_verification_email_tokens'::regclass
    ) THEN
        ALTER TABLE public.college_verification_email_tokens ADD CONSTRAINT college_verification_email_tokens_verification_id_fkey FOREIGN KEY (verification_id) REFERENCES college_verifications(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'college_verification_phone_otps_user_id_fkey' AND conrelid = 'public.college_verification_phone_otps'::regclass
    ) THEN
        ALTER TABLE public.college_verification_phone_otps ADD CONSTRAINT college_verification_phone_otps_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'college_verification_phone_otps_verification_id_fkey' AND conrelid = 'public.college_verification_phone_otps'::regclass
    ) THEN
        ALTER TABLE public.college_verification_phone_otps ADD CONSTRAINT college_verification_phone_otps_verification_id_fkey FOREIGN KEY (verification_id) REFERENCES college_verifications(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'college_verifications_college_id_fkey' AND conrelid = 'public.college_verifications'::regclass
    ) THEN
        ALTER TABLE public.college_verifications ADD CONSTRAINT college_verifications_college_id_fkey FOREIGN KEY (college_id) REFERENCES institutions(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'college_verifications_reviewed_by_fkey' AND conrelid = 'public.college_verifications'::regclass
    ) THEN
        ALTER TABLE public.college_verifications ADD CONSTRAINT college_verifications_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'college_verifications_user_id_fkey' AND conrelid = 'public.college_verifications'::regclass
    ) THEN
        ALTER TABLE public.college_verifications ADD CONSTRAINT college_verifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'email_verification_otps_user_id_fkey' AND conrelid = 'public.email_verification_otps'::regclass
    ) THEN
        ALTER TABLE public.email_verification_otps ADD CONSTRAINT email_verification_otps_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'help_faq_feedback_faq_id_fkey' AND conrelid = 'public.help_faq_feedback'::regclass
    ) THEN
        ALTER TABLE public.help_faq_feedback ADD CONSTRAINT help_faq_feedback_faq_id_fkey FOREIGN KEY (faq_id) REFERENCES help_faqs(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'help_faq_feedback_user_id_fkey' AND conrelid = 'public.help_faq_feedback'::regclass
    ) THEN
        ALTER TABLE public.help_faq_feedback ADD CONSTRAINT help_faq_feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'help_ticket_attachments_ticket_id_fkey' AND conrelid = 'public.help_ticket_attachments'::regclass
    ) THEN
        ALTER TABLE public.help_ticket_attachments ADD CONSTRAINT help_ticket_attachments_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES help_tickets(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'help_ticket_attachments_uploaded_by_fkey' AND conrelid = 'public.help_ticket_attachments'::regclass
    ) THEN
        ALTER TABLE public.help_ticket_attachments ADD CONSTRAINT help_ticket_attachments_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'help_ticket_messages_sender_id_fkey' AND conrelid = 'public.help_ticket_messages'::regclass
    ) THEN
        ALTER TABLE public.help_ticket_messages ADD CONSTRAINT help_ticket_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'help_ticket_messages_ticket_id_fkey' AND conrelid = 'public.help_ticket_messages'::regclass
    ) THEN
        ALTER TABLE public.help_ticket_messages ADD CONSTRAINT help_ticket_messages_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES help_tickets(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'help_tickets_assigned_to_fkey' AND conrelid = 'public.help_tickets'::regclass
    ) THEN
        ALTER TABLE public.help_tickets ADD CONSTRAINT help_tickets_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'help_tickets_closed_by_fkey' AND conrelid = 'public.help_tickets'::regclass
    ) THEN
        ALTER TABLE public.help_tickets ADD CONSTRAINT help_tickets_closed_by_fkey FOREIGN KEY (closed_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'help_tickets_user_id_fkey' AND conrelid = 'public.help_tickets'::regclass
    ) THEN
        ALTER TABLE public.help_tickets ADD CONSTRAINT help_tickets_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'institution_aliases_institution_id_fkey' AND conrelid = 'public.institution_aliases'::regclass
    ) THEN
        ALTER TABLE public.institution_aliases ADD CONSTRAINT institution_aliases_institution_id_fkey FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'institution_rankings_institution_id_fkey' AND conrelid = 'public.institution_rankings'::regclass
    ) THEN
        ALTER TABLE public.institution_rankings ADD CONSTRAINT institution_rankings_institution_id_fkey FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'institution_regulatory_ids_institution_id_fkey' AND conrelid = 'public.institution_regulatory_ids'::regclass
    ) THEN
        ALTER TABLE public.institution_regulatory_ids ADD CONSTRAINT institution_regulatory_ids_institution_id_fkey FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'institution_sources_institution_id_fkey' AND conrelid = 'public.institution_sources'::regclass
    ) THEN
        ALTER TABLE public.institution_sources ADD CONSTRAINT institution_sources_institution_id_fkey FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'institution_verification_requests_resolved_institution_id_fkey' AND conrelid = 'public.institution_verification_requests'::regclass
    ) THEN
        ALTER TABLE public.institution_verification_requests ADD CONSTRAINT institution_verification_requests_resolved_institution_id_fkey FOREIGN KEY (resolved_institution_id) REFERENCES institutions(id);
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'institutions_parent_university_id_fkey' AND conrelid = 'public.institutions'::regclass
    ) THEN
        ALTER TABLE public.institutions ADD CONSTRAINT institutions_parent_university_id_fkey FOREIGN KEY (parent_university_id) REFERENCES institutions(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'leaderboard_entries_user_id_fkey' AND conrelid = 'public.leaderboard_entries'::regclass
    ) THEN
        ALTER TABLE public.leaderboard_entries ADD CONSTRAINT leaderboard_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'privacy_request_audit_user_id_fkey' AND conrelid = 'public.privacy_request_audit'::regclass
    ) THEN
        ALTER TABLE public.privacy_request_audit ADD CONSTRAINT privacy_request_audit_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'resume_versions_resume_id_fkey' AND conrelid = 'public.resume_versions'::regclass
    ) THEN
        ALTER TABLE public.resume_versions ADD CONSTRAINT resume_versions_resume_id_fkey FOREIGN KEY (resume_id) REFERENCES user_resumes(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'team_workspaces_club_id_fkey' AND conrelid = 'public.team_workspaces'::regclass
    ) THEN
        ALTER TABLE public.team_workspaces ADD CONSTRAINT team_workspaces_club_id_fkey FOREIGN KEY (club_id) REFERENCES verified_clubs(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'team_workspaces_manager_user_id_fkey' AND conrelid = 'public.team_workspaces'::regclass
    ) THEN
        ALTER TABLE public.team_workspaces ADD CONSTRAINT team_workspaces_manager_user_id_fkey FOREIGN KEY (manager_user_id) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'team_workspaces_owner_id_fkey' AND conrelid = 'public.team_workspaces'::regclass
    ) THEN
        ALTER TABLE public.team_workspaces ADD CONSTRAINT team_workspaces_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE RESTRICT;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'user_blocks_blocked_id_fkey' AND conrelid = 'public.user_blocks'::regclass
    ) THEN
        ALTER TABLE public.user_blocks ADD CONSTRAINT user_blocks_blocked_id_fkey FOREIGN KEY (blocked_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'user_blocks_blocker_id_fkey' AND conrelid = 'public.user_blocks'::regclass
    ) THEN
        ALTER TABLE public.user_blocks ADD CONSTRAINT user_blocks_blocker_id_fkey FOREIGN KEY (blocker_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'user_github_installations_user_id_fkey' AND conrelid = 'public.user_github_installations'::regclass
    ) THEN
        ALTER TABLE public.user_github_installations ADD CONSTRAINT user_github_installations_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'user_legal_consents_user_id_fkey' AND conrelid = 'public.user_legal_consents'::regclass
    ) THEN
        ALTER TABLE public.user_legal_consents ADD CONSTRAINT user_legal_consents_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'user_notifications_actor_id_fkey' AND conrelid = 'public.user_notifications'::regclass
    ) THEN
        ALTER TABLE public.user_notifications ADD CONSTRAINT user_notifications_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'user_notifications_recipient_id_fkey' AND conrelid = 'public.user_notifications'::regclass
    ) THEN
        ALTER TABLE public.user_notifications ADD CONSTRAINT user_notifications_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'user_notifications_relationship_id_fkey' AND conrelid = 'public.user_notifications'::regclass
    ) THEN
        ALTER TABLE public.user_notifications ADD CONSTRAINT user_notifications_relationship_id_fkey FOREIGN KEY (relationship_id) REFERENCES user_relationships(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'user_notifications_user_id_fkey' AND conrelid = 'public.user_notifications'::regclass
    ) THEN
        ALTER TABLE public.user_notifications ADD CONSTRAINT user_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'user_privacy_preferences_user_id_fkey' AND conrelid = 'public.user_privacy_preferences'::regclass
    ) THEN
        ALTER TABLE public.user_privacy_preferences ADD CONSTRAINT user_privacy_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'user_projects_user_id_fkey' AND conrelid = 'public.user_projects'::regclass
    ) THEN
        ALTER TABLE public.user_projects ADD CONSTRAINT user_projects_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'user_relationship_action_logs_actor_id_fkey' AND conrelid = 'public.user_relationship_action_logs'::regclass
    ) THEN
        ALTER TABLE public.user_relationship_action_logs ADD CONSTRAINT user_relationship_action_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'user_relationship_action_logs_target_id_fkey' AND conrelid = 'public.user_relationship_action_logs'::regclass
    ) THEN
        ALTER TABLE public.user_relationship_action_logs ADD CONSTRAINT user_relationship_action_logs_target_id_fkey FOREIGN KEY (target_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'user_relationships_requested_by_fkey' AND conrelid = 'public.user_relationships'::regclass
    ) THEN
        ALTER TABLE public.user_relationships ADD CONSTRAINT user_relationships_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'user_relationships_user_high_id_fkey' AND conrelid = 'public.user_relationships'::regclass
    ) THEN
        ALTER TABLE public.user_relationships ADD CONSTRAINT user_relationships_user_high_id_fkey FOREIGN KEY (user_high_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'user_relationships_user_low_id_fkey' AND conrelid = 'public.user_relationships'::regclass
    ) THEN
        ALTER TABLE public.user_relationships ADD CONSTRAINT user_relationships_user_low_id_fkey FOREIGN KEY (user_low_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'user_sessions_user_id_fkey' AND conrelid = 'public.user_sessions'::regclass
    ) THEN
        ALTER TABLE public.user_sessions ADD CONSTRAINT user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'users_college_id_fkey' AND conrelid = 'public.users'::regclass
    ) THEN
        ALTER TABLE public.users ADD CONSTRAINT users_college_id_fkey FOREIGN KEY (college_id) REFERENCES institutions(id);
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'verified_clubs_auth_user_id_fkey' AND conrelid = 'public.verified_clubs'::regclass
    ) THEN
        ALTER TABLE public.verified_clubs ADD CONSTRAINT verified_clubs_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'verified_clubs_college_id_fkey' AND conrelid = 'public.verified_clubs'::regclass
    ) THEN
        ALTER TABLE public.verified_clubs ADD CONSTRAINT verified_clubs_college_id_fkey FOREIGN KEY (college_id) REFERENCES institutions(id);
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_activity_feed_actor_id_fkey' AND conrelid = 'public.workspace_activity_feed'::regclass
    ) THEN
        ALTER TABLE public.workspace_activity_feed ADD CONSTRAINT workspace_activity_feed_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_activity_feed_department_id_fkey' AND conrelid = 'public.workspace_activity_feed'::regclass
    ) THEN
        ALTER TABLE public.workspace_activity_feed ADD CONSTRAINT workspace_activity_feed_department_id_fkey FOREIGN KEY (department_id) REFERENCES workspace_departments(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_activity_feed_workspace_id_fkey' AND conrelid = 'public.workspace_activity_feed'::regclass
    ) THEN
        ALTER TABLE public.workspace_activity_feed ADD CONSTRAINT workspace_activity_feed_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES team_workspaces(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_audit_logs_actor_id_fkey' AND conrelid = 'public.workspace_audit_logs'::regclass
    ) THEN
        ALTER TABLE public.workspace_audit_logs ADD CONSTRAINT workspace_audit_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_audit_logs_workspace_id_fkey' AND conrelid = 'public.workspace_audit_logs'::regclass
    ) THEN
        ALTER TABLE public.workspace_audit_logs ADD CONSTRAINT workspace_audit_logs_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES team_workspaces(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_channel_categories_department_id_fkey' AND conrelid = 'public.workspace_channel_categories'::regclass
    ) THEN
        ALTER TABLE public.workspace_channel_categories ADD CONSTRAINT workspace_channel_categories_department_id_fkey FOREIGN KEY (department_id) REFERENCES workspace_departments(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_channel_categories_workspace_id_fkey' AND conrelid = 'public.workspace_channel_categories'::regclass
    ) THEN
        ALTER TABLE public.workspace_channel_categories ADD CONSTRAINT workspace_channel_categories_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES team_workspaces(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_channel_overrides_category_id_fkey' AND conrelid = 'public.workspace_channel_overrides'::regclass
    ) THEN
        ALTER TABLE public.workspace_channel_overrides ADD CONSTRAINT workspace_channel_overrides_category_id_fkey FOREIGN KEY (category_id) REFERENCES workspace_channel_categories(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_channel_overrides_channel_id_fkey' AND conrelid = 'public.workspace_channel_overrides'::regclass
    ) THEN
        ALTER TABLE public.workspace_channel_overrides ADD CONSTRAINT workspace_channel_overrides_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES workspace_channels(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_channel_overrides_member_id_fkey' AND conrelid = 'public.workspace_channel_overrides'::regclass
    ) THEN
        ALTER TABLE public.workspace_channel_overrides ADD CONSTRAINT workspace_channel_overrides_member_id_fkey FOREIGN KEY (member_id) REFERENCES workspace_members(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_channel_overrides_role_id_fkey' AND conrelid = 'public.workspace_channel_overrides'::regclass
    ) THEN
        ALTER TABLE public.workspace_channel_overrides ADD CONSTRAINT workspace_channel_overrides_role_id_fkey FOREIGN KEY (role_id) REFERENCES workspace_roles(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_channel_overrides_workspace_id_fkey' AND conrelid = 'public.workspace_channel_overrides'::regclass
    ) THEN
        ALTER TABLE public.workspace_channel_overrides ADD CONSTRAINT workspace_channel_overrides_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES team_workspaces(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_notifications_channel_id_fkey' AND conrelid = 'public.workspace_channel_read_states'::regclass
    ) THEN
        ALTER TABLE public.workspace_channel_read_states ADD CONSTRAINT workspace_notifications_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES workspace_channels(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_notifications_member_id_fkey' AND conrelid = 'public.workspace_channel_read_states'::regclass
    ) THEN
        ALTER TABLE public.workspace_channel_read_states ADD CONSTRAINT workspace_notifications_member_id_fkey FOREIGN KEY (member_id) REFERENCES workspace_members(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_notifications_workspace_id_fkey' AND conrelid = 'public.workspace_channel_read_states'::regclass
    ) THEN
        ALTER TABLE public.workspace_channel_read_states ADD CONSTRAINT workspace_notifications_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES team_workspaces(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_channel_reads_channel_id_fkey' AND conrelid = 'public.workspace_channel_reads'::regclass
    ) THEN
        ALTER TABLE public.workspace_channel_reads ADD CONSTRAINT workspace_channel_reads_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES workspace_channels(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_channel_reads_last_read_message_id_fkey' AND conrelid = 'public.workspace_channel_reads'::regclass
    ) THEN
        ALTER TABLE public.workspace_channel_reads ADD CONSTRAINT workspace_channel_reads_last_read_message_id_fkey FOREIGN KEY (last_read_message_id) REFERENCES workspace_messages(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_channel_reads_user_id_fkey' AND conrelid = 'public.workspace_channel_reads'::regclass
    ) THEN
        ALTER TABLE public.workspace_channel_reads ADD CONSTRAINT workspace_channel_reads_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_channels_category_id_fkey' AND conrelid = 'public.workspace_channels'::regclass
    ) THEN
        ALTER TABLE public.workspace_channels ADD CONSTRAINT workspace_channels_category_id_fkey FOREIGN KEY (category_id) REFERENCES workspace_channel_categories(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_channels_created_by_fkey' AND conrelid = 'public.workspace_channels'::regclass
    ) THEN
        ALTER TABLE public.workspace_channels ADD CONSTRAINT workspace_channels_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_channels_department_id_fkey' AND conrelid = 'public.workspace_channels'::regclass
    ) THEN
        ALTER TABLE public.workspace_channels ADD CONSTRAINT workspace_channels_department_id_fkey FOREIGN KEY (department_id) REFERENCES workspace_departments(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_channels_workspace_id_fkey' AND conrelid = 'public.workspace_channels'::regclass
    ) THEN
        ALTER TABLE public.workspace_channels ADD CONSTRAINT workspace_channels_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES team_workspaces(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_department_members_assigned_by_fkey' AND conrelid = 'public.workspace_department_members'::regclass
    ) THEN
        ALTER TABLE public.workspace_department_members ADD CONSTRAINT workspace_department_members_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_department_members_department_id_fkey' AND conrelid = 'public.workspace_department_members'::regclass
    ) THEN
        ALTER TABLE public.workspace_department_members ADD CONSTRAINT workspace_department_members_department_id_fkey FOREIGN KEY (department_id) REFERENCES workspace_departments(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_department_members_member_id_fkey' AND conrelid = 'public.workspace_department_members'::regclass
    ) THEN
        ALTER TABLE public.workspace_department_members ADD CONSTRAINT workspace_department_members_member_id_fkey FOREIGN KEY (member_id) REFERENCES workspace_members(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_department_members_user_id_fkey' AND conrelid = 'public.workspace_department_members'::regclass
    ) THEN
        ALTER TABLE public.workspace_department_members ADD CONSTRAINT workspace_department_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_department_members_workspace_id_fkey' AND conrelid = 'public.workspace_department_members'::regclass
    ) THEN
        ALTER TABLE public.workspace_department_members ADD CONSTRAINT workspace_department_members_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES team_workspaces(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_department_transfers_from_department_id_fkey' AND conrelid = 'public.workspace_department_transfers'::regclass
    ) THEN
        ALTER TABLE public.workspace_department_transfers ADD CONSTRAINT workspace_department_transfers_from_department_id_fkey FOREIGN KEY (from_department_id) REFERENCES workspace_departments(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_department_transfers_to_department_id_fkey' AND conrelid = 'public.workspace_department_transfers'::regclass
    ) THEN
        ALTER TABLE public.workspace_department_transfers ADD CONSTRAINT workspace_department_transfers_to_department_id_fkey FOREIGN KEY (to_department_id) REFERENCES workspace_departments(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_department_transfers_transferred_by_fkey' AND conrelid = 'public.workspace_department_transfers'::regclass
    ) THEN
        ALTER TABLE public.workspace_department_transfers ADD CONSTRAINT workspace_department_transfers_transferred_by_fkey FOREIGN KEY (transferred_by) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_department_transfers_user_id_fkey' AND conrelid = 'public.workspace_department_transfers'::regclass
    ) THEN
        ALTER TABLE public.workspace_department_transfers ADD CONSTRAINT workspace_department_transfers_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_department_transfers_workspace_id_fkey' AND conrelid = 'public.workspace_department_transfers'::regclass
    ) THEN
        ALTER TABLE public.workspace_department_transfers ADD CONSTRAINT workspace_department_transfers_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES team_workspaces(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_departments_club_team_id_fkey' AND conrelid = 'public.workspace_departments'::regclass
    ) THEN
        ALTER TABLE public.workspace_departments ADD CONSTRAINT workspace_departments_club_team_id_fkey FOREIGN KEY (club_team_id) REFERENCES club_teams(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_departments_lead_user_id_fkey' AND conrelid = 'public.workspace_departments'::regclass
    ) THEN
        ALTER TABLE public.workspace_departments ADD CONSTRAINT workspace_departments_lead_user_id_fkey FOREIGN KEY (lead_user_id) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_departments_workspace_id_fkey' AND conrelid = 'public.workspace_departments'::regclass
    ) THEN
        ALTER TABLE public.workspace_departments ADD CONSTRAINT workspace_departments_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES team_workspaces(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_email_deliveries_recipient_id_fkey' AND conrelid = 'public.workspace_email_deliveries'::regclass
    ) THEN
        ALTER TABLE public.workspace_email_deliveries ADD CONSTRAINT workspace_email_deliveries_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_email_deliveries_workspace_id_fkey' AND conrelid = 'public.workspace_email_deliveries'::regclass
    ) THEN
        ALTER TABLE public.workspace_email_deliveries ADD CONSTRAINT workspace_email_deliveries_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES team_workspaces(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_file_upload_intents_department_id_fkey' AND conrelid = 'public.workspace_file_upload_intents'::regclass
    ) THEN
        ALTER TABLE public.workspace_file_upload_intents ADD CONSTRAINT workspace_file_upload_intents_department_id_fkey FOREIGN KEY (department_id) REFERENCES workspace_departments(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_file_upload_intents_user_id_fkey' AND conrelid = 'public.workspace_file_upload_intents'::regclass
    ) THEN
        ALTER TABLE public.workspace_file_upload_intents ADD CONSTRAINT workspace_file_upload_intents_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_file_upload_intents_workspace_id_fkey' AND conrelid = 'public.workspace_file_upload_intents'::regclass
    ) THEN
        ALTER TABLE public.workspace_file_upload_intents ADD CONSTRAINT workspace_file_upload_intents_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES team_workspaces(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_files_channel_id_fkey' AND conrelid = 'public.workspace_files'::regclass
    ) THEN
        ALTER TABLE public.workspace_files ADD CONSTRAINT workspace_files_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES workspace_channels(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_files_department_id_fkey' AND conrelid = 'public.workspace_files'::regclass
    ) THEN
        ALTER TABLE public.workspace_files ADD CONSTRAINT workspace_files_department_id_fkey FOREIGN KEY (department_id) REFERENCES workspace_departments(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_files_message_id_fkey' AND conrelid = 'public.workspace_files'::regclass
    ) THEN
        ALTER TABLE public.workspace_files ADD CONSTRAINT workspace_files_message_id_fkey FOREIGN KEY (message_id) REFERENCES workspace_messages(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_files_submission_id_fkey' AND conrelid = 'public.workspace_files'::regclass
    ) THEN
        ALTER TABLE public.workspace_files ADD CONSTRAINT workspace_files_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES workspace_task_submissions(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_files_task_id_fkey' AND conrelid = 'public.workspace_files'::regclass
    ) THEN
        ALTER TABLE public.workspace_files ADD CONSTRAINT workspace_files_task_id_fkey FOREIGN KEY (task_id) REFERENCES workspace_tasks(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_files_uploader_id_fkey' AND conrelid = 'public.workspace_files'::regclass
    ) THEN
        ALTER TABLE public.workspace_files ADD CONSTRAINT workspace_files_uploader_id_fkey FOREIGN KEY (uploader_id) REFERENCES users(id) ON DELETE RESTRICT;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_files_workspace_id_fkey' AND conrelid = 'public.workspace_files'::regclass
    ) THEN
        ALTER TABLE public.workspace_files ADD CONSTRAINT workspace_files_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES team_workspaces(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_invitations_department_id_fkey' AND conrelid = 'public.workspace_invitations'::regclass
    ) THEN
        ALTER TABLE public.workspace_invitations ADD CONSTRAINT workspace_invitations_department_id_fkey FOREIGN KEY (department_id) REFERENCES workspace_departments(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_invitations_invited_user_id_fkey' AND conrelid = 'public.workspace_invitations'::regclass
    ) THEN
        ALTER TABLE public.workspace_invitations ADD CONSTRAINT workspace_invitations_invited_user_id_fkey FOREIGN KEY (invited_user_id) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_invitations_inviter_id_fkey' AND conrelid = 'public.workspace_invitations'::regclass
    ) THEN
        ALTER TABLE public.workspace_invitations ADD CONSTRAINT workspace_invitations_inviter_id_fkey FOREIGN KEY (inviter_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_invitations_revoked_by_fkey' AND conrelid = 'public.workspace_invitations'::regclass
    ) THEN
        ALTER TABLE public.workspace_invitations ADD CONSTRAINT workspace_invitations_revoked_by_fkey FOREIGN KEY (revoked_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_invitations_role_id_fkey' AND conrelid = 'public.workspace_invitations'::regclass
    ) THEN
        ALTER TABLE public.workspace_invitations ADD CONSTRAINT workspace_invitations_role_id_fkey FOREIGN KEY (role_id) REFERENCES workspace_roles(id) ON DELETE RESTRICT;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_invitations_workspace_id_fkey' AND conrelid = 'public.workspace_invitations'::regclass
    ) THEN
        ALTER TABLE public.workspace_invitations ADD CONSTRAINT workspace_invitations_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES team_workspaces(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_members_club_membership_id_fkey' AND conrelid = 'public.workspace_members'::regclass
    ) THEN
        ALTER TABLE public.workspace_members ADD CONSTRAINT workspace_members_club_membership_id_fkey FOREIGN KEY (club_membership_id) REFERENCES club_memberships(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_members_department_id_fkey' AND conrelid = 'public.workspace_members'::regclass
    ) THEN
        ALTER TABLE public.workspace_members ADD CONSTRAINT workspace_members_department_id_fkey FOREIGN KEY (department_id) REFERENCES workspace_departments(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_members_invited_by_fkey' AND conrelid = 'public.workspace_members'::regclass
    ) THEN
        ALTER TABLE public.workspace_members ADD CONSTRAINT workspace_members_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_members_role_id_fkey' AND conrelid = 'public.workspace_members'::regclass
    ) THEN
        ALTER TABLE public.workspace_members ADD CONSTRAINT workspace_members_role_id_fkey FOREIGN KEY (role_id) REFERENCES workspace_roles(id) ON DELETE RESTRICT;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_members_suspended_by_fkey' AND conrelid = 'public.workspace_members'::regclass
    ) THEN
        ALTER TABLE public.workspace_members ADD CONSTRAINT workspace_members_suspended_by_fkey FOREIGN KEY (suspended_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_members_user_id_fkey' AND conrelid = 'public.workspace_members'::regclass
    ) THEN
        ALTER TABLE public.workspace_members ADD CONSTRAINT workspace_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_members_workspace_id_fkey' AND conrelid = 'public.workspace_members'::regclass
    ) THEN
        ALTER TABLE public.workspace_members ADD CONSTRAINT workspace_members_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES team_workspaces(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_message_reactions_message_id_fkey' AND conrelid = 'public.workspace_message_reactions'::regclass
    ) THEN
        ALTER TABLE public.workspace_message_reactions ADD CONSTRAINT workspace_message_reactions_message_id_fkey FOREIGN KEY (message_id) REFERENCES workspace_messages(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_message_reactions_user_id_fkey' AND conrelid = 'public.workspace_message_reactions'::regclass
    ) THEN
        ALTER TABLE public.workspace_message_reactions ADD CONSTRAINT workspace_message_reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_message_reactions_workspace_id_fkey' AND conrelid = 'public.workspace_message_reactions'::regclass
    ) THEN
        ALTER TABLE public.workspace_message_reactions ADD CONSTRAINT workspace_message_reactions_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES team_workspaces(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fk_workspace_messages_thread' AND conrelid = 'public.workspace_messages'::regclass
    ) THEN
        ALTER TABLE public.workspace_messages ADD CONSTRAINT fk_workspace_messages_thread FOREIGN KEY (thread_id) REFERENCES workspace_threads(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_messages_channel_id_fkey' AND conrelid = 'public.workspace_messages'::regclass
    ) THEN
        ALTER TABLE public.workspace_messages ADD CONSTRAINT workspace_messages_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES workspace_channels(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_messages_parent_message_id_fkey' AND conrelid = 'public.workspace_messages'::regclass
    ) THEN
        ALTER TABLE public.workspace_messages ADD CONSTRAINT workspace_messages_parent_message_id_fkey FOREIGN KEY (parent_message_id) REFERENCES workspace_messages(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_messages_pinned_by_fkey' AND conrelid = 'public.workspace_messages'::regclass
    ) THEN
        ALTER TABLE public.workspace_messages ADD CONSTRAINT workspace_messages_pinned_by_fkey FOREIGN KEY (pinned_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_messages_sender_id_fkey' AND conrelid = 'public.workspace_messages'::regclass
    ) THEN
        ALTER TABLE public.workspace_messages ADD CONSTRAINT workspace_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE RESTRICT;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_messages_sender_member_id_fkey' AND conrelid = 'public.workspace_messages'::regclass
    ) THEN
        ALTER TABLE public.workspace_messages ADD CONSTRAINT workspace_messages_sender_member_id_fkey FOREIGN KEY (sender_member_id) REFERENCES workspace_members(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_messages_workspace_id_fkey' AND conrelid = 'public.workspace_messages'::regclass
    ) THEN
        ALTER TABLE public.workspace_messages ADD CONSTRAINT workspace_messages_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES team_workspaces(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_notification_preferences_user_id_fkey' AND conrelid = 'public.workspace_notification_preferences'::regclass
    ) THEN
        ALTER TABLE public.workspace_notification_preferences ADD CONSTRAINT workspace_notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_notification_preferences_workspace_id_fkey' AND conrelid = 'public.workspace_notification_preferences'::regclass
    ) THEN
        ALTER TABLE public.workspace_notification_preferences ADD CONSTRAINT workspace_notification_preferences_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES team_workspaces(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_notifications_actor_id_fkey' AND conrelid = 'public.workspace_notifications'::regclass
    ) THEN
        ALTER TABLE public.workspace_notifications ADD CONSTRAINT workspace_notifications_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_notifications_recipient_id_fkey' AND conrelid = 'public.workspace_notifications'::regclass
    ) THEN
        ALTER TABLE public.workspace_notifications ADD CONSTRAINT workspace_notifications_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_notifications_workspace_id_fkey1' AND conrelid = 'public.workspace_notifications'::regclass
    ) THEN
        ALTER TABLE public.workspace_notifications ADD CONSTRAINT workspace_notifications_workspace_id_fkey1 FOREIGN KEY (workspace_id) REFERENCES team_workspaces(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_outbox_events_workspace_id_fkey' AND conrelid = 'public.workspace_outbox_events'::regclass
    ) THEN
        ALTER TABLE public.workspace_outbox_events ADD CONSTRAINT workspace_outbox_events_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES team_workspaces(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_permission_overrides_created_by_fkey' AND conrelid = 'public.workspace_permission_overrides'::regclass
    ) THEN
        ALTER TABLE public.workspace_permission_overrides ADD CONSTRAINT workspace_permission_overrides_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_permission_overrides_department_id_fkey' AND conrelid = 'public.workspace_permission_overrides'::regclass
    ) THEN
        ALTER TABLE public.workspace_permission_overrides ADD CONSTRAINT workspace_permission_overrides_department_id_fkey FOREIGN KEY (department_id) REFERENCES workspace_departments(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_permission_overrides_member_id_fkey' AND conrelid = 'public.workspace_permission_overrides'::regclass
    ) THEN
        ALTER TABLE public.workspace_permission_overrides ADD CONSTRAINT workspace_permission_overrides_member_id_fkey FOREIGN KEY (member_id) REFERENCES workspace_members(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_permission_overrides_workspace_id_fkey' AND conrelid = 'public.workspace_permission_overrides'::regclass
    ) THEN
        ALTER TABLE public.workspace_permission_overrides ADD CONSTRAINT workspace_permission_overrides_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES team_workspaces(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_recognition_budgets_allocated_by_fkey' AND conrelid = 'public.workspace_recognition_budgets'::regclass
    ) THEN
        ALTER TABLE public.workspace_recognition_budgets ADD CONSTRAINT workspace_recognition_budgets_allocated_by_fkey FOREIGN KEY (allocated_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_recognition_budgets_user_id_fkey' AND conrelid = 'public.workspace_recognition_budgets'::regclass
    ) THEN
        ALTER TABLE public.workspace_recognition_budgets ADD CONSTRAINT workspace_recognition_budgets_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_recognition_budgets_workspace_id_fkey' AND conrelid = 'public.workspace_recognition_budgets'::regclass
    ) THEN
        ALTER TABLE public.workspace_recognition_budgets ADD CONSTRAINT workspace_recognition_budgets_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES team_workspaces(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_recognition_categories_workspace_id_fkey' AND conrelid = 'public.workspace_recognition_categories'::regclass
    ) THEN
        ALTER TABLE public.workspace_recognition_categories ADD CONSTRAINT workspace_recognition_categories_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES team_workspaces(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_recognition_ledger_category_id_fkey' AND conrelid = 'public.workspace_recognition_ledger'::regclass
    ) THEN
        ALTER TABLE public.workspace_recognition_ledger ADD CONSTRAINT workspace_recognition_ledger_category_id_fkey FOREIGN KEY (category_id) REFERENCES workspace_recognition_categories(id) ON DELETE RESTRICT;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_recognition_ledger_department_id_fkey' AND conrelid = 'public.workspace_recognition_ledger'::regclass
    ) THEN
        ALTER TABLE public.workspace_recognition_ledger ADD CONSTRAINT workspace_recognition_ledger_department_id_fkey FOREIGN KEY (department_id) REFERENCES workspace_departments(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_recognition_ledger_issuer_id_fkey' AND conrelid = 'public.workspace_recognition_ledger'::regclass
    ) THEN
        ALTER TABLE public.workspace_recognition_ledger ADD CONSTRAINT workspace_recognition_ledger_issuer_id_fkey FOREIGN KEY (issuer_id) REFERENCES users(id) ON DELETE RESTRICT;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_recognition_ledger_linked_task_id_fkey' AND conrelid = 'public.workspace_recognition_ledger'::regclass
    ) THEN
        ALTER TABLE public.workspace_recognition_ledger ADD CONSTRAINT workspace_recognition_ledger_linked_task_id_fkey FOREIGN KEY (linked_task_id) REFERENCES workspace_tasks(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_recognition_ledger_recipient_id_fkey' AND conrelid = 'public.workspace_recognition_ledger'::regclass
    ) THEN
        ALTER TABLE public.workspace_recognition_ledger ADD CONSTRAINT workspace_recognition_ledger_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE RESTRICT;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_recognition_ledger_reference_award_id_fkey' AND conrelid = 'public.workspace_recognition_ledger'::regclass
    ) THEN
        ALTER TABLE public.workspace_recognition_ledger ADD CONSTRAINT workspace_recognition_ledger_reference_award_id_fkey FOREIGN KEY (reference_award_id) REFERENCES workspace_recognition_ledger(id) ON DELETE RESTRICT;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_recognition_ledger_reversed_by_fkey' AND conrelid = 'public.workspace_recognition_ledger'::regclass
    ) THEN
        ALTER TABLE public.workspace_recognition_ledger ADD CONSTRAINT workspace_recognition_ledger_reversed_by_fkey FOREIGN KEY (reversed_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_recognition_ledger_workspace_id_fkey' AND conrelid = 'public.workspace_recognition_ledger'::regclass
    ) THEN
        ALTER TABLE public.workspace_recognition_ledger ADD CONSTRAINT workspace_recognition_ledger_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES team_workspaces(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_recognition_notes_author_id_fkey' AND conrelid = 'public.workspace_recognition_notes'::regclass
    ) THEN
        ALTER TABLE public.workspace_recognition_notes ADD CONSTRAINT workspace_recognition_notes_author_id_fkey FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE RESTRICT;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_recognition_notes_award_id_fkey' AND conrelid = 'public.workspace_recognition_notes'::regclass
    ) THEN
        ALTER TABLE public.workspace_recognition_notes ADD CONSTRAINT workspace_recognition_notes_award_id_fkey FOREIGN KEY (award_id) REFERENCES workspace_recognition_ledger(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_recognition_notes_workspace_id_fkey' AND conrelid = 'public.workspace_recognition_notes'::regclass
    ) THEN
        ALTER TABLE public.workspace_recognition_notes ADD CONSTRAINT workspace_recognition_notes_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES team_workspaces(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_recognition_period_aggregates_user_id_fkey' AND conrelid = 'public.workspace_recognition_period_aggregates'::regclass
    ) THEN
        ALTER TABLE public.workspace_recognition_period_aggregates ADD CONSTRAINT workspace_recognition_period_aggregates_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_recognition_period_aggregates_workspace_id_fkey' AND conrelid = 'public.workspace_recognition_period_aggregates'::regclass
    ) THEN
        ALTER TABLE public.workspace_recognition_period_aggregates ADD CONSTRAINT workspace_recognition_period_aggregates_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES team_workspaces(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_recognition_policies_updated_by_fkey' AND conrelid = 'public.workspace_recognition_policies'::regclass
    ) THEN
        ALTER TABLE public.workspace_recognition_policies ADD CONSTRAINT workspace_recognition_policies_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_recognition_policies_workspace_id_fkey' AND conrelid = 'public.workspace_recognition_policies'::regclass
    ) THEN
        ALTER TABLE public.workspace_recognition_policies ADD CONSTRAINT workspace_recognition_policies_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES team_workspaces(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_roles_workspace_id_fkey' AND conrelid = 'public.workspace_roles'::regclass
    ) THEN
        ALTER TABLE public.workspace_roles ADD CONSTRAINT workspace_roles_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES team_workspaces(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_task_activity_actor_id_fkey' AND conrelid = 'public.workspace_task_activity'::regclass
    ) THEN
        ALTER TABLE public.workspace_task_activity ADD CONSTRAINT workspace_task_activity_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE RESTRICT;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_task_activity_task_id_fkey' AND conrelid = 'public.workspace_task_activity'::regclass
    ) THEN
        ALTER TABLE public.workspace_task_activity ADD CONSTRAINT workspace_task_activity_task_id_fkey FOREIGN KEY (task_id) REFERENCES workspace_tasks(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_task_activity_workspace_id_fkey' AND conrelid = 'public.workspace_task_activity'::regclass
    ) THEN
        ALTER TABLE public.workspace_task_activity ADD CONSTRAINT workspace_task_activity_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES team_workspaces(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_task_assignments_assigned_by_fkey' AND conrelid = 'public.workspace_task_assignments'::regclass
    ) THEN
        ALTER TABLE public.workspace_task_assignments ADD CONSTRAINT workspace_task_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE RESTRICT;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_task_assignments_member_id_fkey' AND conrelid = 'public.workspace_task_assignments'::regclass
    ) THEN
        ALTER TABLE public.workspace_task_assignments ADD CONSTRAINT workspace_task_assignments_member_id_fkey FOREIGN KEY (member_id) REFERENCES workspace_members(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_task_assignments_task_id_fkey' AND conrelid = 'public.workspace_task_assignments'::regclass
    ) THEN
        ALTER TABLE public.workspace_task_assignments ADD CONSTRAINT workspace_task_assignments_task_id_fkey FOREIGN KEY (task_id) REFERENCES workspace_tasks(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_task_assignments_user_id_fkey' AND conrelid = 'public.workspace_task_assignments'::regclass
    ) THEN
        ALTER TABLE public.workspace_task_assignments ADD CONSTRAINT workspace_task_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_task_assignments_workspace_id_fkey' AND conrelid = 'public.workspace_task_assignments'::regclass
    ) THEN
        ALTER TABLE public.workspace_task_assignments ADD CONSTRAINT workspace_task_assignments_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES team_workspaces(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_task_comments_author_id_fkey' AND conrelid = 'public.workspace_task_comments'::regclass
    ) THEN
        ALTER TABLE public.workspace_task_comments ADD CONSTRAINT workspace_task_comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE RESTRICT;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_task_comments_parent_comment_id_fkey' AND conrelid = 'public.workspace_task_comments'::regclass
    ) THEN
        ALTER TABLE public.workspace_task_comments ADD CONSTRAINT workspace_task_comments_parent_comment_id_fkey FOREIGN KEY (parent_comment_id) REFERENCES workspace_task_comments(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_task_comments_task_id_fkey' AND conrelid = 'public.workspace_task_comments'::regclass
    ) THEN
        ALTER TABLE public.workspace_task_comments ADD CONSTRAINT workspace_task_comments_task_id_fkey FOREIGN KEY (task_id) REFERENCES workspace_tasks(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_task_comments_workspace_id_fkey' AND conrelid = 'public.workspace_task_comments'::regclass
    ) THEN
        ALTER TABLE public.workspace_task_comments ADD CONSTRAINT workspace_task_comments_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES team_workspaces(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_task_reviews_reviewer_id_fkey' AND conrelid = 'public.workspace_task_reviews'::regclass
    ) THEN
        ALTER TABLE public.workspace_task_reviews ADD CONSTRAINT workspace_task_reviews_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE RESTRICT;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_task_reviews_submission_id_fkey' AND conrelid = 'public.workspace_task_reviews'::regclass
    ) THEN
        ALTER TABLE public.workspace_task_reviews ADD CONSTRAINT workspace_task_reviews_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES workspace_task_submissions(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_task_reviews_task_id_fkey' AND conrelid = 'public.workspace_task_reviews'::regclass
    ) THEN
        ALTER TABLE public.workspace_task_reviews ADD CONSTRAINT workspace_task_reviews_task_id_fkey FOREIGN KEY (task_id) REFERENCES workspace_tasks(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_task_reviews_workspace_id_fkey' AND conrelid = 'public.workspace_task_reviews'::regclass
    ) THEN
        ALTER TABLE public.workspace_task_reviews ADD CONSTRAINT workspace_task_reviews_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES team_workspaces(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_task_submissions_submitted_by_fkey' AND conrelid = 'public.workspace_task_submissions'::regclass
    ) THEN
        ALTER TABLE public.workspace_task_submissions ADD CONSTRAINT workspace_task_submissions_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES users(id) ON DELETE RESTRICT;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_task_submissions_task_id_fkey' AND conrelid = 'public.workspace_task_submissions'::regclass
    ) THEN
        ALTER TABLE public.workspace_task_submissions ADD CONSTRAINT workspace_task_submissions_task_id_fkey FOREIGN KEY (task_id) REFERENCES workspace_tasks(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_task_submissions_workspace_id_fkey' AND conrelid = 'public.workspace_task_submissions'::regclass
    ) THEN
        ALTER TABLE public.workspace_task_submissions ADD CONSTRAINT workspace_task_submissions_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES team_workspaces(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_task_watchers_task_id_fkey' AND conrelid = 'public.workspace_task_watchers'::regclass
    ) THEN
        ALTER TABLE public.workspace_task_watchers ADD CONSTRAINT workspace_task_watchers_task_id_fkey FOREIGN KEY (task_id) REFERENCES workspace_tasks(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_task_watchers_user_id_fkey' AND conrelid = 'public.workspace_task_watchers'::regclass
    ) THEN
        ALTER TABLE public.workspace_task_watchers ADD CONSTRAINT workspace_task_watchers_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_task_watchers_workspace_id_fkey' AND conrelid = 'public.workspace_task_watchers'::regclass
    ) THEN
        ALTER TABLE public.workspace_task_watchers ADD CONSTRAINT workspace_task_watchers_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES team_workspaces(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_tasks_archived_by_fkey' AND conrelid = 'public.workspace_tasks'::regclass
    ) THEN
        ALTER TABLE public.workspace_tasks ADD CONSTRAINT workspace_tasks_archived_by_fkey FOREIGN KEY (archived_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_tasks_assigned_role_id_fkey' AND conrelid = 'public.workspace_tasks'::regclass
    ) THEN
        ALTER TABLE public.workspace_tasks ADD CONSTRAINT workspace_tasks_assigned_role_id_fkey FOREIGN KEY (assigned_role_id) REFERENCES workspace_roles(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_tasks_creator_id_fkey' AND conrelid = 'public.workspace_tasks'::regclass
    ) THEN
        ALTER TABLE public.workspace_tasks ADD CONSTRAINT workspace_tasks_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE RESTRICT;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_tasks_department_id_fkey' AND conrelid = 'public.workspace_tasks'::regclass
    ) THEN
        ALTER TABLE public.workspace_tasks ADD CONSTRAINT workspace_tasks_department_id_fkey FOREIGN KEY (department_id) REFERENCES workspace_departments(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_tasks_workspace_id_fkey' AND conrelid = 'public.workspace_tasks'::regclass
    ) THEN
        ALTER TABLE public.workspace_tasks ADD CONSTRAINT workspace_tasks_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES team_workspaces(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_thread_participants_thread_id_fkey' AND conrelid = 'public.workspace_thread_participants'::regclass
    ) THEN
        ALTER TABLE public.workspace_thread_participants ADD CONSTRAINT workspace_thread_participants_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES workspace_threads(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_thread_participants_user_id_fkey' AND conrelid = 'public.workspace_thread_participants'::regclass
    ) THEN
        ALTER TABLE public.workspace_thread_participants ADD CONSTRAINT workspace_thread_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_threads_archived_by_fkey' AND conrelid = 'public.workspace_threads'::regclass
    ) THEN
        ALTER TABLE public.workspace_threads ADD CONSTRAINT workspace_threads_archived_by_fkey FOREIGN KEY (archived_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_threads_channel_id_fkey' AND conrelid = 'public.workspace_threads'::regclass
    ) THEN
        ALTER TABLE public.workspace_threads ADD CONSTRAINT workspace_threads_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES workspace_channels(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_threads_creator_id_fkey' AND conrelid = 'public.workspace_threads'::regclass
    ) THEN
        ALTER TABLE public.workspace_threads ADD CONSTRAINT workspace_threads_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE RESTRICT;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_threads_locked_by_fkey' AND conrelid = 'public.workspace_threads'::regclass
    ) THEN
        ALTER TABLE public.workspace_threads ADD CONSTRAINT workspace_threads_locked_by_fkey FOREIGN KEY (locked_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_threads_parent_message_id_fkey' AND conrelid = 'public.workspace_threads'::regclass
    ) THEN
        ALTER TABLE public.workspace_threads ADD CONSTRAINT workspace_threads_parent_message_id_fkey FOREIGN KEY (parent_message_id) REFERENCES workspace_messages(id) ON DELETE CASCADE;
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_threads_workspace_id_fkey' AND conrelid = 'public.workspace_threads'::regclass
    ) THEN
        ALTER TABLE public.workspace_threads ADD CONSTRAINT workspace_threads_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES team_workspaces(id) ON DELETE CASCADE;
    END IF;
END $$;

-- -------------------------------------------------------------------------
-- 5. PERFORMANCE AND SEARCH INDEXES
-- -------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_account_change_challenges_op ON public.account_change_challenges USING btree (operation_id, status);
CREATE INDEX IF NOT EXISTS idx_account_change_challenges_user ON public.account_change_challenges USING btree (user_id, destination);
CREATE INDEX IF NOT EXISTS idx_account_change_history_monthly ON public.account_change_history USING btree (user_id, change_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_account_change_history_old_username ON public.account_change_history USING btree (lower((old_value)::text)) WHERE ((change_type)::text = 'username'::text);
CREATE INDEX IF NOT EXISTS idx_account_change_ops_expires ON public.account_change_operations USING btree (expires_at) WHERE ((stage)::text <> ALL ((ARRAY['completed'::character varying, 'cancelled'::character varying, 'expired'::character varying])::text[]));
CREATE INDEX IF NOT EXISTS idx_account_change_ops_user_stage ON public.account_change_operations USING btree (user_id, stage);
CREATE INDEX IF NOT EXISTS idx_account_data_exports_export_id ON public.account_data_exports USING btree (export_id);
CREATE INDEX IF NOT EXISTS idx_account_data_exports_user ON public.account_data_exports USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_account_deletion_user ON public.account_deletion_requests USING btree (user_id, status);
CREATE INDEX IF NOT EXISTS idx_account_entitlements_user ON public.account_entitlements USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_account_restrictions_user_active ON public.account_restrictions USING btree (user_id, status);
CREATE INDEX IF NOT EXISTS idx_security_events_type ON public.account_security_events USING btree (user_id, event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_user_created ON public.account_security_events USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_account_status_history_user ON public.account_status_history USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_likes_pub ON public.blog_likes USING btree (hoster, blog_name);
CREATE INDEX IF NOT EXISTS idx_blog_likes_user_pub ON public.blog_likes USING btree (user_id, hoster, blog_name);
CREATE INDEX IF NOT EXISTS idx_cert_audit_club ON public.certificate_audit_logs USING btree (club_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cert_audit_entity ON public.certificate_audit_logs USING btree (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_cert_batches_club ON public.certificate_batches USING btree (club_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cert_batches_event ON public.certificate_batches USING btree (event_id);
CREATE INDEX IF NOT EXISTS idx_cert_batches_idempotency ON public.certificate_batches USING btree (idempotency_key) WHERE (idempotency_key IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_cert_batches_status ON public.certificate_batches USING btree (status);
CREATE INDEX IF NOT EXISTS idx_cert_templates_club ON public.certificate_templates USING btree (club_id, status);
CREATE INDEX IF NOT EXISTS idx_cert_templates_created ON public.certificate_templates USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cert_templates_system ON public.certificate_templates USING btree (is_system, category);
CREATE INDEX IF NOT EXISTS idx_club_access_club_created ON public.club_access_events USING btree (club_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_club_access_session ON public.club_access_events USING btree (session_id);
CREATE INDEX IF NOT EXISTS idx_club_access_user ON public.club_access_events USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_club_achievements_club_id ON public.club_achievements USING btree (club_id);
CREATE INDEX IF NOT EXISTS idx_club_achievements_order ON public.club_achievements USING btree (club_id, display_order);
CREATE INDEX IF NOT EXISTS idx_club_certificates_batch ON public.club_certificates USING btree (batch_id);
CREATE INDEX IF NOT EXISTS idx_club_certificates_club ON public.club_certificates USING btree (club_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_club_certificates_club_issue ON public.club_certificates USING btree (club_id, issue_date DESC);
CREATE INDEX IF NOT EXISTS idx_club_certificates_code ON public.club_certificates USING btree (credential_code);
CREATE INDEX IF NOT EXISTS idx_club_certificates_code_lower ON public.club_certificates USING btree (lower((credential_code)::text));
CREATE INDEX IF NOT EXISTS idx_club_certificates_event ON public.club_certificates USING btree (event_id);
CREATE INDEX IF NOT EXISTS idx_club_certificates_revoked ON public.club_certificates USING btree (is_revoked);
CREATE INDEX IF NOT EXISTS idx_club_certificates_sha ON public.club_certificates USING btree (sha256_hash);
CREATE INDEX IF NOT EXISTS idx_club_certificates_team ON public.club_certificates USING btree (team_id);
CREATE INDEX IF NOT EXISTS idx_club_certificates_template ON public.club_certificates USING btree (template_id);
CREATE INDEX IF NOT EXISTS idx_club_certificates_user ON public.club_certificates USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_club_certificates_user_issue ON public.club_certificates USING btree (user_id, issue_date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS unique_club_user_cert_idx ON public.club_certificates USING btree (club_id, user_id, COALESCE(event_id, '00000000-0000-0000-0000-000000000000'::uuid), certificate_type, title);
CREATE INDEX IF NOT EXISTS idx_club_conv_club_time ON public.club_conversations USING btree (club_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_club_conv_club_unread ON public.club_conversations USING btree (club_id, is_read_by_club) WHERE (is_read_by_club = false);
CREATE INDEX IF NOT EXISTS idx_club_conv_user_time ON public.club_conversations USING btree (user_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_club_coordinators_club_id ON public.club_coordinators USING btree (club_id);
CREATE INDEX IF NOT EXISTS idx_club_coordinators_order ON public.club_coordinators USING btree (club_id, display_order);
CREATE INDEX IF NOT EXISTS idx_club_coordinators_user_id ON public.club_coordinators USING btree (linked_user_id);
CREATE INDEX IF NOT EXISTS idx_credibility_appeals_club ON public.club_credibility_appeals USING btree (club_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credibility_appeals_ledger ON public.club_credibility_appeals USING btree (ledger_id);
CREATE INDEX IF NOT EXISTS idx_credibility_appeals_status ON public.club_credibility_appeals USING btree (appeal_status);
CREATE INDEX IF NOT EXISTS idx_credibility_ledger_club_created ON public.club_credibility_ledger USING btree (club_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credibility_ledger_event ON public.club_credibility_ledger USING btree (event_id);
CREATE INDEX IF NOT EXISTS idx_credibility_ledger_source_action ON public.club_credibility_ledger USING btree (source_action);
CREATE INDEX IF NOT EXISTS idx_credibility_ledger_status ON public.club_credibility_ledger USING btree (status);
CREATE INDEX IF NOT EXISTS idx_club_credibility_snapshots_level ON public.club_credibility_snapshots USING btree (score_level);
CREATE INDEX IF NOT EXISTS idx_club_credibility_snapshots_score ON public.club_credibility_snapshots USING btree (current_score DESC);
CREATE INDEX IF NOT EXISTS idx_event_audit_logs_event ON public.club_event_audit_logs USING btree (event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comm_logs_event ON public.club_event_communication_logs USING btree (event_id, trigger_type);
CREATE INDEX IF NOT EXISTS idx_comm_logs_idempotency ON public.club_event_communication_logs USING btree (idempotency_key);
CREATE INDEX IF NOT EXISTS idx_club_creation_hist_club_scope ON public.club_event_creation_history USING btree (club_id, scope, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_evaluations_judge ON public.club_event_evaluations USING btree (judge_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_submission ON public.club_event_evaluations USING btree (submission_id);
CREATE INDEX IF NOT EXISTS idx_club_event_form_versions_event ON public.club_event_form_versions USING btree (event_id);
CREATE INDEX IF NOT EXISTS idx_club_event_form_versions_form ON public.club_event_form_versions USING btree (form_id);
CREATE INDEX IF NOT EXISTS idx_club_event_form_versions_published ON public.club_event_form_versions USING btree (form_id, is_published);
CREATE INDEX IF NOT EXISTS idx_club_event_forms_club ON public.club_event_forms USING btree (club_id);
CREATE INDEX IF NOT EXISTS idx_club_event_forms_event ON public.club_event_forms USING btree (event_id);
CREATE INDEX IF NOT EXISTS idx_event_judges_stage ON public.club_event_judges USING btree (stage_id);
CREATE INDEX IF NOT EXISTS idx_event_judges_user ON public.club_event_judges USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_judging_criteria_stage ON public.club_event_judging_criteria USING btree (stage_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_event_likes_event ON public.club_event_likes USING btree (event_id);
CREATE INDEX IF NOT EXISTS idx_event_likes_user ON public.club_event_likes USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_club_event_reg_email ON public.club_event_registrations USING btree (event_id, lower((applicant_email)::text)) WHERE (applicant_email IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_club_event_reg_event_registered_at ON public.club_event_registrations USING btree (event_id, registered_at DESC);
CREATE INDEX IF NOT EXISTS idx_club_event_reg_event_status ON public.club_event_registrations USING btree (event_id, status);
CREATE INDEX IF NOT EXISTS idx_club_event_reg_event_user ON public.club_event_registrations USING btree (event_id, user_id) WHERE (user_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_club_event_reg_guardian_token ON public.club_event_registrations USING btree (guardian_consent_token) WHERE (guardian_consent_token IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_club_event_reg_idempotency ON public.club_event_registrations USING btree (idempotency_key) WHERE (idempotency_key IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_club_event_reg_institution ON public.club_event_registrations USING btree (institution_id);
CREATE INDEX IF NOT EXISTS idx_club_event_reg_minor_consent ON public.club_event_registrations USING btree (event_id, guardian_consent_status);
CREATE INDEX IF NOT EXISTS idx_club_event_reg_state ON public.club_event_registrations USING btree (institution_state);
CREATE INDEX IF NOT EXISTS idx_club_event_reg_ticket ON public.club_event_registrations USING btree (event_id, ticket_code) WHERE (ticket_code IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_club_event_registrations_event_user ON public.club_event_registrations USING btree (event_id, user_id);
CREATE INDEX IF NOT EXISTS idx_club_event_registrations_form ON public.club_event_registrations USING btree (form_id);
CREATE INDEX IF NOT EXISTS idx_club_event_registrations_idempotency ON public.club_event_registrations USING btree (idempotency_key) WHERE (idempotency_key IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_club_event_registrations_quiz_score ON public.club_event_registrations USING btree (quiz_score) WHERE (quiz_score IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_club_event_registrations_status ON public.club_event_registrations USING btree (event_id, status);
CREATE INDEX IF NOT EXISTS idx_club_event_registrations_version ON public.club_event_registrations USING btree (form_version_id);
CREATE INDEX IF NOT EXISTS idx_event_reg_club ON public.club_event_registrations USING btree (club_id);
CREATE INDEX IF NOT EXISTS idx_event_reg_event ON public.club_event_registrations USING btree (event_id, status);
CREATE INDEX IF NOT EXISTS idx_event_reg_user ON public.club_event_registrations USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_club_event_drafts_event_user ON public.club_event_response_drafts USING btree (event_id, user_id);
CREATE INDEX IF NOT EXISTS idx_club_event_response_drafts_event_version ON public.club_event_response_drafts USING btree (event_id, form_version_id);
CREATE INDEX IF NOT EXISTS idx_club_event_response_drafts_user_event ON public.club_event_response_drafts USING btree (user_id, event_id);
CREATE INDEX IF NOT EXISTS idx_stage_advancements_registration ON public.club_event_stage_advancements USING btree (registration_id);
CREATE INDEX IF NOT EXISTS idx_stage_advancements_to_stage ON public.club_event_stage_advancements USING btree (to_stage_id, status);
CREATE INDEX IF NOT EXISTS idx_event_stage_forms_event ON public.club_event_stage_forms USING btree (event_id);
CREATE INDEX IF NOT EXISTS idx_event_stage_forms_stage ON public.club_event_stage_forms USING btree (stage_id);
CREATE INDEX IF NOT EXISTS idx_stage_submissions_stage_status ON public.club_event_stage_submissions USING btree (stage_id, status);
CREATE INDEX IF NOT EXISTS idx_stage_submissions_team ON public.club_event_stage_submissions USING btree (team_id);
CREATE INDEX IF NOT EXISTS idx_stage_submissions_user ON public.club_event_stage_submissions USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_event_stages_event_order ON public.club_event_stages USING btree (event_id, stage_order);
CREATE INDEX IF NOT EXISTS idx_event_stages_status_dates ON public.club_event_stages USING btree (status, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_submission_assets_submission ON public.club_event_submission_assets USING btree (submission_id);
CREATE INDEX IF NOT EXISTS idx_club_event_team_invites_invitee ON public.club_event_team_invitations USING btree (invitee_user_id, status);
CREATE INDEX IF NOT EXISTS idx_club_event_team_invites_team ON public.club_event_team_invitations USING btree (team_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_club_event_team_members_event_user ON public.club_event_team_members USING btree (event_id, user_id);
CREATE INDEX IF NOT EXISTS idx_club_event_team_members_team ON public.club_event_team_members USING btree (team_id);
CREATE INDEX IF NOT EXISTS idx_club_event_teams_event_leader ON public.club_event_teams USING btree (event_id, leader_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_club_event_teams_event_name_lower ON public.club_event_teams USING btree (event_id, lower((name)::text));
CREATE INDEX IF NOT EXISTS idx_club_events_capacity_reg ON public.club_events USING btree (id, capacity, registered_count);
CREATE INDEX IF NOT EXISTS idx_club_events_club_id ON public.club_events USING btree (club_id);
CREATE INDEX IF NOT EXISTS idx_club_events_club_starts ON public.club_events USING btree (club_id, starts_at DESC);
CREATE INDEX IF NOT EXISTS idx_club_events_scope ON public.club_events USING btree (scope);
CREATE INDEX IF NOT EXISTS idx_club_events_scope_status ON public.club_events USING btree (scope, status);
CREATE INDEX IF NOT EXISTS idx_club_events_status_starts ON public.club_events USING btree (status, starts_at);
CREATE INDEX IF NOT EXISTS idx_club_form_media_assets_event ON public.club_form_media_assets USING btree (event_id);
CREATE INDEX IF NOT EXISTS idx_club_form_media_assets_form ON public.club_form_media_assets USING btree (form_id);
CREATE INDEX IF NOT EXISTS idx_club_form_media_assets_response ON public.club_form_media_assets USING btree (response_id);
CREATE INDEX IF NOT EXISTS idx_club_memberships_club ON public.club_memberships USING btree (club_id);
CREATE INDEX IF NOT EXISTS idx_club_memberships_user ON public.club_memberships USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_club_msg_logs_pair_time ON public.club_message_action_logs USING btree (user_id, club_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_club_msg_logs_user_time ON public.club_message_action_logs USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_club_msgs_club_time ON public.club_messages USING btree (club_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_club_msgs_conv_time ON public.club_messages USING btree (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_club_team_invitations_club ON public.club_team_invitations USING btree (club_id, status);
CREATE INDEX IF NOT EXISTS idx_club_team_invitations_user ON public.club_team_invitations USING btree (invited_user_id, status);
CREATE INDEX IF NOT EXISTS idx_club_team_members_team ON public.club_team_members USING btree (team_id);
CREATE INDEX IF NOT EXISTS idx_club_team_members_user ON public.club_team_members USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_club_teams_club_id ON public.club_teams USING btree (club_id);
CREATE INDEX IF NOT EXISTS idx_club_teams_lead ON public.club_teams USING btree (lead_user_id);
CREATE INDEX IF NOT EXISTS idx_club_mod_blocked ON public.club_user_moderation USING btree (club_id) WHERE (is_blocked = true);
CREATE INDEX IF NOT EXISTS idx_club_mod_lookup ON public.club_user_moderation USING btree (club_id, user_id);
CREATE INDEX IF NOT EXISTS idx_club_mod_muted ON public.club_user_moderation USING btree (club_id) WHERE (is_muted = true);
CREATE UNIQUE INDEX IF NOT EXISTS club_verification_one_active_request_per_user ON public.club_verification_requests USING btree (auth_user_id) WHERE (status = ANY (ARRAY['pending'::text, 'under_review'::text, 'needs_information'::text, 'ready_for_promotion'::text]));
CREATE INDEX IF NOT EXISTS idx_club_verification_contact_phone ON public.club_verification_requests USING btree (contact_phone);
CREATE INDEX IF NOT EXISTS idx_club_verification_requests_college_id ON public.club_verification_requests USING btree (college_id);
CREATE INDEX IF NOT EXISTS idx_club_verification_requests_status ON public.club_verification_requests USING btree (status);
CREATE INDEX IF NOT EXISTS idx_club_verification_requests_submitted_at ON public.club_verification_requests USING btree (submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_club_verification_requests_user ON public.club_verification_requests USING btree (auth_user_id);
CREATE INDEX IF NOT EXISTS idx_col_verif_email_tokens_hash ON public.college_verification_email_tokens USING btree (token_hash);
CREATE INDEX IF NOT EXISTS idx_col_verif_email_tokens_user ON public.college_verification_email_tokens USING btree (user_id, status);
CREATE INDEX IF NOT EXISTS idx_col_verif_phone_otps_phone ON public.college_verification_phone_otps USING btree (phone, status);
CREATE INDEX IF NOT EXISTS idx_col_verif_phone_otps_user ON public.college_verification_phone_otps USING btree (user_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_college_verifications_active_user ON public.college_verifications USING btree (user_id) WHERE ((status)::text = ANY ((ARRAY['PENDING'::character varying, 'PROCESSING'::character varying])::text[]));
CREATE UNIQUE INDEX IF NOT EXISTS idx_college_verifications_approved_user ON public.college_verifications USING btree (user_id) WHERE ((status)::text = 'APPROVED'::text);
CREATE INDEX IF NOT EXISTS idx_college_verifications_college ON public.college_verifications USING btree (college_id);
CREATE INDEX IF NOT EXISTS idx_college_verifications_enrollment ON public.college_verifications USING btree (enrollment_number) WHERE (enrollment_number IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_college_verifications_status_created ON public.college_verifications USING btree (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_college_verifications_user ON public.college_verifications USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_verification_email ON public.email_verification_otps USING btree (email);
CREATE INDEX IF NOT EXISTS idx_email_verification_user ON public.email_verification_otps USING btree (user_id, status);
CREATE INDEX IF NOT EXISTS idx_help_faq_feedback_faq ON public.help_faq_feedback USING btree (faq_id);
CREATE INDEX IF NOT EXISTS idx_help_faqs_category ON public.help_faqs USING btree (category, order_index);
CREATE INDEX IF NOT EXISTS idx_help_faqs_published ON public.help_faqs USING btree (is_published);
CREATE INDEX IF NOT EXISTS idx_help_ticket_att_ticket ON public.help_ticket_attachments USING btree (ticket_id);
CREATE INDEX IF NOT EXISTS idx_help_ticket_msgs_ticket_id ON public.help_ticket_messages USING btree (ticket_id);
CREATE INDEX IF NOT EXISTS idx_help_tickets_created_at ON public.help_tickets USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_help_tickets_status ON public.help_tickets USING btree (status);
CREATE INDEX IF NOT EXISTS idx_help_tickets_ticket_num ON public.help_tickets USING btree (ticket_number);
CREATE INDEX IF NOT EXISTS idx_help_tickets_user_id ON public.help_tickets USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_inst_aliases_alias ON public.institution_aliases USING btree (lower((alias)::text) varchar_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_inst_aliases_inst_id ON public.institution_aliases USING btree (institution_id);
CREATE INDEX IF NOT EXISTS idx_inst_rankings_inst ON public.institution_rankings USING btree (institution_id);
CREATE INDEX IF NOT EXISTS idx_institution_regulatory_ids_institution ON public.institution_regulatory_ids USING btree (institution_id);
CREATE INDEX IF NOT EXISTS idx_institution_sources_institution ON public.institution_sources USING btree (institution_id);
CREATE INDEX IF NOT EXISTS idx_verification_requests_status ON public.institution_verification_requests USING btree (status);
CREATE INDEX IF NOT EXISTS idx_verification_requests_user ON public.institution_verification_requests USING btree (submitted_by_user_id);
CREATE INDEX IF NOT EXISTS idx_institutions_aishe_code ON public.institutions USING btree (aishe_code) WHERE (aishe_code IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_institutions_city_lower ON public.institutions USING btree (lower((city)::text));
CREATE INDEX IF NOT EXISTS idx_institutions_district_lower ON public.institutions USING btree (lower((district)::text));
CREATE INDEX IF NOT EXISTS idx_institutions_normalized_name ON public.institutions USING btree (normalized_name varchar_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_institutions_state ON public.institutions USING btree (state);
CREATE INDEX IF NOT EXISTS idx_institutions_status_active ON public.institutions USING btree (verification_status, is_active) WHERE (((verification_status)::text = 'verified'::text) AND (is_active = true));
CREATE INDEX IF NOT EXISTS idx_institutions_trgm_name ON public.institutions USING gin (normalized_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_leaderboard_college_id ON public.leaderboard_entries USING btree (college_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_college_score ON public.leaderboard_entries USING btree (college_id, score DESC, total_solved DESC, username) WHERE ((is_public = true) AND (college_id IS NOT NULL));
CREATE INDEX IF NOT EXISTS idx_leaderboard_global_rank ON public.leaderboard_entries USING btree (global_rank);
CREATE INDEX IF NOT EXISTS idx_leaderboard_is_public ON public.leaderboard_entries USING btree (is_public);
CREATE INDEX IF NOT EXISTS idx_leaderboard_score_rank ON public.leaderboard_entries USING btree (score DESC, total_solved DESC, username);
CREATE INDEX IF NOT EXISTS idx_leaderboard_username ON public.leaderboard_entries USING btree (username);
CREATE INDEX IF NOT EXISTS idx_phone_verification_expires ON public.phone_verification_otps USING btree (expires_at);
CREATE INDEX IF NOT EXISTS idx_phone_verification_phone ON public.phone_verification_otps USING btree (phone, status);
CREATE INDEX IF NOT EXISTS idx_photo_cleanup_queue_status ON public.photo_cleanup_queue USING btree (status);
CREATE INDEX IF NOT EXISTS idx_photo_upload_intents_public_id ON public.photo_upload_intents USING btree (public_id);
CREATE INDEX IF NOT EXISTS idx_photo_upload_intents_user ON public.photo_upload_intents USING btree (username, status);
CREATE INDEX IF NOT EXISTS idx_privacy_audit_user ON public.privacy_request_audit USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recruiter_messages_created_at ON public.recruiter_messages USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recruiter_messages_recipient ON public.recruiter_messages USING btree (recipient_username);
CREATE INDEX IF NOT EXISTS idx_resume_analyses_resume ON public.resume_analyses USING btree (resume_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_resume_analyses_upload ON public.resume_analyses USING btree (resume_upload_id);
CREATE INDEX IF NOT EXISTS idx_resume_analyses_user ON public.resume_analyses USING btree (username, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_resume_cleanup_queue_status ON public.resume_cleanup_queue USING btree (status);
CREATE INDEX IF NOT EXISTS idx_resume_sync_reviews_upload ON public.resume_profile_sync_reviews USING btree (resume_upload_id);
CREATE INDEX IF NOT EXISTS idx_resume_sync_reviews_user ON public.resume_profile_sync_reviews USING btree (username, review_status);
CREATE INDEX IF NOT EXISTS idx_resume_upload_intents_public_id ON public.resume_upload_intents USING btree (public_id);
CREATE INDEX IF NOT EXISTS idx_resume_upload_intents_user ON public.resume_upload_intents USING btree (username, status);
CREATE INDEX IF NOT EXISTS idx_resume_uploads_checksum ON public.resume_uploads USING btree (checksum);
CREATE INDEX IF NOT EXISTS idx_resume_uploads_sync ON public.resume_uploads USING btree (username, sync_review_status);
CREATE INDEX IF NOT EXISTS idx_resume_uploads_username ON public.resume_uploads USING btree (username, uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_resume_versions_resume ON public.resume_versions USING btree (resume_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_team_workspaces_club_id ON public.team_workspaces USING btree (club_id);
CREATE INDEX IF NOT EXISTS idx_team_workspaces_manager ON public.team_workspaces USING btree (manager_user_id);
CREATE INDEX IF NOT EXISTS idx_team_workspaces_owner ON public.team_workspaces USING btree (owner_id);
CREATE INDEX IF NOT EXISTS idx_team_workspaces_slug ON public.team_workspaces USING btree (slug);
CREATE INDEX IF NOT EXISTS idx_team_workspaces_status ON public.team_workspaces USING btree (workspace_status);
CREATE INDEX IF NOT EXISTS idx_blocks_blocked_blocker ON public.user_blocks USING btree (blocked_id, blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocks_blocker_blocked ON public.user_blocks USING btree (blocker_id, blocked_id);
CREATE INDEX IF NOT EXISTS idx_blocks_created_at ON public.user_blocks USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_gh_install_user ON public.user_github_installations USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_user_legal_consents_created ON public.user_legal_consents USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_legal_consents_type ON public.user_legal_consents USING btree (user_id, document_type);
CREATE INDEX IF NOT EXISTS idx_user_legal_consents_user ON public.user_legal_consents USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_user_links_portal ON public.user_links USING btree (portal);
CREATE INDEX IF NOT EXISTS idx_user_links_portal_handle ON public.user_links USING btree (portal, portal_username);
CREATE INDEX IF NOT EXISTS idx_user_links_username ON public.user_links USING btree (username);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.user_notifications USING btree (recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread ON public.user_notifications USING btree (recipient_id, is_read) WHERE (is_read = false);
CREATE INDEX IF NOT EXISTS idx_notifications_relationship ON public.user_notifications USING btree (relationship_id);
CREATE INDEX IF NOT EXISTS idx_notifications_sliding_window ON public.user_notifications USING btree (actor_id, recipient_id, is_user_initiated, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_notifications_unread ON public.user_notifications USING btree (username, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_notifications_username ON public.user_notifications USING btree (username, is_read);
CREATE INDEX IF NOT EXISTS idx_user_projects_dev_status ON public.user_projects USING btree (development_status);
CREATE INDEX IF NOT EXISTS idx_user_projects_extraction ON public.user_projects USING btree (extraction_status, extraction_completeness);
CREATE INDEX IF NOT EXISTS idx_user_projects_private ON public.user_projects USING btree (is_repo_private);
CREATE INDEX IF NOT EXISTS idx_user_projects_provider_owner ON public.user_projects USING btree (repository_provider, repository_owner);
CREATE INDEX IF NOT EXISTS idx_user_projects_published ON public.user_projects USING btree (user_id, is_published);
CREATE INDEX IF NOT EXISTS idx_user_projects_show_profile ON public.user_projects USING btree (user_id, show_on_profile) WHERE (show_on_profile = true);
CREATE INDEX IF NOT EXISTS idx_user_projects_slug ON public.user_projects USING btree (slug);
CREATE INDEX IF NOT EXISTS idx_user_projects_synced ON public.user_projects USING btree (last_synced_at);
CREATE INDEX IF NOT EXISTS idx_user_projects_type ON public.user_projects USING btree (project_type);
CREATE INDEX IF NOT EXISTS idx_user_projects_user_id ON public.user_projects USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_user_projects_user_order ON public.user_projects USING btree (user_id, display_order, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_projects_user_slug ON public.user_projects USING btree (user_id, slug);
CREATE INDEX IF NOT EXISTS idx_user_projects_visibility ON public.user_projects USING btree (is_published, show_on_profile);
CREATE INDEX IF NOT EXISTS idx_rel_action_logs_actor_target ON public.user_relationship_action_logs USING btree (actor_id, target_id, action_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rel_action_logs_actor_type_time ON public.user_relationship_action_logs USING btree (actor_id, action_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rel_action_logs_created_at ON public.user_relationship_action_logs USING btree (created_at);
CREATE INDEX IF NOT EXISTS idx_relationships_high ON public.user_relationships USING btree (user_high_id, status);
CREATE INDEX IF NOT EXISTS idx_relationships_high_pending ON public.user_relationships USING btree (user_high_id, requested_by, created_at DESC) WHERE ((status)::text = 'pending'::text);
CREATE INDEX IF NOT EXISTS idx_relationships_last_action ON public.user_relationships USING btree (last_action_at DESC);
CREATE INDEX IF NOT EXISTS idx_relationships_low ON public.user_relationships USING btree (user_low_id, status);
CREATE INDEX IF NOT EXISTS idx_relationships_low_pending ON public.user_relationships USING btree (user_low_id, requested_by, created_at DESC) WHERE ((status)::text = 'pending'::text);
CREATE INDEX IF NOT EXISTS idx_relationships_requested_by_pending ON public.user_relationships USING btree (requested_by, created_at DESC) WHERE ((status)::text = 'pending'::text);
CREATE INDEX IF NOT EXISTS idx_relationships_status ON public.user_relationships USING btree (status);
CREATE INDEX IF NOT EXISTS idx_user_resumes_updated ON public.user_resumes USING btree (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_resumes_user ON public.user_resumes USING btree (username, is_primary);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON public.user_sessions USING btree (user_id, status) WHERE ((status)::text = 'active'::text);
CREATE INDEX IF NOT EXISTS idx_user_sessions_device_hash ON public.user_sessions USING btree (user_id, device_id_hash);
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_id ON public.user_sessions USING btree (session_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_created ON public.user_sessions USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_account_type ON public.users USING btree (account_type);
CREATE INDEX IF NOT EXISTS idx_users_college_id ON public.users USING btree (college_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_github_id ON public.users USING btree (github_id) WHERE (github_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON public.users USING btree (google_id) WHERE (google_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_users_is_public ON public.users USING btree (is_public);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_lower_email ON public.users USING btree (lower((email)::text));
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_lower_username ON public.users USING btree (lower((username)::text));
CREATE INDEX IF NOT EXISTS idx_users_orbix_score ON public.users USING btree (orbix_score DESC, username);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_unique ON public.users USING btree (lower(TRIM(BOTH FROM phone))) WHERE ((phone IS NOT NULL) AND (TRIM(BOTH FROM phone) <> ''::text));
CREATE INDEX IF NOT EXISTS idx_users_two_factor ON public.users USING btree (is_two_factor_enabled) WHERE (is_two_factor_enabled = true);
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users USING btree (username);
CREATE INDEX IF NOT EXISTS idx_verified_clubs_active ON public.verified_clubs USING btree (is_active);
CREATE INDEX IF NOT EXISTS idx_verified_clubs_college_id ON public.verified_clubs USING btree (college_id);
CREATE INDEX IF NOT EXISTS idx_verified_clubs_college_visibility ON public.verified_clubs USING btree (college_id, visibility);
CREATE UNIQUE INDEX IF NOT EXISTS idx_verified_clubs_lower_slug ON public.verified_clubs USING btree (lower(slug));
CREATE UNIQUE INDEX IF NOT EXISTS idx_verified_clubs_slug ON public.verified_clubs USING btree (slug);
CREATE UNIQUE INDEX IF NOT EXISTS idx_verified_clubs_user ON public.verified_clubs USING btree (auth_user_id);
CREATE INDEX IF NOT EXISTS idx_verified_clubs_visibility ON public.verified_clubs USING btree (visibility);
CREATE INDEX IF NOT EXISTS idx_workspace_activity_feed_actor ON public.workspace_activity_feed USING btree (workspace_id, actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workspace_activity_feed_correlation ON public.workspace_activity_feed USING btree (workspace_id, correlation_id) WHERE (correlation_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_workspace_activity_feed_cursor ON public.workspace_activity_feed USING btree (workspace_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_workspace_activity_feed_dept ON public.workspace_activity_feed USING btree (workspace_id, department_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workspace_activity_feed_event ON public.workspace_activity_feed USING btree (workspace_id, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workspace_activity_feed_ws_created ON public.workspace_activity_feed USING btree (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workspace_audit_action ON public.workspace_audit_logs USING btree (workspace_id, action);
CREATE INDEX IF NOT EXISTS idx_workspace_audit_actor ON public.workspace_audit_logs USING btree (actor_id);
CREATE INDEX IF NOT EXISTS idx_workspace_audit_logs_actor_created ON public.workspace_audit_logs USING btree (workspace_id, actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workspace_audit_logs_correlation ON public.workspace_audit_logs USING btree (workspace_id, correlation_id) WHERE (correlation_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_workspace_audit_logs_cursor ON public.workspace_audit_logs USING btree (workspace_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_workspace_audit_logs_filter ON public.workspace_audit_logs USING btree (workspace_id, action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workspace_audit_logs_target ON public.workspace_audit_logs USING btree (workspace_id, target_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workspace_audit_ws_created ON public.workspace_audit_logs USING btree (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workspace_channel_categories_dept ON public.workspace_channel_categories USING btree (workspace_id, department_id);
CREATE INDEX IF NOT EXISTS idx_workspace_channel_categories_ws ON public.workspace_channel_categories USING btree (workspace_id, display_order);
CREATE UNIQUE INDEX IF NOT EXISTS uq_category_member_override ON public.workspace_channel_overrides USING btree (category_id, member_id) WHERE ((category_id IS NOT NULL) AND (member_id IS NOT NULL));
CREATE UNIQUE INDEX IF NOT EXISTS uq_category_role_override ON public.workspace_channel_overrides USING btree (category_id, role_id) WHERE ((category_id IS NOT NULL) AND (role_id IS NOT NULL));
CREATE UNIQUE INDEX IF NOT EXISTS uq_channel_member_override ON public.workspace_channel_overrides USING btree (channel_id, member_id) WHERE ((channel_id IS NOT NULL) AND (member_id IS NOT NULL));
CREATE UNIQUE INDEX IF NOT EXISTS uq_channel_role_override ON public.workspace_channel_overrides USING btree (channel_id, role_id) WHERE ((channel_id IS NOT NULL) AND (role_id IS NOT NULL));
CREATE INDEX IF NOT EXISTS idx_workspace_notif_member ON public.workspace_channel_read_states USING btree (member_id);
CREATE INDEX IF NOT EXISTS idx_workspace_channel_reads_user ON public.workspace_channel_reads USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_channels_cat ON public.workspace_channels USING btree (workspace_id, category_id, "position");
CREATE INDEX IF NOT EXISTS idx_workspace_channels_dept ON public.workspace_channels USING btree (workspace_id, department_id);
CREATE INDEX IF NOT EXISTS idx_workspace_channels_search_name ON public.workspace_channels USING btree (workspace_id, name);
CREATE INDEX IF NOT EXISTS idx_workspace_channels_visibility ON public.workspace_channels USING btree (workspace_id, is_private, is_archived);
CREATE INDEX IF NOT EXISTS idx_workspace_channels_ws ON public.workspace_channels USING btree (workspace_id, is_archived);
CREATE INDEX IF NOT EXISTS idx_dept_members_dept ON public.workspace_department_members USING btree (department_id);
CREATE INDEX IF NOT EXISTS idx_dept_members_member ON public.workspace_department_members USING btree (member_id);
CREATE INDEX IF NOT EXISTS idx_dept_members_role ON public.workspace_department_members USING btree (department_id, department_role);
CREATE INDEX IF NOT EXISTS idx_dept_members_user ON public.workspace_department_members USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_dept_members_ws ON public.workspace_department_members USING btree (workspace_id);
CREATE INDEX IF NOT EXISTS idx_ws_dept_transfers_from_dept ON public.workspace_department_transfers USING btree (from_department_id);
CREATE INDEX IF NOT EXISTS idx_ws_dept_transfers_to_dept ON public.workspace_department_transfers USING btree (to_department_id);
CREATE INDEX IF NOT EXISTS idx_ws_dept_transfers_ws_created ON public.workspace_department_transfers USING btree (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ws_dept_transfers_ws_user ON public.workspace_department_transfers USING btree (workspace_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workspace_departments_lead ON public.workspace_departments USING btree (lead_user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_departments_ws ON public.workspace_departments USING btree (workspace_id, display_order);
CREATE INDEX IF NOT EXISTS idx_workspace_email_deliveries_recipient ON public.workspace_email_deliveries USING btree (recipient_id, email_type);
CREATE INDEX IF NOT EXISTS idx_workspace_email_deliveries_resend_id ON public.workspace_email_deliveries USING btree (resend_id) WHERE (resend_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_workspace_email_deliveries_workspace ON public.workspace_email_deliveries USING btree (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workspace_upload_intents_exp ON public.workspace_file_upload_intents USING btree (expires_at);
CREATE INDEX IF NOT EXISTS idx_workspace_upload_intents_user ON public.workspace_file_upload_intents USING btree (user_id, status);
CREATE INDEX IF NOT EXISTS idx_workspace_upload_intents_ws ON public.workspace_file_upload_intents USING btree (workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_workspace_files_channel ON public.workspace_files USING btree (channel_id);
CREATE INDEX IF NOT EXISTS idx_workspace_files_checksum ON public.workspace_files USING btree (workspace_id, checksum);
CREATE INDEX IF NOT EXISTS idx_workspace_files_dept ON public.workspace_files USING btree (workspace_id, department_id);
CREATE INDEX IF NOT EXISTS idx_workspace_files_message ON public.workspace_files USING btree (message_id);
CREATE INDEX IF NOT EXISTS idx_workspace_files_parent ON public.workspace_files USING btree (parent_resource_type, parent_resource_id);
CREATE INDEX IF NOT EXISTS idx_workspace_files_search_name ON public.workspace_files USING btree (workspace_id, file_name);
CREATE INDEX IF NOT EXISTS idx_workspace_files_status ON public.workspace_files USING btree (workspace_id, asset_status);
CREATE INDEX IF NOT EXISTS idx_workspace_files_submission ON public.workspace_files USING btree (submission_id);
CREATE INDEX IF NOT EXISTS idx_workspace_files_task ON public.workspace_files USING btree (task_id);
CREATE INDEX IF NOT EXISTS idx_workspace_files_ws ON public.workspace_files USING btree (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_email ON public.workspace_invitations USING btree (workspace_id, lower((email)::text));
CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_invitations_token_hash ON public.workspace_invitations USING btree (token_hash);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_user ON public.workspace_invitations USING btree (invited_user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_ws_status ON public.workspace_invitations USING btree (workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_workspace_members_dept ON public.workspace_members USING btree (workspace_id, department_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_role ON public.workspace_members USING btree (workspace_id, role_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON public.workspace_members USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_ws_status ON public.workspace_members USING btree (workspace_id, membership_status);
CREATE INDEX IF NOT EXISTS idx_workspace_reactions_msg ON public.workspace_message_reactions USING btree (message_id);
CREATE INDEX IF NOT EXISTS idx_workspace_messages_feed ON public.workspace_messages USING btree (channel_id, created_at DESC) WHERE ((is_deleted = false) AND (thread_id IS NULL));
CREATE INDEX IF NOT EXISTS idx_workspace_messages_pinned ON public.workspace_messages USING btree (channel_id) WHERE ((is_pinned = true) AND (is_deleted = false));
CREATE INDEX IF NOT EXISTS idx_workspace_messages_search_content ON public.workspace_messages USING btree (workspace_id, channel_id);
CREATE INDEX IF NOT EXISTS idx_workspace_messages_sender ON public.workspace_messages USING btree (workspace_id, sender_id);
CREATE INDEX IF NOT EXISTS idx_workspace_messages_thread ON public.workspace_messages USING btree (thread_id, created_at) WHERE ((is_deleted = false) AND (thread_id IS NOT NULL));
CREATE INDEX IF NOT EXISTS idx_workspace_notifications_recipient_created ON public.workspace_notifications USING btree (recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workspace_notifications_recipient_read ON public.workspace_notifications USING btree (workspace_id, recipient_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workspace_notifications_resource ON public.workspace_notifications USING btree (workspace_id, resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_workspace_outbox_events_status ON public.workspace_outbox_events USING btree (status, created_at) WHERE ((status)::text = ANY ((ARRAY['pending'::character varying, 'failed'::character varying])::text[]));
CREATE INDEX IF NOT EXISTS idx_workspace_outbox_events_workspace ON public.workspace_outbox_events USING btree (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workspace_perm_overrides_dept ON public.workspace_permission_overrides USING btree (workspace_id, department_id);
CREATE INDEX IF NOT EXISTS idx_workspace_perm_overrides_member ON public.workspace_permission_overrides USING btree (workspace_id, member_id);
CREATE INDEX IF NOT EXISTS idx_recognition_budgets_lookup ON public.workspace_recognition_budgets USING btree (workspace_id, user_id, year_month);
CREATE INDEX IF NOT EXISTS idx_recognition_categories_ws_active ON public.workspace_recognition_categories USING btree (workspace_id, is_active, display_order);
CREATE INDEX IF NOT EXISTS idx_recognition_categories_ws_slug ON public.workspace_recognition_categories USING btree (workspace_id, slug);
CREATE INDEX IF NOT EXISTS idx_recognition_ledger_idempotency ON public.workspace_recognition_ledger USING btree (workspace_id, idempotency_key) WHERE (idempotency_key IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_recognition_ledger_ref_award ON public.workspace_recognition_ledger USING btree (reference_award_id) WHERE (reference_award_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_recognition_ledger_ws_dept ON public.workspace_recognition_ledger USING btree (workspace_id, department_id, created_at DESC) WHERE (department_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_recognition_ledger_ws_issuer ON public.workspace_recognition_ledger USING btree (workspace_id, issuer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recognition_ledger_ws_recipient ON public.workspace_recognition_ledger USING btree (workspace_id, recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recognition_ledger_ws_visibility ON public.workspace_recognition_ledger USING btree (workspace_id, visibility);
CREATE INDEX IF NOT EXISTS idx_recognition_notes_award ON public.workspace_recognition_notes USING btree (award_id, created_at);
CREATE INDEX IF NOT EXISTS idx_recognition_aggregates_leaderboard ON public.workspace_recognition_period_aggregates USING btree (workspace_id, period_type, period_key, total_orbits_received DESC);
CREATE INDEX IF NOT EXISTS idx_workspace_roles_ws_rank ON public.workspace_roles USING btree (workspace_id, rank DESC);
CREATE INDEX IF NOT EXISTS idx_workspace_task_activity_task ON public.workspace_task_activity USING btree (task_id, created_at);
CREATE INDEX IF NOT EXISTS idx_workspace_task_activity_ws ON public.workspace_task_activity USING btree (workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_task_assignments_member ON public.workspace_task_assignments USING btree (member_id, is_active);
CREATE INDEX IF NOT EXISTS idx_workspace_task_assignments_task ON public.workspace_task_assignments USING btree (task_id, is_active);
CREATE INDEX IF NOT EXISTS idx_workspace_task_assignments_user ON public.workspace_task_assignments USING btree (user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_workspace_task_assignments_ws ON public.workspace_task_assignments USING btree (workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_task_comments_parent ON public.workspace_task_comments USING btree (parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_workspace_task_comments_task ON public.workspace_task_comments USING btree (task_id, created_at);
CREATE INDEX IF NOT EXISTS idx_workspace_task_comments_ws ON public.workspace_task_comments USING btree (workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_task_reviews_sub ON public.workspace_task_reviews USING btree (submission_id);
CREATE INDEX IF NOT EXISTS idx_workspace_task_reviews_task ON public.workspace_task_reviews USING btree (task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workspace_task_reviews_ws ON public.workspace_task_reviews USING btree (workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_task_submissions_task ON public.workspace_task_submissions USING btree (task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workspace_task_submissions_ws ON public.workspace_task_submissions USING btree (workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_task_watchers_task ON public.workspace_task_watchers USING btree (task_id);
CREATE INDEX IF NOT EXISTS idx_workspace_task_watchers_user ON public.workspace_task_watchers USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_task_watchers_ws ON public.workspace_task_watchers USING btree (workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_tasks_accountability_status_due ON public.workspace_tasks USING btree (workspace_id, status, due_date) WHERE (is_archived = false);
CREATE INDEX IF NOT EXISTS idx_workspace_tasks_archived ON public.workspace_tasks USING btree (workspace_id, is_archived);
CREATE INDEX IF NOT EXISTS idx_workspace_tasks_creator ON public.workspace_tasks USING btree (workspace_id, creator_id);
CREATE INDEX IF NOT EXISTS idx_workspace_tasks_department_status_due ON public.workspace_tasks USING btree (department_id, status, due_date) WHERE (is_archived = false);
CREATE INDEX IF NOT EXISTS idx_workspace_tasks_dept_completed ON public.workspace_tasks USING btree (workspace_id, department_id, completed_at);
CREATE INDEX IF NOT EXISTS idx_workspace_tasks_dept_due ON public.workspace_tasks USING btree (workspace_id, department_id, due_date);
CREATE INDEX IF NOT EXISTS idx_workspace_tasks_dept_status ON public.workspace_tasks USING btree (workspace_id, department_id, status);
CREATE INDEX IF NOT EXISTS idx_workspace_tasks_due ON public.workspace_tasks USING btree (workspace_id, due_date);
CREATE INDEX IF NOT EXISTS idx_workspace_tasks_role ON public.workspace_tasks USING btree (workspace_id, assigned_role_id);
CREATE INDEX IF NOT EXISTS idx_workspace_tasks_search_title ON public.workspace_tasks USING btree (workspace_id, title);
CREATE INDEX IF NOT EXISTS idx_workspace_tasks_ws_dept ON public.workspace_tasks USING btree (workspace_id, department_id);
CREATE INDEX IF NOT EXISTS idx_workspace_tasks_ws_status ON public.workspace_tasks USING btree (workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_workspace_thread_part_user ON public.workspace_thread_participants USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_threads_channel ON public.workspace_threads USING btree (channel_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_workspace_webhook_events_provider_type ON public.workspace_webhook_events USING btree (provider, event_type, created_at DESC);
