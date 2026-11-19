-- ============================================================================
-- Migration 048: Team Workspace Notifications, Transactional Outbox, and Resend Email Delivery
-- Phase 07: Notifications, BullMQ, and Resend Infrastructure
-- ============================================================================

-- Rename legacy 043 table if it has member_id column
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'workspace_notifications' 
          AND column_name = 'member_id'
    ) THEN
        ALTER TABLE public.workspace_notifications RENAME TO workspace_channel_read_states;
    END IF;
END $$;

-- 1. In-App Notifications Table
CREATE TABLE IF NOT EXISTS public.workspace_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.team_workspaces(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    actor_id UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
    event_type VARCHAR(64) NOT NULL,
    resource_type VARCHAR(32) NOT NULL,
    resource_id VARCHAR(128) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    destination_url VARCHAR(512) NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_read BOOLEAN NOT NULL DEFAULT false,
    read_at TIMESTAMPTZ NULL,
    expires_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workspace_notifications_recipient_read 
    ON public.workspace_notifications (workspace_id, recipient_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_workspace_notifications_recipient_created 
    ON public.workspace_notifications (recipient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_workspace_notifications_resource 
    ON public.workspace_notifications (workspace_id, resource_type, resource_id);

-- 2. Transactional Outbox Events Table
CREATE TABLE IF NOT EXISTS public.workspace_outbox_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.team_workspaces(id) ON DELETE CASCADE,
    event_type VARCHAR(64) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'published', 'failed')),
    retry_count INTEGER NOT NULL DEFAULT 0,
    error_message TEXT NULL,
    published_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workspace_outbox_events_status 
    ON public.workspace_outbox_events (status, created_at)
    WHERE status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS idx_workspace_outbox_events_workspace 
    ON public.workspace_outbox_events (workspace_id, created_at DESC);

-- 3. Email Delivery Tracking & Deduplication Table
CREATE TABLE IF NOT EXISTS public.workspace_email_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.team_workspaces(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    recipient_email VARCHAR(255) NOT NULL,
    email_type VARCHAR(64) NOT NULL,
    idempotency_key VARCHAR(255) NOT NULL UNIQUE,
    resend_id VARCHAR(128) NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'delivered', 'bounced', 'complained', 'failed')),
    retry_count INTEGER NOT NULL DEFAULT 0,
    error TEXT NULL,
    sent_at TIMESTAMPTZ NULL,
    delivered_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workspace_email_deliveries_recipient 
    ON public.workspace_email_deliveries (recipient_id, email_type);

CREATE INDEX IF NOT EXISTS idx_workspace_email_deliveries_workspace 
    ON public.workspace_email_deliveries (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_workspace_email_deliveries_resend_id 
    ON public.workspace_email_deliveries (resend_id)
    WHERE resend_id IS NOT NULL;

-- 4. User Workspace Notification Preferences Table
CREATE TABLE IF NOT EXISTS public.workspace_notification_preferences (
    workspace_id UUID NOT NULL REFERENCES public.team_workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    email_task_assigned BOOLEAN NOT NULL DEFAULT true,
    email_task_reminders BOOLEAN NOT NULL DEFAULT true,
    email_mentions BOOLEAN NOT NULL DEFAULT true,
    email_discussions BOOLEAN NOT NULL DEFAULT true,
    email_digest_frequency VARCHAR(20) NOT NULL DEFAULT 'instant' CHECK (email_digest_frequency IN ('instant', 'daily', 'none')),
    muted_until TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (workspace_id, user_id)
);

-- 5. Webhook Events Table (for signature verification replay protection)
CREATE TABLE IF NOT EXISTS public.workspace_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(32) NOT NULL DEFAULT 'resend',
    provider_event_id VARCHAR(255) NOT NULL UNIQUE,
    event_type VARCHAR(64) NOT NULL,
    payload JSONB NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workspace_webhook_events_provider_type 
    ON public.workspace_webhook_events (provider, event_type, created_at DESC);
