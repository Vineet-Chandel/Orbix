-- ============================================================================
-- Migration 044: Team Workspace Departments, Multi-Department Memberships,
-- Workspace Manager Designation, and Secure Cryptographic Invitations
-- ============================================================================

-- 1. Add manager_user_id to team_workspaces for single designated Workspace Manager
ALTER TABLE public.team_workspaces
ADD COLUMN IF NOT EXISTS manager_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS manager_appointed_at TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS manager_permissions JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_team_workspaces_manager ON public.team_workspaces(manager_user_id);

-- 2. Enhance workspace_departments with icon and co-leads
ALTER TABLE public.workspace_departments
ADD COLUMN IF NOT EXISTS icon VARCHAR(50) DEFAULT 'Folder',
ADD COLUMN IF NOT EXISTS co_lead_user_ids JSONB DEFAULT '[]'::jsonb;

-- 3. Create workspace_department_members junction table
-- Allows one member to belong to multiple departments without creating duplicate workspace memberships
CREATE TABLE IF NOT EXISTS public.workspace_department_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.team_workspaces(id) ON DELETE CASCADE,
    department_id UUID NOT NULL REFERENCES public.workspace_departments(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES public.workspace_members(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    department_role VARCHAR(50) NOT NULL DEFAULT 'member' CHECK (department_role IN ('lead', 'co_lead', 'member')),
    role_title VARCHAR(100) DEFAULT 'Department Member',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    assigned_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    CONSTRAINT uq_dept_member UNIQUE (department_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_dept_members_ws ON public.workspace_department_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_dept_members_dept ON public.workspace_department_members(department_id);
CREATE INDEX IF NOT EXISTS idx_dept_members_user ON public.workspace_department_members(user_id);
CREATE INDEX IF NOT EXISTS idx_dept_members_member ON public.workspace_department_members(member_id);
CREATE INDEX IF NOT EXISTS idx_dept_members_role ON public.workspace_department_members(department_id, department_role);

-- 4. Create workspace_invitations table (Cryptographically hashed token workflow)
CREATE TABLE IF NOT EXISTS public.workspace_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.team_workspaces(id) ON DELETE CASCADE,
    inviter_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    invited_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    role_id UUID NOT NULL REFERENCES public.workspace_roles(id) ON DELETE RESTRICT,
    department_id UUID REFERENCES public.workspace_departments(id) ON DELETE SET NULL,
    token_hash VARCHAR(128) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
    invitation_message TEXT NULL,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    accepted_at TIMESTAMPTZ NULL,
    revoked_at TIMESTAMPTZ NULL,
    revoked_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_invitations_token_hash ON public.workspace_invitations(token_hash);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_ws_status ON public.workspace_invitations(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_email ON public.workspace_invitations(workspace_id, LOWER(email));
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_user ON public.workspace_invitations(invited_user_id);
