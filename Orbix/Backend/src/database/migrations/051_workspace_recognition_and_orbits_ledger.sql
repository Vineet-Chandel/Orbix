-- ============================================================================
-- Migration 051: Orbix Recognition, Immutable Ledger and Orbits Engine
-- Feature: Orbix Recognition
-- Unit: Orbits (Integer points)
-- ============================================================================

-- 1. Recognition Configuration Policies
CREATE TABLE IF NOT EXISTS public.workspace_recognition_policies (
    workspace_id UUID PRIMARY KEY REFERENCES public.team_workspaces(id) ON DELETE CASCADE,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    point_unit_name VARCHAR(50) NOT NULL DEFAULT 'Orbits',
    min_points_per_award INTEGER NOT NULL DEFAULT 5 CHECK (min_points_per_award > 0),
    max_points_per_award INTEGER NOT NULL DEFAULT 50 CHECK (max_points_per_award >= min_points_per_award),
    manager_monthly_budget INTEGER NOT NULL DEFAULT 500 CHECK (manager_monthly_budget >= 0),
    recipient_monthly_cap INTEGER NOT NULL DEFAULT 150 CHECK (recipient_monthly_cap >= max_points_per_award),
    daily_award_limit_per_issuer INTEGER NOT NULL DEFAULT 5 CHECK (daily_award_limit_per_issuer > 0),
    require_task_link BOOLEAN NOT NULL DEFAULT FALSE,
    require_evidence_link BOOLEAN NOT NULL DEFAULT FALSE,
    min_reason_length INTEGER NOT NULL DEFAULT 15 CHECK (min_reason_length >= 5),
    is_workspace_visible BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

-- 2. Recognition Categories
CREATE TABLE IF NOT EXISTS public.workspace_recognition_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.team_workspaces(id) ON DELETE CASCADE,
    name VARCHAR(80) NOT NULL,
    slug VARCHAR(80) NOT NULL,
    description TEXT NOT NULL,
    icon VARCHAR(50) NOT NULL DEFAULT 'Award',
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(workspace_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_recognition_categories_ws_slug 
ON public.workspace_recognition_categories(workspace_id, slug);

CREATE INDEX IF NOT EXISTS idx_recognition_categories_ws_active 
ON public.workspace_recognition_categories(workspace_id, is_active, display_order ASC);

-- 3. Recognition Budgets (Monthly allocated budget per issuer)
CREATE TABLE IF NOT EXISTS public.workspace_recognition_budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.team_workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    year_month VARCHAR(7) NOT NULL, -- e.g. '2026-11'
    allocated_budget INTEGER NOT NULL DEFAULT 500 CHECK (allocated_budget >= 0),
    used_budget INTEGER NOT NULL DEFAULT 0 CHECK (used_budget >= 0),
    allocated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(workspace_id, user_id, year_month)
);

CREATE INDEX IF NOT EXISTS idx_recognition_budgets_lookup 
ON public.workspace_recognition_budgets(workspace_id, user_id, year_month);

-- 4. Authoritative Immutable Recognition Ledger
CREATE TABLE IF NOT EXISTS public.workspace_recognition_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.team_workspaces(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    issuer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    department_id UUID REFERENCES public.workspace_departments(id) ON DELETE SET NULL,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('award', 'reversal')),
    points_delta INTEGER NOT NULL, -- positive for award, negative for reversal
    category_id UUID NOT NULL REFERENCES public.workspace_recognition_categories(id) ON DELETE RESTRICT,
    appreciation_reason TEXT NOT NULL,
    linked_task_id UUID REFERENCES public.workspace_tasks(id) ON DELETE SET NULL,
    linked_milestone_id VARCHAR(100),
    evidence_url TEXT,
    reference_award_id UUID REFERENCES public.workspace_recognition_ledger(id) ON DELETE RESTRICT,
    idempotency_key VARCHAR(120),
    status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'reversed')),
    
    -- Reversal metadata
    is_reversed BOOLEAN NOT NULL DEFAULT FALSE,
    reversal_reason TEXT,
    reversed_at TIMESTAMPTZ,
    reversed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,

    -- Security metadata
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Strict Anti-Self-Award Constraint
    CONSTRAINT chk_recognition_no_self_awards CHECK (issuer_id <> recipient_id)
);

-- Indices for rapid queries, leaderboards, and audit
CREATE INDEX IF NOT EXISTS idx_recognition_ledger_ws_recipient 
ON public.workspace_recognition_ledger(workspace_id, recipient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_recognition_ledger_ws_issuer 
ON public.workspace_recognition_ledger(workspace_id, issuer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_recognition_ledger_ws_dept 
ON public.workspace_recognition_ledger(workspace_id, department_id, created_at DESC) 
WHERE department_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_recognition_ledger_ref_award 
ON public.workspace_recognition_ledger(reference_award_id) 
WHERE reference_award_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_recognition_ledger_idempotency 
ON public.workspace_recognition_ledger(workspace_id, idempotency_key) 
WHERE idempotency_key IS NOT NULL;

-- 5. Recognition Period Aggregates (Weekly, Monthly, All-Time summaries)
CREATE TABLE IF NOT EXISTS public.workspace_recognition_period_aggregates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.team_workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    period_type VARCHAR(20) NOT NULL CHECK (period_type IN ('weekly', 'monthly', 'all_time')),
    period_key VARCHAR(30) NOT NULL, -- 'all_time', '2026-11', '2026-W45'
    total_orbits_received INTEGER NOT NULL DEFAULT 0 CHECK (total_orbits_received >= 0),
    total_orbits_given INTEGER NOT NULL DEFAULT 0 CHECK (total_orbits_given >= 0),
    awards_count INTEGER NOT NULL DEFAULT 0 CHECK (awards_count >= 0),
    last_award_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(workspace_id, user_id, period_type, period_key)
);

CREATE INDEX IF NOT EXISTS idx_recognition_aggregates_leaderboard 
ON public.workspace_recognition_period_aggregates(workspace_id, period_type, period_key, total_orbits_received DESC);
