-- =========================================================================
-- Migration 020: Production-Grade Settings & Account Governance System
-- Help Center, Privacy Center, Account Status Governance, Entitlements & FAQs
-- =========================================================================

-- 1. Users Table Extensions
ALTER TABLE users ADD COLUMN IF NOT EXISTS staff_role VARCHAR(50) DEFAULT 'user';

-- 2. Help Tickets Extensions (lifecycle expansion and staff assignment)
ALTER TABLE help_tickets DROP CONSTRAINT IF EXISTS help_tickets_status_check;
ALTER TABLE help_tickets ADD CONSTRAINT help_tickets_status_check CHECK (status IN (
    'open',
    'acknowledged',
    'in_progress',
    'investigating',
    'waiting_on_user',
    'resolved',
    'closed'
));

ALTER TABLE help_tickets ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE help_tickets ADD COLUMN IF NOT EXISTS assigned_team VARCHAR(50) DEFAULT 'general';
ALTER TABLE help_tickets ADD COLUMN IF NOT EXISTS internal_notes TEXT;
ALTER TABLE help_tickets ADD COLUMN IF NOT EXISTS last_response_at TIMESTAMPTZ;
ALTER TABLE help_tickets ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
ALTER TABLE help_tickets ADD COLUMN IF NOT EXISTS closed_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- 3. Help FAQs System Table
CREATE TABLE IF NOT EXISTS help_faqs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(120) UNIQUE NOT NULL,
    category VARCHAR(50) NOT NULL,
    question VARCHAR(300) NOT NULL,
    answer TEXT NOT NULL,
    helpful_count INT DEFAULT 0,
    not_helpful_count INT DEFAULT 0,
    is_published BOOLEAN DEFAULT true,
    order_index INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_help_faqs_category ON help_faqs(category, order_index);
CREATE INDEX IF NOT EXISTS idx_help_faqs_published ON help_faqs(is_published);

-- FAQ Feedback Table (one vote per user/IP)
CREATE TABLE IF NOT EXISTS help_faq_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    faq_id UUID NOT NULL REFERENCES help_faqs(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    ip_address VARCHAR(45),
    is_helpful BOOLEAN NOT NULL,
    feedback_text TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (faq_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_help_faq_feedback_faq ON help_faq_feedback(faq_id);

-- Ticket Attachments Metadata Table
CREATE TABLE IF NOT EXISTS help_ticket_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES help_tickets(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_size_bytes INT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    storage_path TEXT NOT NULL,
    download_url TEXT NOT NULL,
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_help_ticket_att_ticket ON help_ticket_attachments(ticket_id);

-- 4. Privacy Preferences Table
CREATE TABLE IF NOT EXISTS user_privacy_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    anonymous_telemetry_enabled BOOLEAN NOT NULL DEFAULT false,
    public_profile_visibility VARCHAR(20) NOT NULL DEFAULT 'public' CHECK (public_profile_visibility IN ('public', 'private')),
    resume_visibility VARCHAR(30) NOT NULL DEFAULT 'private' CHECK (resume_visibility IN ('private', 'public', 'shared_only')),
    recruiter_contact_allowed BOOLEAN NOT NULL DEFAULT true,
    activity_visibility VARCHAR(30) NOT NULL DEFAULT 'all' CHECK (activity_visibility IN ('all', 'milestones_only', 'private')),
    consent_version VARCHAR(20) DEFAULT 'v1.0',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Account Deletion Requests Table
CREATE TABLE IF NOT EXISTS account_deletion_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(30) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'processing', 'completed', 'cancelled')),
    reason TEXT,
    grace_period_days INT NOT NULL DEFAULT 7,
    scheduled_for TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    cancelled_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    requested_ip VARCHAR(45),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_account_deletion_user ON account_deletion_requests(user_id, status);

-- Privacy Request Audit Log Table
CREATE TABLE IF NOT EXISTS privacy_request_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    request_type VARCHAR(50) NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_privacy_audit_user ON privacy_request_audit(user_id, created_at DESC);

-- 5. Account Status & Governance Tables
CREATE TABLE IF NOT EXISTS account_statuses (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    standing VARCHAR(50) NOT NULL DEFAULT 'good_standing' CHECK (standing IN (
        'good_standing',
        'warning',
        'under_review',
        'restricted',
        'suspended',
        'deactivated'
    )),
    severity VARCHAR(20) NOT NULL DEFAULT 'none' CHECK (severity IN (
        'none',
        'low',
        'medium',
        'high',
        'critical'
    )),
    public_reason_code VARCHAR(100),
    public_reason TEXT,
    internal_reason TEXT,
    restrictions JSONB DEFAULT '[]'::jsonb,
    effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    last_reviewed_at TIMESTAMPTZ,
    next_review_at TIMESTAMPTZ,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    source VARCHAR(20) DEFAULT 'system' CHECK (source IN ('system', 'manual_admin', 'automated_rule')),
    version INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Account Status History (Append-Only Audit Log)
CREATE TABLE IF NOT EXISTS account_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    previous_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    reason_code VARCHAR(100),
    public_explanation TEXT,
    internal_note TEXT,
    restrictions_before JSONB DEFAULT '[]'::jsonb,
    restrictions_after JSONB DEFAULT '[]'::jsonb,
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    actor_role VARCHAR(50),
    effective_from TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_account_status_history_user ON account_status_history(user_id, created_at DESC);

-- Granular Account Restrictions Table
CREATE TABLE IF NOT EXISTS account_restrictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    restriction_type VARCHAR(100) NOT NULL,
    affected_resource VARCHAR(100),
    reason_code VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
    starts_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_account_restrictions_user_active ON account_restrictions(user_id, status);

-- Account Entitlements & Platform Quotas Table
CREATE TABLE IF NOT EXISTS account_entitlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entitlement_key VARCHAR(100) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    scope VARCHAR(50) DEFAULT 'standard',
    quota_limit INT,
    effective_from TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    source VARCHAR(50) DEFAULT 'system',
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, entitlement_key)
);

CREATE INDEX IF NOT EXISTS idx_account_entitlements_user ON account_entitlements(user_id);

-- 6. Initial Seed of Standard Production FAQs
INSERT INTO help_faqs (slug, category, question, answer, order_index)
VALUES
(
    'sync-frequency',
    'platform_sync',
    'How often does Orbix refresh my platform stats (LeetCode, Codeforces, GitHub)?',
    'Orbix triggers automatic daily syncs for all connected profiles. You can also trigger an instant live refresh at any time by visiting your Developer Profile or Onboarding hub and clicking ''Sync''. Sync health and platform response latency are monitored continuously.',
    1
),
(
    'college-update-rule',
    'college_clubs',
    'Why is my College Name locked or on cooldown?',
    'To ensure leaderboard integrity and prevent gaming college standings during contest seasons, college identity updates have a 3-day verification cooldown. You can change your college once every 3 days. Your verified campus history remains securely recorded.',
    2
),
(
    'orbix-score-algorithm',
    'coding_statistics',
    'How is the Orbix Score calculated across competitive platforms?',
    'Orbix Score is a calibrated 0 to 10,000 composite algorithm that mathematically weights algorithmic problem counts across platforms (40%), rated contest performance (35%), active weekly streak consistency (15%), and verified open-source GitHub contributions (10%). Diminishing returns curves ensure fair benchmarking across all coding platforms.',
    3
),
(
    'private-profile-privacy',
    'privacy_security',
    'What happens when I toggle my profile to Private?',
    'A private profile immediately de-indexes your stats, contest rating history, and resume from public URLs and global explore searches. Only essential identity information (name and handle) remains visible to confirmed connections. Recruiter direct messaging is disabled.',
    4
),
(
    'resume-intelligence-audit',
    'resume_analytics',
    'How does the Resume Intelligence engine evaluate my resume?',
    'The Orbix Resume Intelligence engine uses deterministic multi-stage AST parsing to evaluate resumes across 7 distinct dimensions: ATS Compatibility, Quantification & Metrics, Technical Depth, Action-Oriented Language, Brevity, Section Architecture, and Verifiable Project Provenance.',
    5
),
(
    'club-accreditation-process',
    'college_clubs',
    'What is required to verify a student developer club?',
    'Clubs submit collegiate proof (such as an official college portal link or faculty advisor contact). Once submitted, the Orbix verification queue reviews the request under the 4-Pillar Reviewer Standard within 24 to 48 business hours.',
    6
),
(
    'card-studio-export',
    'getting_started',
    'How can I export my verified developer card or embed my live badge?',
    'Visit the Card Studio on your profile page to customize themes, download high-resolution PNG/SVG assets, or copy the auto-updating Markdown badge snippet for your GitHub README.',
    7
),
(
    'account-standing-governance',
    'account_auth',
    'How is Account Standing determined on Orbix?',
    'Account Standing reflects compliance with Orbix Community Guidelines, verified authenticity of contest and solved problem counts, and account security. Users maintain Good Standing as long as zero platform integrity or conduct violations occur.',
    8
)
ON CONFLICT (slug) DO NOTHING;
