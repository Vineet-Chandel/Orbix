# Orbix Club Application Verification: Manual Database & Reviewer Guide

This guide provides complete technical documentation for Orbix staff and reviewers responsible for auditing, verifying, and activating collegiate clubs—either through the **Orbix Reviewer Portal (`/clubs/reviewer`)** or manually via the **PostgreSQL / Supabase Database**.

---

## 1. Executive Summary & Verification Lifecycle

The verification process transitions a club application through the following state machine:

```
                  ┌──────────────┐
                  │   pending    │
                  └──────┬───────┘
                         │ Reviewer picks up application
                         ▼
                  ┌──────────────┐
                  │ under_review │◄──────────────────────────────┐
                  └──┬───┬────┬──┘                               │
     Requires info   │   │    │ Rejected                         │ Applicant provides info
     from applicant  │   │    │ (Invalid club / unauthorized)    │ / reconsideration
┌────────────────────┘   │    └────────────────────┐             │
▼                        │                         ▼             │
┌───────────────────┐    │                 ┌──────────────┐      │
│ needs_information │    │                 │   rejected   │──────┘
└─────────┬─────────┘    │                 └──────────────┘
          └──────────────┘
                         │ All 4 Checklist items confirmed
                         ▼
              ┌─────────────────────┐
              │ ready_for_promotion │
              └──────────┬──────────┘
                         │ Atomic Promotion & Activation
                         ▼
              ┌─────────────────────┐
              │      approved       │ ──► Creates active row in `verified_clubs`
              └─────────────────────┘
```

---

## 2. Database Schema: Reviewer-Controlled Fields

In Supabase / PostgreSQL table `public.club_verification_requests`, reviewers modify the following columns:

| Column Name | Data Type | Nullable | Allowed Values / Constraints | Default Value | Reviewer Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `status` | `text` | `NO` | `'pending'`<br>`'under_review'`<br>`'needs_information'`<br>`'rejected'`<br>`'ready_for_promotion'`<br>`'approved'` | `'pending'` | The authoritative state of the application. |
| `college_contact_status` | `text` | `NO` | `'not_started'`<br>`'contacted'`<br>`'confirmed'`<br>`'not_found'`<br>`'no_response'` | `'not_started'` | Verification status with college faculty or student council. |
| `club_existence_confirmed` | `boolean` | `NO` | `TRUE` / `FALSE` | `FALSE` | Proof that the club actively exists and operates on campus. |
| `college_authorization_confirmed` | `boolean` | `NO` | `TRUE` / `FALSE` | `FALSE` | Proof that the institution officially recognizes the club. |
| `representative_authority_confirmed` | `boolean` | `NO` | `TRUE` / `FALSE` | `FALSE` | Proof that the applicant is an authorized leader of the club. |
| `last_college_contacted_at` | `timestamptz` | `YES` | Valid ISO 8601 Timestamp / `NOW()` / `NULL` | `NULL` | When the reviewer last emailed/called the institution. |
| `reviewed_by` | `uuid` | `YES` | UUID referencing `auth.users(id)` | `NULL` | The user ID of the staff reviewer who performed the review. |
| `reviewed_at` | `timestamptz` | `YES` | Valid ISO 8601 Timestamp / `NOW()` / `NULL` | `NULL` | Timestamp when the reviewer saved the audit review. |
| `internal_notes` | `text` | `YES` | Any string (audit log & notes) | `NULL` | Private notes visible only to reviewers (never shown to applicant). |
| `verified_club_id` | `uuid` | `YES` | UUID referencing `public.verified_clubs(id)` | `NULL` | Foreign key linked **only** once the club is `approved`. |

---

## 3. Four-Point Verification Checklist: Inspection Standards

Before any club can be approved, the reviewer must satisfy **all 4 criteria**:

### Check 1: College Contact Verification (`college_contact_status = 'confirmed'`)
* **Objective**: Confirm the institution exists and can be reached via formal channels.
* **Evidence Required**:
  1. `college_id`: Selected from the verified `institutions` directory.
  2. `college_website_url`: Verified against state/national higher education boards (e.g., UGC, AICTE, NIRF in India, or official `.edu` / `.ac.in` domain).
  3. Official Dean / Faculty Advisor outreach has received an affirmative confirmation.
* **Status Enum Values**:
  - `not_started`: No communication initiated.
  - `contacted`: Email dispatched or phone call placed to faculty/dean.
  - `confirmed`: Institution confirmed authorization.
  - `not_found`: Institution domain or administration cannot be verified.
  - `no_response`: Followed up twice with no reply after 5 business days.

---

### Check 2: Club Existence Confirmed (`club_existence_confirmed = TRUE`)
* **Objective**: Ensure the club is a real, active student collective, not a fictitious placeholder.
* **Evidence Required**:
  1. **Active Online Presence**: Official Instagram (`@college_codingclub`), LinkedIn page, or GitHub organization actively updated within the last 6 months.
  2. **Event Track Record**: Photos, posters, hackathon banners, or workshop announcements bearing the club name and college branding.
  3. **Member Base**: Verifiable roster or active participant community (Discord/WhatsApp community link or GitHub team).

---

### Check 3: College Authorization Confirmed (`college_authorization_confirmed = TRUE`)
* **Objective**: Ensure the club is officially recognized by the college administration (Student Welfare, Department of CSE, or Principal's office).
* **Evidence Required**:
  1. College Official Email (`college_official_email`) matching domain (e.g. `hod.cse@iitb.ac.in` or `studentwelfare@vit.ac.in`).
  2. Letter of Recognition, Club Charter, or Faculty Advisor designation letter.
  3. Inclusion on the official college website's list of registered student organizations.

---

### Check 4: Representative Authority Confirmed (`representative_authority_confirmed = TRUE`)
* **Objective**: Verify that the person who signed up actually represents the club leadership.
* **Evidence Required**:
  1. `contact_person_name` matches student ID card or college roster.
  2. Position stated (`contact_person_role`: President, Vice President, Lead Organizer, General Secretary).
  3. Contact Email (`contact_email`) and Phone Number (`contact_phone`) are cryptographically verified via Orbix 2FA OTP (`is_email_verified = TRUE` and `is_phone_verified = TRUE`).

---

## 4. Manual Database Operations (SQL Runbook)

> [!TIP]
> **AUTOMATED DATABASE TRIGGER (`trg_auto_enforce_verified_club`):**  
> Simply setting `status = 'approved'` on `public.club_verification_requests` will **automatically**:
> 1. Create the verified club in `public.verified_clubs`.
> 2. Generate a clean unique URL slug from the club name.
> 3. Link `verified_club_id` back to the application.
> 4. Auto-confirm all 4 checklist points.
>
> You no longer need to write multi-step SQL scripts or populate a separate timeline table. The applicant's verification timeline is generated **100% dynamically on every refresh** directly from `club_verification_requests` and `verified_clubs`!

---

### 4.1 Update Review Progress & Checklist (Under Review)

```sql
UPDATE public.club_verification_requests
SET
    status = 'under_review',
    college_contact_status = 'contacted',
    club_existence_confirmed = TRUE,
    college_authorization_confirmed = FALSE,
    representative_authority_confirmed = TRUE,
    last_college_contacted_at = NOW(),
    internal_notes = 'Emailed faculty coordinator Prof. Sharma at faculty@college.ac.in. Club existence verified via active GitHub org and Instagram.',
    reviewed_by = '<REVIEWER_USER_UUID>',
    reviewed_at = NOW(),
    updated_at = NOW()
WHERE id = '<APPLICATION_UUID>';
```

---

### 4.2 Request More Information (`needs_information`)

When essential documents (like faculty letter or student ID) are missing, set `status = 'needs_information'` and provide reviewer notes in `internal_notes`. The applicant will immediately see this highlighted on their live timeline upon refresh:

```sql
UPDATE public.club_verification_requests
SET
    status = 'needs_information',
    internal_notes = 'Action Required: Please email verify@orbix.dev with a scanned endorsement letter from your Department Head or Faculty Coordinator.',
    reviewed_by = '<REVIEWER_USER_UUID>',
    reviewed_at = NOW(),
    updated_at = NOW()
WHERE id = '<APPLICATION_UUID>';
```

---

### 4.3 Approve & Activate Club (Single-Step Manual Update)

To approve and activate a club, update `status = 'approved'` directly in the Supabase Table Editor or execute:

```sql
UPDATE public.club_verification_requests
SET
    status = 'approved',
    internal_notes = 'All 4 verification checklist criteria confirmed. Institution and representative verified.',
    reviewed_by = '<REVIEWER_USER_UUID>',
    reviewed_at = NOW(),
    updated_at = NOW()
WHERE id = '<APPLICATION_UUID>';
```

*(The `trg_auto_enforce_verified_club` trigger handles slug generation, `verified_clubs` creation, and `verified_club_id` association automatically).*

---

### 4.4 Rejecting an Ineligible Application (`rejected`)

```sql
UPDATE public.club_verification_requests
SET
    status = 'rejected',
    internal_notes = 'Ineligible: Club has been dormant for 3+ years and failed to provide faculty endorsement.',
    reviewed_by = '<REVIEWER_USER_UUID>',
    reviewed_at = NOW(),
    updated_at = NOW()
WHERE id = '<APPLICATION_UUID>';
```

---

## 5. Standard Reviewer Audit Templates

### 5.1 Internal Notes Templates (`internal_notes`)

```text
[REVIEW PASSED]
- College Verified: IIT Bombay (Verified against NIRF directory).
- Outreach: Faculty advisor Prof. R. Verma responded affirmatively via email (rverma@iitb.ac.in).
- Presence: Active GitHub Organization (github.com/wncc) with 40+ repos.
- Representative: Alex Rivera confirmed via student ID card and verified mobile OTP.
- Decision: Approved for promotion.
```

```text
[INFORMATION REQUESTED]
- Club existence confirmed via Instagram page.
- Representative phone OTP verified.
- Missing: No official faculty email provided. College website does not list student coordinators.
- Action: Sent request for endorsement letter from Dean of Student Affairs.
```

```text
[REJECTED]
- Domain not associated with accredited institution.
- Club social media has been dormant for 3+ years with no verifiable student body.
- Applicant failed to provide student ID after 7-day grace period.
```

---

## 6. Recommended Reviewer Workflow: Reviewer Queue UI

To avoid manual SQL queries, authorized Orbix reviewers should use the built-in UI:

1. **Access the Portal**: Open `http://localhost:5173/clubs/reviewer` (or `/staff/club-reviews`).
2. **Reviewer Authorization**: Your account email must be present in the backend allowlist `CLUB_REVIEWER_EMAILS` (in `Backend/.env`).
3. **Queue Overview**:
   - Filter by status (`Pending`, `Under Review`, `Needs Information`, `Approved`).
   - Click any card to load the **Inspector Panel**.
4. **Interactive Audit**:
   - Change College Contact Status (`Confirmed`, `Contacted`, etc.).
   - Toggle the 3 confirmation checkboxes.
   - Enter internal notes.
   - Click **Save Review Changes** (auto-dispatches timeline events).
5. **One-Click Promotion**:
   - Once all 4 checklist points are green, click **"Approve & Activate Verified Club"**.
   - Orbix will handle the database transaction, unique slug generation, and user activation automatically.
