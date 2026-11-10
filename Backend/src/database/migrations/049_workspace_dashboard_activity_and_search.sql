-- ============================================================================
-- Migration 049: Workspace Dashboard, Activity Feed, Audit Trail & Search Indexes
-- Phase 08: Workspace Dashboard, Activity, Audit and Search
-- ============================================================================

-- 1. Chronological Activity Feed Table
CREATE TABLE IF NOT EXISTS public.workspace_activity_feed (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.team_workspaces(id) ON DELETE CASCADE,
    department_id UUID NULL REFERENCES public.workspace_departments(id) ON DELETE SET NULL,
    actor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    event_type VARCHAR(64) NOT NULL,
    resource_type VARCHAR(32) NOT NULL,
    resource_id VARCHAR(128) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NULL,
    is_restricted BOOLEAN NOT NULL DEFAULT false,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workspace_activity_feed_ws_created
    ON public.workspace_activity_feed (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_workspace_activity_feed_dept
    ON public.workspace_activity_feed (workspace_id, department_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_workspace_activity_feed_actor
    ON public.workspace_activity_feed (workspace_id, actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_workspace_activity_feed_event
    ON public.workspace_activity_feed (workspace_id, event_type, created_at DESC);

-- 2. Audit Trail Composite Indexes for Fast Administrative Filtering
CREATE INDEX IF NOT EXISTS idx_workspace_audit_logs_filter
    ON public.workspace_audit_logs (workspace_id, action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_workspace_audit_logs_actor_created
    ON public.workspace_audit_logs (workspace_id, actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_workspace_audit_logs_target
    ON public.workspace_audit_logs (workspace_id, target_type, created_at DESC);

-- 3. Search Acceleration Trigram / B-Tree Indexes
CREATE INDEX IF NOT EXISTS idx_workspace_tasks_search_title
    ON public.workspace_tasks (workspace_id, title);

CREATE INDEX IF NOT EXISTS idx_workspace_messages_search_content
    ON public.workspace_messages (workspace_id, channel_id);

CREATE INDEX IF NOT EXISTS idx_workspace_files_search_name
    ON public.workspace_files (workspace_id, file_name);

CREATE INDEX IF NOT EXISTS idx_workspace_channels_search_name
    ON public.workspace_channels (workspace_id, name);
