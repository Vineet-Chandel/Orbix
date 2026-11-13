-- ============================================================================
-- Migration 047: Team Workspace Media and Document Management (Phase 06)
--
-- Features:
-- 1. Upgrade workspace_files table with department association, parent resource
--    polymorphic targeting, Cloudinary asset ID, delivery types (authenticated/private),
--    file checksums (SHA-256), formats, and lifecycle status.
-- 2. workspace_file_upload_intents table: Short-lived server-signed upload
--    authorizations to prevent client forgery of Cloudinary folders/paths.
-- 3. Performance & security indexes for tenant isolation, parent lookups,
--    and deduplication.
-- ============================================================================

-- 1. Upgrade workspace_files table
ALTER TABLE public.workspace_files
    ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.workspace_departments(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS submission_id UUID REFERENCES public.workspace_task_submissions(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS cloudinary_asset_id TEXT NULL,
    ADD COLUMN IF NOT EXISTS delivery_type VARCHAR(30) NOT NULL DEFAULT 'authenticated',
    ADD COLUMN IF NOT EXISTS format VARCHAR(30) NULL,
    ADD COLUMN IF NOT EXISTS checksum VARCHAR(64) NULL,
    ADD COLUMN IF NOT EXISTS parent_resource_type VARCHAR(50) NOT NULL DEFAULT 'attachment',
    ADD COLUMN IF NOT EXISTS parent_resource_id UUID NULL,
    ADD COLUMN IF NOT EXISTS asset_status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (asset_status IN ('active', 'archived', 'quarantined')),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_workspace_files_parent ON public.workspace_files(parent_resource_type, parent_resource_id);
CREATE INDEX IF NOT EXISTS idx_workspace_files_checksum ON public.workspace_files(workspace_id, checksum);
CREATE INDEX IF NOT EXISTS idx_workspace_files_dept ON public.workspace_files(workspace_id, department_id);
CREATE INDEX IF NOT EXISTS idx_workspace_files_status ON public.workspace_files(workspace_id, asset_status);
CREATE INDEX IF NOT EXISTS idx_workspace_files_submission ON public.workspace_files(submission_id);

-- 2. Create workspace_file_upload_intents table
CREATE TABLE IF NOT EXISTS public.workspace_file_upload_intents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.team_workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    department_id UUID REFERENCES public.workspace_departments(id) ON DELETE SET NULL,
    parent_resource_type VARCHAR(50) NOT NULL,
    parent_resource_id UUID NULL,
    public_id TEXT NOT NULL,
    folder TEXT NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    expected_mime_type VARCHAR(120) NOT NULL,
    expected_size_bytes BIGINT NOT NULL,
    delivery_type VARCHAR(30) NOT NULL DEFAULT 'authenticated',
    resource_type VARCHAR(30) NOT NULL DEFAULT 'auto',
    status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'registered', 'expired', 'cancelled')),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    registered_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_workspace_upload_intents_ws ON public.workspace_file_upload_intents(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_workspace_upload_intents_user ON public.workspace_file_upload_intents(user_id, status);
CREATE INDEX IF NOT EXISTS idx_workspace_upload_intents_exp ON public.workspace_file_upload_intents(expires_at);
