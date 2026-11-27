ALTER TABLE public.certificate_templates
    ADD COLUMN IF NOT EXISTS official_template_id UUID REFERENCES public.certificate_templates(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS is_starter_copy BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS creation_key UUID,
    ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;

-- Restore provenance only when the old copy name and the saved artwork identify one original.
WITH origins AS (
    SELECT copy.id, (ARRAY_AGG(official.id))[1] AS official_id
    FROM public.certificate_templates copy
    JOIN public.certificate_templates official ON official.is_system
        AND copy.name = official.name || ' (Copy)' AND copy.design = official.design
    WHERE NOT copy.is_system AND copy.official_template_id IS NULL
    GROUP BY copy.id
    HAVING COUNT(*) = 1
)
UPDATE public.certificate_templates copy SET official_template_id = origins.official_id
FROM origins WHERE copy.id = origins.id;

WITH starters AS (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY club_id, official_template_id ORDER BY updated_at DESC, id) AS position
    FROM public.certificate_templates
    WHERE official_template_id IS NOT NULL AND status <> 'archived' AND NOT is_system
)
UPDATE public.certificate_templates copy SET is_starter_copy = true
FROM starters WHERE copy.id = starters.id AND starters.position = 1
  AND NOT EXISTS (
      SELECT 1 FROM public.certificate_templates existing
      WHERE existing.club_id = copy.club_id AND existing.official_template_id = copy.official_template_id
        AND existing.is_starter_copy AND existing.status <> 'archived'
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_certificate_template_starter_copy
    ON public.certificate_templates (club_id, official_template_id)
    WHERE is_starter_copy AND status <> 'archived';

CREATE UNIQUE INDEX IF NOT EXISTS idx_certificate_template_creation_key
    ON public.certificate_templates (club_id, creation_key);

CREATE INDEX IF NOT EXISTS idx_certificate_template_official_source
    ON public.certificate_templates (official_template_id)
    WHERE official_template_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_certificate_discovery_recent_issues
    ON public.club_certificates (created_at DESC, template_id)
    WHERE template_id IS NOT NULL AND is_revoked = false;

CREATE TABLE IF NOT EXISTS public.certificate_template_view_history (
    club_id UUID NOT NULL REFERENCES public.verified_clubs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    template_ids UUID[] NOT NULL CHECK (cardinality(template_ids) <= 10),
    PRIMARY KEY (club_id, user_id)
);

ALTER TABLE public.certificate_template_view_history ENABLE ROW LEVEL SECURITY;
