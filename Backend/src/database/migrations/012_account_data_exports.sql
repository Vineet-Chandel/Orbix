-- 012_account_data_exports.sql
-- Production Data Archive & Portability Engine (GDPR Article 20 / CCPA)
-- Stores cryptographic export records, SHA256 checksums, and audit logs.

CREATE TABLE IF NOT EXISTS account_data_exports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    export_id VARCHAR(64) UNIQUE NOT NULL,
    requested_categories TEXT[] NOT NULL DEFAULT '{}',
    sha256_checksum VARCHAR(64) NOT NULL,
    file_size_bytes INTEGER NOT NULL,
    record_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '48 hours')
);

CREATE INDEX IF NOT EXISTS idx_account_data_exports_user 
ON account_data_exports(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_account_data_exports_export_id 
ON account_data_exports(export_id);
