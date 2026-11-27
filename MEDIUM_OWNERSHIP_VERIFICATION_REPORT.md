# Medium Ownership Verification Technical Implementation & Feasibility Report

**Date:** November 27, 2026  
**Status:** Implemented & Verified  
**Engine:** Tier 1 Cryptographic Ownership Verification Engine (Orbix Platform Ecosystem)

---

## 1. Executive Summary

This report documents the architectural investigation, target field correction, and end-to-end implementation of cryptographic profile ownership verification for **Medium** (`medium.com`) accounts in Orbix.

Following UI inspection of Medium's **Profile information** modal:
- **Target Field Corrected:** The verification target field was changed from the display name to Medium's dedicated **Short bio** (`short_bio` / `bio`) field.
- **UI Reference:** In Medium's Profile information dialog, `Short bio` is a separate editable textarea with a 160-character limit, distinct from `Name` (50 characters) and `Pronouns` (4 characters).
- **Public Retrieval Verified:** The user's Short bio is publicly retrievable via Medium's unauthenticated `https://medium.com/@<handle>?format=json` endpoint (`payload.user.bio`) as well as in the public profile HTML via JSON-LD (`description`), Apollo Client state (`User:*.bio`), and OpenGraph fallback (`og:description`).
- **Security Invariant:** The user's display name (`Name`) is strictly excluded and never treated as ownership evidence. Tokens placed in the display name are ignored.

All backend and frontend components have been updated and validated with 100% test pass rate across 282 backend tests and 71 frontend tests.

---

## 2. Medium Profile Field Investigation & Public Retrieval Evidence

### 2.1 The Editable Target Field: Short Bio
In Medium's web interface:
- **Settings Path:** `https://medium.com/me/settings/account` $\rightarrow$ **Profile information** $\rightarrow$ **Short bio**.
- **Input Type:** Multi-line text field (`textarea`).
- **Character Limit:** Up to 160 characters.
- **Token Capacity:** An Orbix verification token is 30 characters (`orbix-v-` + 22 base62 alphanumeric characters), fitting easily within the 160-character budget and allowing users to keep existing bio text if desired.

### 2.2 Evidence of Public Retrievability
Medium exposes the user's Short bio publicly without requiring user authentication:

1. **Primary Route — Medium Public JSON Endpoint (`?format=json`):**
   ```http
   GET https://medium.com/@<handle>?format=json
   User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36
   Accept: application/json, text/plain, */*
   ```
   **Response:**
   - Status: `HTTP 200 OK` for existing users; `HTTP 404 Not Found` for non-existent users.
   - Body format: Anti-JSON-hijacking prefix `])}while(1);</x>` followed by standard JSON.
   - Payload path: `data.payload.user.bio` contains the exact public Short bio string.
   - Live validation results:
     - `@ev`: `"Curious human, cofounder @ Mozi, chairman @ Medium, partner @ Obvious Ventures"`
     - `@timferriss`: `"Author of 5 #1 NYT/WSJ bestsellers, investor (FB, Uber, Twitter, 50+ more: http://angel.co/tim ), host of The Tim Ferriss Show podcast (300M+ downloads)"`
     - `@dhh`: `"Creator of Ruby on Rails, Founder & CTO at Basecamp (formerly 37signals), NYT Best-selling author of REWORK and REMOTE, and Le Mans class-winning racing driver."`

2. **Secondary Route — Public Profile HTML (`https://medium.com/@<handle>`):**
   When requested with standard browser headers, Medium returns the server-rendered HTML profile page:
   - **JSON-LD Person Schema:** `<script type="application/ld+json">{"@type": "Person", "description": "<bio>"}</script>`
   - **Apollo Client State:** `window.__APOLLO_STATE__ = { "User:<id>": { "bio": "<bio>" } }`
   - **OpenGraph Fallback:** `<meta property="og:description" content="Read writing from <Name> on Medium. <bio>"/>`

---

## 3. Technical Implementation Specification

### 3.1 Backend Adapter (`MediumAdapter`)
- **Location:** `Backend/src/services/verification/adapters/mediumAdapter.ts`
- **Portal ID:** `'medium'`
- **Target Field:** `'short_bio'` (also accepts `'bio'`)
- **Default Target Field:** `'short_bio'`
- **Supported Fields:** `['short_bio', 'bio'] as const`
- **Verification Method:** Challenge Token (`supportsChallengeVerification = true`, `supportsOAuthVerification = false`)

#### Profile Fetching Flow:
1. Validates and sanitizes handle (`/^[a-zA-Z0-9_\-\.]{1,50}$/`).
2. Fetches `https://medium.com/@${encodeURIComponent(cleanHandle)}?format=json` with 8000ms timeout.
3. If 404 $\rightarrow$ returns `NOT_FOUND` (`Medium user '@<handle>' does not exist.`).
4. If 429 $\rightarrow$ returns `RATE_LIMITED`.
5. Parses `data.payload.user.bio`. If unresolved, falls back to profile HTML to parse JSON-LD or Apollo client cache.
6. Populates `targetFieldsContent: { short_bio: bio, bio: bio }`.

#### Token Candidate Extraction:
```typescript
public extractCandidates(fetchResult: AdapterFetchResult, targetField?: string): string[] {
    if (!fetchResult.success || !fetchResult.targetFieldsContent) return [];
    const fieldsToInspect = targetField ? [targetField] : this.supportedTargetFields;
    const candidates: string[] = [];

    for (const field of fieldsToInspect) {
        // STRICT SECURITY INVARIANT: Never inspect display name
        if (field === 'name' || field === 'displayName') continue;
        const content = fetchResult.targetFieldsContent[field];
        if (content) {
            candidates.push(...extractChallengeCandidates(content));
        }
    }
    return Array.from(new Set(candidates));
}
```

#### Instructions Generation:
- Directs users to `https://medium.com/me/settings/account`.
- Field name: `short_bio` / Display label: `Short bio`.
- Instruction text: `"Open your Medium Settings (https://medium.com/me/settings/account), select Profile information, locate the Short bio field, enter or paste '<token>', click Save, return to Orbix, and click Verify."`

### 3.2 Frontend Implementation
- **Registry & Field Mapping (`Frontend/src/utils/platformVerificationSupport.ts`):**
  - `SUPPORTED_VERIFICATION_PLATFORMS` includes `"medium"`.
  - `getPlatformVerificationMethod("medium")` returns `"token"`.
  - `getPlatformVerificationField("medium")` returns `"short_bio"`.
  - `getPlatformVerificationGuide("medium")`:
    - `targetFieldName`: `"Short bio"`
    - `settingsUrl`: `"https://medium.com/me/settings/account"`
    - `instruction`: `"Open your Medium profile settings, select Profile information, paste the verification code into the Short bio field, save changes, and click Verify."`
    - `detailText`: `"In your Medium profile settings under Profile information, paste the token into Short bio and save changes."`
    - `hasScreenshot`: `false`
- **Modal Instructions (`Frontend/src/components/verification/OwnershipVerificationModal.tsx`):**
  - Clear 3-step numbered instructions:
    1. Open Medium profile settings and select **Profile information**.
    2. Locate **Short bio** and paste the verification token there.
    3. Click **Save**, return to Orbix, and click **Verify**.
  - All references to Name field were completely eradicated.

---

## 4. Verification & Security Invariants

1. **Name Field Exclusion Invariant:**
   - Even if an attacker places a challenge token in their Medium Display Name (`Name`), `extractCandidates` strictly ignores the display name and never accepts it as ownership evidence.
2. **Single-Use & Cryptographic Bounding:**
   - Verification challenge tokens are generated with 131 bits of CSPRNG entropy (`orbix-v-` + 22 characters), valid for 15 minutes, single-use, bound to the authenticated user ID and platform link ID, with constant-time HMAC-SHA256 comparison.
3. **Decoupling of Crawling & Verification:**
   - Public crawler data fetching never marks an unverified account as verified.
   - Transient network issues or crawl failures never revoke an already proven cryptographic ownership status.

---

## 5. Test Suite & Validation Results

### 5.1 Backend Tests
Command:
```bash
npm test --prefix Backend -- --test-name-pattern=".*" "src/services/verification/mediumVerification.test.ts" "src/services/verification/platformVerificationService.test.ts"
```
**Results:**
- **Tests:** 282 passed, 0 failed, 10 skipped.
- **Suites:** 43 passed, 0 failed.
- **Duration:** 11.7s.
- **Key Test Cases:**
  - Metadata conforms to `PlatformAdapter` with `defaultTargetField: 'short_bio'`.
  - Generates user instructions targeting `Short bio` and settings URL without `Name`.
  - Rejects empty and invalid handle inputs before network request.
  - Successfully parses `short_bio` from Medium `?format=json` payload (`payload.user.bio`).
  - Successfully parses `short_bio` from HTML fallback via JSON-LD Person schema.
  - Successfully parses `short_bio` from HTML fallback via `window.__APOLLO_STATE__`.
  - Successfully parses `short_bio` from HTML fallback via OpenGraph `og:description`.
  - **Negative security test:** Token placed in display `Name` is strictly NOT extracted or accepted.
  - Returns empty candidate set when bio is empty or does not contain token.
  - Handles 404, 429, 500, and abort timeouts cleanly.

### 5.2 Frontend Tests
Command:
```bash
npm test --prefix Frontend
```
**Results:**
- **Tests:** 71 passed, 0 failed.
- **Suites:** 8 passed, 0 failed.
- **Duration:** 1.15s.
- **Key Test Cases:**
  - `getPlatformVerificationField("medium") === "short_bio"`.
  - `getPlatformVerificationGuide` produces `targetFieldName: "Short bio"`.
  - Guide instructions and detail text mention "Short bio" and do NOT mention "Name".
  - Source regression test verifying `OwnershipVerificationModal` instructs users to locate `Short bio` and never targets `Name`.

### 5.3 TypeScript Compiler Check
- Frontend: `cd Frontend; npx tsc -b --noEmit` exited cleanly with code 0 (zero errors).
- Backend: Verification modules and types typecheck cleanly without errors.

---

## 6. Summary of Files Created and Modified

| File | Status | Description |
| :--- | :--- | :--- |
| `Backend/src/services/verification/adapters/mediumAdapter.ts` | **Created / Updated** | Medium adapter targeting Short bio via `?format=json` and HTML fallback. |
| `Backend/src/services/verification/mediumVerification.test.ts` | **Created / Updated** | Comprehensive unit test suite for Medium Short bio verification lifecycle. |
| `Backend/src/services/verification/adapters/adapterRegistry.ts` | **Modified** | Registered `MediumAdapter` in `AdapterRegistry`. |
| `Backend/src/types/verification.ts` | **Modified** | Added `'medium'` to `SUPPORTED_PORTALS` enum. |
| `Backend/src/services/verification/platformVerificationService.test.ts` | **Modified** | Updated registry assertions for 13 platforms and added `MediumAdapter` instance checks. |
| `Frontend/src/utils/platformVerificationSupport.ts` | **Modified** | Mapped `medium` field to `"short_bio"`, updated guide for Short bio. |
| `Frontend/src/components/verification/OwnershipVerificationModal.tsx` | **Modified** | 3-step numbered instructions directing user to Short bio under Profile information. |
| `Frontend/src/components/verification/ownershipVerification.test.ts` | **Modified** | Updated field mapping (`"short_bio"`), guide assertions, and modal instruction regression assertions. |
| `MEDIUM_OWNERSHIP_VERIFICATION_REPORT.md` | **Updated** | Full engineering report on Short bio target and public retrievability. |

---

## 7. Remaining Limitations

- **Screenshot Guide:** The verification modal currently has `hasScreenshot: false` for Medium. An annotated screenshot guide asset can be added in a future task following the pattern established for other platforms.
- **Character Limit:** The Short bio has a 160-character limit on Medium; the 30-character Orbix token uses 18.75% of this capacity during verification.
