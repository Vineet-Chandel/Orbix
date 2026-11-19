-- Migration 056: Distinguish Club Identity vs Member Identity on workspace messages

ALTER TABLE public.workspace_messages
ADD COLUMN IF NOT EXISTS sender_type VARCHAR(20) NOT NULL DEFAULT 'member';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_workspace_messages_sender_type'
    ) THEN
        ALTER TABLE public.workspace_messages
        ADD CONSTRAINT chk_workspace_messages_sender_type
        CHECK (sender_type IN ('member', 'club'));
    END IF;
END $$;

-- Backfill existing messages created by club institutional accounts
UPDATE public.workspace_messages wm
SET sender_type = 'club'
FROM public.users u
WHERE u.id = wm.sender_id AND u.account_type = 'club' AND wm.sender_type != 'club';
