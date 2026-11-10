# Orbix — College Verification Feature
## Stage 3.7: Final Staging Runbook & AWS Architecture Reconciliation Audit Report (Addendum)

**Date:** 2026-11-08  
**Stage:** Stage 3.7 (AWS Architecture Reconciliation, Runbook Reconciliation & Security Audit Addendum)  
**Auditor Roles:** Senior Backend Engineer, DevOps Architect, Database Reliability Engineer, Application Security Auditor  
**Repository State:** `main` @ `5b8feb5cee37529e0b359ad9df0db7c6c5b3ea51`  
**Shared Supabase DB (`bhixamqnpcbstfwvmmog`) Status:** ZERO WRITES / 100% UNTOUCHED  
**Live AWS Deployment Status:** ZERO MODIFICATIONS / 100% UNTOUCHED  
**Runbook Under Review:** `Orbix — College Verification Staging Runbook` (Version 2.1.0 evaluated; updated to Version 2.2.0)  

---

## 1. Executive Summary & Audit Mandate

This addendum extends the Stage 3.7 engineering audit of Orbix's College Verification implementation and its proposed Staging Runbook (Version 2.1.0). The audit strictly enforces:
- **Zero code changes, zero database writes, zero AWS provisioning or modifications, zero commits, and zero pushes.**
- **Clear epistemological separation** between **Verified Facts** (derived from direct static code analysis and local execution), **Reported Infrastructure Details** (derived from user statements and educational blog documentation), and **Unknowns** (requiring live AWS account inspection).

### Final Verdict: `PARTIALLY VERIFIED — SPECIFIC INFRASTRUCTURE OR DOCUMENTATION ITEMS REQUIRE RESOLUTION`

**Verdict Rationale:**  
The application code, migration runner, isolated test suites (11 runner tests, 31 security unit tests), baseline bootstrap schema, and deployment runbook have been comprehensively verified against the repository with zero database pollution. However, autonomous execution remains blocked because:
1. **Target AWS Infrastructure Topology:** Live AWS compute resources (ECS/EC2), reverse proxy routing rules, and isolated staging RDS instances cannot be inspected from the sandbox without AWS credentials.
2. **Database Identity Enforcement:** The migration runner lacks runtime database identity validation; safeguards rely on shell assertions that require strict environment variable hygiene.
3. **Founder Allowlist Credentials:** Staging user UUIDs for both founders (Rahul Tripathi and Vineet Chandel) depend on accounts created in the isolated staging database and cannot be fabricated.
4. **Unresolved Product Policy:** The divergence between the product requirement (mandatory phone OTP) and code implementation (optional trust signal) remains an explicit founder blocker.
5. **AWS Deployed Baseline Commit:** Commit `092b10e` represents `origin/main` in Git, but cannot be proven to be the live running artifact without AWS deployment logs.

---

## 2. Issue 1: Database Identity Enforcement Audit

### 2.1 Audit of Runbook v2.1.0 Shell Safety Assertion (Section 1)
Runbook v2.1.0 Section 1 proposed the following shell assertion:
```bash
if echo "$SUPABASE_DB_URL" | grep -q "bhixamqnpcbstfwvmmog"; then
    echo "FATAL: Target database is the production/shared Supabase instance (bhixamqnpcbstfwvmmog)!"
    exit 1
fi
```

### 2.2 Critical Vulnerabilities & Bypass Vectors
1. **Fallback Bypass via `DATABASE_URL`:**  
   In [Backend/src/database/client.ts](file:///d:/Dev/GitHub/Orbix/Orbix/Backend/src/database/client.ts#L8):
   ```typescript
   const DATABASE_URL = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
   ```
   If an operator leaves `SUPABASE_DB_URL` empty while `DATABASE_URL` points to the shared production database (`bhixamqnpcbstfwvmmog`), the shell assertion passes completely (since `$SUPABASE_DB_URL` is empty), but the Node.js application falls back to `DATABASE_URL` and connects directly to the production database.
2. **Silent Failure of `STAGING_DATABASE_URL`:**  
   `STAGING_DATABASE_URL` is **not** consumed anywhere in the codebase. If an operator sets `STAGING_DATABASE_URL` in their environment thinking it protects staging, but a persistent `SUPABASE_DB_URL` or `DATABASE_URL` exists in the shell pointing to production, `client.ts` silently connects to production.
3. **Runner Absence of Independent Database Verification:**  
   In [Backend/src/database/run_migration.ts](file:///d:/Dev/GitHub/Orbix/Orbix/Backend/src/database/run_migration.ts), the runner obtains its pool via `getDefaultPool()` from `client.js`. The runner performs **zero runtime identity verification** on the target database, host, port, database name, or SSL server certificate.

### 2.3 Proposed Fail-Closed Staging Validation Inside Tooling (Design Only — Not Implemented)
To enforce fail-closed database validation within migration tooling in a future implementation cycle:
1. **Runtime Connection Inspection:** Upon pool connection, execute:
   ```sql
   SELECT current_database(), current_user, inet_server_addr();
   ```
2. **Blacklist Production Identifiers:** Inspect active connection parameters, connection string, and server address against known production project references (`bhixamqnpcbstfwvmmog`) and production domain names. If detected, throw an uncatchable fatal error and abort immediately.
3. **Whitelist Staging Flag:** Require an explicit environment flag (e.g. `ALLOW_STAGING_MIGRATIONS=true`) AND verify that the database name matches an approved staging prefix (e.g. `orbix_staging` or `staging-*`).
4. **Shell Assertion Update:** In Runbook v2.2.0, the shell assertion has been updated to inspect `CHECK_URL="${SUPABASE_DB_URL:-$DATABASE_URL}"`, reject empty values, and reject production patterns.

---

## 3. Issue 2: AWS Architecture Reconciliation

### 3.1 Taxonomy of Infrastructure Reality

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       ORBIX INFRASTRUCTURE TAXONOMY                        │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. VERIFIED FACTS (Static Code & Repository Evidence)                       │
│    - Node.js Express backend (PORT=5000)                                    │
│    - Vite React SPA frontend (dist/ bundle, relative /api/* paths)          │
│    - PostgreSQL connection via 'pg' Pool with SSL                           │
│    - Redis client via ioredis (REDIS_HOST, REDIS_PORT)                      │
│    - Cloudinary authenticated uploads ('orbix/college_verifications')       │
│    - Resend email API client & Twilio SMS client with fallback simulation   │
│                                                                             │
│ 2. REPORTED DETAILS (User Directives & Blog Content)                        │
│    - Orbix frontend and backend are hosted on AWS                           │
│    - Blog documentation references Nginx on EC2 and S3 + CloudFront         │
│    - Route 53 domain zones for orbix.dev and orbix.club                     │
│                                                                             │
│ 3. UNKNOWNS REQUIRING LIVE AWS INSPECTION                                   │
│    - Backend compute service (ECS Fargate vs EC2 instance vs Beanstalk)     │
│    - Frontend hosting provider (S3 static bucket vs EC2 Nginx document root)│
│    - Reverse proxy routing layer (ALB listener rules vs CloudFront routing) │
│    - Production database location (Supabase bhixamqnpcbstfwvmmog vs AWS RDS)│
│    - Production Redis service (AWS ElastiCache vs Upstash)                  │
│    - AWS IAM execution roles and deployment pipelines                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Confirmed Production vs Proposed Staging Matrix

| Infrastructure Subsystem | Confirmed Production Reality (Code) | Reported AWS Infrastructure | Proposed Staging Isolation Strategy |
| :--- | :--- | :--- | :--- |
| **Frontend** | Static Vite bundle in `Frontend/dist`. All API calls consume relative `/api/...`. | Hosted on AWS (S3/CloudFront or EC2 Nginx). | Dedicated S3 bucket (`orbix-frontend-staging`) + CloudFront distribution with ACM certificate. |
| **Backend** | Express server in `Backend/src/index.ts`. No container manifests in repo. | Hosted on AWS (ECS Fargate or EC2). | Dedicated ECS Fargate task definition or staging EC2 instance behind an ALB. |
| **Routing / Proxy** | Relative `/api/*` requires reverse proxy or shared origin. | CloudFront / Nginx path routing. | CloudFront default `/*` -> S3; `/api/*` -> ALB backend target group. |
| **Database** | Supabase PostgreSQL (`bhixamqnpcbstfwvmmog`) in repo `.env`. | Supabase or AWS RDS PostgreSQL. | Dedicated isolated AWS RDS PostgreSQL 15+ or separate Supabase staging project. |
| **Redis** | `ioredis` parsing `REDIS_HOST`, `REDIS_PORT`, `REDIS_USERNAME`, `REDIS_PASSWORD`. | Redis host configured in environment. | Dedicated Upstash Redis staging database or ElastiCache micro instance. |
| **Storage** | Cloudinary private authenticated folder (`orbix/college_verifications`). | Cloudinary production account. | Dedicated Cloudinary sub-account or isolated staging folder (`orbix/staging_college_verifications`). |
| **Email** | Resend API client (`resendService.ts`) with SMTP fallback. | Resend production sending domain. | Resend staging test key / sandbox or console simulation. |
| **SMS** | Twilio client (`smsGatewayService.ts`) with console simulation fallback. | Twilio / Firebase Phone Auth. | Built-in console simulation mode or Twilio staging SID. |

---

## 4. Issue 3: Bootstrap & Migrations Technical Audit

### 4.1 Verification of `bootstrap_baseline.sql`
- **File Existence:** [Backend/src/database/bootstrap_baseline.sql](file:///d:/Dev/GitHub/Orbix/Orbix/Backend/src/database/bootstrap_baseline.sql) exists in the repository.
- **Contents & Idempotency:**
  1. PostgreSQL Extensions: `CREATE EXTENSION IF NOT EXISTS "pgcrypto"`, `pg_trgm`, `uuid-ossp`.
  2. Foundation Tables: `users`, `user_links`, `leaderboard_entries`, `user_notifications`, `email_verification_otps`.
  3. Migration Tracking: `public.schema_migrations` (`version VARCHAR(255) PRIMARY KEY`, `applied_at TIMESTAMPTZ`).
  4. Idempotency: All DDL statements utilize `IF NOT EXISTS` guards. Zero conflicting constraints with subsequent migrations.

### 4.2 Exact Migration Count & Dependency Ordering
A strict filesystem inspection of `Backend/src/database/migrations` reveals **exactly 31 migration files**:
- **Missing Migration:** `018` was omitted in historical codebase commits.
- **Duplicate Prefix:** `020` occurs twice: `020_blog_likes.sql` and `020_settings_governance_system.sql`.
- **Deterministic Natural Numeric Sort:**
  The runner's sorting logic:
  ```typescript
  files.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
  ```
  Guarantees deterministic execution order across all Node.js platforms:
  1. `001_institutions_schema.sql` (Creates `institutions`)
  2. `002_expand_institutions_directory.sql` (References `institutions`)
  3. `003_club_verification_requests.sql` (References `users`)
  4. `004_relationships_blocks_notifications.sql` (References `users`)
  5. `005_relationship_block_quotas.sql` (References `users`)
  6. `006_verified_clubs_timeline_events.sql` (References `users`, `institutions`)
  7. `007_help_center_tickets.sql` (References `users`)
  8. `008_club_verified_college_fk.sql` (FK: `verified_clubs` -> `institutions`)
  9. `009_club_phone_verification.sql` (Creates `phone_verification_otps`)
  10. `010_firebase_phone_auth.sql` (Alters `users`, `club_verification_requests`)
  11. `011_manage_accounts_system.sql` (Creates account change operations)
  12. `012_account_data_exports.sql` (Creates `account_data_exports`)
  13. `013_club_unique_credentials_and_slugs.sql` (Alters `verified_clubs`)
  14. `014_remove_timeline_and_auto_enforce_verified_clubs.sql` (Alters `verified_clubs`)
  15. `015_club_inbox_and_moderation.sql` (References `verified_clubs`, `users`)
  16. `016_add_two_factor_auth.sql` (Alters `users`)
  17. `017_club_team_management.sql` (References `verified_clubs`, `users`)
  18. `019_club_profile_management.sql` (Alters `verified_clubs`)
  19. `020_blog_likes.sql` (Alphabetically first among `020`; references `users`)
  20. `020_settings_governance_system.sql` (Alphabetically second among `020`; references `users`)
  21. `021_login_activity_and_sessions.sql` (References `users`)
  22. `022_club_profile_redesign.sql` (Alters `verified_clubs`)
  23. `023_college_events_and_applications.sql` (Creates `club_events`)
  24. `024_oauth_authentication.sql` (Alters `users`)
  25. `025_update_club_events_location_type.sql` (Alters `club_events`)
  26. `026_club_events_completed_status.sql` (Alters `club_events`)
  27. `027_club_category_cooldown.sql` (Alters `verified_clubs`)
  28. `028_club_certificates.sql` (Creates `club_certificates`)
  29. `029_event_applications_approval_workflow.sql` (References `club_events`, `users`)
  30. `030_legal_consent_and_minor_protection.sql` (Creates `user_legal_consents`)
  31. `031_college_verifications.sql` (Creates `college_verifications`, tokens, OTPs, alters `users`)

### 4.3 Audit of Runner Commands Against Implementation
- **`--dry-run`:** Checks `to_regclass('public.schema_migrations')`. If table is absent, non-fatal. Calculates pending vs skipped. Logs message and returns without acquiring locks or executing queries. (Verified in Unit Test 5).
- **`--file`:** Uses `path.basename` to prevent traversal (`../`). Matches exact filename in sorted array. Rejects partial names (e.g. `031` throws error). (Verified in Unit Test 6).
- **`--adopt` (without `--confirm`):** Queries `information_schema.tables` and `columns`. Compares against explicit `MIGRATION_SIGNATURES`. Categorizes into `Verified Adoptable` vs `Divergent / Pending`. Writes zero records. (Verified in Unit Test 8).
- **`--adopt --confirm`:** Acquires session-level `pg_try_advisory_lock`. Wraps inserts into `schema_migrations` in an explicit `BEGIN ... COMMIT` transaction. Rolls back on error. (Verified in Unit Test 9).

---

## 5. Issue 4: Backup & Recovery Strategy Audit

### 5.1 Critique of Runbook v2.1.0 Backup Instruction
Runbook v2.1.0 Section 7 included:
```bash
supabase db dump --data=false > staging_snapshot_pre_031.sql
```
This instruction was fundamentally defective on two grounds:
1. **Schema-Only Dump is Non-Recoverable:** The `--data=false` flag dumps only DDL (`CREATE TABLE`, `CREATE INDEX`). It contains **zero data**. Restoring a schema-only dump onto a staging database destroys all user records, test accounts, seed institutions, and configuration state.
2. **Provider Incompatibility:** `supabase db dump` requires the Supabase CLI, an authenticated session, and a linked Supabase project. If staging is hosted on AWS RDS PostgreSQL or standard PostgreSQL, the Supabase CLI cannot communicate with the instance.

### 5.2 Complete Recoverable Backup Requirements
Runbook v2.2.0 replaces this instruction with two production-grade options:
- **AWS RDS Managed Snapshot:** Byte-level storage volume snapshot (`aws rds create-db-snapshot`), preserving complete instance state with point-in-time recovery capability.
- **Full Logical Dump (`pg_dump` with Data):**
  ```bash
  pg_dump --format=custom --no-owner --no-privileges -d "$DATABASE_URL" -f staging_pre_031_full.dump
  ```
  Verified via `pg_restore --list` to guarantee non-zero size and valid table catalog.

### 5.3 Tested Restore Requirements
A safe restoration procedure must include:
1. Active backend pool connection termination (`pg_terminate_backend`).
2. Clean restoration (`pg_restore --clean --if-exists`).
3. Post-restore verification query asserting row counts of `public.users` and `public.schema_migrations`.

---

## 6. Issue 5: Security Acceptance Coverage Audit

The 10 critical security test cases were evaluated against the implementation:

### 1. Cloudinary Upload Failure & Partial Cleanup
- **Static Finding:** In [collegeVerificationService.ts#L250](file:///d:/Dev/GitHub/Orbix/Orbix/Backend/src/services/verification/collegeVerificationService.ts#L250), `savePrivateDocument()` is called in a loop over uploaded files.
- **Defect Analysis:** If file 1 (front ID) succeeds on Cloudinary, but file 2 (back ID) fails due to format validation or network error, an unhandled exception is thrown. There is no rollback mechanism or `cloudinary.uploader.destroy()` call to purge file 1. File 1 remains orphaned on Cloudinary.
- **Runbook Coverage:** Restored as Security Test Case 7 in Runbook v2.2.0 matrix.

### 2. Cross-User Document Access
- **Static Finding:** [collegeVerificationRoutes.ts#L372](file:///d:/Dev/GitHub/Orbix/Orbix/Backend/src/Routes/verification/collegeVerificationRoutes.ts#L372) and [L442](file:///d:/Dev/GitHub/Orbix/Orbix/Backend/src/Routes/verification/collegeVerificationRoutes.ts#L442) mount `getApplication` and `document-proxy` exclusively on `founderCollegeVerificationRouter`, guarded by `authenticate, requireFounder`.
- **Verdict:** Verified secure. Regular students cannot access document proxy tokens or application details (HTTP 403 Forbidden).

### 3. Expired Signed Document URLs
- **Static Finding:** Cloudinary signed URLs use `expires_at: Math.floor(Date.now() / 1000) + 300` (5-minute TTL). Local storage HMAC tokens check `if (payload.exp < Math.floor(Date.now() / 1000)) return null;` in [collegeVerificationService.ts#L1101](file:///d:/Dev/GitHub/Orbix/Orbix/Backend/src/services/verification/collegeVerificationService.ts#L1101).
- **Verdict:** Verified secure. Expired URLs return 403 Forbidden.

### 4. Concurrent Founder Approvals
- **Static Finding:** In [collegeVerificationService.ts#L861](file:///d:/Dev/GitHub/Orbix/Orbix/Backend/src/services/verification/collegeVerificationService.ts#L861), the service checks `if (app.status === 'APPROVED') throw error;`. However, the subsequent query:
  `UPDATE college_verifications SET status = 'APPROVED' ... WHERE id = $4`
  does not enforce `AND status IN ('PENDING', 'PROCESSING')` in its `WHERE` clause.
- **Race Condition Risk:** If two founders click "Approve" at the exact same millisecond, both read the non-approved status, both execute updates, and the last write overwrites `reviewed_by` and `reviewed_at`.
- **Runbook Coverage:** Added as Security Test Case 22 to verify concurrency resilience in staging.

### 5. College Change Followed by Switching Back
- **Static Finding:** In [profile.ts#L691](file:///d:/Dev/GitHub/Orbix/Orbix/Backend/src/Routes/profile/profile.ts#L691), changing college sets `is_college_verified = false`, resets `college_verified_at = NULL`, updates prior verifications to `INVALIDATED`, and triggers a 72-hour lock (`COLLEGE_CHANGE_COOLDOWN_MS`).
- **Behavior:** If a student switches back to the original college after 72 hours, the verification remains `INVALIDATED`. Prior approval is **never** automatically restored; a fresh application is mandatory.

### 6. 72-Hour Cooldown Boundary
- **Static Finding:** Cooldown is calculated as `COLLEGE_CHANGE_COOLDOWN_MS - (Date.now() - updatedAtMs)`.
- **Boundary Behavior:** At 71 hours 59 minutes, `remainingMs > 0` -> returns 400 with cooldown message. At 72 hours 01 minutes, `remainingMs <= 0` -> update is allowed. (Test Case 28).

### 7. Club-Account Restrictions
- **Static Finding:** In [Sidebar.tsx#L942](file:///d:/Dev/GitHub/Orbix/Orbix/Frontend/src/app/Dashboard/Sidebar.tsx#L942) and [GlobalCollegeVerificationModal.tsx#L49](file:///d:/Dev/GitHub/Orbix/Orbix/Frontend/src/components/CollegeVerification/GlobalCollegeVerificationModal.tsx#L49):
  ```typescript
  if (!user || user.accountType === "club") return null;
  ```
- **Verdict:** Club accounts cannot open the modal or submit verification.

### 8. INVALIDATED Status Lifecycle
- **Static Finding:** Handled across backend status mapping ([profile.ts#L282](file:///d:/Dev/GitHub/Orbix/Orbix/Backend/src/Routes/profile/profile.ts#L282)) and frontend UI ([PublicProfilePage.tsx#L1572](file:///d:/Dev/GitHub/Orbix/Orbix/Frontend/src/app/Profile/PublicProfilePage.tsx#L1572)). Displays "Re-verify" CTA and allows resubmission.

### 9. Account Switching & Modal Cleanup
- **Static Finding:** In [GlobalCollegeVerificationModal.tsx#L40](file:///d:/Dev/GitHub/Orbix/Orbix/Frontend/src/components/CollegeVerification/GlobalCollegeVerificationModal.tsx#L40), `previousUserIdRef` monitors `user?.id`. On account change or logout, `setIsOpen(false)` and `setOverrideCollege(null)` trigger immediately.
- In [CollegeVerificationModal.tsx#L121](file:///d:/Dev/GitHub/Orbix/Orbix/Frontend/src/components/CollegeVerification/CollegeVerificationModal.tsx#L121), image object URLs are explicitly revoked via `URL.revokeObjectURL()` on modal close.

### 10. Immediate Public Badge Removal After Invalidation
- **Static Finding:** In [PublicProfilePage.tsx#L1547](file:///d:/Dev/GitHub/Orbix/Orbix/Frontend/src/app/Profile/PublicProfilePage.tsx#L1547), the green badge renders strictly if `Boolean(profile.isCollegeVerified)` is true. On invalidation, `is_college_verified` becomes false, Redis profile cache is purged, and the badge disappears immediately.

---

## 7. Issue 6: Founder Authorization Audit

### 7.1 Two-Founder Requirement in Staging
Orbix has two founders: Rahul Tripathi and Vineet Chandel. In staging, both must be authorized to review applications:
```env
ORBIX_FOUNDER_USER_IDS="<FOUNDER_1_UUID>,<FOUNDER_2_UUID>"
```

### 7.2 Strict UUID Allowlisting & Zero Email Fallback
In [founder.middleware.ts](file:///d:/Dev/GitHub/Orbix/Orbix/Backend/src/middlewares/founder.middleware.ts#L6):
- Strictly checks against standard UUID v1-v5 regex (`UUID_REGEX`).
- Ignores malformed entries and email addresses with a console warning.
- Contains **zero email-based fallback logic** and **zero hardcoded identities**.
- If `ORBIX_FOUNDER_USER_IDS` is unset or empty, `isAuthorizedFounder` returns `false` fail-closed.

### 7.3 External Dependency
Founder accounts in staging must be registered through normal authentication or seeded in the staging database. Their generated UUIDs must be queried directly:
```sql
SELECT id, email FROM public.users WHERE email IN ('...', '...');
```
**Placeholder or invented UUIDs must never be configured.**

---

## 8. Issue 7: Product Requirement vs Implementation Conflict

### 8.1 Status of Phone Verification Policy Conflict
- **Product Requirement 4:** Institutional email and phone OTP are separate mandatory ownership checks.
- **Code Reality:** In `031_college_verifications.sql`, `collegeVerificationService.ts`, and `CollegeVerificationModal.tsx`, `phoneNumber` and `phone_verified_at` are nullable. Phone OTP is implemented as an optional trust score signal rather than a blocking prerequisite.
- **Auditor Action:** In accordance with instructions, this conflict is **preserved as an unresolved founder blocker**. No code or policy changes were made.

---

## 9. Issue 8: AWS Deployment Baseline Audit

### 9.1 Investigation of Commit `092b10e`
- **Git Remote Evidence:**
  - `origin/main` points to `092b10ef8493d75fe8bf207f3930ec924d3a2698` (`Merge branch 'main' of https://github.com/rt2248/Orbix`).
  - Local HEAD commit `5b8feb5` has not been pushed to `origin/main`.
- **Live AWS Status:**
  - There are no automated CI/CD deployment pipelines (GitHub Actions, CodePipeline) in the repository.
  - While `092b10e` is the latest commit on `origin/main`, **it cannot be assumed to be the running artifact on AWS** without inspecting AWS CloudWatch logs, ECS task revisions, or EC2 git checkouts.
  - If AWS was deployed from an earlier commit (e.g. `64d6864` or `b8f07a9`), rolling back to `092b10e` could introduce untested intermediate changes.
- **Conclusion:** The live deployed baseline commit is classified as an **Unverified Infrastructure Detail** requiring explicit confirmation from the deploying engineer.

---

## 10. Summary of Required External Inputs

Before staging execution can be authorized, provide:
1. **Isolated Staging Database Connection String:** (Verified not `bhixamqnpcbstfwvmmog`).
2. **Founder Account UUIDs (Both Founders):** Exact database UUIDs for Rahul Tripathi and Vineet Chandel.
3. **Confirmed AWS Live Deployed Commit SHA:** Verified from AWS ECS/EC2 environment.
4. **AWS Staging Compute & Routing Topology:** Confirmation of ECS Fargate/EC2, S3 staging bucket, and CloudFront `/api/*` reverse proxy configuration.
5. **Founder Policy Sign-Off:** Confirmation of phone OTP verification enforceability (optional trust signal vs mandatory blocking gate).
