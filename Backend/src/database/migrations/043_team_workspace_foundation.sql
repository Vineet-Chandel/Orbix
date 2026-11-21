-- ============================================================================
-- Migration 043: Orbix Team Workspace Foundation & Multi-Tenant Architecture
--
-- Features:
-- 1. team_workspaces: 1:1 domain entity anchored to verified_clubs
-- 2. workspace_roles: System & custom role hierarchy with granular permissions
-- 3. workspace_departments: Sub-teams with leads & permissions
-- 4. workspace_members: User-workspace membership with suspension state
-- 5. workspace_permission_overrides: Member and department-level overrides
-- 6. workspace_channel_categories & workspace_channels: Structured chat & announcements
-- 7. workspace_tasks: Foundational task engine with priorities and statuses
-- 8. workspace_files: Cloudinary asset tracking with workspace isolation
-- 9. workspace_audit_logs: Immutable security and administrative audit stream
-- 10. workspace_notifications: Member read receipts and alert preferences
-- ============================================================================

-- 1. Create team_workspaces table (1:1 with verified_clubs)
CREATE TABLE IF NOT EXISTS public.team_workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES public.verified_clubs(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    name VARCHAR(120) NOT NULL,
    slug VARCHAR(150) NOT NULL,
    description TEXT,
    icon_url TEXT,
    workspace_status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (workspace_status IN ('active', 'suspended', 'archived')),
    schema_version INT NOT NULL DEFAULT 1,
    settings JSONB NOT NULL DEFAULT '{"allow_member_invites": true, "theme": "neo", "max_members": 250}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_team_workspaces_club_id UNIQUE (club_id),
    CONSTRAINT uq_team_workspaces_slug UNIQUE (slug)
);

CREATE INDEX IF NOT EXISTS idx_team_workspaces_club_id ON public.team_workspaces(club_id);
CREATE INDEX IF NOT EXISTS idx_team_workspaces_slug ON public.team_workspaces(slug);
CREATE INDEX IF NOT EXISTS idx_team_workspaces_owner ON public.team_workspaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_team_workspaces_status ON public.team_workspaces(workspace_status);

-- 2. Create workspace_roles table
CREATE TABLE IF NOT EXISTS public.workspace_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.team_workspaces(id) ON DELETE CASCADE,
    name VARCHAR(60) NOT NULL,
    slug VARCHAR(80) NOT NULL,
    description TEXT,
    rank INT NOT NULL DEFAULT 100, -- 1000=owner, 800=admin, 500=dept_lead, 200=member, 100=guest
    is_system BOOLEAN NOT NULL DEFAULT false,
    color VARCHAR(30) DEFAULT '#000000',
    permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_workspace_role_slug UNIQUE (workspace_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_workspace_roles_ws_rank ON public.workspace_roles(workspace_id, rank DESC);

-- 3. Create workspace_departments table
CREATE TABLE IF NOT EXISTS public.workspace_departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.team_workspaces(id) ON DELETE CASCADE,
    club_team_id UUID REFERENCES public.club_teams(id) ON DELETE SET NULL,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(120) NOT NULL,
    description TEXT,
    lead_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    color VARCHAR(30) DEFAULT '#2563eb',
    display_order INT NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_workspace_department_slug UNIQUE (workspace_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_workspace_departments_ws ON public.workspace_departments(workspace_id, display_order ASC);
CREATE INDEX IF NOT EXISTS idx_workspace_departments_lead ON public.workspace_departments(lead_user_id);

-- 4. Create workspace_members table
CREATE TABLE IF NOT EXISTS public.workspace_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.team_workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    club_membership_id UUID REFERENCES public.club_memberships(id) ON DELETE SET NULL,
    department_id UUID REFERENCES public.workspace_departments(id) ON DELETE SET NULL,
    role_id UUID NOT NULL REFERENCES public.workspace_roles(id) ON DELETE RESTRICT,
    role_title VARCHAR(100) NOT NULL DEFAULT 'Member',
    membership_status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (membership_status IN ('invitation_pending', 'active', 'suspended', 'removed')),
    is_suspended BOOLEAN NOT NULL DEFAULT false,
    suspended_at TIMESTAMPTZ NULL,
    suspended_reason TEXT NULL,
    suspended_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    invited_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active_at TIMESTAMPTZ NULL,
    custom_permissions JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_workspace_member_user UNIQUE (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON public.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_ws_status ON public.workspace_members(workspace_id, membership_status);
CREATE INDEX IF NOT EXISTS idx_workspace_members_dept ON public.workspace_members(workspace_id, department_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_role ON public.workspace_members(workspace_id, role_id);

-- 5. Create workspace_permission_overrides table
CREATE TABLE IF NOT EXISTS public.workspace_permission_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.team_workspaces(id) ON DELETE CASCADE,
    member_id UUID REFERENCES public.workspace_members(id) ON DELETE CASCADE,
    department_id UUID REFERENCES public.workspace_departments(id) ON DELETE CASCADE,
    permission_key VARCHAR(100) NOT NULL,
    is_granted BOOLEAN NOT NULL,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT check_override_target CHECK (
        (member_id IS NOT NULL AND department_id IS NULL) OR 
        (member_id IS NULL AND department_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_workspace_perm_overrides_member ON public.workspace_permission_overrides(workspace_id, member_id);
CREATE INDEX IF NOT EXISTS idx_workspace_perm_overrides_dept ON public.workspace_permission_overrides(workspace_id, department_id);

-- 6. Create workspace_channel_categories table
CREATE TABLE IF NOT EXISTS public.workspace_channel_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.team_workspaces(id) ON DELETE CASCADE,
    name VARCHAR(80) NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_workspace_category_name UNIQUE (workspace_id, name)
);

CREATE INDEX IF NOT EXISTS idx_workspace_channel_categories_ws ON public.workspace_channel_categories(workspace_id, display_order ASC);

-- 7. Create workspace_channels table
CREATE TABLE IF NOT EXISTS public.workspace_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.team_workspaces(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.workspace_channel_categories(id) ON DELETE SET NULL,
    department_id UUID REFERENCES public.workspace_departments(id) ON DELETE CASCADE,
    name VARCHAR(80) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    topic TEXT NULL,
    channel_type VARCHAR(30) NOT NULL DEFAULT 'text' CHECK (channel_type IN ('text', 'announcement', 'department', 'private')),
    is_private BOOLEAN NOT NULL DEFAULT false,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_workspace_channel_slug UNIQUE (workspace_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_workspace_channels_ws ON public.workspace_channels(workspace_id, is_archived);
CREATE INDEX IF NOT EXISTS idx_workspace_channels_dept ON public.workspace_channels(workspace_id, department_id);

-- 8. Create workspace_tasks table
CREATE TABLE IF NOT EXISTS public.workspace_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.team_workspaces(id) ON DELETE CASCADE,
    department_id UUID REFERENCES public.workspace_departments(id) ON DELETE SET NULL,
    creator_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    title VARCHAR(200) NOT NULL,
    description TEXT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'todo' CHECK (status IN ('backlog', 'todo', 'in_progress', 'in_review', 'completed', 'cancelled')),
    priority VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    due_date TIMESTAMPTZ NULL,
    custom_fields JSONB DEFAULT '{}'::jsonb,
    display_order INT NOT NULL DEFAULT 0,
    completed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workspace_tasks_ws_status ON public.workspace_tasks(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_workspace_tasks_ws_dept ON public.workspace_tasks(workspace_id, department_id);
CREATE INDEX IF NOT EXISTS idx_workspace_tasks_due ON public.workspace_tasks(workspace_id, due_date);

-- 9. Create workspace_files table (Cloudinary attachments & assets)
CREATE TABLE IF NOT EXISTS public.workspace_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.team_workspaces(id) ON DELETE CASCADE,
    uploader_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    channel_id UUID REFERENCES public.workspace_channels(id) ON DELETE SET NULL,
    task_id UUID REFERENCES public.workspace_tasks(id) ON DELETE SET NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    mime_type VARCHAR(120) NOT NULL,
    cloudinary_public_id TEXT NOT NULL,
    cloudinary_url TEXT NOT NULL,
    cloudinary_secure_url TEXT NOT NULL,
    resource_type VARCHAR(20) NOT NULL DEFAULT 'auto',
    purpose VARCHAR(50) NOT NULL DEFAULT 'attachment',
    is_archived BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workspace_files_ws ON public.workspace_files(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workspace_files_channel ON public.workspace_files(channel_id);
CREATE INDEX IF NOT EXISTS idx_workspace_files_task ON public.workspace_files(task_id);

-- 10. Create workspace_audit_logs table (Immutable security trail)
CREATE TABLE IF NOT EXISTS public.workspace_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.team_workspaces(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    action VARCHAR(80) NOT NULL,
    target_type VARCHAR(50) NOT NULL,
    target_id UUID NULL,
    details JSONB DEFAULT '{}'::jsonb,
    ip_address VARCHAR(50) NULL,
    user_agent TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workspace_audit_ws_created ON public.workspace_audit_logs(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workspace_audit_actor ON public.workspace_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_workspace_audit_action ON public.workspace_audit_logs(workspace_id, action);

-- 11. Create workspace_notifications table (Member channel read states & notification preferences)
CREATE TABLE IF NOT EXISTS public.workspace_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.team_workspaces(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES public.workspace_members(id) ON DELETE CASCADE,
    channel_id UUID REFERENCES public.workspace_channels(id) ON DELETE CASCADE,
    last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    unread_mention_count INT NOT NULL DEFAULT 0,
    notification_preferences JSONB DEFAULT '{"muted": false, "email_digest": true, "desktop_push": true}'::jsonb,
    CONSTRAINT uq_workspace_member_channel_notif UNIQUE (member_id, channel_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_notif_member ON public.workspace_notifications(member_id);
