# ORBIX — Google OAuth Configuration Forensic Audit
**Document ID:** `ORBIX-AUDIT-AUTH-2026-001`  
**Classification:** Production Engineering & Security Audit  
**Target Domain:** `https://theorbix.world` / `https://www.theorbix.world`  
**Investigation Mode:** Strict Read-Only Codebase & Configuration Forensic Analysis  

---

## 1. Executive Summary

This forensic audit investigates the production Google OAuth failure on Orbix:
```text
Error 400: redirect_uri_mismatch
Access blocked: This app's request is invalid.
```

### Key Audit Conclusions

1. **Authentication Architecture:** Orbix does **not** use Supabase Auth for Google authentication. Google OAuth is executed entirely through a **custom Express.js backend implementation** located in [`Backend/src/services/auth/oauthService.ts`](file:///Users/vineetchandel/Developer/SAAS/Orbix/Backend/src/services/auth/oauthService.ts) and [`Backend/src/Routes/auth/oauthRoutes.ts`](file:///Users/vineetchandel/Developer/SAAS/Orbix/Backend/src/Routes/auth/oauthRoutes.ts). Supabase is utilized strictly as a managed PostgreSQL relational database via direct connection pooling (`SUPABASE_DB_URL`).
2. **Redirect URI Authority:** The `redirect_uri` sent to Google is dynamically generated on the backend inside `OAuthService.getGoogleAuthUrl()` ([Line 170](file:///Users/vineetchandel/Developer/SAAS/Orbix/Backend/src/services/auth/oauthService.ts#L170)):
   $$\text{redirect\_uri} = \text{GOOGLE\_CALLBACK\_URL} \parallel (\text{BACKEND\_URL} + \text{"/api/auth/google/callback"})$$
3. **Confirmed Cause of `redirect_uri_mismatch`:**
   Google Cloud requires an **exact, byte-for-byte character match** between the `redirect_uri` query parameter transmitted in the authorization request and the URIs listed in the Google Cloud Console OAuth 2.0 Client credentials. A mismatch occurs because:
   * The backend defaults to `http://localhost:3000/api/auth/google/callback` if `GOOGLE_CALLBACK_URL` and `BACKEND_URL` are missing or default in the production server environment.
   * If `BACKEND_URL` is set to `https://api.theorbix.world`, the generated callback is `https://api.theorbix.world/api/auth/google/callback`. If Google Cloud Console is configured with the apex domain (`https://theorbix.world/api/auth/google/callback`) or root URL (`https://theorbix.world`), Google halts with `redirect_uri_mismatch`.
   * If Google OAuth was configured in the Supabase Dashboard using Supabase's callback URL (`https://<project-ref>.supabase.co/auth/v1/callback`), Google rejects the Orbix backend's request because Orbix bypasses Supabase Auth entirely.

---

## 2. Actual Authentication Architecture

### 2.1 Technology Stack & Provider Role Classification

| Component | Responsibility in Google OAuth | Relevant Implementation File |
| :--- | :--- | :--- |
| **Frontend UI (React + Vite)** | Renders social sign-in button. Initiates full-page redirect to backend `/api/auth/google`. Handles final app landing on `/auth/callback`. | [`Frontend/src/LandingPages/Auth-Pages/AuthLayout.tsx`](file:///Users/vineetchandel/Developer/SAAS/Orbix/Frontend/src/LandingPages/Auth-Pages/AuthLayout.tsx#L30) |
| **Backend API (Express + TypeScript)** | Generates CSRF state, computes `redirect_uri`, redirects browser to Google. Receives Google callback, exchanges authorization code, verifies identity, sets JWT cookies, and redirects to frontend. | [`Backend/src/services/auth/oauthService.ts`](file:///Users/vineetchandel/Developer/SAAS/Orbix/Backend/src/services/auth/oauthService.ts#L164), [`Backend/src/Routes/auth/oauthRoutes.ts`](file:///Users/vineetchandel/Developer/SAAS/Orbix/Backend/src/Routes/auth/oauthRoutes.ts#L42) |
| **Supabase** | **None for OAuth.** Used strictly as PostgreSQL database via `node-postgres` (`pg.Pool`). | [`Backend/src/database/client.ts`](file:///Users/vineetchandel/Developer/SAAS/Orbix/Backend/src/database/client.ts#L21) |
| **Firebase** | **None for Google OAuth.** Used exclusively for SMS phone number OTP verification (`phoneAuthService.ts`). | [`Frontend/src/services/phoneAuthService.ts`](file:///Users/vineetchandel/Developer/SAAS/Orbix/Frontend/src/services/phoneAuthService.ts) |
| **Passport.js / Supabase Auth SDK** | **Not installed / Not used.** The codebase uses zero third-party OAuth wrapper frameworks. All requests use raw Node `fetch()` against Google endpoints. | [`Backend/package.json`](file:///Users/vineetchandel/Developer/SAAS/Orbix/Backend/package.json) |

### 2.2 Frontend Route Handling

The frontend router in [`Frontend/src/App.tsx`](file:///Users/vineetchandel/Developer/SAAS/Orbix/Frontend/src/App.tsx#L164) defines the landing route:
```tsx
<Route path="/auth/callback" element={<OAuthCallbackPage />} />
```
This route is **not** an OAuth callback for Google's servers. It is an internal application landing page that receives tokens from the **Orbix backend** after the backend completes the Google exchange.

---

## 3. Complete OAuth Flow Trace

```text
User Browser              Orbix Frontend               Orbix Backend                 Google OAuth 2.0
     |                          |                            |                              |
     |---- 1. Click "Google" -->|                            |                              |
     |                          |-- 2. GET /api/auth/google->|                              |
     |                          |      (?returnTo=/dashboard)|                              |
     |                          |                            |-- 3. Generate CSRF state --->|
     |                          |                            |      (Stored in Redis+Cookie)|
     |                          |                            |-- 4. 302 Redirect to Google->|
     |<------------------------- 5. Browser navigates to Google Consent --------------------|
     |                                                       |                              |
     |-------------------------- 6. User authenticates & approves scopes ------------------>|
     |                                                       |                              |
     |<------------------------- 7. 302 Redirect to backend redirect_uri -------------------|
     |                              (?code=AUTH_CODE&state=CSRF_STATE)                      |
     |                                                       |                              |
     |-------------------------- 8. GET /api/auth/google/callback ------------------------->|
     |                              (Carrying code, state & cookie)                         |
     |                                                       |                              |
     |                                                       |-- 9. Validate CSRF State     |
     |                                                       |-- 10. POST /oauth2/v2/token->|
     |                                                       |<-- 11. Return Access Token --|
     |                                                       |-- 12. GET /userinfo -------->|
     |                                                       |<-- 13. Return Google Profile-|
     |                                                       |-- 14. Upsert User in Postgres|
     |                                                       |-- 15. Issue Orbix JWTs       |
     |                                                       |-- 16. Set HTTPOnly Cookies   |
     |                                                       |-- 17. 302 Redirect to App -->|
     |<------------------------- 18. Navigates to /auth/callback?token=JWT -----------------|
     |                          |                            |                              |
     |-- 19. Load /auth/callback|                            |                              |
     |       Stores localStorage|                            |                              |
     |       Redirects to       |                            |                              |
     |       /dashboard ------->|                            |                              |
```

### Detailed Execution Steps

#### Step 1: User Action on Frontend
* **File:** [`Frontend/src/LandingPages/Auth-Pages/AuthLayout.tsx`](file:///Users/vineetchandel/Developer/SAAS/Orbix/Frontend/src/LandingPages/Auth-Pages/AuthLayout.tsx#L30-L40)
* **Function:** `handleGoogleAuth()`
* **Mechanism:**
  ```typescript
  const handleGoogleAuth = () => {
      const searchParams = new URLSearchParams(window.location.search);
      const returnTo = searchParams.get("returnTo") || "/dashboard";
      let deviceId = "";
      try {
          deviceId = getOrCreateDeviceId();
      } catch {}
      const query = new URLSearchParams({ returnTo });
      if (deviceId) query.set("deviceId", deviceId);
      window.location.href = `/api/auth/google?${query.toString()}`;
  };
  ```
  The browser is commanded via `window.location.href` to navigate to `/api/auth/google`. In production on `https://theorbix.world`, this hits `https://theorbix.world/api/auth/google`.

#### Step 2: Backend Route Dispatch
* **File:** [`Backend/src/Routes/auth/oauthRoutes.ts`](file:///Users/vineetchandel/Developer/SAAS/Orbix/Backend/src/Routes/auth/oauthRoutes.ts#L11-L36)
* **Route:** `GET /api/auth/google` (registered on `apiRouter` in [`Backend/src/index.ts#L112`](file:///Users/vineetchandel/Developer/SAAS/Orbix/Backend/src/index.ts#L112))
* **Execution:** Calls `OAuthService.generateState(res, "google", returnTo, deviceId)` and `OAuthService.getGoogleAuthUrl(state)`.

#### Step 3: CSRF Token & State Creation
* **File:** [`Backend/src/services/auth/oauthService.ts`](file:///Users/vineetchandel/Developer/SAAS/Orbix/Backend/src/services/auth/oauthService.ts#L66-L102)
* **Function:** `OAuthService.generateState()`
* **Security Mechanics:**
  * Generates 32 cryptographically secure random bytes: `crypto.randomBytes(32).toString("hex")`.
  * Serializes payload: `{ state, provider: "google", returnTo, deviceId, createdAt }`.
  * Persists in Redis with 10-minute TTL (`oauth:state:<state>`).
  * Emits fallback HTTPOnly cookie `orbix_oauth_state` with `sameSite: "lax"`, `path: "/"`, `secure: isProduction`.

#### Step 4: Google Authorization URL Generation & Browser Redirection
* **File:** [`Backend/src/services/auth/oauthService.ts`](file:///Users/vineetchandel/Developer/SAAS/Orbix/Backend/src/services/auth/oauthService.ts#L164-L185)
* **Function:** `OAuthService.getGoogleAuthUrl(state)`
* **Code:**
  ```typescript
  const callbackUrl =
      process.env.GOOGLE_CALLBACK_URL ||
      `${this.getBackendUrl()}/api/auth/google/callback`;

  const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl,
      response_type: "code",
      scope: "openid email profile",
      access_type: "offline",
      prompt: "select_account",
      state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  ```
  The backend sends a `302 Found` redirecting the browser directly to Google.

#### Step 5: Google Authentication
* User selects Google account and grants consent.
* Google validates `client_id` and checks whether the `redirect_uri` param strictly matches an authorized redirect URI registered in Google Cloud Console.
* **If mismatch:** Google stops here with `Error 400: redirect_uri_mismatch`.
* **If match:** Google redirects browser to `redirect_uri?code=...&state=...`.

#### Step 6: Callback Processing & Security Validation
* **File:** [`Backend/src/Routes/auth/oauthRoutes.ts`](file:///Users/vineetchandel/Developer/SAAS/Orbix/Backend/src/Routes/auth/oauthRoutes.ts#L42-L100)
* **Route:** `GET /api/auth/google/callback`
* **Execution:**
  1. Validates presence of `code` and `state`.
  2. Calls `OAuthService.validateState(req, res, incomingState, "google")`: matches against Redis and clears state cookie.

#### Step 7: Authorization Code Exchange
* **File:** [`Backend/src/services/auth/oauthService.ts`](file:///Users/vineetchandel/Developer/SAAS/Orbix/Backend/src/services/auth/oauthService.ts#L213-L241)
* **Function:** `OAuthService.exchangeGoogleCode(code)`
* **Code:**
  ```typescript
  const callbackUrl =
      process.env.GOOGLE_CALLBACK_URL ||
      `${this.getBackendUrl()}/api/auth/google/callback`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: callbackUrl,
          grant_type: "authorization_code",
      }),
  });
  ```
  Note that RFC 6749 Section 4.1.3 mandates that `redirect_uri` in the code exchange request must match the `redirect_uri` in the initial authorization request.

#### Step 8: Profile Ingestion & User Linking
* **File:** [`Backend/src/services/auth/oauthService.ts`](file:///Users/vineetchandel/Developer/SAAS/Orbix/Backend/src/services/auth/oauthService.ts#L244-L440)
* Fetches profile from `https://www.googleapis.com/oauth2/v3/userinfo`.
* Maps user via `findOrCreateOAuthUser()`: queries `users` table by `gmail` or `google_id`. If user exists, links `google_id` (`Migration 024`). If new, inserts user record with `auth_provider = 'google'`.

#### Step 9: Session Finalization & Cookie Issuance
* **File:** [`Backend/src/services/auth/oauthService.ts`](file:///Users/vineetchandel/Developer/SAAS/Orbix/Backend/src/services/auth/oauthService.ts#L638-L713)
* **Function:** `finalizeOAuthSession()`
* Creates session in database (`createSession()`).
* Issues Access JWT (`8h`) and Refresh JWT (`7d`).
* Emits HTTPOnly cookies: `token` and `refreshToken` with `path: "/"`, `sameSite: "lax"`, `secure: isProduction`.

#### Step 10: Final Frontend Redirection
* **File:** [`Backend/src/Routes/auth/oauthRoutes.ts`](file:///Users/vineetchandel/Developer/SAAS/Orbix/Backend/src/Routes/auth/oauthRoutes.ts#L85-L91)
* **Redirect Destination:**
  ```typescript
  const frontendUrl = OAuthService.getFrontendUrl(); // process.env.FRONTEND_URL || "http://localhost:5173"
  return res.redirect(
      `${frontendUrl}/auth/callback?token=${encodeURIComponent(token)}&status=success&provider=google&isNew=${isNewUser ? "1" : "0"}&returnTo=${encodeURIComponent(targetDestination)}`
  );
  ```

#### Step 11: Frontend Storage & Dashboard Transition
* **File:** [`Frontend/src/LandingPages/Auth-Pages/OAuthCallbackPage.tsx`](file:///Users/vineetchandel/Developer/SAAS/Orbix/Frontend/src/LandingPages/Auth-Pages/OAuthCallbackPage.tsx#L33-L60)
* Extracts `token` from URL parameters.
* Stores `token` into `localStorage.setItem("orbix_token", token)`.
* Dispatches `fetchUserProfile({ force: true })` Redux action.
* Navigates to `returnTo` (default: `/dashboard`).

---

## 4. Exact Redirect URI Analysis

### 4.1 URL Construction Formula

In [`Backend/src/services/auth/oauthService.ts#L170-L172`](file:///Users/vineetchandel/Developer/SAAS/Orbix/Backend/src/services/auth/oauthService.ts#L170-L172):
```typescript
const callbackUrl =
    process.env.GOOGLE_CALLBACK_URL ||
    `${this.getBackendUrl()}/api/auth/google/callback`;
```
Where `this.getBackendUrl()` is defined in [`Line 49-51`](file:///Users/vineetchandel/Developer/SAAS/Orbix/Backend/src/services/auth/oauthService.ts#L49-L51):
```typescript
public static getBackendUrl(): string {
    return process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3000}`;
}
```

### 4.2 Environmental Redirect URI Matrix

| Environment / Architecture | Actual Exact `redirect_uri` Sent to Google | Source Logic | Precedence Condition |
| :--- | :--- | :--- | :--- |
| **Development** | `http://localhost:3000/api/auth/google/callback` | [`oauthService.ts:171`](file:///Users/vineetchandel/Developer/SAAS/Orbix/Backend/src/services/auth/oauthService.ts#L171) | When `GOOGLE_CALLBACK_URL` is set in dev `.env` OR derived from `BACKEND_URL=http://localhost:3000` |
| **Production (Explicit Env)** | Value of `GOOGLE_CALLBACK_URL` in production `.env` | [`oauthService.ts:171`](file:///Users/vineetchandel/Developer/SAAS/Orbix/Backend/src/services/auth/oauthService.ts#L171) | Active whenever `process.env.GOOGLE_CALLBACK_URL` is non-empty |
| **Production (Subdomain API)** | `https://api.theorbix.world/api/auth/google/callback` | [`oauthService.ts:172`](file:///Users/vineetchandel/Developer/SAAS/Orbix/Backend/src/services/auth/oauthService.ts#L172) | When `GOOGLE_CALLBACK_URL` is unset and `BACKEND_URL=https://api.theorbix.world` |
| **Production (Same-Origin Reverse Proxy)** | `https://theorbix.world/api/auth/google/callback` | [`oauthService.ts:172`](file:///Users/vineetchandel/Developer/SAAS/Orbix/Backend/src/services/auth/oauthService.ts#L172) | When `GOOGLE_CALLBACK_URL` is unset and `BACKEND_URL=https://theorbix.world` |
| **Production (Unconfigured Fallback)** | `http://localhost:3000/api/auth/google/callback` | [`oauthService.ts:50`](file:///Users/vineetchandel/Developer/SAAS/Orbix/Backend/src/services/auth/oauthService.ts#L50) | When neither `GOOGLE_CALLBACK_URL` nor `BACKEND_URL` is present in production `.env` |

> [!CRITICAL]
> The backend does **not** dynamically extract the host from incoming request headers (`req.headers.host`, `x-forwarded-host`, or `req.protocol`). The `redirect_uri` is calculated strictly from process environment variables.

---

## 5. OAuth Environment Variables Audit

| Variable | Referenced In | Consuming Function | Availability Status in Repo |
| :--- | :--- | :--- | :--- |
| **`GOOGLE_CLIENT_ID`** | [`oauthService.ts:165,214`](file:///Users/vineetchandel/Developer/SAAS/Orbix/Backend/src/services/auth/oauthService.ts#L165) | `getGoogleAuthUrl()`, `exchangeGoogleCode()` | **Configured** in `.env` (Format: `*.apps.googleusercontent.com`) |
| **`GOOGLE_CLIENT_SECRET`** | [`oauthService.ts:215`](file:///Users/vineetchandel/Developer/SAAS/Orbix/Backend/src/services/auth/oauthService.ts#L215) | `exchangeGoogleCode()` | **Configured** in `.env` (Format: `GOCSPX-*`) |
| **`GOOGLE_CALLBACK_URL`** | [`oauthService.ts:171,217`](file:///Users/vineetchandel/Developer/SAAS/Orbix/Backend/src/services/auth/oauthService.ts#L171) | `getGoogleAuthUrl()`, `exchangeGoogleCode()` | **Configured in `.env.example`** (Defaulted to `http://localhost:3000/...`) |
| **`BACKEND_URL`** | [`oauthService.ts:50`](file:///Users/vineetchandel/Developer/SAAS/Orbix/Backend/src/services/auth/oauthService.ts#L50) | `getBackendUrl()` | **Configured in `.env.example`** (Defaulted to `http://localhost:3000`) |
| **`FRONTEND_URL`** | [`oauthService.ts:46`](file:///Users/vineetchandel/Developer/SAAS/Orbix/Backend/src/services/auth/oauthService.ts#L46), [`oauthRoutes.ts:43`](file:///Users/vineetchandel/Developer/SAAS/Orbix/Backend/src/Routes/auth/oauthRoutes.ts#L43) | `getFrontendUrl()`, post-auth redirect | **Configured in `.env.example`** (Defaulted to `http://localhost:5173`) |
| **`JWT_SECRET`** | [`oauthService.ts:652`](file:///Users/vineetchandel/Developer/SAAS/Orbix/Backend/src/services/auth/oauthService.ts#L652) | Session JWT signing | **Configured** in `.env` |

---

## 6. Supabase Configuration Analysis

### Is Supabase Auth Involved in Google Sign-In?
**No.** There is zero integration between Supabase Auth and Google OAuth in Orbix:
* Searching the entire frontend codebase for Supabase client initialization (`createClient`) returns zero matches.
* Searching the backend codebase reveals `@supabase/supabase-js` is not even listed in `dependencies` in [`Backend/package.json`](file:///Users/vineetchandel/Developer/SAAS/Orbix/Backend/package.json).
* The Supabase variables present in [`Backend/.env`](file:///Users/vineetchandel/Developer/SAAS/Orbix/Backend/.env):
  ```env
  SUPABASE_DB_URL=postgresql://postgres.bhixamqnpcbstfwvmmog:...@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres
  SUPABASE_URL=https://bhixamqnpcbstfwvmmog.supabase.co
  SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
  SUPABASE_SECRET_KEY=sb_secret_...
  SUPABASE_JWKS_URL=https://bhixamqnpcbstfwvmmog.supabase.co/auth/v1/.well-known/jwks.json
  ```
  are used exclusively by `Backend/src/database/config.ts` to connect to PostgreSQL via `pg.Pool`.

### Supabase URL Configuration Layer vs Google Cloud Layer
If you opened the Supabase Dashboard under *Authentication → URL Configuration* and saw:
* **Site URL:** `https://theorbix.world`
* **Callback URL:** `https://bhixamqnpcbstfwvmmog.supabase.co/auth/v1/callback`

This configuration **has no effect on Orbix's Google Sign-In**. If Google Cloud Console was given the Supabase callback URL (`https://bhixamqnpcbstfwvmmog.supabase.co/auth/v1/callback`), but the Orbix backend initiates the request with its own URL (`https://api.theorbix.world/api/auth/google/callback` or `https://theorbix.world/api/auth/google/callback`), Google will immediately abort with `redirect_uri_mismatch`.

---

## 7. Google Cloud Configuration Requirements

Google Cloud Console OAuth 2.0 Client settings require two specific fields:

### 1. Authorized JavaScript Origins
Google verifies this against the `Origin` header of requests initiating client-side authentication or web origins.
* `https://theorbix.world`
* `https://www.theorbix.world`

### 2. Authorized Redirect URIs
This must match the exact string sent in the `redirect_uri` parameter by `oauthService.ts`.
Depending on your production topology:
* If Backend is hosted on dedicated subdomain `api.theorbix.world`:
  `https://api.theorbix.world/api/auth/google/callback`
* If Backend is reverse-proxied behind `theorbix.world`:
  `https://theorbix.world/api/auth/google/callback`
* In Local Development:
  `http://localhost:3000/api/auth/google/callback`

---

## 8. Production Deployment & Network Topology Analysis

### 8.1 The Frontend-to-Backend Routing Problem
In [`Frontend/src/LandingPages/Auth-Pages/AuthLayout.tsx#L39`](file:///Users/vineetchandel/Developer/SAAS/Orbix/Frontend/src/LandingPages/Auth-Pages/AuthLayout.tsx#L39):
```typescript
window.location.href = `/api/auth/google?${query.toString()}`;
```
Because this uses a **relative path** (`/api/auth/google`):
* When a user clicks "Continue with Google" on `https://theorbix.world`, the browser visits `https://theorbix.world/api/auth/google`.
* **If your infrastructure has a reverse proxy (e.g. Cloudflare / Nginx / Vercel rewrites)** forwarding `/api/*` from `https://theorbix.world/api/*` to the backend server:
  * The backend initiates OAuth.
  * If `GOOGLE_CALLBACK_URL` is set to `https://theorbix.world/api/auth/google/callback`, Google returns the user to `https://theorbix.world/api/auth/google/callback`.
* **If your infrastructure has separate domains with NO reverse proxy** (Frontend on Vercel at `https://theorbix.world` and Backend on Render/AWS/Railway at `https://api.theorbix.world`):
  * Navigating to `/api/auth/google` on `theorbix.world` will return a **404 Not Found** because the frontend static host has no `/api` server.
  * For separate domains, the frontend must initiate to `https://api.theorbix.world/api/auth/google`.

### 8.2 Cookie Domain Scoping
In [`Backend/src/services/auth/oauthService.ts#L53-L61`](file:///Users/vineetchandel/Developer/SAAS/Orbix/Backend/src/services/auth/oauthService.ts#L53-L61):
```typescript
private static getAuthCookieOptions() {
    const isProduction = process.env.NODE_ENV === "production";
    return {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: isProduction,
    };
}
```
Notice that **no explicit `domain` is specified**.
* When a cookie is set without a `domain` attribute, the browser defaults to the **exact host** that served the HTTP response (host-only cookie).
* If the OAuth callback executes on `https://api.theorbix.world/api/auth/google/callback`:
  * The cookies (`token`, `refreshToken`) are scoped exclusively to `api.theorbix.world`.
  * The backend then redirects the user to `https://theorbix.world/auth/callback`.
  * The frontend at `theorbix.world` cannot read cookies belonging to `api.theorbix.world`!
* **Mitigation already in place in Orbix:** In [`oauthRoutes.ts#L86`](file:///Users/vineetchandel/Developer/SAAS/Orbix/Backend/src/Routes/auth/oauthRoutes.ts#L86), the backend passes the JWT token as a URL query parameter:
  `.../auth/callback?token=${encodeURIComponent(token)}...`
  and the frontend in [`OAuthCallbackPage.tsx#L35`](file:///Users/vineetchandel/Developer/SAAS/Orbix/Frontend/src/LandingPages/Auth-Pages/OAuthCallbackPage.tsx#L35) reads this query parameter and writes it to `localStorage.setItem("orbix_token", token)`. Therefore, cross-subdomain cookie blocking does not prevent login, though configuring `domain: ".theorbix.world"` is recommended for unified cookie sessions.

### 8.3 Express `trust proxy` Setting
[`Backend/src/index.ts`](file:///Users/vineetchandel/Developer/SAAS/Orbix/Backend/src/index.ts) does not contain `app.set('trust proxy', 1)`. However, because `oauthService.ts` relies strictly on explicit environment variables (`GOOGLE_CALLBACK_URL`, `BACKEND_URL`, `FRONTEND_URL`) and never inspects `req.protocol` or `req.hostname` for OAuth redirect construction, missing proxy headers **do not** mutate the redirect URI.

---

## 9. Mermaid Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    actor User as User Browser
    participant FE as Orbix Frontend<br/>(theorbix.world)
    participant BE as Orbix Backend<br/>(api.theorbix.world)
    participant Redis as Redis Cache
    participant Google as Google OAuth 2.0<br/>(accounts.google.com)
    participant DB as Supabase PostgreSQL

    User->>FE: Clicks "Continue with Google"
    FE->>BE: Full-page redirect: GET /api/auth/google?returnTo=/dashboard
    Note over BE: OAuthService.generateState()
    BE->>Redis: SETEX oauth:state:<nonce> (10 min TTL)
    BE-->>User: Set-Cookie: orbix_oauth_state=<state>; HttpOnly
    Note over BE: Computes redirect_uri =<br/>GOOGLE_CALLBACK_URL ||<br/>BACKEND_URL + /api/auth/google/callback
    BE->>User: 302 Redirect to https://accounts.google.com/o/oauth2/v2/auth<br/>?client_id=...&redirect_uri=...&state=...
    User->>Google: GET /o/oauth2/v2/auth (Sends client_id & redirect_uri)
    
    rect rgb(255, 235, 235)
        Note over Google: Google validates redirect_uri against<br/>Authorized Redirect URIs in Cloud Console.<br/>IF NOT EXACT MATCH -> Error 400: redirect_uri_mismatch
    end

    Google->>User: Renders Consent Screen
    User->>Google: Authenticates & grants consent
    Google->>User: 302 Redirect to redirect_uri?code=AUTH_CODE&state=...
    User->>BE: GET /api/auth/google/callback?code=AUTH_CODE&state=...
    Note over BE: OAuthService.validateState()
    BE->>Redis: GET & DEL oauth:state:<nonce>
    BE->>Google: POST https://oauth2.googleapis.com/token<br/>(code, client_id, client_secret, redirect_uri)
    Google-->>BE: 200 OK (access_token, id_token)
    BE->>Google: GET https://www.googleapis.com/oauth2/v3/userinfo
    Google-->>BE: 200 OK (email, name, sub, picture)
    BE->>DB: Query/Upsert user by email or google_id
    DB-->>BE: User record confirmed
    Note over BE: Issues Orbix Access & Refresh JWTs
    BE-->>User: Set-Cookie: token=JWT; HttpOnly; Secure<br/>Set-Cookie: refreshToken=JWT; HttpOnly; Secure
    BE->>User: 302 Redirect to https://theorbix.world/auth/callback?token=JWT&status=success
    User->>FE: Loads /auth/callback?token=JWT
    Note over FE: OAuthCallbackPage writes<br/>localStorage.setItem("orbix_token", token)
    FE-->>User: Navigates to /dashboard (Authenticated)
```

---

## 10. Root Cause Analysis

We classify the investigation findings according to forensic weight:

### Confirmed Root Cause
**Google Cloud Console OAuth 2.0 Client Authorized Redirect URIs does not match the actual string generated by the Orbix backend.**
* **Mechanism:** When the user clicks Google Sign In, Orbix compiles the request with:
  ```text
  redirect_uri = process.env.GOOGLE_CALLBACK_URL || `${process.env.BACKEND_URL}/api/auth/google/callback`
  ```
  If Google Cloud Console does not contain this **identical** string, Google displays `Error 400: redirect_uri_mismatch`.

### Probable Root Causes (Triggering the Mismatch in Production)

1. **Production Environment Falling Back to Localhost:**
   In [`Backend/src/services/auth/oauthService.ts#L49-L51`](file:///Users/vineetchandel/Developer/SAAS/Orbix/Backend/src/services/auth/oauthService.ts#L49-L51):
   If `GOOGLE_CALLBACK_URL` and `BACKEND_URL` are not defined in the live production server environment variables, the backend falls back to:
   `http://localhost:3000/api/auth/google/callback`
   Google immediately rejects this request on a live domain.

2. **Subdomain Mismatch (`api.theorbix.world` vs `theorbix.world`):**
   If the backend is hosted on `https://api.theorbix.world`, the backend generates:
   `https://api.theorbix.world/api/auth/google/callback`
   If the developer registered `https://theorbix.world/api/auth/google/callback` (without `api.`) in Google Cloud Console, Google detects an authority mismatch and rejects it.

3. **Missing `/api` Prefix in Google Cloud Console:**
   The backend route is mounted exclusively under `/api` in [`Backend/src/index.ts#L112`](file:///Users/vineetchandel/Developer/SAAS/Orbix/Backend/src/index.ts#L112). If Google Cloud Console was configured with `https://theorbix.world/auth/google/callback` or `https://theorbix.world/auth/callback` (missing `/api`), Google fails.

4. **Attempted Use of Supabase Callback URI:**
   If the developer configured Google Cloud Console with Supabase's redirect URL (`https://bhixamqnpcbstfwvmmog.supabase.co/auth/v1/callback`), but the Orbix application initiates the request directly from its Node backend, Google halts because the received URI does not match the Supabase URL.

---

## 11. Exact Configuration Checklist

To resolve `redirect_uri_mismatch`, register the exact values below in their respective dashboards:

### Scenario A: Backend Hosted on Subdomain (`https://api.theorbix.world`)

| Platform | Setting Key | Exact Required Value | Evidence Source | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Google Cloud** | Authorized JavaScript origins | `https://theorbix.world`<br/>`https://www.theorbix.world` | [`AuthLayout.tsx:39`](file:///Users/vineetchandel/Developer/SAAS/Orbix/Frontend/src/LandingPages/Auth-Pages/AuthLayout.tsx#L39) | Required in Google Console |
| **Google Cloud** | Authorized redirect URIs | `https://api.theorbix.world/api/auth/google/callback` | [`oauthService.ts:172`](file:///Users/vineetchandel/Developer/SAAS/Orbix/Backend/src/services/auth/oauthService.ts#L172) | **Primary Fix Required** |
| **Google Cloud** | Authorized redirect URIs (Local) | `http://localhost:3000/api/auth/google/callback` | [`oauthService.ts:50`](file:///Users/vineetchandel/Developer/SAAS/Orbix/Backend/src/services/auth/oauthService.ts#L50) | Keep for dev testing |
| **Orbix Backend (`.env`)** | `BACKEND_URL` | `https://api.theorbix.world` | [`oauthService.ts:50`](file:///Users/vineetchandel/Developer/SAAS/Orbix/Backend/src/services/auth/oauthService.ts#L50) | Confirmed from code |
| **Orbix Backend (`.env`)** | `GOOGLE_CALLBACK_URL` | `https://api.theorbix.world/api/auth/google/callback` | [`oauthService.ts:171`](file:///Users/vineetchandel/Developer/SAAS/Orbix/Backend/src/services/auth/oauthService.ts#L171) | Confirmed from code |
| **Orbix Backend (`.env`)** | `FRONTEND_URL` | `https://theorbix.world` | [`oauthService.ts:46`](file:///Users/vineetchandel/Developer/SAAS/Orbix/Backend/src/services/auth/oauthService.ts#L46) | Confirmed from code |
| **Orbix Frontend (`.env`)** | `VITE_API_BASE_URL` | `https://api.theorbix.world/api` | [`apiClient.ts:8`](file:///Users/vineetchandel/Developer/SAAS/Orbix/Frontend/src/api/apiClient.ts#L8) | Confirmed from code |

---

### Scenario B: Backend Reverse-Proxied on Same Domain (`https://theorbix.world/api/*`)

| Platform | Setting Key | Exact Required Value | Evidence Source | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Google Cloud** | Authorized JavaScript origins | `https://theorbix.world`<br/>`https://www.theorbix.world` | [`AuthLayout.tsx:39`](file:///Users/vineetchandel/Developer/SAAS/Orbix/Frontend/src/LandingPages/Auth-Pages/AuthLayout.tsx#L39) | Required in Google Console |
| **Google Cloud** | Authorized redirect URIs | `https://theorbix.world/api/auth/google/callback` | [`oauthService.ts:172`](file:///Users/vineetchandel/Developer/SAAS/Orbix/Backend/src/services/auth/oauthService.ts#L172) | **Primary Fix Required** |
| **Orbix Backend (`.env`)** | `BACKEND_URL` | `https://theorbix.world` | [`oauthService.ts:50`](file:///Users/vineetchandel/Developer/SAAS/Orbix/Backend/src/services/auth/oauthService.ts#L50) | Confirmed from code |
| **Orbix Backend (`.env`)** | `GOOGLE_CALLBACK_URL` | `https://theorbix.world/api/auth/google/callback` | [`oauthService.ts:171`](file:///Users/vineetchandel/Developer/SAAS/Orbix/Backend/src/services/auth/oauthService.ts#L171) | Confirmed from code |
| **Orbix Backend (`.env`)** | `FRONTEND_URL` | `https://theorbix.world` | [`oauthService.ts:46`](file:///Users/vineetchandel/Developer/SAAS/Orbix/Backend/src/services/auth/oauthService.ts#L46) | Confirmed from code |
| **Orbix Frontend (`.env`)** | `VITE_API_BASE_URL` | `/api` | [`apiClient.ts:8`](file:///Users/vineetchandel/Developer/SAAS/Orbix/Frontend/src/api/apiClient.ts#L8) | Confirmed from code |

---

## 12. Remaining Unknowns

Because this is a read-only investigation restricted to the local workspace:
1. **Live Production Hosting Environment:** The exact cloud provider (AWS, Render, Railway, DigitalOcean, Vercel) where the backend is running is not committed to the repository (no Dockerfile or deployment manifests).
2. **Current Google Cloud Console Entries:** The live entries inside the Google Cloud Console credentials dashboard cannot be queried from local files.
3. **Current Production `.env` Values:** The active environment variables loaded into the production container/process cannot be directly read from git.

---

## 13. Recommended Next Steps

1. **Inspect Google Cloud Console:**
   * Navigate to: **Google Cloud Console → APIs & Services → Credentials**.
   * Click your OAuth 2.0 Client ID (matching the client ID in your backend `.env`).
   * Under **Authorized redirect URIs**, check what is currently listed.
2. **Match Backend Environment with Google Cloud:**
   * Determine whether your backend is reachable at `https://api.theorbix.world` or `https://theorbix.world`.
   * Add the matching callback URL to Google Cloud Console:
     * `https://api.theorbix.world/api/auth/google/callback` OR
     * `https://theorbix.world/api/auth/google/callback`
   * Ensure `GOOGLE_CALLBACK_URL` in the production backend `.env` matches this exact string.
3. **Save and Wait 5 Minutes:**
   Google OAuth client credential updates propagate globally within 2 to 5 minutes.
4. **Test Sign-In:**
   Open `https://theorbix.world/auth/signin`, click "Continue with Google", and verify that the Google account selection prompt renders without the `redirect_uri_mismatch` error.
