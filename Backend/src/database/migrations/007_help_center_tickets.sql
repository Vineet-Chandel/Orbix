-- =========================================================================
-- Migration 007: Help Center Tickets and Discussion Messages
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.help_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_number VARCHAR(32) UNIQUE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    username VARCHAR(100),
    contact_email VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN (
        'bug_report',
        'sync_issue',
        'college_verification',
        'feature_request',
        'general_inquiry'
    )),
    subject VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (priority IN (
        'low',
        'normal',
        'high',
        'urgent'
    )),
    status VARCHAR(30) NOT NULL DEFAULT 'open' CHECK (status IN (
        'open',
        'investigating',
        'waiting_on_user',
        'resolved',
        'closed'
    )),
    system_info JSONB DEFAULT '{}'::jsonb,
    attachment_url TEXT,
    resolution_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.help_ticket_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES public.help_tickets(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('user', 'support', 'system')),
    sender_name VARCHAR(100),
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_help_tickets_user_id ON public.help_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_help_tickets_status ON public.help_tickets(status);
CREATE INDEX IF NOT EXISTS idx_help_tickets_created_at ON public.help_tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_help_tickets_ticket_num ON public.help_tickets(ticket_number);
CREATE INDEX IF NOT EXISTS idx_help_ticket_msgs_ticket_id ON public.help_ticket_messages(ticket_id);
