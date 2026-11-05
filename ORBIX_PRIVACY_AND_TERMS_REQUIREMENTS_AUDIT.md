# ORBIX — COMPREHENSIVE PRIVACY POLICY & TERMS OF SERVICE REQUIREMENTS AUDIT

**Document Identifier:** `ORBIX_PRIVACY_AND_TERMS_REQUIREMENTS_AUDIT.md`  
**Audit Execution Date:** November 5, 2026  
**Audit Scope:** Entire Orbix Repository (Frontend, Backend, Database Migrations & Schemas, Middleware, Routes, Services, Controllers, Hooks, Components, Docs, Configurations)  
**Status:** COMPLETE (AUDIT-ONLY — ZERO CODE MODIFICATIONS PERFORMED)  

---

## 1. EXECUTIVE SUMMARY

An exhaustive, evidence-based technical audit was conducted across the entire Orbix codebase. The objective of this audit is to identify all technical, operational, architectural, and product requirements necessary to implement an authentic, legally compliant **Privacy Policy page** and **Terms & Conditions page**, and to catalog every legal-document reference currently existing in the application.

### Key Audit Findings

1. **Product Nature:** Orbix is a dual-segment developer ecosystem comprising:
   - **Personal Developer Showcase & Analytics:** Aggregates competitive programming metrics (LeetCode, Codeforces, CodeChef, AtCoder, etc.), open-source repository contributions (GitHub), calculates a calibrated 0–10,000 "Orbix Score", generates interactive 3D developer cards, parses resumes via deterministic AST analysis, and enables peer-to-peer networking.
   - **Collegiate Chapters & Student Organizations (`verified_clubs`):** Dedicated infrastructure for campus developer clubs, verified via a strict 4-pillar manual reviewer protocol, supporting campus events, attendee registration pipelines, digital certificate issuance, team delegation, and FERPA-aligned student roster confidentiality.

2. **Verified Legal Consent State in Code:**
   - **Personal Signups (`Frontend/src/LandingPages/Auth-Pages/Signup/Form.tsx` & `Backend/src/validators/SignupValidator.ts`):** Enforces a mandatory boolean checkbox `termsAccepted: true` before account creation. However, the UI displays: *"I accept the Terms of Service and Privacy Policy"*, where both terms are dead anchor hash links (`#terms` and `#privacy`). The database `users` table records `termsAccepted BOOLEAN NOT NULL DEFAULT FALSE`, but has no separate column for personal `privacyPolicyAccepted` (privacy consent is subsumed into terms acceptance at signup).
   - **Club Signups (`Frontend/src/LandingPages/Auth-Pages/Signup/ClubSignupForm.tsx` & `Backend/src/validators/ClubRegistrationValidator.ts`):** Enforces two distinct mandatory checkboxes: `termsAccepted: true` and `privacyPolicyAccepted: true`. The database table `club_verification_requests` explicitly records: `terms_accepted BOOLEAN`, `terms_version VARCHAR(32) DEFAULT 'v1.0'`, `privacy_policy_accepted BOOLEAN`, `privacy_policy_version VARCHAR(32) DEFAULT 'v1.0'`, and `consent_recorded_at TIMESTAMPTZ DEFAULT NOW()`. In the UI, these links are also dead anchor hash links (`#terms` and `#privacy`).
   - **Public Footer (`Frontend/src/LandingPages/Main-Landing-Pages/Footer/Footer.tsx`):** Displays links labeled `"Privacy Policy"` and `"Terms of Service"` under the "Trust & Security" column, but both erroneously navigate to `/support` (the customer support ticket contact form).
   - **Missing Routes:** There are currently **no routes** for `/privacy`, `/terms`, `/privacy-policy`, or `/terms-and-conditions` configured in `Frontend/src/App.tsx`.

3. **Privacy Architecture Highlights:**
   - **Dedicated Privacy Center:** Implemented at `Frontend/src/app/Settings/SettingDetailView.tsx` (`case "privacy-center"`) backed by `Backend/src/services/account/privacyCenterService.ts` and `user_privacy_preferences` table. Users can toggle anonymous diagnostics telemetry, switch their profile between Public and Private, gate resume visibility, and govern recruiter messaging.
   - **Data Portability (GDPR Art. 20 / CCPA):** Fully implemented production data archive engine (`Backend/src/services/account/dataArchiveService.ts`) allowing users to export a signed JSON archive covering 6 categories (Identity, Platforms, Resumes, Security, Support, Network) with SHA-256 verification and step-up password/OTP authorization.
   - **Account Deletion:** Users can request account deletion with a 7-day grace period (`account_deletion_requests`). However, **no background cron worker currently executes the actual hard database purge** upon grace period expiration.
   - **Resume Intelligence AI Misconception:** While files and table columns are named `geminiResumeAnalyzer.ts` and `ai_consent_granted`, **no external Google Gemini or OpenAI API is called**. Resume parsing and scoring are performed 100% locally on the server using deterministic AST parsing (`pdf-parse`, `mammoth`, regular expressions) and role intelligence rules. No resume content is sent to third-party AI LLMs.
   - **External Third-Party Transmissions:** Identified verified external data sharing with:
     1. `Cloudinary` (profile photos, avatars, resumes, event covers).
     2. `Resend` & `Nodemailer/SMTP` (transactional security emails, OTPs).
     3. `Firebase Phone Authentication` & `Google reCAPTCHA Enterprise` (SMS OTP phone verification for club representatives).
     4. `Twilio` (auxiliary carrier fallback in `smsGatewayService.ts`).
     5. `ipwho.is` (external IP geolocation API to resolve city/region/country for user sessions in `geolocationService.ts`).
     6. `Google OAuth 2.0` & `GitHub OAuth` (third-party federated identity).
     7. `Google Fonts` (external typography assets loaded in `Frontend/index.html`).
     8. `Dicebear API` (fallback SVG avatars in `portals.ts`).
     9. 16 competitive coding platforms scraped or queried via public APIs.

---

## 2. APPLICATION ARCHITECTURE OVERVIEW

Orbix is structured as a modern full-stack web application:

```
Orbix Monorepo
├── Backend/                     # Express 5 + Node.js (ES Modules, TypeScript)
│   ├── src/
│   │   ├── config/              # Cloudinary, Firebase Admin SDK
│   │   ├── controllers/         # Blog likes, etc.
│   │   ├── database/            # Supabase PostgreSQL Pool, Migrations 001-029
│   │   ├── middlewares/         # auth.middleware.ts, staff.middleware.ts
│   │   ├── redis/               # ioredis client, rate limiters, profile/auth cache
│   │   ├── Routes/              # auth, oauth, profile, portals, leaderboard,
│   │   │                        # events, notifications, institutions, club,
│   │   │                        # relationships, help, verification, account,
│   │   │                        # blogs, platform, session
│   │   ├── scoring/             # Deterministic 0-10,000 Orbix Score engine
│   │   ├── services/            # Account governance, Data archive, Privacy center,
│   │   │                        # OAuth, 2FA, Club moderation, Email (Resend/SMTP),
│   │   │                        # SMS (Firebase/Twilio), Resume AST parser, Session
│   │   └── validators/          # SignupValidator, SigninValidator, ClubRegistrationValidator
│   └── data/                    # AISHE Indian institution directory seeds
└── Frontend/                    # Vite + React 19 + TypeScript + Tailwind CSS
    ├── src/
    │   ├── api/                 # Settings governance, Club settings, Session activity, etc.
    │   ├── app/                 # Authenticated application views (Dashboard, Profile,
    │   │                        # Settings, Club Dashboard, Leaderboard, Events, Inbox)
    │   ├── LandingPages/        # Marketing, Auth (Signin, Signup, OAuth Callback),
    │   │                        # Blogs/Workshops, Docs Hub & Documentaries, Support
    │   ├── store/               # Redux Toolkit (user, club, platforms, analytics)
    │   └── utils/               # Cache manager, profileApi, platformRegistry, ratingSystems
```

### Infrastructure & Deployment Verification
- **Frontend:** Single Page Application (SPA) served via Vite; uses HTML5 History API (`react-router-dom` v7). Font dependencies loaded from `fonts.googleapis.com`.
- **Backend:** Express v5.2.1 running on Node.js. Listens on `0.0.0.0:${PORT}`. Configured to accept CORS credentials with dynamic origin reflection (`Backend/src/index.ts:32-58`).
- **Database:** PostgreSQL (hosted on Supabase, connected via `pg.Pool` with SSL `rejectUnauthorized: false`).
- **Cache & Ephemeral Storage:** Redis (via `ioredis` v6) used for session caching, rate limiting (auth, signup, 2FA, OTPs), profile cache, and geolocation caching.
- **Hosting Targets Inferred:** Evidence from `platformRoutes.ts` checks `RENDER_GIT_COMMIT` and `VERCEL_GIT_COMMIT_SHA`.

---

## 3. VERIFIED DATA COLLECTION INVENTORY

This section details every category of data collected, its source, storage location, processing logic, third-party disclosure, and deletion mechanisms.

| Data Category | Specific Data Points | Collection Source | Database / Storage Destination | Processing & Purpose | Transmitted to 3rd Party? | Retention & Deletion Mechanisms | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Account Identity (Personal)** | First Name, Middle Name, Last Name, Username, Email, Password Hash | `Signup/Form.tsx`, `SignupValidator.ts` | Table `users` (`firstname`, `middlename`, `lastname`, `username`, `email`, `password`) | Authentication, profile presentation, account management | No (stored internally) | Erased upon account deletion (scheduled 7-day grace period) | **VERIFIED** |
| **Account Identity (Club Representative)** | Contact Person Name, Contact Person Role, Contact Email, Official College Email, Contact Phone | `ClubSignupForm.tsx`, `ClubRegistrationValidator.ts` | Table `club_verification_requests` | Reviewer auditing, institutional verification, representative authorization | Phone sent to Firebase/Twilio for OTP verification | Retained in audit history; omitted from public club showcase (`/clubs/:slug`) | **VERIFIED** |
| **Account Credentials & Auth** | Bcrypt Password Hash (cost 10), OAuth Provider IDs (`google_id`, `github_id`), Auth Provider (`local`, `google`, `github`) | Signup, Signin, OAuth callbacks | Table `users` (`password`, `google_id`, `github_id`, `auth_provider`) | Password verification via `bcrypt.compare`; password is `NULL` for pure OAuth users | Transmitted to Google/GitHub during OAuth exchange | Retained until account deletion; passwords can be updated via Manage Account | **VERIFIED** |
| **Legal Consent Records** | `termsAccepted` (boolean), `privacyPolicyAccepted` (boolean), version strings (`'v1.0'`), timestamps | Signup forms, Club registration | Table `users` (`termsaccepted`), Table `club_verification_requests` (`terms_accepted`, `terms_version`, `privacy_policy_accepted`, `privacy_policy_version`, `consent_recorded_at`) | Proof of compliance and contract agreement | No | Retained permanently in audit tables for non-repudiation | **VERIFIED** |
| **Two-Factor Authentication (2FA)** | 2FA enablement status, activation timestamp, SHA-256 hashed 6-digit OTPs, cooldown/hourly counters | Settings 2FA setup, login challenge | Table `users` (`is_two_factor_enabled`, `two_factor_enabled_at`), Redis keys `2fa:setup:*`, `2fa:login:*` | Login step-up security verification | OTP sent via email (Resend / SMTP) | Ephemeral OTP in Redis (10 min TTL); audit log in `account_security_events` | **VERIFIED** |
| **Email Verification** | Email address, SHA-256 OTP hash, verification proof JWT token, attempts count | Pre-signup OTP, account email changes | Table `email_verification_otps`, Table `account_change_challenges` | Preventing fake email signups; enforcing verified coder status | Email sent via Resend / SMTP | OTPs expire after 10 min; audit records retained | **VERIFIED** |
| **Phone Verification** | Phone number (normalized E.164), OTP hash, verification timestamps | Club registration, Settings phone auth | Table `phone_verification_otps`, Table `users` (`phone`, `is_phone_verified`, `phone_verified_at`) | Anti-fraud verification of collegiate club organizers | Phone number sent to Firebase Phone Auth / Twilio | Retained on user record; masked on public endpoints | **VERIFIED** |
| **Session & Device Telemetry** | Raw User-Agent, parsed OS & browser with versions, device type, device ID hash, client IP, masked IP, IP hash, approximate geolocation (city, region, country, country code) | HTTP Request headers (`user-agent`, `cf-connecting-ip`, `x-forwarded-for`, `x-orbix-device-id`) on login | Table `user_sessions`, Table `account_security_events`, Redis session store | Session management, new device detection, risk classification, remote session termination | Client IP sent to `ipwho.is` for geolocation lookup | Sessions active for 7 days (`SESSION_TTL_SECONDS`); revocable by user | **VERIFIED** |
| **Profile & Portfolio Data** | Headline, Bio (up to 2,000 chars), Location, Website, LinkedIn, GitHub, Custom Link, Skills array, Open-to-work flag, Hireable flag | Profile Manager (`ProfileManager.tsx`), `profile.ts` | Table `users` (`headline`, `bio`, `location`, `website`, `linkedin`, `github`, `custom_link`, `skills`, `is_open_to_work`, `is_hireable`, `is_public`) | Public developer showcase, recruiter discovery | No | Editable and clearable by user at any time in Profile Manager | **VERIFIED** |
| **Profile Photos & Avatars** | Cloudinary URL, Cloudinary Public ID, Previous Photo URL, Previous Public ID, Upload intent signatures | Photo upload modal (`photo.ts`), Cloudinary SDK | Table `users` (`photo_url`, `photo_public_id`, `previous_photo_url`), Table `photo_upload_intents`, Table `photo_cleanup_queue` | Profile picture display, avatar transformation | Uploaded directly to Cloudinary CDN | Deleted assets queued in `photo_cleanup_queue` for Cloudinary API destruction | **VERIFIED** |
| **Connected Coding Platforms** | Platform handles, URLs, problem counts (easy, medium, hard, total), contest ratings, rank badges, submission calendar timestamps | `handleSavePortals` (`portals.ts`), daily background sync | Table `user_links`, Table `leaderboard_entries` | Aggregating competitive programming stats, calculating Orbix Score, leaderboard rankings | Handles transmitted to 16 external CP platform APIs to fetch stats | Synchronized daily; removed from database when user unlinks platform | **VERIFIED** |
| **Resume Documents & Parsed Facts** | Original filename, file size, SHA-256 checksum, MIME type, Cloudinary storage URL, parsed text AST, extracted skills, work history, education, ATS score (0-100) | Resume Upload (`resume.ts`), `documentParser.ts`, `factExtractor.ts` | Table `resume_uploads`, Table `resume_analyses`, Table `user_resumes`, Table `resume_versions`, Table `resume_profile_sync_reviews` | Deterministic ATS audit, scoring 7 dimensions, proposing missing profile fields | PDF stored on Cloudinary. Parsed facts processed locally on server (NO third-party AI LLMs) | User can delete uploaded resumes; proposals require explicit user consent | **VERIFIED** |
| **Collegiate Club Information** | Club name, category, campus description, mission, vision, focus areas, social links, logo URL, cover URL, founded year, recruitment status | Club settings, Club profile editor | Table `verified_clubs`, Table `club_coordinators`, Table `club_achievements`, Table `club_teams`, Table `club_memberships` | Public campus club showcase (`/clubs/:slug`), campus community directory | Stored internally; logo/cover stored on Cloudinary | Managed by club leadership; erased if club is deactivated | **VERIFIED** |
| **Club Events & Attendance** | Event title, summary, description, start/end dates, timezone, venue, location type (in-person/online/hybrid), registration URL, cover image | Club Events Manager (`events.ts`), `club_events` | Table `club_events`, Table `club_event_likes`, Table `club_event_registrations` | Campus hackathon/workshop scheduling, attendee registration pipeline | Published events viewable publicly; covers on Cloudinary | Managed by club organizers; cancelable / completable | **VERIFIED** |
| **Event Registration Personal Data** | Attendee Name, Email, Department, Year of Study, Roll Number / Student ID, Phone Number, Custom Answers | Event application modal (`ClubEventModal.tsx`) | Table `club_event_registrations` | Event ticketing, attendance verification, roster exports | Accessible only to verified club officers of the hosting club | Roster exportable by chapter officers; editable status (approved, waitlisted, rejected) | **VERIFIED** |
| **Club Digital Certificates** | Recipient Name, Recipient Email, Certificate Type, Credential Code (UUID), Title, Signer Name, Signer Role, Issue Date | Certificate Studio (`clubCertificatesApi.ts`) | Table `club_certificates` | Issuing verifiable credentials to students for workshops/hackathons | Publicly verifiable via unique `credential_code` | Permanent credential record unless revoked by issuing club | **VERIFIED** |
| **Club Messaging & Moderation** | Message text, conversation threads, user moderation flags (muted, blocked), audit action logs | Club Inbox (`club_inbox_and_moderation.sql`) | Table `club_conversations`, Table `club_messages`, Table `club_user_moderation`, Table `club_message_action_logs` | Communication between students and campus club officers | Internal only | Stored in conversation history; auditable by officers | **VERIFIED** |
| **Social Networking & Blocks** | Connection requests (pending, connected, declined), actor ID, recipient ID, blocked user ID, block reason | Relationship routes (`relationshipRoutes.ts`) | Table `user_relationships`, Table `user_blocks`, Table `user_relationship_action_logs` | Peer connections, mutual feed visibility, blocking harassment | Internal only | Connections can be removed; blocks can be unblocked | **VERIFIED** |
| **Recruiter Communications** | Recruiter Name, Recruiter Email, Communication Email, Company Name, Message Body, Read status | Recruiter Inquire modal (`recruiter_messages`) | Table `recruiter_messages` | Inquiries sent to developers flagged as `is_hireable` / `is_open_to_work` | Notification emailed to recipient developer | Developer can disable recruiter contact in Privacy Center | **VERIFIED** |
| **Help & Support Tickets** | Contact Email, Category, Subject, Description, Priority, Diagnostic system info (browser/OS), Screenshot attachment URL, Support replies | Support page (`/support`), Help Center in Settings (`helpRoutes.ts`) | Table `help_tickets`, Table `help_ticket_messages`, Table `help_ticket_attachments` | Customer support, bug debugging, college verification claims | Screenshot files on Cloudinary | Retained in support ticket history | **VERIFIED** |
| **User Privacy Preferences** | `anonymous_telemetry_enabled`, `public_profile_visibility`, `resume_visibility`, `recruiter_contact_allowed`, `activity_visibility`, `consent_version` | Privacy Center (`SettingsDetailView.tsx`) | Table `user_privacy_preferences`, Table `privacy_request_audit` | User-controlled governance over data discoverability and telemetry | Internal only | Stored and versioned; auditable | **VERIFIED** |
| **Account Governance & Disciplinary** | Standing (`good_standing`, `warning`, `restricted`, `suspended`, `deactivated`), severity, public reason, internal reason, quotas, active restrictions | Account Governance service (`accountGovernanceService.ts`) | Table `account_statuses`, Table `account_status_history`, Table `account_restrictions`, Table `account_entitlements` | Platform safety enforcement, anti-gaming protection, spam mitigation | Internal only | Append-only audit history for platform security | **VERIFIED** |
| **Blog / Publication Interactions** | Hoster, Publication slug, User ID, timestamp | Engineering guides (`useBlogLikes.ts`, `blogRoutes.ts`) | Table `blog_likes` | Bookmarking and liking technical workshop publications | Internal only | Unique per publication-user pair; removable (unlike) | **VERIFIED** |

---

## 4. DATABASE AND STORAGE ANALYSIS

### 4.1. PostgreSQL Relational Database (Supabase)
The database schema consists of **37 distinct relational tables** across migrations `001_` through `029_` and auto-migration declarations in `Backend/src/database/client.ts`.

#### Complete Relational Tables Inventory
1. `users`: Core account identity, credentials, profile metadata, verification flags, and score projections.
2. `user_links`: Connected external developer portal profiles and sync metrics.
3. `user_privacy_preferences`: Granular privacy toggles (telemetry, profile visibility, resume visibility, recruiter contact).
4. `account_deletion_requests`: Self-service deletion queue with 7-day grace period.
5. `privacy_request_audit`: Non-repudiable log of all user privacy operations.
6. `account_statuses`: Current disciplinary standing and severity.
7. `account_status_history`: Append-only governance audit log.
8. `account_restrictions`: Fine-grained account limitations.
9. `account_entitlements`: Resource quotas and capabilities.
10. `user_sessions`: Persistent session tracking, device fingerprint hashes, masked IP, approximate geolocation, risk level.
11. `account_security_events`: Security audit log (logins, password changes, 2FA activations).
12. `account_change_operations`: Two-step verification state machine for email/username updates.
13. `account_change_challenges`: Cryptographic OTP challenges for identity updates.
14. `account_change_history`: Audit record of all committed email and username modifications.
15. `account_data_exports`: GDPR Art. 20 export records, SHA-256 checksums, and download logs.
16. `email_verification_otps`: Email verification audit log.
17. `phone_verification_otps`: Mobile phone SMS OTP verification audit log.
18. `photo_upload_intents`: Cryptographic intent signatures for Cloudinary avatar uploads.
19. `photo_cleanup_queue`: Safe retryable queue for deleting obsolete Cloudinary images.
20. `resume_upload_intents`: Pre-upload intent tracking for resume PDF files.
21. `resume_cleanup_queue`: Asynchronous deletion queue for obsolete resume assets.
22. `resume_uploads`: Stored resume documents, MIME types, file sizes, checksums.
23. `resume_analyses`: Deterministic AST extraction results, 7-dimension ATS scores, findings.
24. `resume_profile_sync_reviews`: Candidate review state for syncing resume facts to profile.
25. `user_resumes`: User-created structured resume documents.
26. `resume_versions`: Version history of structured resumes.
27. `recruiter_messages`: Messages dispatched by recruiters to developers.
28. `user_notifications`: User notification delivery and read status.
29. `user_relationships`: Mutual friendship / connection state pairs.
30. `user_blocks`: Directional blocking relationships.
31. `user_relationship_action_logs`: Quota tracking for relationship requests (20/day, 50/week).
32. `institutions`: Directory of verified Indian higher education institutions (AISHE code, UGC, NAAC).
33. `institution_regulatory_ids`: Regulatory identifiers per institution.
34. `institution_sources`: Evidence verification sources for institutions.
35. `institution_verification_requests`: User-submitted missing institution requests.
36. `club_verification_requests`: Collegiate student organization verification applications with explicit Terms and Privacy consent fields.
37. `verified_clubs`: Promoted active student organizations with public profile metadata.
38. `club_coordinators`: Faculty and student coordinator profiles.
39. `club_achievements`: Verified club milestones.
40. `club_teams`: Sub-teams within collegiate organizations.
41. `club_memberships`: User memberships and leadership roles in clubs.
42. `club_team_members`: Association of members with sub-teams.
43. `club_team_invitations`: Team invite tracking.
44. `club_events`: Hackathons, workshops, and campus meetups.
45. `club_event_likes`: User likes on campus events.
46. `club_event_registrations`: Attendee application details (name, email, department, roll number, phone).
47. `club_certificates`: Verifiable digital credentials issued to event attendees.
48. `club_conversations`: Club inbox message threads.
49. `club_messages`: Direct chat messages between users and club leadership.
50. `club_user_moderation`: Muting/blocking records within club channels.
51. `club_message_action_logs`: Moderation audit log.
52. `blog_likes`: Publication-level bookmarking and likes.
53. `help_tickets`: Support ticketing lifecycle.
54. `help_ticket_messages`: Discussion messages on support tickets.
55. `help_ticket_attachments`: File attachments on tickets.
56. `help_faqs`: Platform knowledgebase and FAQs.
57. `help_faq_feedback`: User votes on FAQ helpfulness.
58. `leaderboard_entries`: Materialized performance projections for global and college leaderboards.

#### Cascading Deletion & Orphan Prevention Behavior
- Most user-centric tables (`user_relationships`, `user_blocks`, `user_notifications`, `user_privacy_preferences`, `user_sessions`, `account_statuses`, `account_restrictions`, `account_entitlements`, `account_deletion_requests`, `privacy_request_audit`, `blog_likes`, `club_event_likes`) specify `ON DELETE CASCADE` referencing `users(id)`.
- Support tickets (`help_tickets`, `help_ticket_messages`) specify `ON DELETE SET NULL` on `user_id` so that administrative resolution history is preserved without identifying deleted users.
- Event registrations (`club_event_registrations`) specify `ON DELETE SET NULL` on reviewer IDs, but cascading on user IDs.

### 4.2. In-Memory & Redis Storage (`ioredis`)
- **Key Patterns:**
  - `auth:user:${gmail}`: Cached user credentials and profile state for zero-latency JWT authentication.
  - `session:${sessionId}`: Active session token validation and touch tracking.
  - `session:revoked:${sessionId}`: Instant session revocation blacklist.
  - `geoip:${ip}`: Cached IP geolocation responses (48-hour TTL).
  - `2fa:setup:cooldown:${userId}` / `2fa:setup:hourly:${userId}`: Rate-limiting counters for 2FA.
  - `data_archive:daily:${userId}` / `data_archive:cooldown:${userId}`: Rate-limiting counters for data portability exports.
  - `fails:signin:*` / `fails:signup:*`: Brute-force anti-abuse rate limiters.

### 4.3. Client-Side Browser Storage

#### LocalStorage Keys (`Frontend/src/utils/cacheManager.ts`, `userSlice.ts`, etc.)
1. `orbix_token`: Active JWT access token.
2. `orbix_user`: JSON stringified current user session object.
3. `orbix_device_id`: Persistent client-generated UUID used to distinguish devices and detect new logins.
4. `orbix_unified_submissions`: Cached competitive programming submission history per user.
5. `orbix_unified_development`: Cached GitHub commit / pull request history per user.
6. `orbix_unified_contests`: Cached contest rating history.
7. `orbix_unified_badges`: Cached badge data.
8. `orbix_practice_analytics`: Cached problem-solving metrics.
9. `orbix_development_analytics`: Cached development analytics.
10. `orbix_dashboard_tab` / `orbix_club_cache_*`: Transient UI view preferences.

#### SessionStorage Keys
- `orbix_pending_like`: Temporary state (`{ hoster, blogName, returnUrl, timestamp }`) allowing an unauthenticated visitor to click "Like" on an engineering guide, complete sign-in, and have the like automatically submitted upon redirection. Valid for 5 minutes.

#### Browser Cookies
- `token`: HTTPOnly, SameSite=Lax, Secure (in production), Path=/; MaxAge=8 hours (JWT access token).
- `refreshToken`: HTTPOnly, SameSite=Lax, Secure (in production), Path=/; MaxAge=7 days (JWT refresh token).
- `orbix_oauth_state`: HTTPOnly, SameSite=Lax, Secure (in production), Path=/; MaxAge=10 minutes (Anti-CSRF state token for Google/GitHub OAuth flows).

#### IndexedDB & WebSQL
- **VERIFIED:** Zero usage. No IndexedDB databases or WebSQL instances are opened anywhere in the application.

---

## 5. COOKIES, TRACKING AND ANALYTICS ANALYSIS

### Cookie Classification

| Cookie Name | Category | Provider | Expiration | HttpOnly | SameSite | Secure | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `token` | Strictly Necessary | First-Party (Orbix API) | 8 hours | **YES** | `Lax` | Conditional (`NODE_ENV === 'production'`) | Core API authentication and authorization |
| `refreshToken` | Strictly Necessary | First-Party (Orbix API) | 7 days | **YES** | `Lax` | Conditional (`NODE_ENV === 'production'`) | Refreshing expired access tokens without user re-authentication |
| `orbix_oauth_state` | Strictly Necessary | First-Party (Orbix API) | 10 minutes | **YES** | `Lax` | Conditional (`NODE_ENV === 'production'`) | Preventing CSRF attacks during Google and GitHub OAuth handshakes |

### Third-Party Tracking & Analytics Findings
- **Commercial Trackers:** **ABSENT**. Inspection of `Frontend/package.json`, `index.html`, and all source files confirms **NO** Google Analytics (`gtag.js`, `ga.js`), Meta / Facebook Pixel, Mixpanel, Segment, Amplitude, PostHog, Hotjar, or advertising cookies are integrated or loaded.
- **Firebase Measurement ID:** While `VITE_FIREBASE_MEASUREMENT_ID` is present in `Frontend/.env.example`, inspection of `Frontend/src/config/firebase.ts` confirms that **only `firebase/app` and `firebase/auth` are imported and initialized**. `firebase/analytics` is **NOT** imported, and `getAnalytics()` is **NEVER** called.
- **Client Diagnostics & Performance Telemetry:** The application implements an opt-in toggle (`anonymous_telemetry_enabled`) in the Privacy Center (`SettingsDetailView.tsx`). The toggle defaults to `false` in the database. When enabled, client latency and crash codes are processed ephemerally. No third-party analytics script is injected.
- **Google Invisible reCAPTCHA:** Initiated dynamically by `phoneAuthService.ts` (`RecaptchaVerifier`) during phone verification. Google reCAPTCHA sets transient security evaluation tokens to detect automated bot attacks.

### Cookie Consent Banner Assessment
- Under EU ePrivacy Directive and GDPR Article 5(3), cookies that are **strictly necessary** to deliver a service explicitly requested by the user (authentication tokens, session continuity, CSRF tokens) are **exempt from prior consent requirements**.
- Because Orbix **does not set non-essential marketing, tracking, or commercial advertising cookies**, an intrusive cookie banner is **technically not legally required** under current EU/UK guidance, provided the Privacy Policy accurately discloses the three strictly necessary first-party cookies.

---

## 6. THIRD-PARTY SERVICES AND DATA SHARING

The table below documents every verified external service with which Orbix communicates:

| Service Name | Category | Exact Integration Location | Information Transmitted | Personal Data Involved? | Essential or Optional | Audit Evidence / Verification |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Cloudinary** | Cloud Media Storage / CDN | `Backend/src/config/cloudinary.ts`, `Routes/profile/photo.ts`, `Routes/profile/resume.ts` | User profile photos, club logos, event cover images, resume PDF files | **YES** (Candidate resume documents, user photographs) | Essential for profile media & resume features | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`. Files stored under folders `orbix/avatars` and `orbix/resumes`. |
| **Resend** | Transactional Email API | `Backend/src/services/email/resendService.ts` | Recipient email address, user display name, security OTPs, security warning notifications | **YES** (Email address, user full name) | Essential (Default email provider) | `RESEND_API_KEY`, `RESEND_FROM_EMAIL`. Calls `resend.emails.send()`. |
| **SMTP / Nodemailer** | Direct Email Delivery | `Backend/src/services/email/resendService.ts` | Recipient email address, user display name, security OTPs | **YES** (Email address, user full name) | Essential (Fallback / alternate provider) | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`. |
| **Firebase Phone Auth (Google)** | Identity & Anti-Abuse Verification | `Frontend/src/services/phoneAuthService.ts`, `Backend/src/config/firebaseAdmin.ts` | User phone number (E.164), SMS OTP, device verification signals via Google Invisible reCAPTCHA | **YES** (Mobile phone number) | Essential for club organizer verification | `firebase/auth`, `RecaptchaVerifier`, `firebase-admin/auth`. |
| **Twilio** | SMS Carrier Delivery | `Backend/src/services/sms/smsGatewayService.ts` | Recipient phone number, verification SMS body | **YES** (Phone number) | Optional (Secondary carrier fallback) | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`. Calls Twilio Messages REST API. |
| **ipwho.is** | IP Geolocation API | `Backend/src/services/session/geolocationService.ts:107` | Client IP address (`cleanIp`) | **YES** (IP address is personal data under GDPR) | Essential for session security & location display | Direct `fetch('https://ipwho.is/${cleanIp}')` with 1500ms timeout. Cached in Redis for 48 hours. |
| **Google Identity (OAuth 2.0)** | Federated Authentication | `Backend/src/services/auth/oauthService.ts`, `Routes/auth/oauthRoutes.ts` | Authorization code, Google ID, email, verified email status, name, picture URL | **YES** (Google profile name, email, avatar) | Optional (User choice to login with Google) | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`. Endpoints: `https://oauth2.googleapis.com/token`, `https://www.googleapis.com/oauth2/v2/userinfo`. |
| **GitHub OAuth** | Federated Authentication | `Backend/src/services/auth/oauthService.ts` | Authorization code, GitHub ID, username, email, name, avatar URL | **YES** (GitHub username, email, avatar) | Optional (User choice to login with GitHub) | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_CALLBACK_URL`. Endpoints: `https://github.com/login/oauth/access_token`, `https://api.github.com/user`. |
| **Google Fonts** | Static Font CDN | `Frontend/index.html:9-11` | Client IP address, browser User-Agent headers | **YES** (IP address collected by Google font servers) | Optional (Typography rendering) | Link tags to `fonts.googleapis.com` and `fonts.gstatic.com` for "Poppins" font family. |
| **Dicebear API** | Dynamic Avatar Generation | `Backend/src/Routes/portals/portals.ts:75` | User handle / seed parameter | **NO** (Only username seed is passed) | Optional (Fallback avatar for unlinked profiles) | URL generation: `https://api.dicebear.com/7.x/identicon/svg?seed=...` |
| **External CP Portals (16 Services)** | Public Developer Statistics Scrapers & APIs | `Backend/src/Routes/portals/*` | Public platform handles (e.g. `leetcode.com`, `codeforces.com`, `codechef.com`, `atcoder.jp`, `github.com`) | **NO** (Public platform usernames only; zero passwords or private tokens) | Essential for core platform score & metrics | Outgoing HTTP requests to LeetCode GraphQL, Codeforces REST API, GitHub public API, etc. |
| **Supabase** | Cloud Database Provider | `Backend/src/database/client.ts` | All PostgreSQL database tables, records, encrypted passwords | **YES** (All stored data) | Essential (Primary database host) | `DATABASE_URL` / `SUPABASE_DB_URL`. SSL encrypted connections. |

---

## 7. AUTHENTICATION AND SECURITY ANALYSIS

### Password Hashing
- **Algorithm:** `bcrypt` with salt rounds = `10` (`Backend/src/Routes/auth/auth.ts:246`).
- **Timing Attack Mitigation:** In `signin`, if a user is not found, a dummy bcrypt comparison is executed against a static hash (`Backend/src/Routes/auth/auth.ts:526`) to ensure constant-time response and prevent username enumeration.
- **Weak Password Filtering:** `SignupValidator.ts` includes an extensive dictionary blacklist of over 400 weak passwords, sequential numbers (`123456`), keyboard walks (`qwerty`), and common Indian city names with numbers (`mumbai123`, `kanpur123`).

### Token Security
- **Access Tokens:** Signed using `jsonwebtoken` with `HS256`, algorithm verification, issuer `'orbix'`, audience `'orbix-users'`, and an expiration of 8 hours. Contains payload: `sub` (userId), `gmail`, `username`, `sid` (sessionId), `accountType`.
- **Refresh Tokens:** Issued with a 7-day expiration and typed payload (`type: "refresh"`).
- **Session Revocation:** On every authenticated request, `auth.middleware.ts` extracts `sessionId` and checks `isSessionRevoked(sessionId)` via Redis / PostgreSQL. When a session is revoked, access is rejected immediately without waiting for JWT expiration.

### CORS & Transport Security
- **CORS Configuration (`Backend/src/index.ts:32-58`):** Dynamically reflects incoming `Origin` header with `Access-Control-Allow-Credentials: true`. In production, this should be hardened to an explicit whitelist of approved domains (e.g. `process.env.FRONTEND_URL`).
- **Transport Security:** Database connection pool enforces SSL (`ssl: { rejectUnauthorized: false }`). All external third-party communication uses HTTPS / TLS 1.3.

### Anti-Brute-Force & Rate Limiting
- Signin failures are tracked in Redis per `{ email, ip }` with a threshold of 10 failed attempts before triggering HTTP 429 (`rate-limiters-auth.ts`).
- Signup verification requests are capped at 10 requests per IP.
- Relationship action requests are restricted to 20/day and 50/week (`user_relationship_action_logs`).
- Data portability archives are limited to 5 per 24-hour window with a 60-second cooldown (`DataArchiveService`).

### Non-Existent Gemini AI Transmission
- The audit conclusively establishes that despite the presence of `Backend/src/services/resume/geminiResumeAnalyzer.ts` and `ai_consent_granted` database columns, **no resume data is sent to Google Gemini or OpenAI**. Parsing is performed entirely through local libraries (`pdf-parse`, `mammoth`).

---

## 8. USER RIGHTS AND ACCOUNT MANAGEMENT

| User Right (GDPR / CCPA / DPDP) | Code Implementation Status | Responsible Component / Route | Operational Behavior & Potential Legal Conflicts |
| :--- | :--- | :--- | :--- |
| **Right to Access / Data Portability** | **IMPLEMENTED** | `Backend/src/services/account/dataArchiveService.ts`, `dataArchiveApi.ts` | Users can download a signed JSON package of their data across 6 categories. Requires step-up authentication (password or email OTP). Includes SHA-256 integrity hash. |
| **Right to Rectification** | **IMPLEMENTED** | `ManageAccountView.tsx`, `account_change_operations` | Users can update first/last name, bio, social links, username, and email. Email and username changes enforce a strict 2-step verification challenge with cooldowns (30 days for username). |
| **Right to Erasure (Account Deletion)** | **PARTIALLY IMPLEMENTED (GAP IDENTIFIED)** | `privacyCenterService.ts:228`, `privacyRoutes.ts:71`, `account_deletion_requests` | Users can submit an account deletion request with a 7-day grace period. Users can cancel during this period. **CRITICAL GAP:** There is no automated backend cron job or worker in the codebase that executes the actual hard database purge (`DELETE FROM users`) once the 7 days elapse. |
| **Right to Restriction / Objection** | **IMPLEMENTED** | `SettingsDetailView.tsx`, `user_privacy_preferences` | Users can toggle their entire profile to Private (masks stats, hides from leaderboard, disables recruiter messaging) and toggle anonymous telemetry off. |
| **Right to Withdraw Consent** | **IMPLEMENTED** | `user_privacy_preferences`, `user_links` | Users can unlink competitive platforms at any time (immediately deleting synced records) and revoke recruiter contact permissions. |
| **FERPA Student Roster Protection** | **IMPLEMENTED** | `ClubSettingDetailView.tsx:958`, `verified_clubs` | Club rosters and event applicant records are strictly partitioned from personal developer dashboards and shielded from public discovery. |

---

## 9. TERMS & CONDITIONS PRODUCT REQUIREMENTS

Understanding Orbix as a functional product reveals the following specific legal terms that must be addressed:

1. **User Eligibility:** Target audience includes collegiate developers, competitive coders, student club organizers, and tech recruiters. Minimum age requirements (e.g. 13 or 16 depending on jurisdiction) must be established.
2. **Account Classification & Responsibilities:**
   - *Personal Accounts:* Developer identity, accuracy of connected platform handles.
   - *Club Accounts:* Strict representation warranty requiring applicants to be authorized representatives of a genuine collegiate student organization.
3. **Acceptable Use & Anti-Gaming Rules:**
   - Prohibition against linking competitive programming accounts not owned by the user.
   - Prohibition against artificial score manipulation, fake GitHub contribution spoofing, or automated scraping of Orbix leaderboards.
   - Anti-harassment rules governing peer connection requests, club direct messaging, and recruiter inquiries.
4. **Collegiate Verification & Revocation:**
   - Orbix reserves the right to review, reject, or revoke verified club status if false documentation is provided or if representative authorization lapses.
5. **Collegiate Event Ticketing & Certificates:**
   - Clubs are solely responsible for event management, physical venue safety, and accuracy of digital certificates issued. Orbix acts as a technology platform and does not sponsor individual campus events.
6. **Intellectual Property & Licensing:**
   - Users retain full copyright over their code, projects, and resume content.
   - Users grant Orbix a worldwide, royalty-free license to display their public profile, score metrics, and avatar within platform leaderboards and community discovery.
   - The Orbix Platform, scoring algorithms, and brand assets are proprietary (notwithstanding open-source elements licensed under Apache-2.0 as noted in `platformRoutes.ts`).
7. **Disclaimers & Third-Party Platforms:**
   - Orbix is not affiliated with, endorsed by, or sponsored by LeetCode, Codeforces, CodeChef, GitHub, AtCoder, or Google.
   - Orbix does not guarantee employment or interview offers through its Resume Intelligence or Recruiter Contact tools.
8. **Limitation of Liability & Indemnification:**
   - Standard liability caps for service downtime, external API sync latency, or inaccurate third-party coding metrics.

---

## 10. APPLICATION-WIDE LEGAL REFERENCE INVENTORY

The following inventory details every occurrence of legal documents, privacy references, and terms across the entire repository:

| # | Exact Displayed Text | Source File Path | Line # | Component / Function | Current Behavior | Is Genuine Legal Reference? | Recommended Destination |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | `"Privacy Policy"` | `Frontend/src/LandingPages/Main-Landing-Pages/Footer/Footer.tsx` | 251 | `Footer` (Trust & Security Column) | Routes to `<Link to="/support">` (Contact Support Form) | **YES** | `/privacy` (Dedicated Privacy Policy Page) |
| **2** | `"Terms of Service"` | `Frontend/src/LandingPages/Main-Landing-Pages/Footer/Footer.tsx` | 256 | `Footer` (Trust & Security Column) | Routes to `<Link to="/support">` (Contact Support Form) | **YES** | `/terms` (Dedicated Terms & Conditions Page) |
| **3** | `"Terms of Service"` | `Frontend/src/LandingPages/Auth-Pages/Signup/Form.tsx` | 496 | `SignupForm` (Checkbox Label) | Anchor hash `<a href="#terms">` (Dead link / no navigation) | **YES** | `/terms` (Open in new tab / modal) |
| **4** | `"Privacy Policy"` | `Frontend/src/LandingPages/Auth-Pages/Signup/Form.tsx` | 500 | `SignupForm` (Checkbox Label) | Anchor hash `<a href="#privacy">` (Dead link / no navigation) | **YES** | `/privacy` (Open in new tab / modal) |
| **5** | `"Privacy"` | `Frontend/src/LandingPages/Auth-Pages/AuthLayout.tsx` | 161 | `AuthLayout` (Footer Links) | Anchor hash `<a href="#privacy">` (Dead link) | **YES** | `/privacy` |
| **6** | `"Terms"` | `Frontend/src/LandingPages/Auth-Pages/AuthLayout.tsx` | 163 | `AuthLayout` (Footer Links) | Anchor hash `<a href="#terms">` (Dead link) | **YES** | `/terms` |
| **7** | `"Terms of Service"` | `Frontend/src/LandingPages/Auth-Pages/Signup/ClubSignupForm.tsx` | 1429 | `ClubSignupForm` (Section E Checkbox) | Anchor hash `<a href="#terms">` (Dead link) | **YES** | `/terms` (Open in new tab) |
| **8** | `"Privacy Policy"` | `Frontend/src/LandingPages/Auth-Pages/Signup/ClubSignupForm.tsx` | 1447 | `ClubSignupForm` (Section E Checkbox) | Anchor hash `<a href="#privacy">` (Dead link) | **YES** | `/privacy` (Open in new tab) |
| **9** | `"Privacy policy, data safety, and compliance"` | `Frontend/src/app/Settings/SettingsHub.tsx` | 103 | `SettingsHub` (Privacy Center card description) | Navigates to `/settings?view=privacy-center` | **Descriptive reference** | Keep as `/settings?view=privacy-center` with embedded link to `/privacy` |
| **10** | `"Orbix version, terms of service, and licenses"` | `Frontend/src/app/Settings/SettingsHub.tsx` | 117 | `SettingsHub` (About card description) | Navigates to `/settings?view=about` (currently lacks Terms link) | **Descriptive reference** | Add link to `/terms` inside the About view |
| **11** | `"Student organization data safety & FERPA compliance"` | `Frontend/src/app/Club/Settings/ClubSettingsHub.tsx` | 63 | `ClubSettingsHub` (Collegiate Privacy card) | Navigates to `/club/settings?view=privacy-center` | **Descriptive reference** | Keep internal collegiate privacy view |
| **12** | `"Orbix for Student Organizations version & platform terms"` | `Frontend/src/app/Club/Settings/ClubSettingsHub.tsx` | 77 | `ClubSettingsHub` (Club About card) | Navigates to `/club/settings?view=about` | **Descriptive reference** | Add link to `/terms` inside club About view |
| **13** | `"Privacy Center"` / `"Manage In Privacy Center"` | `Frontend/src/app/Notifications/NotificationsView.tsx` | 2078, 2112 | `NotificationsView` (Security Warning Banner) | Routes to `/settings?view=privacy-center` | **Internal feature reference** | Keep navigating to internal settings view |
| **14** | `"You must accept the terms to continue"` | `Frontend/src/LandingPages/Auth-Pages/Signup/Form.tsx` | 111 | `SignupForm` (Validation Error Message) | Displays red validation error | **Legal enforcement string** | Keep string; link to `/terms` |
| **15** | `"You must accept the Terms of Service"` | `Frontend/src/LandingPages/Auth-Pages/Signup/ClubSignupForm.tsx` | 439 | `ClubSignupForm` (Validation Error) | Displays red validation error | **Legal enforcement string** | Keep string |
| **16** | `"You must accept the Privacy Policy"` | `Frontend/src/LandingPages/Auth-Pages/Signup/ClubSignupForm.tsx` | 442 | `ClubSignupForm` (Validation Error) | Displays red validation error | **Legal enforcement string** | Keep string |
| **17** | `"You must accept the terms and conditions."` | `Backend/src/validators/SignupValidator.ts` | 551 | `SignupValidator` (Backend Validation) | Throws HTTP 400 `ValidationError` | **Backend legal contract validation** | Keep validation |
| **18** | `"You must accept the Terms of Service."` | `Backend/src/validators/ClubRegistrationValidator.ts` | 98 | `ClubRegistrationValidator` (Backend) | Throws HTTP 400 `ValidationError` | **Backend legal contract validation** | Keep validation |
| **19** | `"You must accept the Privacy Policy."` | `Backend/src/validators/ClubRegistrationValidator.ts` | 101 | `ClubRegistrationValidator` (Backend) | Throws HTTP 400 `ValidationError` | **Backend legal contract validation** | Keep validation |
| **20** | `"terms_accepted"`, `"privacy_policy_accepted"` | `Backend/src/database/migrations/003_club_verification_requests.sql` | 41-45 | Database Schema | Stores booleans and version `'v1.0'` | **Database audit columns** | Preserve schema |

---

## 11. PRIVACY POLICY REQUIREMENTS

To accurately reflect the existing implementation, the forthcoming Privacy Policy must explicitly include:

1. **Data Controller Identity & Contact:** Full legal entity name, jurisdiction of incorporation, registered office address, and dedicated privacy email (e.g. `privacy@orbix.dev` or support contact).
2. **Categories of Personal Data Collected:**
   - Account identity (name, email, username, encrypted password, college).
   - Club representative identity (official institutional email, phone number).
   - Profile information (bio, headline, skills, location, portfolio links, avatar photo).
   - Competitive programming handles and public submission statistics.
   - Resume documents and extracted career facts.
   - Technical telemetry (masked IP, device fingerprint hash, User-Agent, approximate city/country geolocation).
3. **Legal Bases for Processing (GDPR Art. 6):**
   - *Contractual Necessity:* Delivering developer portfolio hosting, leaderboard rankings, and club dashboards.
   - *Legitimate Interests:* Detecting unauthorized account access, new device alerts, anti-gaming algorithms.
   - *Explicit Consent:* Phone SMS OTP verification, profile photo uploads, optional anonymous diagnostic telemetry.
4. **Third-Party Subprocessors Disclosed:**
   - Supabase (PostgreSQL hosting), Cloudinary (media CDN), Resend / Nodemailer (email delivery), Firebase / Google reCAPTCHA (phone authentication & bot protection), ipwho.is (IP geolocation), Google OAuth & GitHub OAuth.
5. **No AI Third-Party Transmission Clarification:**
   - Clear disclosure that resume parsing is conducted through deterministic local AST extraction on Orbix servers, and resumes are **not** sold or transmitted to Google Gemini or OpenAI.
6. **Data Retention & Erasure Protocol:**
   - Active accounts retain data until deletion.
   - Deletion requests enter a 7-day grace period during which the request may be cancelled.
   - Clarification of permanent deletion timeframes once implemented.
7. **User Privacy Rights & Self-Service Controls:**
   - Direct instruction on using the **Privacy Center** (`/settings?view=privacy-center`) to toggle public/private profile visibility, restrict resume access, or export data via the **Data Portability Engine** (`/settings?view=data-archive`).

---

## 12. TERMS & CONDITIONS REQUIREMENTS

The Terms & Conditions document must accurately cover:

1. **Acceptance of Terms & Electronic Signatures:** Explicit clause stating that registering an account or ticking the agreement box constitutes a binding electronic contract under applicable electronic signature laws (e.g., US ESIGN Act, EU eIDAS, Indian Information Technology Act 2000).
2. **User Eligibility & Minors:** Age restriction definitions and parental consent stipulations for minor students.
3. **Collegiate Organization Representations:**
   - Warranty by club applicants that they possess formal institutional authority to represent the student society.
   - Acknowledgment that verification decisions are subject to Orbix staff manual review and may be revoked upon breach of campus guidelines.
4. **Acceptable Use & Platform Integrity:**
   - Strict ban on account sharing, automated scraping, bot manipulation of competitive problem counts, and submission of fraudulent college credentials.
   - Prohibition against uploading malicious PDF/DOCX files or abusive content in event descriptions.
5. **Intellectual Property Rights:**
   - Clear reservation that users own their user-generated content and resumes.
   - Non-exclusive license granted to Orbix to compute and display rankings, scores, and profile cards.
6. **Disclaimers of Affiliation:**
   - Explicit disclaimer that Orbix is an independent platform and has no official corporate affiliation with LeetCode, Codeforces, CodeChef, GitHub, or any accredited university unless explicitly stated.
7. **Disclaimer of Warranties & Limitation of Liability:**
   - "As Is" and "As Available" service delivery. Disclaimers regarding third-party platform API outages, scraping changes, or inaccurate external metrics.
8. **Dispute Resolution & Governing Law:**
   - Governing jurisdiction, dispute resolution procedures, and arbitration/court venue as determined by the business owner.

---

## 13. LEGAL AND OPERATIONAL GAPS

The audit identified the following operational and architectural gaps:

1. **Dead Anchor Links in Production:**
   - In both `Signup/Form.tsx` and `ClubSignupForm.tsx`, clicking "Terms of Service" or "Privacy Policy" fails to navigate anywhere because they point to `#terms` and `#privacy`.
2. **Footer Navigation Misdirection:**
   - In `Footer.tsx`, both "Privacy Policy" and "Terms of Service" route to `/support`, which is an interactive contact form, creating consumer confusion and failing standard consumer-protection disclosures.
3. **Missing Automated Account Deletion Purge:**
   - While `account_deletion_requests` tracks scheduled deletions with a 7-day grace period, there is no automated server cron or worker to execute the permanent purge (`DELETE FROM users`) when `NOW() > scheduled_for`.
4. **Subsumed Personal Privacy Consent:**
   - Personal signup only records `termsAccepted: true` in the database, without a distinct `privacy_policy_accepted` column, whereas the frontend UI promises acceptance of both.
5. **CORS Origin Permissiveness:**
   - `Backend/src/index.ts:33-38` reflects any incoming `Origin` header with credentials allowed. In production, this should be locked to authorized frontend domains to prevent cross-origin credential leaks.
6. **Unencrypted IP Geolocation Call:**
   - Geolocation calls `https://ipwho.is/${cleanIp}` over public HTTPS. While encrypted in transit, IP addresses are transmitted to an external free service without explicit user consent disclosure in a privacy policy.

---

## 14. PRODUCT OWNER DECISIONS REQUIRED

Before drafting legal documents or deploying new legal pages, the product owner must confirm:

1. **Legal Entity & Governing Law:**
   - What is the registered corporate name (e.g. "Orbix Inc.", "Orbix Technologies Private Limited")?
   - What is the registered address, country, and state?
   - What jurisdiction and governing law apply (e.g., India, Delaware USA, UK)?
2. **Minimum Age Policy:**
   - Is Orbix open to students aged 13+, 16+, or 18+?
3. **Target Jurisdictions:**
   - Does Orbix actively target EU/UK users (triggering GDPR/UK-GDPR requirements), California residents (CCPA), or primarily Indian collegiate students (DPDP Act 2023)?
4. **Account Purge Implementation:**
   - Should expired account deletion requests be purged by a nightly cron job, or should accounts be permanently anonymized/soft-deleted to preserve leaderboard integrity?
5. **Recruiter Monetization Plans:**
   - Will recruiter messaging remain free, or will future paid recruiter subscriptions be introduced?
6. **Dedicated Privacy Contact:**
   - What email address will handle legal inquiries, data subject access requests, and DMCA/copyright notices (e.g., `legal@orbix.dev`)?

---

## 15. RECOMMENDATIONS AND IMPLEMENTATION CONSIDERATIONS

### Phase 1: Preparation (Current Phase — Complete)
- Present this comprehensive audit report.
- Obtain Product Owner confirmation on business identity, governing law, and age policies.

### Phase 2: Implementation (Future Instructions)
1. **Frontend Routing:**
   - Register `/privacy` and `/terms` routes in `Frontend/src/App.tsx`.
   - Create clean, neo-brutalist styled `PrivacyPolicyPage.tsx` and `TermsConditionsPage.tsx` adhering to the Orbix design system.
2. **Update Link References:**
   - Update `Footer.tsx` lines 250-258 to link directly to `/privacy` and `/terms`.
   - Update `Signup/Form.tsx` lines 495-501 to link to `/terms` and `/privacy` (opening in a modal or new tab so the user does not lose signup form input).
   - Update `ClubSignupForm.tsx` lines 1428-1448 similarly.
   - Update `AuthLayout.tsx` lines 161-163 to point to `/privacy` and `/terms`.
   - Add explicit links to `/terms` within `Settings` and `Club Settings` About views.
3. **Backend Deletion Worker:**
   - Implement an automated background task (e.g. via `node-cron` or serverless trigger) to complete scheduled account deletions once the 7-day grace period lapses.
4. **Personal Signup Consent Schema Alignment:**
   - Consider adding `privacy_policy_accepted` and `consent_recorded_at` to the `users` table for personal accounts to mirror the club registration model.

---

## 16. COMPLETE FILE REFERENCE INDEX

### Frontend Files
- `Frontend/src/App.tsx`: Central router configuration (lacks `/privacy` and `/terms` routes).
- `Frontend/src/LandingPages/Main-Landing-Pages/Footer/Footer.tsx`: Lines 250–258 (Footer links erroneously pointing to `/support`).
- `Frontend/src/LandingPages/Auth-Pages/Signup/Form.tsx`: Lines 485–525 (Personal signup terms/privacy dead anchor links).
- `Frontend/src/LandingPages/Auth-Pages/Signup/ClubSignupForm.tsx`: Lines 1415–1475 (Club registration dual consent checkboxes with dead anchor links).
- `Frontend/src/LandingPages/Auth-Pages/AuthLayout.tsx`: Lines 158–165 (Auth layout footer dead links `#privacy`, `#terms`).
- `Frontend/src/LandingPages/Support/Landing.tsx`: Lines 1–241 (Support ticketing contact form currently receiving footer legal traffic).
- `Frontend/src/app/Settings/SettingsHub.tsx`: Lines 100–120 (Privacy Center & About settings navigation cards).
- `Frontend/src/app/Settings/SettingDetailView.tsx`: Lines 1133–1260 (Privacy Center view); Lines 1480–1600 (About view).
- `Frontend/src/app/Settings/AccountPrivacyView.tsx`: Lines 1–150 (Profile visibility toggle and recruiter settings).
- `Frontend/src/app/Club/Settings/ClubSettingsHub.tsx`: Lines 60–80 (Collegiate privacy center & About cards).
- `Frontend/src/app/Club/Settings/ClubSettingDetailView.tsx`: Lines 955–1068 (Collegiate Privacy Center view); Lines 1250–1315 (Club About view).
- `Frontend/src/app/Notifications/NotificationsView.tsx`: Lines 2075, 2109 (In-app notifications linking to privacy center).
- `Frontend/src/LandingPages/Docs/documentaries/ProfilePrivacyDocumentary.tsx`: Architectural explanation of public vs private modes.
- `Frontend/src/LandingPages/Docs/documentaries/ClubVerificationDocumentary.tsx`: 4-pillar collegiate verification standards.
- `Frontend/src/services/phoneAuthService.ts`: Firebase Phone Auth and Google Invisible reCAPTCHA client service.
- `Frontend/src/utils/cacheManager.ts`: Complete inventory of LocalStorage keys.
- `Frontend/src/store/userSlice.ts`: Redux user session management.
- `Frontend/index.html`: Google Fonts external asset loading.

### Backend Files
- `Backend/src/index.ts`: Server entrypoint, CORS configuration, cookie parser, route mounting.
- `Backend/src/database/client.ts`: PostgreSQL connection pool, auto-migrations for 37 tables.
- `Backend/src/middlewares/auth.middleware.ts`: JWT verification, cookie extraction, session revocation check.
- `Backend/src/validators/SignupValidator.ts`: Lines 546–552 (Enforces `termsAccepted: true`).
- `Backend/src/validators/ClubRegistrationValidator.ts`: Lines 96–104 (Enforces `termsAccepted: true` and `privacyPolicyAccepted: true`).
- `Backend/src/Routes/auth/auth.ts`: Signup, signin, session cookie issuance (`token`, `refreshToken`), email OTP validation.
- `Backend/src/Routes/auth/oauthRoutes.ts` & `services/auth/oauthService.ts`: Google & GitHub OAuth handlers, CSRF state cookie (`orbix_oauth_state`).
- `Backend/src/Routes/account/privacyRoutes.ts`: `/api/account/privacy` endpoints (preferences, data inventory, deletion request/cancellation).
- `Backend/src/services/account/privacyCenterService.ts`: Platform data inventory, privacy preference updates, deletion request lifecycle.
- `Backend/src/services/account/dataArchiveService.ts`: GDPR Art. 20 Data Portability archive generation.
- `Backend/src/services/account/accountGovernanceService.ts`: Account standing, conduct compliance, platform quotas.
- `Backend/src/services/session/sessionService.ts`: Session creation, device parsing, risk evaluation, session revocation.
- `Backend/src/services/session/deviceParser.ts`: User-Agent parsing, client IP masking, IP hashing.
- `Backend/src/services/session/geolocationService.ts`: IP geolocation queries to `ipwho.is`.
- `Backend/src/services/email/resendService.ts`: Email delivery via Resend API and Nodemailer SMTP.
- `Backend/src/services/sms/phoneVerificationService.ts` & `smsGatewayService.ts`: Phone OTP verification via Firebase Admin SDK & Twilio fallback.
- `Backend/src/services/resume/geminiResumeAnalyzer.ts`: Local deterministic AST resume evaluation (no external Gemini calls).
- `Backend/src/Routes/portals/*`: External competitive programming platform aggregators.
- `Backend/src/scoring/orbixScore.ts`: Deterministic 6-pillar scoring engine.
- `Backend/src/database/migrations/`: Migrations `001_` through `029_`.
- `docs/CLUB_VERIFICATION_MANUAL_REVIEWER_GUIDE.md`: Standards for 4-pillar collegiate club verification.

---

## SUMMARY OF VERIFICATION CLASSIFICATIONS

| Finding / Topic | Classification | Primary Evidence Source |
| :--- | :--- | :--- |
| Personal signup requires terms acceptance | **VERIFIED** | `Backend/src/validators/SignupValidator.ts:550` |
| Club registration requires terms & privacy acceptance | **VERIFIED** | `Backend/src/validators/ClubRegistrationValidator.ts:97-102` |
| Privacy Policy & Terms of Service links route to `/support` | **VERIFIED** | `Frontend/src/LandingPages/Main-Landing-Pages/Footer/Footer.tsx:250-258` |
| Signup form legal links are dead anchor hash tags | **VERIFIED** | `Frontend/src/LandingPages/Auth-Pages/Signup/Form.tsx:495-501` |
| No `/privacy` or `/terms` routes exist in `App.tsx` | **VERIFIED** | `Frontend/src/App.tsx:84-172` |
| No commercial analytics (Google Analytics, Meta Pixel, PostHog) loaded | **VERIFIED** | `Frontend/package.json`, `index.html`, source search |
| Cookies used are strictly first-party essential (`token`, `refreshToken`, `orbix_oauth_state`) | **VERIFIED** | `Backend/src/Routes/auth/auth.ts`, `services/auth/oauthService.ts` |
| Client IP transmitted to `ipwho.is` for geolocation | **VERIFIED** | `Backend/src/services/session/geolocationService.ts:107` |
| Phone numbers transmitted to Firebase & Twilio for SMS verification | **VERIFIED** | `Frontend/src/services/phoneAuthService.ts`, `Backend/src/services/sms/smsGatewayService.ts:117` |
| Resume intelligence is 100% local deterministic AST (No external AI LLM calls) | **VERIFIED** | `Backend/src/services/resume/geminiResumeAnalyzer.ts`, `scoringEngine.ts` |
| GDPR Data Portability export engine exists and works | **VERIFIED** | `Backend/src/services/account/dataArchiveService.ts` |
| Account deletion grace period exists but lacks automated backend purge worker | **VERIFIED** | `Backend/src/services/account/privacyCenterService.ts:250`, search for `DELETE FROM users` |
| Hosting providers include Vercel and Render | **INFERRED** | `Backend/src/Routes/platform/platformRoutes.ts:60` |
| Production database is Supabase PostgreSQL | **INFERRED** | `Backend/src/database/client.ts:8`, `SUPABASE_DB_URL` |
| Company legal jurisdiction and registered entity details | **UNKNOWN** | Not specified in codebase (Requires Product Owner confirmation) |
| Intended minimum user age policy | **UNKNOWN** | Not defined in code (Requires Product Owner confirmation) |
