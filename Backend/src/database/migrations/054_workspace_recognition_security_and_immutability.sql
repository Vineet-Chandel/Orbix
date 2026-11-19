-- ============================================================================
-- Migration 054: Workspace Recognition Security, Ledger Immutability & Budget Integrity
-- Enforces:
-- 1. Database-level ledger immutability trigger (blocks DELETE and unauthorized UPDATEs)
-- 2. Budget constraint (used_budget <= allocated_budget)
-- 3. Points delta transaction type integrity check
-- ============================================================================

-- 1. Add CHECK constraint on workspace_recognition_budgets ensuring used_budget never exceeds allocated_budget
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'chk_used_budget_lte_allocated'
    ) THEN
        ALTER TABLE public.workspace_recognition_budgets
        ADD CONSTRAINT chk_used_budget_lte_allocated CHECK (used_budget <= allocated_budget);
    END IF;
END $$;

-- 2. Add CHECK constraint on workspace_recognition_ledger ensuring transaction_type matches points_delta polarity
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'chk_points_delta_type'
    ) THEN
        ALTER TABLE public.workspace_recognition_ledger
        ADD CONSTRAINT chk_points_delta_type 
        CHECK ((transaction_type = 'award' AND points_delta > 0) OR (transaction_type = 'reversal' AND points_delta < 0));
    END IF;
END $$;

-- 3. Ledger Immutability Guard Function & Trigger
CREATE OR REPLACE FUNCTION public.fn_guard_recognition_ledger_immutability()
RETURNS TRIGGER AS $$
BEGIN
    -- Permanently forbid row deletion
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Security violation: workspace_recognition_ledger records are permanently immutable and cannot be deleted.';
    END IF;

    -- On UPDATE, strictly forbid modifying any core ledger field
    IF TG_OP = 'UPDATE' THEN
        IF OLD.id <> NEW.id OR
           OLD.workspace_id <> NEW.workspace_id OR
           OLD.recipient_id <> NEW.recipient_id OR
           OLD.issuer_id <> NEW.issuer_id OR
           COALESCE(OLD.department_id, '00000000-0000-0000-0000-000000000000'::uuid) <> COALESCE(NEW.department_id, '00000000-0000-0000-0000-000000000000'::uuid) OR
           OLD.transaction_type <> NEW.transaction_type OR
           OLD.points_delta <> NEW.points_delta OR
           OLD.category_id <> NEW.category_id OR
           OLD.appreciation_reason <> NEW.appreciation_reason OR
           OLD.created_at <> NEW.created_at THEN
            RAISE EXCEPTION 'Security violation: Core recognition ledger fields (points, recipient, issuer, department, reason, timestamp) are immutable and cannot be modified.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_guard_recognition_ledger_immutability ON public.workspace_recognition_ledger;
CREATE TRIGGER trg_guard_recognition_ledger_immutability
BEFORE UPDATE OR DELETE ON public.workspace_recognition_ledger
FOR EACH ROW EXECUTE FUNCTION public.fn_guard_recognition_ledger_immutability();
