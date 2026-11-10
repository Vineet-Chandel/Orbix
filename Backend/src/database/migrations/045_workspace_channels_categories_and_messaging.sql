-- ============================================================================
-- Migration 045: Team Workspace Channels, Categories, Permission Sync,
-- Realtime Messaging, Reactions, and Threads
-- ============================================================================

-- 1. Enhance workspace_channel_categories
ALTER TABLE public.workspace_channel_categories
ADD COLUMN IF NOT EXISTS department_id UUID NULL REFERENCES public.workspace_departments(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_workspace_channel_categories_dept 
    ON public.workspace_channel_categories(workspace_id, department_id);

-- Drop old name uniqueness constraint if exists to allow same-named categories under different departments (e.g. "GENERAL" under Club-Wide and Departments)
ALTER TABLE public.workspace_channel_categories
DROP CONSTRAINT IF EXISTS uq_workspace_category_name;

-- 2. Enhance workspace_channels
ALTER TABLE public.workspace_channels
ADD COLUMN IF NOT EXISTS is_category_synced BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS position INT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS default_slowmode_seconds INT NOT NULL DEFAULT 0;

-- Update channel_type check constraint to include forum and task_discussion
ALTER TABLE public.workspace_channels 
DROP CONSTRAINT IF EXISTS workspace_channels_channel_type_check;

ALTER TABLE public.workspace_channels
ADD CONSTRAINT workspace_channels_channel_type_check 
    CHECK (channel_type IN ('text', 'announcement', 'forum', 'task_discussion', 'department', 'private'));

CREATE INDEX IF NOT EXISTS idx_workspace_channels_cat ON public.workspace_channels(workspace_id, category_id, position ASC);
CREATE INDEX IF NOT EXISTS idx_workspace_channels_visibility ON public.workspace_channels(workspace_id, is_private, is_archived);

-- 3. Discord-style Channel & Category Permission Overrides
CREATE TABLE IF NOT EXISTS public.workspace_channel_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.team_workspaces(id) ON DELETE CASCADE,
    category_id UUID NULL REFERENCES public.workspace_channel_categories(id) ON DELETE CASCADE,
    channel_id UUID NULL REFERENCES public.workspace_channels(id) ON DELETE CASCADE,
    role_id UUID NULL REFERENCES public.workspace_roles(id) ON DELETE CASCADE,
    member_id UUID NULL REFERENCES public.workspace_members(id) ON DELETE CASCADE,
    allow_permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
    deny_permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT check_override_scope CHECK (
        (category_id IS NOT NULL AND channel_id IS NULL) OR 
        (category_id IS NULL AND channel_id IS NOT NULL)
    ),
    CONSTRAINT check_override_subject CHECK (
        (role_id IS NOT NULL AND member_id IS NULL) OR 
        (role_id IS NULL AND member_id IS NOT NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_channel_role_override 
    ON public.workspace_channel_overrides(channel_id, role_id) 
    WHERE channel_id IS NOT NULL AND role_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_channel_member_override 
    ON public.workspace_channel_overrides(channel_id, member_id) 
    WHERE channel_id IS NOT NULL AND member_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_category_role_override 
    ON public.workspace_channel_overrides(category_id, role_id) 
    WHERE category_id IS NOT NULL AND role_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_category_member_override 
    ON public.workspace_channel_overrides(category_id, member_id) 
    WHERE category_id IS NOT NULL AND member_id IS NOT NULL;

-- 4. Create workspace_messages table
CREATE TABLE IF NOT EXISTS public.workspace_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.team_workspaces(id) ON DELETE CASCADE,
    channel_id UUID NOT NULL REFERENCES public.workspace_channels(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    sender_member_id UUID NOT NULL REFERENCES public.workspace_members(id) ON DELETE CASCADE,
    parent_message_id UUID NULL REFERENCES public.workspace_messages(id) ON DELETE CASCADE,
    thread_id UUID NULL,
    content TEXT NOT NULL,
    message_type VARCHAR(30) NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'system', 'announcement', 'thread_starter')),
    is_pinned BOOLEAN NOT NULL DEFAULT false,
    pinned_at TIMESTAMPTZ NULL,
    pinned_by UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
    is_edited BOOLEAN NOT NULL DEFAULT false,
    edited_at TIMESTAMPTZ NULL,
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    deleted_at TIMESTAMPTZ NULL,
    mentions JSONB DEFAULT '{"users": [], "roles": [], "everyone": false}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workspace_messages_feed 
    ON public.workspace_messages(channel_id, created_at DESC) 
    WHERE is_deleted = false AND thread_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_workspace_messages_thread 
    ON public.workspace_messages(thread_id, created_at ASC) 
    WHERE is_deleted = false AND thread_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workspace_messages_pinned 
    ON public.workspace_messages(channel_id) 
    WHERE is_pinned = true AND is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_workspace_messages_sender 
    ON public.workspace_messages(workspace_id, sender_id);

-- 5. Create workspace_threads table
CREATE TABLE IF NOT EXISTS public.workspace_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.team_workspaces(id) ON DELETE CASCADE,
    channel_id UUID NOT NULL REFERENCES public.workspace_channels(id) ON DELETE CASCADE,
    parent_message_id UUID NOT NULL REFERENCES public.workspace_messages(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    creator_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    is_locked BOOLEAN NOT NULL DEFAULT false,
    locked_at TIMESTAMPTZ NULL,
    locked_by UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    archived_at TIMESTAMPTZ NULL,
    archived_by UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
    message_count INT NOT NULL DEFAULT 0,
    last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_thread_parent_message UNIQUE (parent_message_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_threads_channel 
    ON public.workspace_threads(channel_id, last_message_at DESC);

-- Add foreign key constraint from messages.thread_id to workspace_threads
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_workspace_messages_thread'
    ) THEN 
        ALTER TABLE public.workspace_messages 
        ADD CONSTRAINT fk_workspace_messages_thread 
        FOREIGN KEY (thread_id) REFERENCES public.workspace_threads(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 6. Create workspace_thread_participants table
CREATE TABLE IF NOT EXISTS public.workspace_thread_participants (
    thread_id UUID NOT NULL REFERENCES public.workspace_threads(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_muted BOOLEAN NOT NULL DEFAULT false,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (thread_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_thread_part_user 
    ON public.workspace_thread_participants(user_id);

-- 7. Create workspace_message_reactions table
CREATE TABLE IF NOT EXISTS public.workspace_message_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.team_workspaces(id) ON DELETE CASCADE,
    message_id UUID NOT NULL REFERENCES public.workspace_messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    emoji VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_msg_reaction UNIQUE (message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_workspace_reactions_msg 
    ON public.workspace_message_reactions(message_id);

-- 8. Add message_id to workspace_files
ALTER TABLE public.workspace_files
ADD COLUMN IF NOT EXISTS message_id UUID REFERENCES public.workspace_messages(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_workspace_files_message 
    ON public.workspace_files(message_id);

-- 9. Create workspace_channel_reads table (Unread tracking per user per channel)
CREATE TABLE IF NOT EXISTS public.workspace_channel_reads (
    channel_id UUID NOT NULL REFERENCES public.workspace_channels(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    last_read_message_id UUID NULL REFERENCES public.workspace_messages(id) ON DELETE SET NULL,
    last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (channel_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_channel_reads_user 
    ON public.workspace_channel_reads(user_id);
