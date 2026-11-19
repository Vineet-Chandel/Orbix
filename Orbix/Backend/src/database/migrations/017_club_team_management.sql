-- 017_club_team_management.sql
-- Migration for Orbix Club Team Management System

-- 1. Ensure club_teams table & columns
CREATE TABLE IF NOT EXISTS public.club_teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES public.verified_clubs(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(120),
    description TEXT,
    responsibilities TEXT,
    lead_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    co_lead_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'active',
    is_archived BOOLEAN NOT NULL DEFAULT false,
    display_order INT NOT NULL DEFAULT 0,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.club_teams ADD COLUMN IF NOT EXISTS responsibilities TEXT;
ALTER TABLE public.club_teams ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'active';
ALTER TABLE public.club_teams ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.club_teams ADD COLUMN IF NOT EXISTS display_order INT NOT NULL DEFAULT 0;

-- Sync is_archived with status
UPDATE public.club_teams SET is_archived = (status = 'archived') WHERE is_archived IS DISTINCT FROM (status = 'archived');

-- 2. Ensure club_memberships table & columns
CREATE TABLE IF NOT EXISTS public.club_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES public.verified_clubs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    access_role VARCHAR(30) NOT NULL DEFAULT 'member',
    club_role VARCHAR(30) NOT NULL DEFAULT 'member',
    title VARCHAR(100) NOT NULL DEFAULT 'Member',
    status VARCHAR(30) NOT NULL DEFAULT 'active',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    invited_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.club_memberships ADD COLUMN IF NOT EXISTS access_role VARCHAR(30) NOT NULL DEFAULT 'member';
ALTER TABLE public.club_memberships ADD COLUMN IF NOT EXISTS club_role VARCHAR(30);
UPDATE public.club_memberships SET club_role = access_role WHERE club_role IS NULL;

-- 3. Ensure club_team_members table & columns
CREATE TABLE IF NOT EXISTS public.club_team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES public.club_teams(id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES public.verified_clubs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    club_membership_id UUID REFERENCES public.club_memberships(id) ON DELETE CASCADE,
    team_role VARCHAR(30) NOT NULL DEFAULT 'member',
    team_title VARCHAR(100) NOT NULL DEFAULT 'Member',
    status VARCHAR(30) NOT NULL DEFAULT 'active',
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    assigned_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.club_team_members ADD COLUMN IF NOT EXISTS club_membership_id UUID;
ALTER TABLE public.club_team_members ADD COLUMN IF NOT EXISTS team_role VARCHAR(30) NOT NULL DEFAULT 'member';
ALTER TABLE public.club_team_members ADD COLUMN IF NOT EXISTS team_title VARCHAR(100) NOT NULL DEFAULT 'Member';
ALTER TABLE public.club_team_members ADD COLUMN IF NOT EXISTS position_title VARCHAR(100) NOT NULL DEFAULT 'Member';
ALTER TABLE public.club_team_members ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'active';
UPDATE public.club_team_members SET position_title = team_title WHERE position_title IS NULL;
UPDATE public.club_team_members SET team_title = position_title WHERE team_title IS NULL;

-- 4. Ensure club_team_invitations table & columns
CREATE TABLE IF NOT EXISTS public.club_team_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES public.verified_clubs(id) ON DELETE CASCADE,
    team_id UUID REFERENCES public.club_teams(id) ON DELETE CASCADE,
    invited_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    invited_by_user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    inviter_user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    access_role VARCHAR(30) NOT NULL DEFAULT 'member',
    club_role VARCHAR(30) NOT NULL DEFAULT 'member',
    title VARCHAR(100) NOT NULL DEFAULT 'Member',
    team_role VARCHAR(30) NOT NULL DEFAULT 'member',
    team_title VARCHAR(100) NOT NULL DEFAULT 'Member',
    position_title VARCHAR(100) NOT NULL DEFAULT 'Member',
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    token VARCHAR(120),
    notification_id UUID REFERENCES public.user_notifications(id) ON DELETE SET NULL,
    invitation_message TEXT,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    responded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.club_team_invitations ADD COLUMN IF NOT EXISTS invited_by_user_id UUID;
ALTER TABLE public.club_team_invitations ADD COLUMN IF NOT EXISTS inviter_user_id UUID;
ALTER TABLE public.club_team_invitations ADD COLUMN IF NOT EXISTS access_role VARCHAR(30) NOT NULL DEFAULT 'member';
ALTER TABLE public.club_team_invitations ADD COLUMN IF NOT EXISTS club_role VARCHAR(30);
ALTER TABLE public.club_team_invitations ADD COLUMN IF NOT EXISTS team_role VARCHAR(30) NOT NULL DEFAULT 'member';
ALTER TABLE public.club_team_invitations ADD COLUMN IF NOT EXISTS title VARCHAR(100) NOT NULL DEFAULT 'Member';
ALTER TABLE public.club_team_invitations ADD COLUMN IF NOT EXISTS team_title VARCHAR(100) NOT NULL DEFAULT 'Member';
ALTER TABLE public.club_team_invitations ADD COLUMN IF NOT EXISTS position_title VARCHAR(100);
ALTER TABLE public.club_team_invitations ADD COLUMN IF NOT EXISTS notification_id UUID REFERENCES public.user_notifications(id) ON DELETE SET NULL;
ALTER TABLE public.club_team_invitations ADD COLUMN IF NOT EXISTS invitation_message TEXT;

UPDATE public.club_team_invitations SET inviter_user_id = invited_by_user_id WHERE inviter_user_id IS NULL AND invited_by_user_id IS NOT NULL;
UPDATE public.club_team_invitations SET invited_by_user_id = inviter_user_id WHERE invited_by_user_id IS NULL AND inviter_user_id IS NOT NULL;
UPDATE public.club_team_invitations SET club_role = access_role WHERE club_role IS NULL AND access_role IS NOT NULL;
UPDATE public.club_team_invitations SET position_title = COALESCE(team_title, title, 'Member') WHERE position_title IS NULL;

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_club_teams_club_id ON public.club_teams (club_id);
CREATE INDEX IF NOT EXISTS idx_club_teams_lead ON public.club_teams (lead_user_id);
CREATE INDEX IF NOT EXISTS idx_club_memberships_club ON public.club_memberships (club_id);
CREATE INDEX IF NOT EXISTS idx_club_memberships_user ON public.club_memberships (user_id);
CREATE INDEX IF NOT EXISTS idx_club_team_members_team ON public.club_team_members (team_id);
CREATE INDEX IF NOT EXISTS idx_club_team_members_user ON public.club_team_members (user_id);
CREATE INDEX IF NOT EXISTS idx_club_team_invitations_user ON public.club_team_invitations (invited_user_id, status);
CREATE INDEX IF NOT EXISTS idx_club_team_invitations_club ON public.club_team_invitations (club_id, status);

-- 6. Bootstrap verified club owners into club_memberships
INSERT INTO public.club_memberships (club_id, user_id, access_role, club_role, title, status, joined_at)
SELECT vc.id, vc.auth_user_id, 'owner', 'owner', 'President', 'active', vc.verified_at
FROM public.verified_clubs vc
WHERE NOT EXISTS (
    SELECT 1 FROM public.club_memberships cm
    WHERE cm.club_id = vc.id AND cm.user_id = vc.auth_user_id
)
ON CONFLICT DO NOTHING;
