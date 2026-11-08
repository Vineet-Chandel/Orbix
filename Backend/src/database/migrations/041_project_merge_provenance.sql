-- ============================================================================
-- Migration 041: Field-Level Provenance & Non-Destructive Data Merge Engine
--
-- Features:
-- 1. raw_extracted_data: Stores the verbatim repository extraction snapshot
-- 2. field_overrides: Tracks which fields the user has manually customized
-- 3. last_synced_at: Timestamp of the most recent GitHub synchronization
-- 4. sync_metadata: Holds sync state, latest diffs, and pending updates count
-- ============================================================================

ALTER TABLE user_projects
ADD COLUMN IF NOT EXISTS raw_extracted_data JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS field_overrides JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS sync_metadata JSONB DEFAULT '{"lastCheckAt": null, "pendingDiffCount": 0}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_user_projects_synced ON user_projects(last_synced_at);
