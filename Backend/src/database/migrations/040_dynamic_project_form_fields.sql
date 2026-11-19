-- ============================================================================
-- Migration 040: Dynamic Project Creation Form Fields
--
-- Features:
-- 1. Section A (Identity): project_type, development_status, full_overview
-- 2. Section B (Story): story JSONB (problem, motivation, solution, audience, differentiation, challenges, learnings)
-- 3. Section D (Tech Stack): categorized_technologies JSONB (grouped tech with confidence/provenance)
-- 4. Section E (Links): api_doc_url, figma_url (in addition to live, demo, repo, docs, external_links)
-- 5. Section G (Contribution): contribution JSONB (role, responsibilities, project_scope, team_members, description)
-- 6. Section H (Additional Details): additional_details JSONB (achievements, metrics, future improvements, deployment, custom fields)
-- ============================================================================

ALTER TABLE user_projects
ADD COLUMN IF NOT EXISTS project_type VARCHAR(60) DEFAULT 'Web application',
ADD COLUMN IF NOT EXISTS development_status VARCHAR(40) DEFAULT 'Completed',
ADD COLUMN IF NOT EXISTS full_overview TEXT NULL,
ADD COLUMN IF NOT EXISTS story JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS categorized_technologies JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS contribution JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS additional_details JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS api_doc_url TEXT NULL,
ADD COLUMN IF NOT EXISTS figma_url TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_user_projects_type ON user_projects(project_type);
CREATE INDEX IF NOT EXISTS idx_user_projects_dev_status ON user_projects(development_status);
