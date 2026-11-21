-- =========================================================================
-- Migration 015: Club Inbox, Public Messaging, Quotas, Moderation & Event RSVP
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Club Conversations
CREATE TABLE IF NOT EXISTS public.club_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES public.verified_clubs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    subject VARCHAR(100) NOT NULL DEFAULT 'General Inquiry',
    status VARCHAR(30) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'archived')),
    is_read_by_club BOOLEAN NOT NULL DEFAULT false,
    is_read_by_user BOOLEAN NOT NULL DEFAULT true,
    last_message_preview TEXT,
    last_message_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT unique_club_user_conversation UNIQUE (club_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_club_conv_club_time 
    ON public.club_conversations(club_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_club_conv_user_time 
    ON public.club_conversations(user_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_club_conv_club_unread 
    ON public.club_conversations(club_id, is_read_by_club) 
    WHERE is_read_by_club = false;

-- 2. Club Messages
CREATE TABLE IF NOT EXISTS public.club_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.club_conversations(id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES public.verified_clubs(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('user', 'club')),
    body TEXT NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 5000),
    is_muted_delivery BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_club_msgs_conv_time 
    ON public.club_messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_club_msgs_club_time 
    ON public.club_messages(club_id, created_at DESC);

-- 3. Club User Moderation (Mute and Block)
CREATE TABLE IF NOT EXISTS public.club_user_moderation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES public.verified_clubs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    is_muted BOOLEAN NOT NULL DEFAULT false,
    muted_at TIMESTAMPTZ,
    muted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    mute_reason TEXT,
    is_blocked BOOLEAN NOT NULL DEFAULT false,
    blocked_at TIMESTAMPTZ,
    blocked_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    block_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT unique_club_user_moderation UNIQUE (club_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_club_mod_lookup 
    ON public.club_user_moderation(club_id, user_id);
CREATE INDEX IF NOT EXISTS idx_club_mod_muted 
    ON public.club_user_moderation(club_id) 
    WHERE is_muted = true;
CREATE INDEX IF NOT EXISTS idx_club_mod_blocked 
    ON public.club_user_moderation(club_id) 
    WHERE is_blocked = true;

-- 4. Club Message Action Logs (For durable audit & sliding-window rate limit checks)
CREATE TABLE IF NOT EXISTS public.club_message_action_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES public.verified_clubs(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_club_msg_logs_user_time 
    ON public.club_message_action_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_club_msg_logs_pair_time 
    ON public.club_message_action_logs(user_id, club_id, created_at DESC);

-- 5. Club Event Registrations (RSVP and Check-in with Block Enforcement)
CREATE TABLE IF NOT EXISTS public.club_event_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.club_events(id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES public.verified_clubs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    status VARCHAR(30) NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'attended', 'cancelled', 'blocked')),
    registered_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    checked_in_at TIMESTAMPTZ,
    ticket_code VARCHAR(50) NOT NULL DEFAULT ('ORB-' || upper(substr(md5(random()::text), 1, 8))),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT unique_event_user_registration UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_reg_event 
    ON public.club_event_registrations(event_id, status);
CREATE INDEX IF NOT EXISTS idx_event_reg_user 
    ON public.club_event_registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_event_reg_club 
    ON public.club_event_registrations(club_id);
