# User Acceptance Testing (UAT) Guide: Club Account Lifecycle & Verification

This document outlines the end-to-end verification and acceptance test cases for the Orbix Dedicated Club Experience:
**Club Registration → Live Verification Timeline → Reviewer Promotion → Dedicated Club Dashboard → Public Presence.**

---

## Architecture & Account Isolation Principles

1. **Authentication Cohesion**: Both personal and club accounts use the canonical Orbix authentication system and sessions.
2. **Authoritative Routing Guard**: Account classification (`personal` vs `club`) and verification status (`pending`, `under_review`, `needs_information`, `approved`) are resolved authoritatively from trusted database tables (`verified_clubs`, `club_verification_requests`).
3. **Strict Separation of Experience**:
   - Club accounts are strictly prevented from accessing personal developer dashboard (`/dashboard`), personal profiles, coding analytics, or resume tools.
   - Personal developer accounts are unaffected and retain full access to their features.
4. **Data Isolation & Privacy**:
   - Private reviewer notes, representative phone numbers, and login emails are never exposed on the public profile (`/clubs/:slug`).

---

## Test Suite Matrix

| Test Case ID | Feature / Phase | Test Description | Expected Result |
| :--- | :--- | :--- | :--- |
| **TC-CLUB-01** | Phase 1: Registration | Register a new club account via `/auth/signup` (Club tab) | Account created with `account_type = 'club'`, verification request recorded as `pending`, redirected to `/club/status`. |
| **TC-CLUB-02** | Phase 1: Auth Isolation | Navigate directly to `/dashboard` or `/profile` while logged in as a pending club | Immediately redirected to `/club/status`. Personal developer cards never render. |
| **TC-CLUB-03** | Phase 2: Live Timeline | Inspect `/club/status` as a pending club applicant | Five-stage timeline displays real database events: Stage 01 (Completed), Stage 02 (In Progress), Stages 03-05 (Upcoming) with real timestamps. |
| **TC-CLUB-04** | Phase 2: Needs Info | Reviewer sets request to `needs_information` with instructions | Orange "Action Required" callout renders on `/club/status` with the reviewer's instructions. |
| **TC-CLUB-05** | Phase 3: Reviewer Queue | Staff reviewer accesses `/staff/club-reviews` | Reviewer queue loads requests with status filters (`pending`, `under_review`, `needs_information`, `ready_for_promotion`, `approved`). |
| **TC-CLUB-06** | Phase 3: Atomic Promotion | Reviewer confirms 4-point checklist and clicks "Approve & Activate Club" | Atomic transaction commits: `verified_clubs` row created with unique collision-safe slug, request marked `approved`, timeline completion events recorded. |
| **TC-CLUB-07** | Phase 4: Club Dashboard | Approved club logs in or navigates to `/club/dashboard` | Dedicated club dashboard loads. Minimal sidebar displays **only ONE** nav item: `Dashboard`. |
| **TC-CLUB-08** | Phase 4: Account Modal | Click bottom club avatar trigger on `/club/dashboard` | Modal opens showing club avatar, verified badge, private login email, "View Public Page", "Edit Club Profile", and "Sign Out". |
| **TC-CLUB-09** | Phase 4: Profile Editor | Update About, Website URL, and Social links on "Manage Public Profile" tab | Updates persist via `PATCH /api/club/profile` and reflect immediately without exposing internal review data. |
| **TC-CLUB-10** | Phase 4: Event CRUD | Create draft and published events with start/end time and registration URL | Events render on Events tab with status badges. Toggle publish/draft updates status in real-time. |
| **TC-CLUB-11** | Phase 5: Public Club Page | Open `/clubs/:slug` in an incognito window (no login) | Public page renders banner, verified badge, institution affiliation, about story, social links, and published upcoming events. |
| **TC-CLUB-12** | Phase 5: Privacy Verification | Inspect API response `GET /api/clubs/:slug` | Internal notes, contact phone, and private login credentials are strictly omitted. |

---

## Step-by-Step Manual Testing Instructions

### Scenario A: Club Registration & Initial Status
1. Navigate to `/auth/signup`.
2. Toggle to the **Club Registration** tab.
3. Fill in:
   - Club Name: `Axonic Developers Club`
   - Category: `Coding & Development`
   - College: Select or enter institution name, city, state.
   - Representative: Alex Rivera, Lead Organizer, `alex@axonic.edu`, password.
   - Accept Terms and Privacy Policy.
4. Submit the registration form.
5. **Verify**:
   - The user is signed in and lands on `/club/status`.
   - The 5-stage timeline shows:
     - `01 Application submitted` (Completed with today's timestamp)
     - `02 Initial review` (In progress)
     - `03 College verification` (Upcoming)
     - `04 Verification decision` (Upcoming)
     - `05 Club access activated` (Upcoming)

---

### Scenario B: Route Isolation Verification
1. While logged in as the pending club account, manually type in the browser URL:
   - `http://localhost:5173/dashboard`
   - `http://localhost:5173/profile`
   - `http://localhost:5173/resume`
2. **Verify**:
   - The application immediately redirects back to `/club/status`.
   - Personal developer metrics, platforms, and practice modules are strictly inaccessible.

---

### Scenario C: Staff Review & Atomic Promotion
1. Sign in with a staff reviewer account (or use `/staff/club-reviews`).
2. Select `Axonic Developers Club` from the queue.
3. In the Inspector Panel on the right:
   - Under **College Contact Verification**, select `Confirmed`.
   - Check **Club Existence Confirmed**.
   - Check **College Authorization Confirmed**.
   - Check **Representative Authority Confirmed**.
4. The green **Approve & Activate Club (Promote to Live)** button becomes enabled.
5. Click **Approve & Activate Club**.
6. **Verify**:
   - Toast notification: *"Club successfully promoted and activated!"*
   - Status badge transitions to `Verified Club`.
   - Success banner displays generated slug link: `/clubs/axonic-developers-club`.

---

### Scenario D: Dedicated Club Dashboard
1. Sign in with the club's credentials.
2. **Verify**:
   - System immediately redirects to `/club/dashboard`.
   - Sidebar displays **only ONE** navigation button: `Dashboard`.
   - Bottom trigger displays club avatar, name, and green verified badge.
3. Click the bottom club profile trigger:
   - **Verify**: The Club Account Center modal opens, displaying the club's verified details and private login email.
4. Test Profile Completeness & Overview:
   - Click "Copy Link" to verify public URL copy functionality.
   - Inspect profile completeness progress bar.
5. Test Public Profile Management:
   - Switch to the **Manage Public Profile** tab.
   - Enter About narrative, Website URL, GitHub, and Discord links.
   - Click **Save Public Profile**. Toast confirms update.

---

### Scenario E: Club Event Lifecycle
1. On `/club/dashboard`, switch to the **Events** tab.
2. Click **Create New Event**.
3. Fill in:
   - Title: `Campus Hackathon 2026`
   - Starts At: A future date/time
   - Location Type: `In-Person`
   - Venue: `Main Auditorium, Block C`
   - Registration URL: `https://unstop.com/hackathons/example`
   - Status: `Published`
4. Click **Create Event**.
5. **Verify**: Event card appears with green `PUBLISHED` badge, date, venue, and registration link.
6. Click **Unpublish**: Badge immediately toggles to `DRAFT`.
7. Click **Publish Live**: Badge toggles back to `PUBLISHED`.

---

### Scenario F: Public Club Presence (No Login Required)
1. Open a new private/incognito browser window.
2. Navigate directly to `http://localhost:5173/clubs/axonic-developers-club`.
3. **Verify**:
   - Page loads cleanly without requiring authentication.
   - Displays cover header, club logo, club name, institution affiliation, and verified badge.
   - "Official Website", "GitHub", and "Discord" pills are clickable.
   - "About Axonic Developers Club" narrative matches the text saved in the dashboard.
   - "Campus Hackathon 2026" appears under Upcoming Events with venue and "Register for Event" button.
   - Open browser developer tools → Network tab → inspect `GET /api/clubs/axonic-developers-club`:
     - Confirm NO `contact_phone`, `internal_notes`, or private reviewer audit data is sent to the client.

---

## Automated Verification Suite

To run the full automated database and transactional pipeline test:
```bash
cd Backend
npx tsx test_club_full_pipeline.ts
```
Expected output:
```
=================================================
   🎉 ALL 7 CLUB PIPELINE TESTS PASSED!
=================================================
```
