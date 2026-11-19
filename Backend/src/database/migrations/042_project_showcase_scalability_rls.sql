-- ============================================================================
-- Migration 042: Scalable Project Showcase Entity, Atomic Lock & Row Level Security
--
-- Features:
-- 1. Full logical specification columns:
--    - short_description: concise summary
--    - repository_provider: VCS platform (default 'github')
--    - repository_owner: account/org handle
--    - repository_visibility: 'public' | 'private' | 'internal'
--    - repository_metadata: raw GitHub metrics (stars, forks, open issues, etc.)
--    - extraction_status: 'pending' | 'analyzing' | 'completed' | 'manual' | 'incomplete' | 'error'
--    - extraction_completeness: 0-100 completeness score
--    - show_on_profile: portfolio display visibility toggle
--    - repository_link_visibility: 'visible' | 'hidden'
-- 2. Enhanced atomic concurrency protection with advisory transaction lock
-- 3. Supabase / PostgreSQL Row Level Security (RLS) & Role Grants
-- ============================================================================

-- 1. Add logical specification columns
ALTER TABLE public.user_projects
ADD COLUMN IF NOT EXISTS short_description TEXT NULL,
ADD COLUMN IF NOT EXISTS repository_provider VARCHAR(50) DEFAULT 'github',
ADD COLUMN IF NOT EXISTS repository_owner VARCHAR(100) NULL,
ADD COLUMN IF NOT EXISTS repository_visibility VARCHAR(20) DEFAULT 'public' CHECK (repository_visibility IN ('public', 'private', 'internal')),
ADD COLUMN IF NOT EXISTS repository_metadata JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS extraction_status VARCHAR(30) DEFAULT 'completed' CHECK (extraction_status IN ('pending', 'analyzing', 'completed', 'manual', 'incomplete', 'error')),
ADD COLUMN IF NOT EXISTS extraction_completeness INT DEFAULT 100 CHECK (extraction_completeness BETWEEN 0 AND 100),
ADD COLUMN IF NOT EXISTS show_on_profile BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS repository_link_visibility VARCHAR(20) DEFAULT 'visible' CHECK (repository_link_visibility IN ('visible', 'hidden'));

-- Synchronize existing records
UPDATE public.user_projects
SET
    short_description = COALESCE(short_description, description),
    repository_visibility = CASE WHEN is_repo_private = true THEN 'private' ELSE 'public' END,
    repository_link_visibility = CASE WHEN hide_repo_url = true THEN 'hidden' ELSE 'visible' END,
    repository_owner = CASE 
        WHEN repository_owner IS NULL AND repo_name LIKE '%/%' THEN split_part(repo_name, '/', 1)
        ELSE repository_owner
    END
WHERE short_description IS NULL OR repository_owner IS NULL;

-- 2. Performance & Query Optimization Indexes
CREATE INDEX IF NOT EXISTS idx_user_projects_visibility ON public.user_projects(is_published, show_on_profile);
CREATE INDEX IF NOT EXISTS idx_user_projects_provider_owner ON public.user_projects(repository_provider, repository_owner);
CREATE INDEX IF NOT EXISTS idx_user_projects_extraction ON public.user_projects(extraction_status, extraction_completeness);
CREATE INDEX IF NOT EXISTS idx_user_projects_show_profile ON public.user_projects(user_id, show_on_profile) WHERE show_on_profile = true;

-- 3. Enhanced Atomic 4-Project Capacity Enforcement with Advisory Transaction Lock
-- Prevents race conditions from simultaneous requests trying to exceed 4 projects
CREATE OR REPLACE FUNCTION enforce_user_projects_max_limit()
RETURNS TRIGGER AS $$
DECLARE
    project_count INT;
BEGIN
    -- Acquire advisory transaction lock for this user to guarantee strict serialization
    PERFORM pg_advisory_xact_lock(hashtext('user_projects_capacity_' || NEW.user_id::text));

    SELECT COUNT(*) INTO project_count
    FROM public.user_projects
    WHERE user_id = NEW.user_id;

    IF project_count >= 4 THEN
        RAISE EXCEPTION 'Maximum project showcase capacity reached (4/4). You cannot showcase more than 4 projects. Please delete an existing project before adding a new one.'
            USING ERRCODE = '23514'; -- check_violation
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_enforce_user_projects_max_limit ON public.user_projects;
CREATE TRIGGER trigger_enforce_user_projects_max_limit
BEFORE INSERT ON public.user_projects
FOR EACH ROW
EXECUTE FUNCTION enforce_user_projects_max_limit();

-- 4. Supabase / PostgreSQL Row Level Security (RLS) & Role Grants
ALTER TABLE public.user_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_github_installations ENABLE ROW LEVEL SECURITY;

-- Grants to service_role (Full system backend privileges)
GRANT ALL PRIVILEGES ON TABLE public.user_projects TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.user_github_installations TO service_role;

-- Grants to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_projects TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.user_github_installations TO authenticated;

-- Grants to anonymous public visitors (SELECT only)
GRANT SELECT ON public.user_projects TO anon;

-- RLS Policies on user_projects
DROP POLICY IF EXISTS owner_manage_projects ON public.user_projects;
CREATE POLICY owner_manage_projects
    ON public.user_projects
    FOR ALL TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS public_read_published_projects ON public.user_projects;
CREATE POLICY public_read_published_projects
    ON public.user_projects
    FOR SELECT TO anon, authenticated
    USING (is_published = true AND show_on_profile = true);

-- RLS Policies on user_github_installations (Strictly owner accessible)
DROP POLICY IF EXISTS owner_manage_github_installations ON public.user_github_installations;
CREATE POLICY owner_manage_github_installations
    ON public.user_github_installations
    FOR ALL TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));
