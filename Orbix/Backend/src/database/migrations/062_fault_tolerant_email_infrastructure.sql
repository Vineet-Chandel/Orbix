-- ============================================================================
-- Migration 062: Fault-Tolerant Email Infrastructure, Transactional Outbox,
-- Recipient Job Isolation, Delivery Attempts Audit, and Dead Letter Queue (DLQ)
-- ============================================================================

-- 1. Email Outbox Campaigns Table (Batch / Fan-out Notifications)
CREATE TABLE IF NOT EXISTS public.email_outbox_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NULL,
    club_id UUID NULL,
    campaign_type VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED')),
    total_recipients INTEGER NOT NULL DEFAULT 0,
    processed_recipients INTEGER NOT NULL DEFAULT 0,
    successful_recipients INTEGER NOT NULL DEFAULT 0,
    failed_recipients INTEGER NOT NULL DEFAULT 0,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    idempotency_key VARCHAR(255) NOT NULL UNIQUE,
    error_message TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_campaigns_status 
    ON public.email_outbox_campaigns (status, created_at);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_event 
    ON public.email_outbox_campaigns (event_id) WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_campaigns_club 
    ON public.email_outbox_campaigns (club_id) WHERE club_id IS NOT NULL;

-- 2. Email Delivery Jobs Table (Individual Recipient Isolation)
CREATE TABLE IF NOT EXISTS public.email_delivery_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NULL REFERENCES public.email_outbox_campaigns(id) ON DELETE SET NULL,
    event_id UUID NULL,
    user_id UUID NULL,
    recipient_email VARCHAR(255) NOT NULL,
    recipient_name VARCHAR(150) NULL,
    subject VARCHAR(255) NOT NULL,
    html_body TEXT NOT NULL,
    text_body TEXT NULL,
    email_type VARCHAR(64) NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('HIGH', 'NORMAL', 'LOW')),
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'QUEUED', 'PROCESSING', 'RETRY_WAIT', 'SENT', 'DEAD_LETTER', 'CANCELLED')),
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 8,
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_attempt_at TIMESTAMPTZ NULL,
    sent_at TIMESTAMPTZ NULL,
    failed_at TIMESTAMPTZ NULL,
    provider VARCHAR(32) NULL,
    provider_message_id VARCHAR(255) NULL,
    idempotency_key VARCHAR(255) NOT NULL UNIQUE,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    error_category VARCHAR(64) NULL,
    last_error TEXT NULL,
    locked_by VARCHAR(128) NULL,
    locked_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_jobs_status_next_attempt 
    ON public.email_delivery_jobs (status, next_attempt_at) 
    WHERE status IN ('PENDING', 'RETRY_WAIT');
CREATE INDEX IF NOT EXISTS idx_email_jobs_campaign 
    ON public.email_delivery_jobs (campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_jobs_event 
    ON public.email_delivery_jobs (event_id) WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_jobs_user 
    ON public.email_delivery_jobs (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_jobs_recipient 
    ON public.email_delivery_jobs (recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_jobs_type 
    ON public.email_delivery_jobs (email_type, status);

-- 3. Email Delivery Attempts Audit Table
CREATE TABLE IF NOT EXISTS public.email_delivery_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.email_delivery_jobs(id) ON DELETE CASCADE,
    attempt_number INTEGER NOT NULL,
    worker_id VARCHAR(128) NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ NULL,
    duration_ms INTEGER NULL,
    status VARCHAR(32) NOT NULL CHECK (status IN ('SUCCESS', 'TRANSIENT_FAILURE', 'PERMANENT_FAILURE', 'SYSTEMIC_FAILURE')),
    provider VARCHAR(32) NULL,
    provider_message_id VARCHAR(255) NULL,
    provider_response JSONB NULL,
    error_category VARCHAR(64) NULL,
    error_code VARCHAR(64) NULL,
    error_message TEXT NULL,
    next_retry_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_attempts_job 
    ON public.email_delivery_attempts (job_id, attempt_number);
CREATE INDEX IF NOT EXISTS idx_email_attempts_created 
    ON public.email_delivery_attempts (created_at DESC);

-- 4. Email Dead Letter Queue (DLQ) Table
CREATE TABLE IF NOT EXISTS public.email_dead_letters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_job_id UUID NULL,
    idempotency_key VARCHAR(255) NOT NULL UNIQUE,
    campaign_id UUID NULL,
    event_id UUID NULL,
    user_id UUID NULL,
    recipient_email VARCHAR(255) NOT NULL,
    email_type VARCHAR(64) NOT NULL,
    subject VARCHAR(255) NULL,
    payload JSONB NULL,
    failure_stage VARCHAR(64) NOT NULL,
    failure_category VARCHAR(64) NOT NULL,
    error_code VARCHAR(64) NULL,
    error_message TEXT NULL,
    error_stack TEXT NULL,
    total_attempts INTEGER NOT NULL DEFAULT 0,
    first_attempt_at TIMESTAMPTZ NULL,
    last_attempt_at TIMESTAMPTZ NULL,
    failed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    provider VARCHAR(32) NULL,
    provider_message_id VARCHAR(255) NULL,
    provider_response JSONB NULL,
    recovered_at TIMESTAMPTZ NULL,
    recovered_by UUID NULL,
    discarded BOOLEAN NOT NULL DEFAULT false,
    discarded_at TIMESTAMPTZ NULL,
    discarded_reason TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_dlq_category 
    ON public.email_dead_letters (failure_category, failed_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_dlq_recipient 
    ON public.email_dead_letters (recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_dlq_event 
    ON public.email_dead_letters (event_id) WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_dlq_recovered 
    ON public.email_dead_letters (recovered_at) WHERE recovered_at IS NULL;
