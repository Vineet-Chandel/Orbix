-- ============================================================================
-- Migration 046: Team Workspace Task Management System (Phase 05)
--
-- Features:
-- 1. Upgrade workspace_tasks with explicit 10-status workflow, start dates,
--    role targeting, checklists, reference links, optimistic concurrency versioning,
--    and department-level restriction flags.
-- 2. workspace_task_assignments: Multi-member assignments with active/reassignment history.
-- 3. workspace_task_submissions: Member deliverable submissions with Cloudinary assets.
-- 4. workspace_task_reviews: Reviewer decisions (approved / changes requested).
-- 5. workspace_task_comments: Discussion thread, replies, mentions, attachments.
-- 6. workspace_task_watchers: Task subscriber & notification tracking.
-- 7. workspace_task_activity: Immutable chronological task event log.
-- ============================================================================

-- 1. Upgrade workspace_tasks table
ALTER TABLE public.workspace_tasks
    DROP CONSTRAINT IF EXISTS workspace_tasks_status_check;

ALTER TABLE public.workspace_tasks
    ADD CONSTRAINT workspace_tasks_status_check 
    CHECK (status IN (
        'draft',
        'assigned',
        'in_progress',
        'blocked',
        'submitted',
        'changes_requested',
        'approved',
        'completed',
        'archived',
        'cancelled'
    ));

ALTER TABLE public.workspace_tasks
    ALTER COLUMN status SET DEFAULT 'draft';

ALTER TABLE public.workspace_tasks
    ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS assigned_role_id UUID REFERENCES public.workspace_roles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS reference_links JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS is_restricted BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_workspace_tasks_creator ON public.workspace_tasks(workspace_id, creator_id);
CREATE INDEX IF NOT EXISTS idx_workspace_tasks_archived ON public.workspace_tasks(workspace_id, is_archived);
CREATE INDEX IF NOT EXISTS idx_workspace_tasks_role ON public.workspace_tasks(workspace_id, assigned_role_id);

-- 2. workspace_task_assignments: Multi-member assignments with active & reassignment history
CREATE TABLE IF NOT EXISTS public.workspace_task_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.team_workspaces(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES public.workspace_tasks(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES public.workspace_members(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    assigned_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    unassigned_at TIMESTAMPTZ NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workspace_task_assignments_task ON public.workspace_task_assignments(task_id, is_active);
CREATE INDEX IF NOT EXISTS idx_workspace_task_assignments_user ON public.workspace_task_assignments(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_workspace_task_assignments_member ON public.workspace_task_assignments(member_id, is_active);
CREATE INDEX IF NOT EXISTS idx_workspace_task_assignments_ws ON public.workspace_task_assignments(workspace_id);

-- 3. workspace_task_submissions: Deliverables submission
CREATE TABLE IF NOT EXISTS public.workspace_task_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.team_workspaces(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES public.workspace_tasks(id) ON DELETE CASCADE,
    submitted_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    content TEXT NOT NULL,
    attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
    status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'changes_requested')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workspace_task_submissions_task ON public.workspace_task_submissions(task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workspace_task_submissions_ws ON public.workspace_task_submissions(workspace_id);

-- 4. workspace_task_reviews: Review decisions
CREATE TABLE IF NOT EXISTS public.workspace_task_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.team_workspaces(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES public.workspace_tasks(id) ON DELETE CASCADE,
    submission_id UUID NOT NULL REFERENCES public.workspace_task_submissions(id) ON DELETE CASCADE,
    reviewer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    decision VARCHAR(30) NOT NULL CHECK (decision IN ('approved', 'changes_requested')),
    comments TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workspace_task_reviews_task ON public.workspace_task_reviews(task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workspace_task_reviews_sub ON public.workspace_task_reviews(submission_id);
CREATE INDEX IF NOT EXISTS idx_workspace_task_reviews_ws ON public.workspace_task_reviews(workspace_id);

-- 5. workspace_task_comments: Task comments and replies
CREATE TABLE IF NOT EXISTS public.workspace_task_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.team_workspaces(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES public.workspace_tasks(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    parent_comment_id UUID REFERENCES public.workspace_task_comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    mentions JSONB NOT NULL DEFAULT '[]'::jsonb,
    attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_edited BOOLEAN NOT NULL DEFAULT false,
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workspace_task_comments_task ON public.workspace_task_comments(task_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_workspace_task_comments_parent ON public.workspace_task_comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_workspace_task_comments_ws ON public.workspace_task_comments(workspace_id);

-- 6. workspace_task_watchers: Task watchers
CREATE TABLE IF NOT EXISTS public.workspace_task_watchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.team_workspaces(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES public.workspace_tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_workspace_task_watchers UNIQUE (task_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_task_watchers_task ON public.workspace_task_watchers(task_id);
CREATE INDEX IF NOT EXISTS idx_workspace_task_watchers_user ON public.workspace_task_watchers(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_task_watchers_ws ON public.workspace_task_watchers(workspace_id);

-- 7. workspace_task_activity: Chronological task audit and activity log
CREATE TABLE IF NOT EXISTS public.workspace_task_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.team_workspaces(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES public.workspace_tasks(id) ON DELETE CASCADE,
    actor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    action VARCHAR(50) NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workspace_task_activity_task ON public.workspace_task_activity(task_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_workspace_task_activity_ws ON public.workspace_task_activity(workspace_id);
