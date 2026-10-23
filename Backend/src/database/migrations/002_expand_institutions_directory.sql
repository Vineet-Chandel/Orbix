-- ============================================================
-- Migration 002: Expand Institutions Directory & High-Performance Search
-- ============================================================
-- 1. Enable pg_trgm for fuzzy search and fast substring matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Add campus / parent university columns to institutions
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS parent_university VARCHAR(500);
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS parent_university_id UUID REFERENCES institutions(id) ON DELETE SET NULL;
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS subtype VARCHAR(100);

-- 3. Dedicated relational table for alternate names and abbreviations
CREATE TABLE IF NOT EXISTS institution_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    alias VARCHAR(255) NOT NULL,
    alias_type VARCHAR(50) DEFAULT 'abbreviation', -- 'acronym', 'abbreviation', 'popular', 'historical'
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_inst_alias UNIQUE (institution_id, alias)
);

CREATE INDEX IF NOT EXISTS idx_inst_aliases_alias
    ON institution_aliases (LOWER(alias) varchar_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_inst_aliases_inst_id
    ON institution_aliases (institution_id);

-- 4. Dedicated rankings table for NIRF and other official ranking bodies
CREATE TABLE IF NOT EXISTS institution_rankings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    ranking_body VARCHAR(50) NOT NULL, -- 'NIRF', 'NAAC', 'QS'
    year INT NOT NULL,
    category VARCHAR(100) NOT NULL,   -- 'Overall', 'Engineering', 'University', 'College', 'Management'
    rank VARCHAR(50) NOT NULL,        -- '1', '101-150', 'A++', etc.
    score NUMERIC(6,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_inst_ranking UNIQUE (institution_id, ranking_body, year, category)
);

CREATE INDEX IF NOT EXISTS idx_inst_rankings_inst
    ON institution_rankings (institution_id);

-- 5. Search indexes
CREATE INDEX IF NOT EXISTS idx_institutions_trgm_name
    ON institutions USING gin (normalized_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_institutions_city_lower
    ON institutions (LOWER(city));
CREATE INDEX IF NOT EXISTS idx_institutions_district_lower
    ON institutions (LOWER(district));

-- 6. Upgraded Multi-Strategy Autocomplete Search Function
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
    prefix_pattern TEXT;
    contains_pattern TEXT;
BEGIN
    IF result_limit > 50 THEN
        result_limit := 50;
    END IF;
    IF result_limit < 1 THEN
        result_limit := 15;
    END IF;

    -- Sanitize: trim and remove dangerous characters
    sanitized_query := TRIM(query_text);
    sanitized_query := REPLACE(sanitized_query, '%', '');
    sanitized_query := REPLACE(sanitized_query, '_', '');
    sanitized_query := REPLACE(sanitized_query, '\', '');

    IF LENGTH(sanitized_query) < 2 THEN
        RETURN;
    END IF;

    prefix_pattern := LOWER(sanitized_query) || '%';
    contains_pattern := '%' || LOWER(sanitized_query) || '%';

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
          -- Exact prefix match
          i.normalized_name LIKE prefix_pattern
          -- Word boundary match in official or normalized name (e.g. 'kanpur' matches '... kanpur')
          OR i.normalized_name LIKE '% ' || LOWER(sanitized_query) || '%'
          -- Aliases array prefix match
          OR EXISTS (
              SELECT 1 FROM unnest(i.aliases) alias
              WHERE LOWER(alias) LIKE prefix_pattern
                 OR LOWER(alias) = LOWER(sanitized_query)
          )
          -- Relational aliases table match
          OR EXISTS (
              SELECT 1 FROM institution_aliases ia
              WHERE ia.institution_id = i.id
                AND (LOWER(ia.alias) LIKE prefix_pattern OR LOWER(ia.alias) = LOWER(sanitized_query))
          )
          -- Substring match on normalized name
          OR i.normalized_name LIKE contains_pattern
          -- City or District match
          OR LOWER(COALESCE(i.city, '')) LIKE prefix_pattern
          OR LOWER(COALESCE(i.district, '')) LIKE prefix_pattern
          -- Exact AISHE code match
          OR LOWER(COALESCE(i.aishe_code, '')) = LOWER(sanitized_query)
      )
      AND (state_filter IS NULL OR LOWER(i.state) = LOWER(state_filter))
    ORDER BY
        -- 1. Exact alias match or exact prefix match on normalized_name
        CASE
            WHEN LOWER(i.normalized_name) = LOWER(sanitized_query) THEN 0
            WHEN EXISTS (SELECT 1 FROM unnest(i.aliases) a WHERE LOWER(a) = LOWER(sanitized_query)) THEN 0
            WHEN EXISTS (SELECT 1 FROM institution_aliases ia WHERE ia.institution_id = i.id AND LOWER(ia.alias) = LOWER(sanitized_query)) THEN 0
            WHEN i.normalized_name LIKE prefix_pattern THEN 1
            WHEN EXISTS (SELECT 1 FROM unnest(i.aliases) a WHERE LOWER(a) LIKE prefix_pattern) THEN 2
            WHEN EXISTS (SELECT 1 FROM institution_aliases ia WHERE ia.institution_id = i.id AND LOWER(ia.alias) LIKE prefix_pattern) THEN 2
            WHEN i.normalized_name LIKE '% ' || LOWER(sanitized_query) || '%' THEN 3
            WHEN i.normalized_name LIKE contains_pattern THEN 4
            ELSE 5
        END ASC,
        -- Boost canonical Universities / INIs over minor affiliated colleges when ranking is tied
        CASE
            WHEN i.institution_type IN ('Institute of National Importance', 'Central University', 'Deemed to be University', 'State Public University', 'Private University') THEN 0
            ELSE 1
        END ASC,
        LENGTH(i.official_name) ASC,
        i.official_name ASC
    LIMIT result_limit;
END;
$$;
