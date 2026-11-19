-- Migration 050: Department Transfers Ledger and Task Accountability Performance Indexes
-- Ensures immutable audit trail when members change departments and optimizes accountability aggregations

CREATE TABLE IF NOT EXISTS public.workspace_department_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.team_workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    from_department_id UUID REFERENCES public.workspace_departments(id) ON DELETE SET NULL,
    to_department_id UUID NOT NULL REFERENCES public.workspace_departments(id) ON DELETE CASCADE,
    transferred_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance and query indexes
CREATE INDEX IF NOT EXISTS idx_ws_dept_transfers_ws_user 
    ON public.workspace_department_transfers(workspace_id, user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ws_dept_transfers_ws_created 
    ON public.workspace_department_transfers(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ws_dept_transfers_from_dept 
    ON public.workspace_department_transfers(from_department_id);

CREATE INDEX IF NOT EXISTS idx_ws_dept_transfers_to_dept 
    ON public.workspace_department_transfers(to_department_id);

-- Composite index on workspace_tasks for high-velocity accountability queries
CREATE INDEX IF NOT EXISTS idx_workspace_tasks_accountability_status_due
    ON public.workspace_tasks(workspace_id, status, due_date)
    WHERE is_archived = false;

CREATE INDEX IF NOT EXISTS idx_workspace_tasks_department_status_due
    ON public.workspace_tasks(department_id, status, due_date)
    WHERE is_archived = false;
