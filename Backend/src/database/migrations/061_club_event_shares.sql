-- Migration 061: Event Shares Tracking & Idempotency
-- Enables tracking of public and authenticated event share actions with idempotency duplicate prevention.

CREATE TABLE IF NOT EXISTS public.club_event_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.club_events(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    idempotency_key VARCHAR(128) NOT NULL,
    platform VARCHAR(50) NOT NULL DEFAULT 'web_share',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_event_share_idempotency UNIQUE (event_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_club_event_shares_event ON public.club_event_shares(event_id);
CREATE INDEX IF NOT EXISTS idx_club_event_shares_created ON public.club_event_shares(created_at);
CREATE INDEX IF NOT EXISTS idx_club_event_shares_user ON public.club_event_shares(user_id);
