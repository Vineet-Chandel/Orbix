-- Migration 036: Orbix Club Credibility Engine
-- Evidence-based reputation system: snapshots, immutable audit ledger, and appeals

-- 1. Club Credibility Snapshots Table (Optimized cached representation of club reputation)
CREATE TABLE IF NOT EXISTS public.club_credibility_snapshots (
    club_id UUID PRIMARY KEY REFERENCES public.verified_clubs(id) ON DELETE CASCADE,
    current_score NUMERIC(5,2) NOT NULL DEFAULT 50.00 CHECK (current_score >= 0 AND current_score <= 100),
    lifetime_score NUMERIC(5,2) NOT NULL DEFAULT 50.00 CHECK (lifetime_score >= 0 AND lifetime_score <= 100),
    recent_score NUMERIC(5,2) NOT NULL DEFAULT 50.00 CHECK (recent_score >= 0 AND recent_score <= 100),
    score_level VARCHAR(20) NOT NULL DEFAULT 'developing' CHECK (score_level IN ('critical', 'developing', 'reliable', 'trusted', 'exceptional')),
    confidence_level VARCHAR(20) NOT NULL DEFAULT 'low' CHECK (confidence_level IN ('low', 'medium', 'high')),
    is_provisional BOOLEAN NOT NULL DEFAULT true,
    total_verified_events INT NOT NULL DEFAULT 0,
    total_verified_incidents INT NOT NULL DEFAULT 0,
    successful_event_streak INT NOT NULL DEFAULT 0,
    total_evidence_weight NUMERIC(8,2) NOT NULL DEFAULT 0,
    dimensional_scores JSONB NOT NULL DEFAULT '{
        "eventDelivery": 50,
        "scheduleReliability": 50,
        "communication": 50,
        "participantExperience": 50,
        "cancellationReliability": 50,
        "certificateIntegrity": 50
    }'::jsonb,
    scoring_version VARCHAR(20) NOT NULL DEFAULT 'v1.0',
    last_calculated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_club_credibility_snapshots_score
    ON public.club_credibility_snapshots(current_score DESC);
CREATE INDEX IF NOT EXISTS idx_club_credibility_snapshots_level
    ON public.club_credibility_snapshots(score_level);

-- 2. Credibility Ledger (Immutable, append-only source of truth)
CREATE TABLE IF NOT EXISTS public.club_credibility_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES public.verified_clubs(id) ON DELETE CASCADE,
    event_id UUID REFERENCES public.club_events(id) ON DELETE SET NULL,
    source_action VARCHAR(50) NOT NULL, -- 'event_completed', 'event_cancelled', 'event_postponed', 'event_deleted', 'certificate_issued', 'complaint_resolved', 'incident_verified', 'appeal_reversed', 'manual_adjustment'
    reason_code VARCHAR(60) NOT NULL,
    outcome_quality NUMERIC(5,2) NOT NULL CHECK (outcome_quality >= 0 AND outcome_quality <= 100),
    evidence_weight NUMERIC(5,2) NOT NULL CHECK (evidence_weight >= 0 AND evidence_weight <= 20),
    score_before NUMERIC(5,2) NOT NULL,
    score_after NUMERIC(5,2) NOT NULL,
    score_delta NUMERIC(5,2) NOT NULL,
    evidence_confidence NUMERIC(3,2) NOT NULL DEFAULT 1.00 CHECK (evidence_confidence >= 0.1 AND evidence_confidence <= 1.0),
    factor_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
    evidence_references JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(20) NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'reversed')),
    reversal_reference_id UUID REFERENCES public.club_credibility_ledger(id) ON DELETE SET NULL,
    actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    actor_type VARCHAR(20) NOT NULL DEFAULT 'club_admin' CHECK (actor_type IN ('club_admin', 'system', 'platform_admin')),
    idempotency_key VARCHAR(128) UNIQUE,
    scoring_version VARCHAR(20) NOT NULL DEFAULT 'v1.0',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finalised_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_credibility_ledger_club_created
    ON public.club_credibility_ledger(club_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credibility_ledger_event
    ON public.club_credibility_ledger(event_id);
CREATE INDEX IF NOT EXISTS idx_credibility_ledger_source_action
    ON public.club_credibility_ledger(source_action);
CREATE INDEX IF NOT EXISTS idx_credibility_ledger_status
    ON public.club_credibility_ledger(status);

-- 3. Credibility Appeals Table
CREATE TABLE IF NOT EXISTS public.club_credibility_appeals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES public.verified_clubs(id) ON DELETE CASCADE,
    ledger_id UUID NOT NULL REFERENCES public.club_credibility_ledger(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    evidence_attachments JSONB DEFAULT '[]'::jsonb,
    appeal_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (appeal_status IN ('pending', 'under_review', 'approved', 'rejected')),
    reviewer_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    review_decision VARCHAR(20),
    reviewer_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_credibility_appeals_club
    ON public.club_credibility_appeals(club_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credibility_appeals_ledger
    ON public.club_credibility_appeals(ledger_id);
CREATE INDEX IF NOT EXISTS idx_credibility_appeals_status
    ON public.club_credibility_appeals(appeal_status);

-- 4. Initial Seed for Existing Verified Clubs (Insert default 50.00 provisional snapshot if missing)
INSERT INTO public.club_credibility_snapshots (club_id, current_score, lifetime_score, recent_score, is_provisional, score_level, confidence_level)
SELECT id, 50.00, 50.00, 50.00, true, 'developing', 'low'
FROM public.verified_clubs
ON CONFLICT (club_id) DO NOTHING;
