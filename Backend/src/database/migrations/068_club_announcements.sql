CREATE TABLE IF NOT EXISTS public.club_announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES public.verified_clubs(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    content JSONB NOT NULL,
    plain_text TEXT NOT NULL DEFAULT '' CHECK (length(plain_text) <= 20000),
    status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
    client_request_id UUID NOT NULL,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (author_id, client_request_id)
);
CREATE INDEX IF NOT EXISTS idx_announcements_club_feed ON public.club_announcements(club_id, created_at DESC, id DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_announcements_published_feed ON public.club_announcements(created_at DESC, id DESC) WHERE status='published' AND deleted_at IS NULL;
CREATE TABLE IF NOT EXISTS public.club_announcement_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID REFERENCES public.verified_clubs(id) ON DELETE SET NULL,
    uploader_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    announcement_id UUID REFERENCES public.club_announcements(id) ON DELETE SET NULL,
    public_id TEXT NOT NULL UNIQUE,
    resource_type TEXT NOT NULL CHECK (resource_type IN ('image','video','raw')),
    media_type TEXT NOT NULL CHECK (media_type IN ('image','video','audio','pdf')),
    filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    bytes BIGINT NOT NULL CHECK (bytes > 0),
    format TEXT,
    width INTEGER,
    height INTEGER,
    duration DOUBLE PRECISION,
    version BIGINT,
    display_order INTEGER NOT NULL DEFAULT 0,
    state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','verified','attached','cleanup','deleted')),
    finalize_until TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '15 minutes'),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '70 minutes'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_announcement_assets_parent ON public.club_announcement_assets(announcement_id, display_order);
CREATE INDEX IF NOT EXISTS idx_announcement_assets_orphans ON public.club_announcement_assets(expires_at) WHERE announcement_id IS NULL AND state <> 'deleted';
CREATE TABLE IF NOT EXISTS public.club_announcement_likes (
    announcement_id UUID NOT NULL REFERENCES public.club_announcements(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (announcement_id, user_id)
);
-- Database-backed limits work consistently across server instances and Redis outages.
CREATE TABLE IF NOT EXISTS public.club_announcement_limits (
    actor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    bucket BIGINT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 1,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '2 days'),
    PRIMARY KEY (actor_id, action, bucket)
);
CREATE TABLE IF NOT EXISTS public.club_announcement_jobs (
    announcement_id UUID PRIMARY KEY REFERENCES public.club_announcements(id) ON DELETE CASCADE,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_announcement_jobs_pending ON public.club_announcement_jobs(created_at) WHERE processed_at IS NULL;
CREATE TABLE IF NOT EXISTS public.club_announcement_audit (
    id BIGSERIAL PRIMARY KEY,
    announcement_id UUID NOT NULL REFERENCES public.club_announcements(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
