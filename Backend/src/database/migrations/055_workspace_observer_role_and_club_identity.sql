-- Migration 055: Workspace Observer Role and System Roles Alignment

-- 1. Ensure Observer role exists for all active workspaces
INSERT INTO public.workspace_roles (
    workspace_id,
    name,
    slug,
    description,
    rank,
    is_system,
    color,
    permissions
)
SELECT
    tw.id,
    'Observer',
    'observer',
    'Read-only observer access to view public channels, tasks, and shared resources.',
    50,
    true,
    '#64748b',
    '["channels:view", "messages:read", "tasks:view", "files:view"]'::jsonb
FROM public.team_workspaces tw
WHERE NOT EXISTS (
    SELECT 1 FROM public.workspace_roles wr
    WHERE wr.workspace_id = tw.id AND wr.slug = 'observer'
);
