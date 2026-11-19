-- 021_login_activity_and_sessions.sql
-- Production-Grade Login Activity, Device Session Management & Club Access Audit

-- 1. User Sessions Table (Persistent server-managed sessions)
CREATE TABLE IF NOT EXISTS public.user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    session_id VARCHAR(128) NOT NULL UNIQUE,
    device_id_hash VARCHAR(64) NOT NULL,
    device_name VARCHAR(100) NOT NULL,
    device_type VARCHAR(30) NOT NULL DEFAULT 'desktop',
    browser VARCHAR(50) NOT NULL,
    browser_version VARCHAR(30),
    operating_system VARCHAR(50) NOT NULL,
    operating_system_version VARCHAR(30),
    user_agent_summary TEXT,
    raw_user_agent TEXT,
    ip_address_masked VARCHAR(64) NOT NULL,
    ip_address_hash VARCHAR(64) NOT NULL,
    city VARCHAR(100),
    region VARCHAR(100),
    country VARCHAR(100),
    country_code VARCHAR(10),
    location_summary VARCHAR(200),
    login_method VARCHAR(40) NOT NULL DEFAULT 'password',
    is_mfa_authenticated BOOLEAN NOT NULL DEFAULT false,
    is_new_device BOOLEAN NOT NULL DEFAULT false,
    risk_level VARCHAR(20) NOT NULL DEFAULT 'low',
    risk_reasons TEXT[] DEFAULT '{}',
    status VARCHAR(30) NOT NULL DEFAULT 'active', -- 'active', 'revoked', 'expired', 'logged_out'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    revocation_reason VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_created ON public.user_sessions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_id ON public.user_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON public.user_sessions(user_id, status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_user_sessions_device_hash ON public.user_sessions(user_id, device_id_hash);

-- 2. Club Access Events Table (Audit log of team access to collegiate clubs)
CREATE TABLE IF NOT EXISTS public.club_access_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES public.verified_clubs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    membership_id UUID REFERENCES public.club_memberships(id) ON DELETE SET NULL,
    session_id VARCHAR(128) REFERENCES public.user_sessions(session_id) ON DELETE SET NULL,
    action VARCHAR(60) NOT NULL, -- 'club_accessed', 'club_dashboard_opened', 'club_settings_viewed', 'member_access_revoked', 'club_session_ended'
    user_role_at_time VARCHAR(40) NOT NULL DEFAULT 'member',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_club_access_club_created ON public.club_access_events(club_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_club_access_user ON public.club_access_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_club_access_session ON public.club_access_events(session_id);

-- 3. Account Security Events Table (Non-repudiable audit timeline of security events)
CREATE TABLE IF NOT EXISTS public.account_security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    session_id VARCHAR(128),
    event_type VARCHAR(60) NOT NULL,
    title VARCHAR(150) NOT NULL,
    description TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'info', -- 'info', 'warning', 'high', 'critical'
    ip_address_masked VARCHAR(64),
    location_summary VARCHAR(200),
    device_summary VARCHAR(150),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_events_user_created ON public.account_security_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_type ON public.account_security_events(user_id, event_type);
