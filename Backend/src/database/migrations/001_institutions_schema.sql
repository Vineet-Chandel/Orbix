-- ============================================================
-- Migration 001: Verified Indian Institution Directory
-- ============================================================
-- Creates the institutions table, source evidence table,
-- verification requests table, and adds college_id FK to users.
-- Idempotent: safe to run multiple times.
-- ============================================================

-- 1. Institutions table
CREATE TABLE IF NOT EXISTS institutions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    official_name VARCHAR(500) NOT NULL,
    normalized_name VARCHAR(500) NOT NULL,
    aliases TEXT[] DEFAULT '{}',
    aishe_code VARCHAR(50) UNIQUE,
    state VARCHAR(100),
    district VARCHAR(150),
    city VARCHAR(150),
    institution_type VARCHAR(100),
    website VARCHAR(500),
    verification_status VARCHAR(30) NOT NULL DEFAULT 'unverified'
        CHECK (verification_status IN ('verified', 'needs_review', 'unverified', 'inactive')),
    verification_basis TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_verified_at TIMESTAMPTZ,
    source_year VARCHAR(20),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Search indexes for autocomplete performance
CREATE INDEX IF NOT EXISTS idx_institutions_normalized_name
    ON institutions (normalized_name varchar_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_institutions_status_active
    ON institutions (verification_status, is_active)
    WHERE verification_status = 'verified' AND is_active = true;
CREATE INDEX IF NOT EXISTS idx_institutions_state
    ON institutions (state);
CREATE INDEX IF NOT EXISTS idx_institutions_aishe_code
    ON institutions (aishe_code)
    WHERE aishe_code IS NOT NULL;
-- Trigram index for fuzzy search (requires pg_trgm extension)
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- CREATE INDEX IF NOT EXISTS idx_institutions_name_trgm
--     ON institutions USING gin (normalized_name gin_trgm_ops);

-- 2. Regulatory identifiers table (supports multiple identifiers per institution)
CREATE TABLE IF NOT EXISTS institution_regulatory_ids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    regulator VARCHAR(50) NOT NULL,  -- 'UGC', 'AICTE', 'NAAC', 'NBA', etc.
    identifier VARCHAR(100) NOT NULL,
    status VARCHAR(50),  -- 'recognized', 'approved', 'accredited', etc.
    valid_from DATE,
    valid_until DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_institution_regulator UNIQUE (institution_id, regulator, identifier)
);

CREATE INDEX IF NOT EXISTS idx_institution_regulatory_ids_institution
    ON institution_regulatory_ids (institution_id);

-- 3. Source evidence table
CREATE TABLE IF NOT EXISTS institution_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    source_name VARCHAR(200) NOT NULL,       -- e.g. 'AISHE 2023-24 Report'
    source_url TEXT,                          -- official URL
    source_record_id VARCHAR(100),           -- e.g. AISHE code or UGC serial
    source_publication_year VARCHAR(20),      -- e.g. '2023-24'
    retrieval_date DATE NOT NULL DEFAULT CURRENT_DATE,
    verification_result VARCHAR(50) NOT NULL DEFAULT 'confirmed'
        CHECK (verification_result IN ('confirmed', 'partial', 'conflicting', 'unverified')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_institution_sources_institution
    ON institution_sources (institution_id);

-- 4. Verification requests table (for missing institutions)
CREATE TABLE IF NOT EXISTS institution_verification_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submitted_by_user_id UUID,
    submitted_by_username VARCHAR(100),
    institution_name VARCHAR(500) NOT NULL,
    institution_website VARCHAR(500),
    supporting_reference TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'under_review', 'approved', 'rejected', 'duplicate')),
    admin_notes TEXT,
    resolved_institution_id UUID REFERENCES institutions(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_verification_requests_status
    ON institution_verification_requests (status);
CREATE INDEX IF NOT EXISTS idx_verification_requests_user
    ON institution_verification_requests (submitted_by_user_id);

-- 5. Add college_id foreign key to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS college_id UUID REFERENCES institutions(id);
CREATE INDEX IF NOT EXISTS idx_users_college_id ON users (college_id);

-- 6. Add college_id to leaderboard_entries for display
ALTER TABLE leaderboard_entries ADD COLUMN IF NOT EXISTS college_id UUID;

-- 7. RPC function for fast autocomplete search
CREATE OR REPLACE FUNCTION search_verified_institutions(
    query_text TEXT,
    state_filter TEXT DEFAULT NULL,
    result_limit INT DEFAULT 15
)
RETURNS TABLE (
    id UUID,
    official_name VARCHAR(500),
    city VARCHAR(150),
    state VARCHAR(100),
    district VARCHAR(150),
    institution_type VARCHAR(100),
    aishe_code VARCHAR(50),
    verification_status VARCHAR(30)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    sanitized_query TEXT;
    search_pattern TEXT;
BEGIN
    -- Enforce max result limit server-side
    IF result_limit > 50 THEN
        result_limit := 50;
    END IF;
    IF result_limit < 1 THEN
        result_limit := 15;
    END IF;

    -- Sanitize: remove SQL wildcards and trim
    sanitized_query := TRIM(query_text);
    sanitized_query := REPLACE(sanitized_query, '%', '');
    sanitized_query := REPLACE(sanitized_query, '_', '');
    sanitized_query := REPLACE(sanitized_query, '\', '');

    -- Require at least 2 meaningful characters
    IF LENGTH(sanitized_query) < 2 THEN
        RETURN;
    END IF;

    -- Lowercase for case-insensitive prefix matching
    search_pattern := LOWER(sanitized_query) || '%';

    RETURN QUERY
    SELECT
        i.id,
        i.official_name,
        i.city,
        i.state,
        i.district,
        i.institution_type,
        i.aishe_code,
        i.verification_status
    FROM institutions i
    WHERE i.verification_status = 'verified'
      AND i.is_active = true
      AND (
          i.normalized_name LIKE search_pattern
          OR EXISTS (
              SELECT 1 FROM unnest(i.aliases) alias
              WHERE LOWER(alias) LIKE search_pattern
          )
      )
      AND (state_filter IS NULL OR LOWER(i.state) = LOWER(state_filter))
    ORDER BY
        -- Exact prefix match on normalized_name ranks highest
        CASE WHEN i.normalized_name LIKE search_pattern THEN 0 ELSE 1 END,
        LENGTH(i.official_name) ASC,
        i.official_name ASC
    LIMIT result_limit;
END;
$$;

-- 8. Server-side validation function for profile college_id update
CREATE OR REPLACE FUNCTION validate_college_selection(
    target_college_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF target_college_id IS NULL THEN
        RETURN true;  -- Allow clearing college selection
    END IF;

    RETURN EXISTS (
        SELECT 1 FROM institutions
        WHERE id = target_college_id
          AND verification_status = 'verified'
          AND is_active = true
    );
END;
$$;
