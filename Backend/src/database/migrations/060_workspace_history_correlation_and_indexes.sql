-- ============================================================================
-- Migration 060: Unified Workspace History Correlation & Cursor Pagination Indexes
-- Preserves separate workspace_activity_feed and workspace_audit_logs tables
-- while enabling correlation across linked operational/audit records and
-- deterministic keyset cursor pagination.
-- ============================================================================

ALTER TABLE public.workspace_activity_feed
    ADD COLUMN IF NOT EXISTS correlation_id UUID NULL;

ALTER TABLE public.workspace_audit_logs
    ADD COLUMN IF NOT EXISTS correlation_id UUID NULL;

CREATE INDEX IF NOT EXISTS idx_workspace_activity_feed_correlation
    ON public.workspace_activity_feed (workspace_id, correlation_id)
    WHERE correlation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workspace_audit_logs_correlation
    ON public.workspace_audit_logs (workspace_id, correlation_id)
    WHERE correlation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workspace_activity_feed_cursor
    ON public.workspace_activity_feed (workspace_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_workspace_audit_logs_cursor
    ON public.workspace_audit_logs (workspace_id, created_at DESC, id DESC);
