-- Migration 053: Three Leaderboards & Department Performance Index (DPI)
-- Extends workspace recognition policy to support configurable, versioned DPI weights and metrics.

ALTER TABLE public.workspace_recognition_policies
ADD COLUMN IF NOT EXISTS dpi_weight_approved_tasks NUMERIC(5,2) NOT NULL DEFAULT 35.00,
ADD COLUMN IF NOT EXISTS dpi_weight_on_time NUMERIC(5,2) NOT NULL DEFAULT 35.00,
ADD COLUMN IF NOT EXISTS dpi_weight_participation NUMERIC(5,2) NOT NULL DEFAULT 20.00,
ADD COLUMN IF NOT EXISTS dpi_weight_recognition NUMERIC(5,2) NOT NULL DEFAULT 10.00,
ADD COLUMN IF NOT EXISTS dpi_recognition_cap_per_member INTEGER NOT NULL DEFAULT 50,
ADD COLUMN IF NOT EXISTS dpi_min_tasks_sample INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS dpi_formula_version VARCHAR(20) NOT NULL DEFAULT 'v1.0';

-- Performance index for department task aggregations
CREATE INDEX IF NOT EXISTS idx_workspace_tasks_dept_status ON public.workspace_tasks(workspace_id, department_id, status);
CREATE INDEX IF NOT EXISTS idx_workspace_tasks_dept_due ON public.workspace_tasks(workspace_id, department_id, due_date);
CREATE INDEX IF NOT EXISTS idx_workspace_tasks_dept_completed ON public.workspace_tasks(workspace_id, department_id, completed_at);
