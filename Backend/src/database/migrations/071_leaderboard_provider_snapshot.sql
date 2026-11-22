-- Provider-fetched metrics only. Never backfill from client-writable snapshots.
ALTER TABLE public.user_links ADD COLUMN IF NOT EXISTS leaderboard_snapshot JSONB;
