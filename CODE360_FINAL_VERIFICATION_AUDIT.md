# Code360 Ownership Verification — Final Security and Integration Audit

**Audit Date:** November 27, 2026  
**Target Platform:** Naukri Code360 (formerly Coding Ninjas Studio)  
**Scope:** Cryptographic Ownership Verification Lifecycle, Public API Integration, and Crawler Semantic Decoupling  
**Auditor:** Antigravity AI Engine  

---

## Executive Summary

A comprehensive post-implementation security and integration audit of the **Naukri Code360** profile ownership verification feature was conducted across the backend cryptographic verification engine, public crawler services, frontend modal UX, and live external endpoints.

All verification invariants are verified intact. The critical invariant separating account existence from cryptographic ownership was enforced, Code360 editor UI fields were precisely documented from production client code, bidirectional token extraction was validated, and live external API checks confirmed expected behavior across populated, unpopulated, and non-existent profiles.

**Final Verdict:** **APPROVED**

---

## 1. Account-Resolution vs. Ownership-Verification Semantics

### Investigation and Tracing
The crawler function `fetchCode360()` in `Backend/src/Routes/portals/portals.ts` and all consumers of the returned `PortalProfileData.verified` property were traced.

- **Previous State:** `fetchCode360()` returned `verified: true` upon successfully locating a public profile page or API payload, mirroring legacy crawler stubs.
- **Consumer Analysis:**
  - `user_links` database queries in `/api/portals/link` and `/api/portals/links` insert platform connections with `verified = false` and `ownership_status = 'CONNECTED_UNVERIFIED'`.
  - However, returning `verified: true` in `PortalProfileData` was semantically ambiguous and introduced latent risk that client-side components, caching layers, or downstream consumers could conflate public profile resolution with verified account ownership.

### Smallest Safe Correction Applied
In `Backend/src/Routes/portals/portals.ts`, `fetchCode360()` was corrected to strictly return:
```typescript
return {
    success: true,
    portal: "code360",
    username: clean,
    name,
    avatar,
    stats,
    profileUrl,
    verified: false, // Invariant: Public profile crawling strictly yields verified: false
};
```

### Invariant Established
- **`success: true`** denotes that the public profile was resolved and public statistics were retrieved.
- **`verified: false`** guarantees that public resolution cannot mark an Orbix account as ownership-verified, grant a verified badge, or bypass the cryptographic challenge flow.
- Ownership verification is granted **exclusively** through the cryptographic challenge lifecycle via `PlatformVerificationService.confirmVerification()`.

### Cross-Platform Audit
Other platform fetchers were inspected. `fetchKaggle()` already strictly enforces `verified: false`. All Tier-1 challenge-verified adapters (`leetcode`, `codeforces`, `hackerrank`, `hackerearth`, `interviewbit`, `medium`, `substack`, `topcoder`, `code360`) adhere to this strict separation.

---

## 2. Exact Code360 Field Labels and Public API Response Fields

### UI Label Inspection (Production Angular Bundle)
Inspection of Code360's production client application (`chunk_6917.js`) identified the exact structure and labels in the Profile Editor (`https://www.naukri.com/code360/profile/edit`):

| Tab Name | UI Control | Exact Label | Form Control Name | Placeholder | Length / Constraints |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Personal info** | `<input type="text">` | **`Name*`** | `name` | `"Enter here..."` | Required, Single-line |
| **Additional info** | `<textarea>` | **`About you`** | `about` | `"Write here..."` | 3 rows, 550 characters max |

On the public profile page (`https://www.naukri.com/code360/profile/{uuid}`):
- The user's name is rendered as the primary header title.
- The `About you` text is rendered under the section heading **`About`**.

### Target Field Assessment & UX Decision
1. **Impact of Modifying `Name*`:** Code360 profiles are shared with Naukri recruiter searches and contest leaderboards. Temporarily overwriting the user's display name alters their real name across the Naukri ecosystem, causing high user disruption.
2. **Impact of Modifying `About you`:** The `About you` textarea provides 550 characters of unstructured bio space. It is designed for personal descriptions, easily accommodates the 32-character challenge token, and causes zero disruption to the user's public identity.
3. **Architectural Choice:**
   - **Default Target Field:** Set to **`about`** (labeled in UI as **`About you (Bio)`**).
   - **Supported Target Fields:** `['about', 'name']`.
   - **Bidirectional Fallback Extraction:** The adapter inspects the user-selected target field first. If no challenge candidate is found, it automatically checks the other supported field. A user who pastes their token into either `About you` or `Name*` will verify successfully without manual reconfiguration.

### Public API Response Schema
Both fields are exposed publicly without authentication at:
`GET https://www.naukri.com/code360/api/v3/public_section/profile/user_details?uuid={cleanHandle}`

Representative sanitized response structure:
```json
{
  "status": 200,
  "data": {
    "uuid": "sarthaksangwan",
    "name": "Sarthak Sangwan",
    "about": "Full stack engineer and open source contributor.",
    "image": "https://files.codingninjas.in/avatar-example.png",
    "profile": {
      "summary": "Full stack engineer and open source contributor."
    },
    "user_exp": 13870,
    "user_level_name": "Expert",
    "followers_count": 1,
    "dsa_domain_data": {
      "problem_count_data": {
        "total_count": 69
      }
    }
  }
}
```
*Note: `about` is extracted primarily from `data.about`, with fallback to `data.profile.summary` if present.*

---

## 3. End-to-End Challenge Lifecycle Findings

The complete request path from challenge initiation through database state transition was verified:

1. **Authenticated Binding:** Challenge initiation via `POST /api/verify/initiate` binds the challenge to `req.user.id` and the sanitized `handle`. Cross-user initiation is strictly prohibited.
2. **CSPRNG Generation & Safe Display:**
   - A 128-bit cryptographically secure token (`orbix-v-{32_hex_chars}`) is generated via `crypto.randomBytes(16)`.
   - The plaintext token is delivered once to the client in the API response.
   - Only the SHA-256 hash (`crypto.createHash('sha256').update(plaintextToken).digest('hex')`) is stored in PostgreSQL `platform_verifications`.
   - Only a safe 12-character prefix (`orbix-v-xxxx...`) is recorded in plain text for debugging/UI display.
3. **Rate Limiting:**
   - Initiation: Fixed-window limit of 10 attempts per 15 minutes per user/platform.
   - Confirmation: Limit of 20 attempts per 15 minutes per user/platform.
   - Atomic Redis expiry prevents lockouts and isolates distinct users.
4. **Candidate Extraction & Timing-Safe Matching:**
   - `Code360Adapter.extractCandidates()` regex-extracts candidate tokens from `targetFieldsContent.about` and `targetFieldsContent.name`.
   - Candidate hashes are compared against the database `token_hash` using `crypto.timingSafeEqual` (constant-time evaluation prevents timing attacks).
5. **Atomic Single-Use State Transition:**
   - `confirmVerification()` executes within an atomic database transaction using `SELECT ... FOR UPDATE`.
   - Verification status transitions from `'pending'` to `'verified'` with `verified_at = NOW()`.
   - The associated `user_links` record is updated to `verified = true`, `ownership_status = 'OWNERSHIP_VERIFIED'`.
   - Replay is impossible: consumed, expired (`expires_at < NOW()`), or cancelled tokens immediately return error.
6. **Fail-Closed Guarantees:**
   - Profile found without token: Verification fails (0 candidates extracted).
   - Rate limit (429) or Network Timeout (504): Normalized as operational errors; verification is NEVER granted.
   - Token belonging to User B present on profile: Verification for User A strictly fails (hash mismatch).

---

## 4. Tests Run: Mocked Test Suite vs. Live API Checks

### A. Mocked Unit & Regression Test Suite
Executed via Node.js native test runner (`tsx --test`):

| Test Suite | Tests Run | Pass | Fail | Key Assertions Covered |
| :--- | :---: | :---: | :---: | :--- |
| `code360Verification.test.ts` | 14 | 14 | 0 | Metadata compliance, default `about`, `name` instructions, empty handle rejection, token in `about` success, token in `name` fallback success, token absent failure, wrong token failure, cross-user token isolation, profile URL parsing, 404/429/network error handling, and `fetchCode360` invariant (`verified: false`). |
| `platformVerificationService.test.ts` | 40 | 40 | 0 | End-to-end challenge lifecycle, CSPRNG token security, timing-safe evaluation, rate limiting, and consumer protection. |
| `Frontend ownershipVerification.test.ts` | 71 | 71 | 0 | UI platform registry support, default field `"about"`, target name `"About you (Bio)"`, modal instructions, and sync-decoupling invariants. |
| **Total Automated Tests** | **125** | **125** | **0** | **100% Pass Rate** |

### B. Live Public API Checks (Safe, Unauthenticated External Requests)
Executed against `https://www.naukri.com/code360/api/v3/public_section/profile/user_details`:

1. **Existing Account with Bio (`sarthaksangwan`):**
   - **HTTP Status:** 200 OK
   - **Returned Fields:** `name: "Sarthak Sangwan"`, `uuid: "sarthaksangwan"`, `about: "<populated bio>"`, `solved: 69`.
   - **Outcome:** Successfully resolved profile, name, and bio fields.
2. **Existing Account with Empty Bio (`Maximus`):**
   - **HTTP Status:** 200 OK
   - **Returned Fields:** `name: "Maximus"`, `uuid: "Maximus"`, `about: null`.
   - **Outcome:** Validates that users with empty bios return `about: null` gracefully without breaking schema parsing; fallback to `name` or populating `about` operates correctly.
3. **Non-Existent Account (`non_existent_code360_user_9999`):**
   - **HTTP Status:** 404 Not Found
   - **Response Body:** `{"status": 404, "error": {"code": 404, "message": "Not found"}}`
   - **Outcome:** Adapter correctly normalizes 404 as `errorCode: 'NOT_FOUND'` with user-friendly error message.

---

## 5. Defects Found and Exact Files Changed

### Defects Found & Remediated
1. **Defect:** `fetchCode360()` previously returned `verified: true` upon crawling success.  
   **Correction:** Changed to strictly return `verified: false`.
2. **Defect:** Initial prototype instructed users to overwrite `Name*`, causing potential disruption to real-world Naukri recruiter visibility.  
   **Correction:** Promoted `About you` (Bio) to primary default target field while maintaining bidirectional fallback to `Name*`.
3. **Defect:** Modal instructions lacked Code360-specific guidance.  
   **Correction:** Added dedicated step-by-step guidance in `OwnershipVerificationModal.tsx` directing users to `Additional info` -> `About you` (or `Name*` under `Personal info`).

### Exact Files Changed
- `Backend/src/Routes/portals/portals.ts`: Corrected `fetchCode360()` to enforce `verified: false`.
- `Backend/src/services/verification/adapters/code360Adapter.ts`: Full adapter implementation with `about` default, bidirectional candidate extraction, and dual instructions.
- `Backend/src/services/verification/adapters/adapterRegistry.ts`: Registered `code360` adapter instance.
- `Backend/src/types/verification.ts`: Added `'code360'` to verification platform types.
- `Backend/src/services/verification/code360Verification.test.ts`: Complete unit and regression test suite.
- `Frontend/src/utils/platformVerificationSupport.ts`: Added `code360` to supported platforms, default field `about`, target label `About you (Bio)`, and edit URL.
- `Frontend/src/components/verification/OwnershipVerificationModal.tsx`: Added Code360 modal instructions.
- `Frontend/src/components/verification/ownershipVerification.test.ts`: Added frontend registry and modal assertions.

---

## 6. Kaggle Exclusion Confirmation

**Confirmation:**  
Kaggle was **strictly excluded** from this audit and implementation.
- No Kaggle verification adapters or contracts were modified.
- No Kaggle tests were altered.
- All existing Kaggle regression boundaries and invariants remain untouched.

---

## 7. Final Verdict

# **APPROVED**

The Naukri Code360 ownership verification integration satisfies all security, cryptographic, architectural, and user-experience criteria. Account-existence resolution is strictly decoupled from cryptographic ownership verification, token matching is robust and timing-safe, the UX defaults to the non-disruptive `About you` field with automatic fallback to `Name*`, and all automated and live checks pass cleanly.
