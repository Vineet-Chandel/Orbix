-- ============================================================================
-- Migration 052: Workspace Recognition Visibility & Member Recognition Profile
-- Adds visibility support ('workspace', 'recipient_only', 'private')
-- ============================================================================

-- 1. Add visibility column to recognition ledger
ALTER TABLE public.workspace_recognition_ledger 
ADD COLUMN IF NOT EXISTS visibility VARCHAR(30) NOT NULL DEFAULT 'workspace' 
CHECK (visibility IN ('workspace', 'recipient_only', 'private'));

-- 2. Index for visibility queries
CREATE INDEX IF NOT EXISTS idx_recognition_ledger_ws_visibility 
ON public.workspace_recognition_ledger(workspace_id, visibility);

-- 3. Recognition notes (optional manager appreciation notes attached to awards)
CREATE TABLE IF NOT EXISTS public.workspace_recognition_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.team_workspaces(id) ON DELETE CASCADE,
    award_id UUID NOT NULL REFERENCES public.workspace_recognition_ledger(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    note TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recognition_notes_award 
ON public.workspace_recognition_notes(award_id, created_at ASC);
