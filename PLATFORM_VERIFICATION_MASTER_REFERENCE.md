# ORBIX — PLATFORM CONNECTION & OWNERSHIP VERIFICATION MASTER REFERENCE

**Authoritative System Audit & Specification**  
**Audit Date:** November 24, 2026  
**System Scope:** Full repository audit across all 16 supported external platforms in Orbix.  
**Source Baseline:** `Backend/src/Routes/portals/portals.ts`, `Backend/src/services/verification/`, `Frontend/src/utils/portalParser.ts`, `Frontend/src/utils/platformVerificationSupport.ts`, and `Frontend/src/components/verification/OwnershipVerificationModal.tsx`.

---

## SECTION A — EXECUTIVE SUMMARY

An exhaustive, evidence-based code and architectural audit was performed on all platform integrations across the Orbix full-stack repository.

### 1. Key Metrics & Platform Breakdown

- **Total Platforms Discovered:** Exactly **16 platforms** registered across the frontend router (`Frontend/src/utils/portalParser.ts`) and backend portal dispatcher (`Backend/src/Routes/portals/portals.ts`).
- **Connection Methods:**
  - `PUBLIC_PROFILE_FETCH` (Live API / HTML Scraping): **12 platforms** (LeetCode, Codeforces, GitHub, CodeChef, GeeksforGeeks, HackerRank, AtCoder, CSES, HackerEarth, InterviewBit, TopCoder, Kaggle)
  - `PUBLIC_PROFILE_FETCH` (Shallow HTML Title Scrape with Fallback): **1 platform** (Code360 / Coding Ninjas)
  - `MANUAL_LINK_ONLY` (Client Regex Validation & Local Stub Generation): **3 platforms** (SPOJ, Medium, Substack)
- **Ownership Verification Methods:**
  - `CRYPTOGRAPHIC PROFILE CHALLENGE` (Token Placement in User Profile): **4 platforms** (LeetCode, Codeforces, HackerRank, Kaggle)
  - `OAUTH OWNERSHIP VERIFICATION` (OAuth 2.0 Identity Assertion): **1 platform** (GitHub)
  - `UNSUPPORTED / CRAWLER-ONLY` (No Ownership Verification Architecture): **11 platforms** (CodeChef, GeeksforGeeks, AtCoder, Code360, InterviewBit, TopCoder, HackerEarth, CSES, SPOJ, Medium, Substack)
- **Platforms with Confirmed, Live-Operational Editable Verification Fields:** **3 platforms** (LeetCode — `ReadMe`, Codeforces — `Organization`, HackerRank — `Headline`).
- **Platforms Blocked by Anti-Bot Infrastructure:** **1 platform** (Kaggle — `Bio` field implementation complete and unit-tested, but live server-side fetching is gated by Google reCAPTCHA Enterprise).
- **OAuth Ownership Platforms:** **1 platform** (GitHub — Verified via OAuth identity matching; no profile editing required).
- **Public Crawler-Only Platforms:** **8 platforms** (CodeChef, GeeksforGeeks, AtCoder, Code360, InterviewBit, TopCoder, HackerEarth, CSES).
- **Manual Link / Local Stub Platforms:** **3 platforms** (SPOJ, Medium, Substack).

### 2. Critical Architectural Decoupling: Connection vs. Ownership

A central finding of this audit is that **Account Connection** and **Ownership Verification** in Orbix are completely decoupled:
1. **Account Connection (`user_links.sync_status`):** Any user can enter a public handle or profile link for all 16 platforms. The system executes a public fetch or URL check, displays public badges, and stores the handle in `public.user_links` with `ownership_status = 'CONNECTED_UNVERIFIED'` and `verified = false`. A successful profile fetch proves only that the account exists on the platform, **not** that the Orbix user owns it.
2. **Cryptographic Ownership Verification (`user_links.ownership_status`):** Only platforms registered in `Backend/src/services/verification/adapters/adapterRegistry.ts` (currently 5 Tier-1 platforms: LeetCode, Codeforces, HackerRank, GitHub, Kaggle) have cryptographic verification mechanisms. To transition to `ownership_status = 'VERIFIED'` and `verified = true`, the user must complete a cryptographic profile challenge or an OAuth grant. All other 11 platforms remain strictly unverified.

### 3. Major Inconsistencies & Platform Limitations Discovered

1. **LeetCode Instruction Discrepancy:** The backend adapter (`leetcodeAdapter.ts`) contains a legacy string in `getInstructions()` pointing to `displayFieldName: 'About Me / Summary'` and `profileSettingsUrl: 'https://leetcode.com/profile/'`. In contrast, the frontend (`platformVerificationSupport.ts`) correctly displays `ReadMe` and links directly to `https://leetcode.com/settings/profile/`, perfectly matching LeetCode's live UI.
2. **`types/verification.ts` Discrepancy:** `SUPPORTED_PORTALS` in `Backend/src/types/verification.ts` lists 7 portals (`leetcode`, `codeforces`, `codechef`, `hackerrank`, `geeksforgeeks`, `github`, `kaggle`), but `adapterRegistry.ts` only registers 5 adapters. `codechef` and `geeksforgeeks` have no adapter implementations and fail closed with `UNSUPPORTED_PLATFORM`.
3. **CSES Zero-Editable-Field Limitation:** CSES (`cses.fi`) user profiles contain no bio, location, organization, or custom status text fields whatsoever. Cryptographic profile challenge verification is structurally impossible on CSES without an official OAuth/API provider.
4. **SPOJ, Medium, Substack Stubbing:** `fetchSPOJ`, `fetchMedium`, and `fetchSubstack` in `portals.ts` do not make network calls; they perform regex matching and immediately return synthetic profile objects with `verified: true` in the crawler payload. (Note: database ownership projection correctly forces `verified: false` for unverified connections).
5. **Kaggle Bot Gate:** `KaggleAdapter` correctly parses the `Bio` field from Open Graph, JSON-LD, and embedded state, but live unauthenticated requests from server environments are intercepted by Google reCAPTCHA Enterprise (`recaptcha/challengepage`), causing server-side verification to fail closed.

---

## SECTION B — MASTER COMPARISON TABLE

| # | Platform | Identifier | Connection Method | Ownership Method | Exact Visible Field | Internal Field Key | Direct Destination URL | Verification Status | Confidence |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **LeetCode** | `leetcode` | `PUBLIC_PROFILE_FETCH` (GraphQL) | `CRYPTOGRAPHIC PROFILE CHALLENGE` | **ReadMe** | `aboutMe` | `https://leetcode.com/settings/profile/` | Fully Operational | **CONFIRMED** |
| 2 | **Codeforces** | `codeforces` | `PUBLIC_PROFILE_FETCH` (REST API) | `CRYPTOGRAPHIC PROFILE CHALLENGE` | **Organization** | `organization` | `https://codeforces.com/settings/social` | Fully Operational | **CONFIRMED** |
| 3 | **HackerRank** | `hackerrank` | `PUBLIC_PROFILE_FETCH` (REST API) | `CRYPTOGRAPHIC PROFILE CHALLENGE` | **Headline** | `headline`, `jobs_headline` | `https://www.hackerrank.com/profile/{username}` | Fully Operational | **CONFIRMED** |
| 4 | **GitHub** | `github` | `PUBLIC_PROFILE_FETCH` (REST API) | `OAUTH OWNERSHIP VERIFICATION` | *N/A (OAuth Grant)* | `oauth_identity` | `/api/auth/github` | Fully Operational | **CONFIRMED** |
| 5 | **Kaggle** | `kaggle` | `PUBLIC_PROFILE_FETCH` (HTML Scraping) | `CRYPTOGRAPHIC PROFILE CHALLENGE` | **Bio** | `bio` | `https://www.kaggle.com/{username}` | Anti-Bot Blocked | **BLOCKED** |
| 6 | **CodeChef** | `codechef` | `PUBLIC_PROFILE_FETCH` (HTML Scraping) | `CRAWLER-ONLY` | *N/A (No Adapter)* | *None* | `https://www.codechef.com/users/{username}` | Unsupported | **UNSUPPORTED** |
| 7 | **GeeksforGeeks** | `geeksforgeeks` | `PUBLIC_PROFILE_FETCH` (HTML + Tashif API) | `CRAWLER-ONLY` | *N/A (No Adapter)* | *None* | `https://www.geeksforgeeks.org/user/{username}/` | Unsupported | **UNSUPPORTED** |
| 8 | **AtCoder** | `atcoder` | `PUBLIC_PROFILE_FETCH` (HTML Scraping) | `CRAWLER-ONLY` | *N/A (No Adapter)* | *None* | `https://atcoder.jp/users/{username}` | Unsupported | **UNSUPPORTED** |
| 9 | **Code360** | `code360` | `PUBLIC_PROFILE_FETCH` (Shallow HTML Title) | `CRAWLER-ONLY` | *N/A (No Adapter)* | *None* | `https://www.naukri.com/code360/profile/{username}` | Unsupported | **UNSUPPORTED** |
| 10 | **InterviewBit** | `interviewbit` | `PUBLIC_PROFILE_FETCH` (Official API) | `CRAWLER-ONLY` | *N/A (No Adapter)* | *None* | `https://www.interviewbit.com/profile/{username}/` | Unsupported | **UNSUPPORTED** |
| 11 | **TopCoder** | `topcoder` | `PUBLIC_PROFILE_FETCH` (Official v6 API) | `CRAWLER-ONLY` | *N/A (No Adapter)* | *None* | `https://profiles.topcoder.com/{username}` | Unsupported | **UNSUPPORTED** |
| 12 | **HackerEarth** | `hackerearth` | `PUBLIC_PROFILE_FETCH` (HTML Scraping) | `CRAWLER-ONLY` | *N/A (No Adapter)* | *None* | `https://www.hackerearth.com/@{username}/` | Unsupported | **UNSUPPORTED** |
| 13 | **CSES** | `cses` | `PUBLIC_PROFILE_FETCH` (HTML Scraping) | `CRAWLER-ONLY` | *N/A (No Editable Bio Field)* | *None* | `https://cses.fi/user/{id}` | Unsupported | **UNSUPPORTED** |
| 14 | **SPOJ** | `spoj` | `MANUAL_LINK_ONLY` (Local Regex Stub) | `CRAWLER-ONLY` | *N/A (No Adapter)* | *None* | `https://www.spoj.com/users/{username}/` | Unsupported | **UNSUPPORTED** |
| 15 | **Medium** | `medium` | `MANUAL_LINK_ONLY` (Local Regex Stub) | `CRAWLER-ONLY` | *N/A (No Adapter)* | *None* | `https://medium.com/@{username}` | Unsupported | **UNSUPPORTED** |
| 16 | **Substack** | `substack` | `MANUAL_LINK_ONLY` (Local Regex Stub) | `CRAWLER-ONLY` | *N/A (No Adapter)* | *None* | `https://{username}.substack.com` | Unsupported | **UNSUPPORTED** |

---

## SECTION C — INDIVIDUAL PLATFORM AUDITS & USER INSTRUCTIONS

### 1. LeetCode (`leetcode`)

- **Account connection method:** `PUBLIC_PROFILE_FETCH` (GraphQL query).
- **Expected user input:** Username or profile URL (`leetcode.com/u/username` or `leetcode.com/username`).
- **Public profile URL:** `https://leetcode.com/u/{username}`
- **Profile fetch status:** Operational. Queried via `https://leetcode.com/graphql` using `userPublicProfile` query.
- **Ownership verification method:** `CRYPTOGRAPHIC PROFILE CHALLENGE`
- **Exact visible field:** **ReadMe**
- **Internal backend field key:** `aboutMe` (returned in GraphQL `matchedUser.profile.aboutMe`).
- **Exact destination URL:** `https://leetcode.com/settings/profile/`
- **Exact navigation steps:**
  1. Open your browser and navigate to LeetCode Profile Settings: `https://leetcode.com/settings/profile/`.
  2. Sign in to your LeetCode account if prompted.
  3. In the profile settings table, scroll down to the row labeled **ReadMe**.
  4. Click the edit input in the **ReadMe** row.
  5. Paste the verification token generated by Orbix into the input field.
- **Save instructions:** Click the **Save** button at the bottom of the LeetCode profile settings form.
- **Backend extraction mechanism:** `Backend/src/services/verification/adapters/leetcodeAdapter.ts` queries `https://leetcode.com/graphql` and extracts `data.matchedUser.profile.aboutMe`.
- **Public retrievability:** Publicly accessible via LeetCode's public GraphQL endpoint without user authentication.
- **Verification capability:** Operational. Complete with reference screenshot (`leetcode-verification-guide-cropped.png`) and full lightbox preview.
- **Evidence:** `Backend/src/services/verification/adapters/leetcodeAdapter.ts#L41-L51`, `Frontend/src/utils/platformVerificationSupport.ts#L68-L80`.
- **Known limitations:** LeetCode GraphQL is subject to rate limiting (HTTP 429) under rapid polling. Handled gracefully by Orbix fail-closed rate limiters.

---

### 2. Codeforces (`codeforces`)

- **Account connection method:** `PUBLIC_PROFILE_FETCH` (REST API).
- **Expected user input:** Handle or URL (`codeforces.com/profile/handle`).
- **Public profile URL:** `https://codeforces.com/profile/{handle}`
- **Profile fetch status:** Operational. Calls `https://codeforces.com/api/user.info?handles={handle}` and `user.status`.
- **Ownership verification method:** `CRYPTOGRAPHIC PROFILE CHALLENGE`
- **Exact visible field:** **Organization**
- **Internal backend field key:** `organization` (returned in REST API `result[0].organization`).
- **Exact destination URL:** `https://codeforces.com/settings/social`
- **Exact navigation steps:**
  1. Navigate directly to Codeforces Social Settings: `https://codeforces.com/settings/social`.
  2. Sign in to your Codeforces account.
  3. Ensure the **SOCIAL** settings tab is active.
  4. Locate the text input field labeled **Organization**.
  5. Paste the verification token generated by Orbix into the **Organization** input.
- **Save instructions:** Click the **Save changes** button directly below the form fields.
- **Backend extraction mechanism:** `Backend/src/services/verification/adapters/codeforcesAdapter.ts` fetches `https://codeforces.com/api/user.info?handles={handle}` and extracts `result[0].organization`.
- **Public retrievability:** Publicly available on all public Codeforces profile API calls without session cookies.
- **Verification capability:** Operational. Complete with reference screenshot (`codeforces-verification-guide.png`) and full lightbox preview.
- **Evidence:** `Backend/src/services/verification/adapters/codeforcesAdapter.ts#L111-L121`, `Frontend/src/utils/platformVerificationSupport.ts#L81-L93`.
- **Known limitations:** Codeforces API enforces a strict rate limit of 5 requests per second across all consumers. Handled with 8-second request timeouts and fail-closed handling.

---

### 3. HackerRank (`hackerrank`)

- **Account connection method:** `PUBLIC_PROFILE_FETCH` (REST API).
- **Expected user input:** Username or URL (`hackerrank.com/profile/username`).
- **Public profile URL:** `https://www.hackerrank.com/profile/{username}`
- **Profile fetch status:** Operational. Calls `https://www.hackerrank.com/rest/hackers/{username}` and `/badges`.
- **Ownership verification method:** `CRYPTOGRAPHIC PROFILE CHALLENGE`
- **Exact visible field:** **Headline**
- **Internal backend field key:** `headline` and `jobs_headline` (returned in REST API `data.model.jobs_headline` and `data.model.headline`).
- **Exact destination URL:** `https://www.hackerrank.com/profile/{username}`
- **Exact navigation steps:**
  1. Open your public HackerRank profile: `https://www.hackerrank.com/profile/{username}`.
  2. Sign in to HackerRank.
  3. Click the pencil edit icon (`.profile-edit-button`) located next to your profile display name.
  4. In the **Personal Information** modal dialog that appears, locate the field labeled **Headline**.
  5. Append the verification token generated by Orbix to your existing Headline text.
- **Save instructions:** Click the green **Save** button in the bottom-right corner of the Personal Information modal.
- **Backend extraction mechanism:** `Backend/src/services/verification/adapters/hackerrankAdapter.ts` fetches `https://www.hackerrank.com/rest/hackers/{username}` and inspects `model.headline` and `model.jobs_headline`.
- **Public retrievability:** Publicly accessible via HackerRank's unauthenticated REST endpoint.
- **Verification capability:** Operational. Complete with reference screenshot (`hackerrank-verification-guide.png`) and full lightbox preview.
- **Evidence:** `Backend/src/services/verification/adapters/hackerrankAdapter.ts#L10-L15`, `Frontend/src/utils/platformVerificationSupport.ts#L94-L113`.
- **Known limitations:** Headline has an 80-character maximum length limit on HackerRank; users should append or replace temporary text without exceeding 80 characters.

---

### 4. GitHub (`github`)

- **Account connection method:** `PUBLIC_PROFILE_FETCH` (REST API).
- **Expected user input:** Username or URL (`github.com/username`).
- **Public profile URL:** `https://github.com/{username}`
- **Profile fetch status:** Operational. Fetches `https://api.github.com/users/{username}` (with optional `GITHUB_TOKEN`).
- **Ownership verification method:** `OAUTH OWNERSHIP VERIFICATION`
- **Exact visible field:** *N/A (OAuth Authorization Flow — no manual text editing required)*.
- **Internal backend field key:** `oauth_identity` (Numeric GitHub user ID and login username).
- **Exact destination URL:** `/api/auth/github` (Redirects to `https://github.com/login/oauth/authorize`).
- **Exact navigation steps:**
  1. In the Orbix Ownership Verification modal, click **Verify with GitHub**.
  2. You will be redirected to GitHub's secure OAuth authorization page.
  3. Ensure you are signed in as the GitHub handle specified in your connection.
  4. Authorize the Orbix application.
  5. GitHub redirects you back to Orbix with a temporary code that securely proves ownership.
- **Save instructions:** Click **Authorize theorbix** on the GitHub OAuth authorization page.
- **Backend extraction mechanism:** `Backend/src/services/auth/githubLinkFlow.ts` and `githubAdapter.ts` exchange the OAuth code for an access token, query `https://api.github.com/user`, and assert that the authenticated user's login matches the claimed connection handle.
- **Public retrievability:** Direct cryptographically verified OAuth 2.0 handshake.
- **Verification capability:** Operational.
- **Evidence:** `Backend/src/services/auth/githubLinkFlow.ts#L18-L25`, `Backend/src/services/verification/adapters/githubAdapter.ts#L9-L20`.
- **Known limitations:** If the user is logged into a different GitHub account in their browser than the handle they claimed on Orbix, the backend rejects with HTTP 409 `IDENTITY_MISMATCH`.

---

### 5. Kaggle (`kaggle`)

- **Account connection method:** `PUBLIC_PROFILE_FETCH` (HTML scraping).
- **Expected user input:** Username or URL (`kaggle.com/username`).
- **Public profile URL:** `https://www.kaggle.com/{username}`
- **Profile fetch status:** Operational in code via `fetchKaggleDetailed` in `portals.ts`.
- **Ownership verification method:** `CRYPTOGRAPHIC PROFILE CHALLENGE`
- **Exact visible field:** **Bio**
- **Internal backend field key:** `bio` (extracted from Open Graph description, Schema.org JSON-LD Person description, and `userBio` embedded state).
- **Exact destination URL:** `https://www.kaggle.com/{username}`
- **Exact navigation steps:**
  1. Open your Kaggle profile: `https://www.kaggle.com/{username}`.
  2. Sign in to Kaggle.
  3. Select the **Home** tab on your profile page.
  4. Locate the **Bio** section in the left sidebar.
  5. Click the **Edit** icon associated with Bio.
  6. Append the Orbix verification token to your Bio.
- **Save instructions:** Click the **Save** button in the Bio editor.
- **Backend extraction mechanism:** `Backend/src/services/verification/adapters/kaggleAdapter.ts` fetches `https://www.kaggle.com/{username}` and extracts candidate tokens from `<meta property="og:description">`, JSON-LD `<script type="application/ld+json">`, and embedded state.
- **Public retrievability:** Publicly visible on desktop browsers; however, server-side automated fetch requests are intercepted by Google reCAPTCHA Enterprise.
- **Verification capability:** `BLOCKED` (Anti-Bot Restricted).
- **Evidence:** `Backend/src/services/verification/adapters/kaggleAdapter.ts#L1-L280`, `Backend/src/services/verification/kaggleVerification.test.ts`.
- **Known limitations:** Google reCAPTCHA Enterprise actively blocks automated server-side requests from cloud datacenter IPs. Live verification cannot succeed without proxy infrastructure or an official Kaggle user profile API.

---

### 6. CodeChef (`codechef`)

- **Account connection method:** `PUBLIC_PROFILE_FETCH` (HTML scraping).
- **Expected user input:** Username or URL (`codechef.com/users/username`).
- **Public profile URL:** `https://www.codechef.com/users/{username}`
- **Profile fetch status:** Operational. Scrapes rating, global rank, stars, and problem counts from `https://www.codechef.com/users/{username}` in `fetchCodeChef` (`portals.ts#L706`).
- **Ownership verification method:** `CRAWLER-ONLY` (No ownership verification adapter exists).
- **Exact visible field:** *N/A (No verification adapter)*.
- **Internal backend field key:** *None*.
- **Exact destination URL:** `https://www.codechef.com/users/{username}`
- **Exact navigation steps:** *N/A*.
- **Save instructions:** *N/A*.
- **Backend extraction mechanism:** *None*. `adapterRegistry.getAdapter('codechef')` returns `undefined`.
- **Public retrievability:** Public profile HTML can be scraped, but is frequently protected by Cloudflare anti-bot checks.
- **Verification capability:** `UNSUPPORTED`.
- **Evidence:** `Backend/src/services/verification/platformVerificationService.test.ts#L79`, `Backend/src/Routes/portals/portals.ts#L706-L850`.
- **Known limitations:** CodeChef does not provide an official unauthenticated REST API. Cloudflare bot mitigation occasionally blocks datacenter IPs.

---

### 7. GeeksforGeeks (`geeksforgeeks`)

- **Account connection method:** `PUBLIC_PROFILE_FETCH` (HTML scraping + Tashif API fallback).
- **Expected user input:** Username or URL (`geeksforgeeks.org/user/username/`).
- **Public profile URL:** `https://www.geeksforgeeks.org/user/{username}/`
- **Profile fetch status:** Operational. Scrapes profile HTML and calls community API `https://gfg-stats.tashif.codes/{username}/stats` in `fetchGeeksforGeeks` (`portals.ts#L857`).
- **Ownership verification method:** `CRAWLER-ONLY` (No ownership verification adapter exists).
- **Exact visible field:** *N/A (No verification adapter)*.
- **Internal backend field key:** *None*.
- **Exact destination URL:** `https://www.geeksforgeeks.org/user/{username}/`
- **Exact navigation steps:** *N/A*.
- **Save instructions:** *N/A*.
- **Backend extraction mechanism:** *None*. `adapterRegistry.getAdapter('geeksforgeeks')` returns `undefined`.
- **Public retrievability:** GeeksforGeeks profiles are client-rendered Next.js applications protected by Cloudflare.
- **Verification capability:** `UNSUPPORTED`.
- **Evidence:** `Backend/src/services/verification/platformVerificationService.test.ts#L77`, `Backend/src/Routes/portals/portals.ts#L857-L1120`.
- **Known limitations:** Next.js client hydration and dynamic layout changes make HTML scraping fragile for cryptographic token extraction.

---

### 8. AtCoder (`atcoder`)

- **Account connection method:** `PUBLIC_PROFILE_FETCH` (HTML scraping).
- **Expected user input:** Username or URL (`atcoder.jp/users/username`).
- **Public profile URL:** `https://atcoder.jp/users/{username}`
- **Profile fetch status:** Operational. Scrapes rating, rank, and contests from `https://atcoder.jp/users/{username}` in `fetchAtCoder` (`portals.ts#L1229`).
- **Ownership verification method:** `CRAWLER-ONLY` (No ownership verification adapter exists).
- **Exact visible field:** *N/A (No verification adapter)*.
- **Internal backend field key:** *None*.
- **Exact destination URL:** `https://atcoder.jp/users/{username}`
- **Exact navigation steps:** *N/A*.
- **Save instructions:** *N/A*.
- **Backend extraction mechanism:** *None*.
- **Public retrievability:** Public HTML table accessible without authentication.
- **Verification capability:** `UNSUPPORTED`.
- **Evidence:** `Backend/src/Routes/portals/portals.ts#L1229-L1308`.
- **Known limitations:** AtCoder profile settings (`https://atcoder.jp/settings`) provide Affiliation and Country fields, but no free-form bio or status field exists on public profile pages.

---

### 9. Code360 / Coding Ninjas (`code360`)

- **Account connection method:** `PUBLIC_PROFILE_FETCH` (Shallow HTML title scrape with fallback).
- **Expected user input:** Handle or URL (`naukri.com/code360/profile/handle` or `codingninjas.com/codestudio/profile/handle`).
- **Public profile URL:** `https://www.naukri.com/code360/profile/{username}`
- **Profile fetch status:** Partially operational. Attempts shallow title scrape; falls back to verified username stub in `fetchCode360` (`portals.ts#L1577`).
- **Ownership verification method:** `CRAWLER-ONLY` (No ownership verification adapter exists).
- **Exact visible field:** *N/A (No verification adapter)*.
- **Internal backend field key:** *None*.
- **Exact destination URL:** `https://www.naukri.com/code360/profile/{username}`
- **Exact navigation steps:** *N/A*.
- **Save instructions:** *N/A*.
- **Backend extraction mechanism:** *None*.
- **Public retrievability:** Web pages are client-rendered SPAs behind Naukri infrastructure.
- **Verification capability:** `UNSUPPORTED`.
- **Evidence:** `Backend/src/Routes/portals/portals.ts#L1577-L1614`.
- **Known limitations:** Heavy SPA rendering prevents reliable server-side extraction without headless browser execution.

---

### 10. InterviewBit (`interviewbit`)

- **Account connection method:** `PUBLIC_PROFILE_FETCH` (Official API).
- **Expected user input:** Username or profile URL (`interviewbit.com/profile/username`).
- **Public profile URL:** `https://www.interviewbit.com/profile/{username}/`
- **Profile fetch status:** Operational. Queries official API `https://www.interviewbit.com/v2/profile/username?id={username}` and streak API in `fetchInterviewBit` (`portals.ts#L1388`).
- **Ownership verification method:** `CRAWLER-ONLY` (No ownership verification adapter exists).
- **Exact visible field:** *N/A (No verification adapter)*.
- **Internal backend field key:** *None*.
- **Exact destination URL:** `https://www.interviewbit.com/profile/{username}/`
- **Exact navigation steps:** *N/A*.
- **Save instructions:** *N/A*.
- **Backend extraction mechanism:** *None*.
- **Public retrievability:** Public API returns score and streak, but does not expose user bio or custom editable fields.
- **Verification capability:** `UNSUPPORTED`.
- **Evidence:** `Backend/src/Routes/portals/portals.ts#L1388-L1506`.
- **Known limitations:** Public API payload lacks an editable free-form text property suitable for token placement.

---

### 11. TopCoder (`topcoder`)

- **Account connection method:** `PUBLIC_PROFILE_FETCH` (Official v6 REST API).
- **Expected user input:** Handle or URL (`topcoder.com/members/handle` or `profiles.topcoder.com/handle`).
- **Public profile URL:** `https://profiles.topcoder.com/{handle}`
- **Profile fetch status:** Operational. Queries official REST API `https://api.topcoder.com/v6/members?handle={handle}` in `fetchTopCoder` (`portals.ts#L1508`).
- **Ownership verification method:** `CRAWLER-ONLY` (No ownership verification adapter exists).
- **Exact visible field:** *N/A (No verification adapter)*.
- **Internal backend field key:** *None*.
- **Exact destination URL:** `https://profiles.topcoder.com/{handle}`
- **Exact navigation steps:** *N/A*.
- **Save instructions:** *N/A*.
- **Backend extraction mechanism:** *None*.
- **Public retrievability:** TopCoder API returns rating and track data, but excludes user-editable biographical text in public unauthenticated member responses.
- **Verification capability:** `UNSUPPORTED`.
- **Evidence:** `Backend/src/Routes/portals/portals.ts#L1508-L1575`.
- **Known limitations:** No public editable profile field is accessible via TopCoder's unauthenticated REST endpoints.

---

### 12. HackerEarth (`hackerearth`)

- **Account connection method:** `PUBLIC_PROFILE_FETCH` (HTML scraping).
- **Expected user input:** Username or URL (`hackerearth.com/@username`).
- **Public profile URL:** `https://www.hackerearth.com/@{username}/`
- **Profile fetch status:** Operational. Scrapes title, avatar, and rating from `https://www.hackerearth.com/@{username}/` in `fetchHackerEarth` (`portals.ts#L1349`).
- **Ownership verification method:** `CRAWLER-ONLY` (No ownership verification adapter exists).
- **Exact visible field:** *N/A (No verification adapter)*.
- **Internal backend field key:** *None*.
- **Exact destination URL:** `https://www.hackerearth.com/@{username}/`
- **Exact navigation steps:** *N/A*.
- **Save instructions:** *N/A*.
- **Backend extraction mechanism:** *None*.
- **Public retrievability:** Profile page returns HTML, but full profile details require authenticated sessions or AJAX tokens.
- **Verification capability:** `UNSUPPORTED`.
- **Evidence:** `Backend/src/services/verification/platformVerificationService.test.ts#L80`, `Backend/src/Routes/portals/portals.ts#L1349-L1386`.
- **Known limitations:** HackerEarth frequently gates profile pages with dynamic JavaScript loading.

---

### 13. CSES (`cses`)

- **Account connection method:** `PUBLIC_PROFILE_FETCH` (HTML scraping).
- **Expected user input:** User ID or URL (`cses.fi/user/id`).
- **Public profile URL:** `https://cses.fi/user/{id}`
- **Profile fetch status:** Operational. Scrapes task and submission counts from `https://cses.fi/user/{id}` in `fetchCSES` (`portals.ts#L1310`).
- **Ownership verification method:** `CRAWLER-ONLY` (Cryptographic verification is structurally impossible).
- **Exact visible field:** *NONE — CSES user profiles do not possess any user-editable text fields*.
- **Internal backend field key:** *None*.
- **Exact destination URL:** `https://cses.fi/user/{id}`
- **Exact navigation steps:** *N/A*.
- **Save instructions:** *N/A*.
- **Backend extraction mechanism:** *None*.
- **Public retrievability:** Public HTML displays solved problems only.
- **Verification capability:** `UNSUPPORTED` (Permanently blocked by platform architecture).
- **Evidence:** `Backend/src/Routes/portals/portals.ts#L1310-L1347`. Live inspection of CSES user settings confirms zero editable public text fields.
- **Known limitations:** CSES has no bio, description, social links, or status field. Automated cryptographic verification cannot be implemented on CSES.

---

### 14. SPOJ (`spoj`)

- **Account connection method:** `MANUAL_LINK_ONLY` (Local Regex Stub Generator).
- **Expected user input:** Username or URL (`spoj.com/users/username`).
- **Public profile URL:** `https://www.spoj.com/users/{username}/`
- **Profile fetch status:** Stubbed. `fetchSPOJ` in `portals.ts#L1616` does not perform network fetches; it validates the username format (`/^[a-zA-Z0-9_\.]{3,25}$/`) and returns a static stub object.
- **Ownership verification method:** `CRAWLER-ONLY` (No ownership verification adapter exists).
- **Exact visible field:** *N/A (No verification adapter)*.
- **Internal backend field key:** *None*.
- **Exact destination URL:** `https://www.spoj.com/users/{username}/`
- **Exact navigation steps:** *N/A*.
- **Save instructions:** *N/A*.
- **Backend extraction mechanism:** *None*.
- **Public retrievability:** SPOJ public profile pages are aggressively protected by Cloudflare anti-bot and CAPTCHA challenges.
- **Verification capability:** `UNSUPPORTED`.
- **Evidence:** `Backend/src/Routes/portals/portals.ts#L1616-L1633`.
- **Known limitations:** Unauthenticated server requests to `spoj.com` return Cloudflare challenge pages (HTTP 403/503).

---

### 15. Medium (`medium`)

- **Account connection method:** `MANUAL_LINK_ONLY` (Local Regex Stub Generator).
- **Expected user input:** Username or URL (`medium.com/@username`).
- **Public profile URL:** `https://medium.com/@{username}`
- **Profile fetch status:** Stubbed. `fetchMedium` in `portals.ts#L1635` does not perform network fetches; it validates regex (`/^[a-zA-Z0-9_\-\.]{2,30}$/`) and returns a static stub object.
- **Ownership verification method:** `CRAWLER-ONLY` (No ownership verification adapter exists).
- **Exact visible field:** *N/A (No verification adapter)*.
- **Internal backend field key:** *None*.
- **Exact destination URL:** `https://medium.com/@{username}`
- **Exact navigation steps:** *N/A*.
- **Save instructions:** *N/A*.
- **Backend extraction mechanism:** *None*.
- **Public retrievability:** Direct scraping of Medium web pages triggers Cloudflare bot challenges and rate limiting.
- **Verification capability:** `UNSUPPORTED`.
- **Evidence:** `Backend/src/Routes/portals/portals.ts#L1635-L1652`.
- **Known limitations:** Medium requires RSS feed parsing (`medium.com/feed/@username`) or custom domain mapping. No ownership verification adapter exists.

---

### 16. Substack (`substack`)

- **Account connection method:** `MANUAL_LINK_ONLY` (Local Regex Stub Generator).
- **Expected user input:** Publication subdomain or URL (`username.substack.com`).
- **Public profile URL:** `https://{username}.substack.com`
- **Profile fetch status:** Stubbed. `fetchSubstack` in `portals.ts#L1654` does not perform network fetches; it validates regex (`/^[a-zA-Z0-9_\-]{2,30}$/`) and returns a static stub object.
- **Ownership verification method:** `CRAWLER-ONLY` (No ownership verification adapter exists).
- **Exact visible field:** *N/A (No verification adapter)*.
- **Internal backend field key:** *None*.
- **Exact destination URL:** `https://{username}.substack.com`
- **Exact navigation steps:** *N/A*.
- **Save instructions:** *N/A*.
- **Backend extraction mechanism:** *None*.
- **Public retrievability:** Substack publications are isolated on distinct subdomains or custom domains.
- **Verification capability:** `UNSUPPORTED`.
- **Evidence:** `Backend/src/Routes/portals/portals.ts#L1654-L1671`.
- **Known limitations:** No standard public REST API or bio extraction adapter exists.

---

## SECTION D — FRONTEND / BACKEND CONSISTENCY AUDIT

### 1. Correctly Aligned Platforms

- **Codeforces (`codeforces`):**
  - Frontend field label: `Organization`
  - Backend adapter extraction target: `result[0].organization`
  - Direct destination URL: `https://codeforces.com/settings/social`
  - Alignment: **100% PERFECT MATCH**
- **HackerRank (`hackerrank`):**
  - Frontend field label: `Headline`
  - Backend adapter extraction target: `data.model.jobs_headline` and `data.model.headline`
  - Direct destination URL: `https://www.hackerrank.com/profile/{username}`
  - Alignment: **100% PERFECT MATCH**
- **GitHub (`github`):**
  - Frontend verification method: OAuth
  - Backend adapter verification method: OAuth authorization grant (`oauth_identity`)
  - Direct destination URL: `/api/auth/github`
  - Alignment: **100% PERFECT MATCH**

### 2. Discrepancies & Backend/Frontend Alignment Fixes

- **LeetCode (`leetcode`):**
  - Frontend instruction: Displays **ReadMe** and links directly to `https://leetcode.com/settings/profile/`.
  - Backend adapter `getInstructions()`: Returns `displayFieldName: 'About Me / Summary'` and `profileSettingsUrl: 'https://leetcode.com/profile/'`.
  - GraphQL extraction key: `data.matchedUser.profile.aboutMe`.
  - Assessment: In LeetCode's live UI, the field is titled **ReadMe**, but in the backend GraphQL schema it is called `aboutMe`. Because the frontend renders its own authoritative guide from `platformVerificationSupport.ts`, end users see the correct UI label (`ReadMe`) and correct deep link (`https://leetcode.com/settings/profile/`). However, the backend's internal `getInstructions()` method in `leetcodeAdapter.ts` still contains legacy wording (`About Me / Summary`).
- **Kaggle (`kaggle`):**
  - Frontend and backend agree on the **Bio** field and `https://www.kaggle.com/{username}`.
  - However, live execution fails closed due to Google reCAPTCHA Enterprise bot protection.
- **Platform Registration Count in `types/verification.ts`:**
  - `Backend/src/types/verification.ts` contains `SUPPORTED_PORTALS = ['leetcode', 'codeforces', 'codechef', 'hackerrank', 'geeksforgeeks', 'github', 'kaggle']` (7 portals).
  - But `Backend/src/services/verification/adapters/adapterRegistry.ts` only registers 5 portals. `codechef` and `geeksforgeeks` have no adapter implementations. The type definition suggests 7 platforms are supported, but only 5 are wired for verification.
- **11 Crawler-Only Platforms:**
  - Previously, `platformVerificationSupport.ts` had a generic fallback instructing users to paste tokens into "Profile Bio". This was eliminated to prevent users from attempting token placement on platforms where verification is unsupported.

---

## SECTION E — UNRESOLVED & BLOCKED PLATFORMS

### 1. Kaggle (`kaggle`) — Blocked by Anti-Bot Infrastructure

- **Obstacle:** Google reCAPTCHA Enterprise (`recaptcha/challengepage`) actively intercepts automated server-side HTTP requests originating from cloud hosting or datacenter IP ranges.
- **Technical Detail:** Even though `KaggleAdapter` is fully written and tested against static HTML fixtures, live unauthenticated `fetch()` calls from Orbix servers receive an HTML challenge page rather than the profile DOM.
- **Required Resolution:** Unauthenticated server-side scraping cannot reliably verify Kaggle. Resolution requires either an official Kaggle API integration (using API tokens), residential proxy rotation, or a client-side verification model.

### 2. CSES (`cses`) — Structurally Unsupported

- **Obstacle:** Total absence of user-editable text fields on public CSES user profiles.
- **Technical Detail:** Inspection of `https://cses.fi/user/{id}` demonstrates that the page displays only user ID, registration date, and solved task links. There is no bio, location, affiliation, or custom status input.
- **Required Resolution:** Cryptographic profile challenge verification cannot ever be implemented on CSES unless the CSES platform alters its profile architecture to allow user-editable text.

### 3. SPOJ, Medium, Substack — Mocked / Stubbed Fetchers

- **Obstacle:** `fetchSPOJ`, `fetchMedium`, and `fetchSubstack` in `Backend/src/Routes/portals/portals.ts` contain no network code; they validate regex and return local stubs.
- **Technical Detail:** These platforms were integrated as profile placeholders without live crawling pipelines.
- **Required Resolution:** Full public crawlers must be authored and integrated before these platforms can reliably display live public stats.

---

## SECTION F — EVIDENCE & SOURCE CODE REPOSITORY REFERENCES

| Item | File Path | Function / Class / Interface | Line Reference | Confidence |
|---|---|---|---|---|
| **Supported Portals Type** | `Backend/src/types/verification.ts` | `SUPPORTED_PORTALS` | Line 47 | CONFIRMED |
| **Verification Adapter Registry** | `Backend/src/services/verification/adapters/adapterRegistry.ts` | `AdapterRegistry.constructor` | Lines 18–24 | CONFIRMED |
| **LeetCode Adapter** | `Backend/src/services/verification/adapters/leetcodeAdapter.ts` | `LeetCodeAdapter.fetchProfile` | Lines 41–55 | CONFIRMED |
| **Codeforces Adapter** | `Backend/src/services/verification/adapters/codeforcesAdapter.ts` | `CodeforcesAdapter.fetchProfile` | Lines 111–121 | CONFIRMED |
| **HackerRank Adapter** | `Backend/src/services/verification/adapters/hackerrankAdapter.ts` | `HackerRankAdapter.fetchProfile` | Lines 10–15 | CONFIRMED |
| **GitHub Adapter** | `Backend/src/services/verification/adapters/githubAdapter.ts` | `GitHubAdapter` | Lines 9–20 | CONFIRMED |
| **Kaggle Adapter** | `Backend/src/services/verification/adapters/kaggleAdapter.ts` | `KaggleAdapter.fetchProfile` | Lines 50–120 | IMPLEMENTATION VERIFIED / BLOCKED |
| **Frontend Portal Parser (16 Portals)** | `Frontend/src/utils/portalParser.ts` | `PORTALS` | Lines 40–350 | CONFIRMED |
| **Frontend Verification Registry** | `Frontend/src/utils/platformVerificationSupport.ts` | `SUPPORTED_VERIFICATION_PLATFORMS` | Lines 6–12 | CONFIRMED |
| **Frontend Verification Guides** | `Frontend/src/utils/platformVerificationSupport.ts` | `getPlatformVerificationGuide` | Lines 60–146 | CONFIRMED |
| **LeetCode Fetcher** | `Backend/src/Routes/portals/portals.ts` | `fetchLeetCode` | Line 185 | CONFIRMED |
| **Codeforces Fetcher** | `Backend/src/Routes/portals/portals.ts` | `fetchCodeforces` | Line 403 | CONFIRMED |
| **GitHub Fetcher** | `Backend/src/Routes/portals/portals.ts` | `fetchGitHub` | Line 552 | CONFIRMED |
| **CodeChef Fetcher** | `Backend/src/Routes/portals/portals.ts` | `fetchCodeChef` | Line 706 | CONFIRMED |
| **GeeksforGeeks Fetcher** | `Backend/src/Routes/portals/portals.ts` | `fetchGeeksforGeeks` | Line 857 | CONFIRMED |
| **HackerRank Fetcher** | `Backend/src/Routes/portals/portals.ts` | `fetchHackerRank` | Line 1122 | CONFIRMED |
| **AtCoder Fetcher** | `Backend/src/Routes/portals/portals.ts` | `fetchAtCoder` | Line 1229 | CONFIRMED |
| **CSES Fetcher** | `Backend/src/Routes/portals/portals.ts` | `fetchCSES` | Line 1310 | CONFIRMED |
| **HackerEarth Fetcher** | `Backend/src/Routes/portals/portals.ts` | `fetchHackerEarth` | Line 1349 | CONFIRMED |
| **InterviewBit Fetcher** | `Backend/src/Routes/portals/portals.ts` | `fetchInterviewBit` | Line 1388 | CONFIRMED |
| **TopCoder Fetcher** | `Backend/src/Routes/portals/portals.ts` | `fetchTopCoder` | Line 1508 | CONFIRMED |
| **Code360 Fetcher** | `Backend/src/Routes/portals/portals.ts` | `fetchCode360` | Line 1577 | CONFIRMED |
| **SPOJ Fetcher (Stub)** | `Backend/src/Routes/portals/portals.ts` | `fetchSPOJ` | Line 1616 | CONFIRMED |
| **Medium Fetcher (Stub)** | `Backend/src/Routes/portals/portals.ts` | `fetchMedium` | Line 1635 | CONFIRMED |
| **Substack Fetcher (Stub)** | `Backend/src/Routes/portals/portals.ts` | `fetchSubstack` | Line 1654 | CONFIRMED |
| **Kaggle Detailed Fetcher** | `Backend/src/Routes/portals/portals.ts` | `fetchKaggleDetailed` | Line 1694 | CONFIRMED |
