-- 025_update_club_events_location_type.sql
-- Update club_events location_type check constraint to support 'in_person', 'online', 'virtual', 'hybrid'

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'club_events'
    ) THEN
        ALTER TABLE public.club_events DROP CONSTRAINT IF EXISTS club_events_location_type_check;
        ALTER TABLE public.club_events ADD CONSTRAINT club_events_location_type_check
            CHECK (location_type IN ('in_person', 'online', 'virtual', 'hybrid'));
    END IF;
END $$;
