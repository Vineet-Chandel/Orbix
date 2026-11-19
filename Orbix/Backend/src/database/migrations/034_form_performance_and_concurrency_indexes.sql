-- Migration 034: Form Performance, Concurrency, and Observability Indexes
-- Accelerates capacity locks, duplicate lookups, response pagination, and QR check-ins under high concurrency

-- 1. Ensure atomic event capacity, registered_count, and eligibility columns exist on club_events
ALTER TABLE public.club_events
    ADD COLUMN IF NOT EXISTS capacity INT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS registered_count INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS eligibility VARCHAR(50) DEFAULT 'open_to_all';

-- Synchronize registered_count with existing registrations
UPDATE public.club_events e
SET registered_count = COALESCE((
    SELECT COUNT(*)::int
    FROM public.club_event_registrations r
    WHERE r.event_id = e.id AND r.status NOT IN ('cancelled', 'rejected')
), 0)
WHERE registered_count = 0;

-- 2. Accelerate duplicate registration checks (event_id + user_id)
CREATE INDEX IF NOT EXISTS idx_club_event_reg_event_user
    ON public.club_event_registrations(event_id, user_id)
    WHERE user_id IS NOT NULL;

-- 3. Accelerate active registration capacity counts (excluding cancelled/rejected)
CREATE INDEX IF NOT EXISTS idx_club_event_reg_event_status
    ON public.club_event_registrations(event_id, status);

-- 4. Accelerate paginated responses dashboard queries (event_id + registered_at DESC)
CREATE INDEX IF NOT EXISTS idx_club_event_reg_event_registered_at
    ON public.club_event_registrations(event_id, registered_at DESC);

-- 5. Fast O(1) Idempotency lookup index
CREATE INDEX IF NOT EXISTS idx_club_event_reg_idempotency
    ON public.club_event_registrations(idempotency_key)
    WHERE idempotency_key IS NOT NULL;

-- 6. Fast QR Check-In Ticket Code lookup
CREATE INDEX IF NOT EXISTS idx_club_event_reg_ticket
    ON public.club_event_registrations(event_id, ticket_code)
    WHERE ticket_code IS NOT NULL;

-- 7. Fast Guest Email duplicate check
CREATE INDEX IF NOT EXISTS idx_club_event_reg_email
    ON public.club_event_registrations(event_id, lower(applicant_email))
    WHERE applicant_email IS NOT NULL;

-- 8. Accelerate Cross-Event Analytics & Question Library queries on club_events
CREATE INDEX IF NOT EXISTS idx_club_events_club_starts
    ON public.club_events(club_id, starts_at DESC);

CREATE INDEX IF NOT EXISTS idx_club_events_capacity_reg
    ON public.club_events(id, capacity, registered_count);

-- 9. Fast Draft lookups for in-progress registrations
CREATE INDEX IF NOT EXISTS idx_club_event_drafts_event_user
    ON public.club_event_response_drafts(event_id, user_id);
