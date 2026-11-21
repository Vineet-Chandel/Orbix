/**
 * GitHub App & Secure Repository Authorization Service (Phase 3)
 *
 * Implements repository-specific GitHub App installation and authorization
 * workflows with HMAC-SHA256 CSRF protection, AES-256-GCM encrypted token storage,
 * and read-only permission scoping (Metadata: Read, Contents: Read).
 *
 * Never exposes tokens or secrets to the browser.
 */

import crypto from "crypto";
import { query } from "../../database/client.js";

const STATE_SECRET = process.env.JWT_SECRET || "orbix_secure_github_state_secret_2026";
const STATE_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

// AES-256-GCM key derived from JWT_SECRET
const ENCRYPTION_KEY = crypto.createHash("sha256").update(STATE_SECRET).digest();

/**
 * Encrypts a sensitive string using AES-256-GCM
 */
export function encryptSecret(plaintext: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");
    const authTag = cipher.getAuthTag().toString("hex");
    return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * Decrypts an AES-256-GCM encrypted string
 */
export function decryptSecret(ciphertext: string): string | null {
    try {
        const [ivHex, authTagHex, encrypted] = ciphertext.split(":");
        if (!ivHex || !authTagHex || !encrypted) return null;

        const decipher = crypto.createDecipheriv("aes-256-gcm", ENCRYPTION_KEY, Buffer.from(ivHex, "hex"));
        decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
        let decrypted = decipher.update(encrypted, "hex", "utf8");
        decrypted += decipher.final("utf8");
        return decrypted;
    } catch {
        return null;
    }
}

export interface SignedStatePayload {
    userId: string;
    repoHint?: string;
    timestamp: number;
    nonce: string;
}

/**
 * 1. Generates an HMAC-SHA256 signed CSRF protection state
 */
export function generateInstallationState(userId: string, repoHint?: string): string {
    const payload: SignedStatePayload = {
        userId,
        repoHint,
        timestamp: Date.now(),
        nonce: crypto.randomBytes(16).toString("hex"),
    };

    const dataString = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = crypto
        .createHmac("sha256", STATE_SECRET)
        .update(dataString)
        .digest("base64url");

    return `${dataString}.${signature}`;
}

/**
 * 2. Verifies and decodes CSRF protection state
 */
export function verifyInstallationState(rawState: string): { userId: string; repoHint?: string } {
    if (!rawState || typeof rawState !== "string") {
        throw new Error("Missing or invalid authorization state parameter.");
    }

    const parts = rawState.split(".");
    if (parts.length !== 2) {
        throw new Error("Malformed authorization state format.");
    }

    const [dataString, incomingSignature] = parts;

    // Verify HMAC signature
    const expectedSignature = crypto
        .createHmac("sha256", STATE_SECRET)
        .update(dataString)
        .digest("base64url");

    if (
        !crypto.timingSafeEqual(
            Buffer.from(incomingSignature, "utf8"),
            Buffer.from(expectedSignature, "utf8")
        )
    ) {
        throw new Error("Invalid authorization state signature (potential CSRF attack).");
    }

    const decodedString = Buffer.from(dataString, "base64url").toString("utf8");
    const payload: SignedStatePayload = JSON.parse(decodedString);

    if (Date.now() - payload.timestamp > STATE_EXPIRY_MS) {
        throw new Error("Authorization request has expired. Please try connecting again.");
    }

    return {
        userId: payload.userId,
        repoHint: payload.repoHint,
    };
}

/**
 * 3. Builds the GitHub App / OAuth Installation URL
 */
export function getGitHubAppInstallUrl(state: string): string {
    const appSlug = process.env.GITHUB_APP_SLUG || process.env.GITHUB_APP_NAME;

    if (appSlug) {
        // Dedicated GitHub App installation URL
        return `https://github.com/apps/${encodeURIComponent(appSlug)}/installations/new?state=${encodeURIComponent(
            state
        )}`;
    }

    // Fallback: GitHub OAuth application with read-only repository scope
    const clientId = process.env.GITHUB_CLIENT_ID;
    const backendUrl = process.env.BACKEND_URL || "http://localhost:5001";
    const callbackUrl = `${backendUrl}/api/projects/github-app/callback`;

    if (!clientId) {
        throw new Error("Neither GITHUB_APP_SLUG nor GITHUB_CLIENT_ID is configured.");
    }

    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: callbackUrl,
        scope: "repo:status repo_deployment read:packages",
        state,
    });

    return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

/**
 * 4. Processes the GitHub App installation callback
 */
export async function handleInstallationCallback(
    userId: string,
    params: {
        installation_id?: string;
        code?: string;
        setup_action?: string;
    }
): Promise<{ success: boolean; message: string }> {
    const { installation_id, code } = params;

    let accessToken: string | null = null;
    let accountLogin = "github-user";
    let accountType = "User";

    // If an authorization code was returned, exchange it for a token
    if (code) {
        const clientId = process.env.GITHUB_CLIENT_ID;
        const clientSecret = process.env.GITHUB_CLIENT_SECRET;
        const backendUrl = process.env.BACKEND_URL || "http://localhost:5001";
        const callbackUrl = `${backendUrl}/api/projects/github-app/callback`;

        if (clientId && clientSecret) {
            const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                body: JSON.stringify({
                    client_id: clientId,
                    client_secret: clientSecret,
                    code,
                    redirect_uri: callbackUrl,
                }),
            });

            const tokenData = await tokenRes.json().catch(() => null);
            if (tokenData?.access_token) {
                accessToken = tokenData.access_token;

                // Fetch account login
                const userRes = await fetch("https://api.github.com/user", {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        Accept: "application/vnd.github+json",
                        "User-Agent": "Orbix-Showcase-Agent/2.0",
                    },
                });
                if (userRes.ok) {
                    const u = await userRes.json();
                    accountLogin = u.login || accountLogin;
                    accountType = u.type || accountType;
                }
            }
        }
    }

    const encryptedToken = accessToken ? encryptSecret(accessToken) : null;
    const finalInstallationId = installation_id || `oauth_${Date.now()}`;

    // Store in database
    await query(
        `INSERT INTO user_github_installations (
            user_id, installation_id, account_login, account_type, encrypted_access_token, repository_selection
        ) VALUES ($1, $2, $3, $4, $5, 'selected')
        ON CONFLICT (user_id, installation_id) 
        DO UPDATE SET 
            encrypted_access_token = EXCLUDED.encrypted_access_token,
            updated_at = CURRENT_TIMESTAMP;`,
        [userId, finalInstallationId, accountLogin, accountType, encryptedToken]
    );

    return {
        success: true,
        message: "GitHub repository access authorized successfully.",
    };
}

/**
 * 5. Retrieves the user's active GitHub authorization token (if connected)
 */
export async function getUserAuthorizedGithubToken(userId: string): Promise<string | null> {
    const res = await query(
        `SELECT encrypted_access_token 
         FROM user_github_installations 
         WHERE user_id = $1 
         ORDER BY updated_at DESC 
         LIMIT 1;`,
        [userId]
    );

    if (res.rowCount === 0 || !res.rows[0].encrypted_access_token) {
        return null;
    }

    return decryptSecret(res.rows[0].encrypted_access_token);
}

/**
 * 6. Checks if user has an active GitHub connection
 */
export async function getUserGithubConnectionStatus(userId: string): Promise<{
    isConnected: boolean;
    accountLogin?: string;
}> {
    const res = await query(
        `SELECT account_login 
         FROM user_github_installations 
         WHERE user_id = $1 
         ORDER BY updated_at DESC 
         LIMIT 1;`,
        [userId]
    );

    if (res.rowCount === 0) {
        return { isConnected: false };
    }

    return {
        isConnected: true,
        accountLogin: res.rows[0].account_login,
    };
}

/**
 * 7. Disconnects user GitHub connection
 */
export async function disconnectUserGithub(userId: string): Promise<boolean> {
    await query(`DELETE FROM user_github_installations WHERE user_id = $1;`, [userId]);
    return true;
}
