/**
 * GITHUB VERIFICATION ADAPTER
 * OAuth-based identity verification for GitHub accounts.
 * 
 * Security Invariants:
 * 1. Uses immutable numeric GitHub user ID (providerId), NOT mutable usernames.
 * 2. Cross-references against authenticated Orbix user's users.github_id.
 * 3. Does not permit public-profile string matching challenges.
 */

import type { PlatformAdapter, AdapterFetchResult, VerificationInstructions } from "./adapterInterface.js";
import { query } from "../../../database/client.js";

export class GitHubAdapter implements PlatformAdapter {
    public readonly portal = 'github';
    public readonly displayName = 'GitHub';
    public readonly defaultTargetField = 'oauth_identity';
    public readonly supportedTargetFields = ['oauth_identity'] as const;
    public readonly supportsChallengeVerification = false;
    public readonly supportsOAuthVerification = true;

    public async fetchProfile(handle: string): Promise<AdapterFetchResult> {
        const cleanHandle = handle.trim();
        if (!cleanHandle) {
            return {
                success: false,
                portal: this.portal,
                handle,
                targetFieldsContent: {},
                errorCode: 'NOT_FOUND',
                errorMessage: 'Empty or invalid GitHub username',
            };
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);

            const headers: Record<string, string> = {
                "User-Agent": "Orbix-Verification-Service",
                "Accept": "application/vnd.github.v3+json",
            };

            const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
            if (token) {
                headers["Authorization"] = `Bearer ${token}`;
            }

            const res = await fetch(`https://api.github.com/users/${encodeURIComponent(cleanHandle)}`, {
                headers,
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (res.status === 404) {
                return {
                    success: false,
                    portal: this.portal,
                    handle: cleanHandle,
                    targetFieldsContent: {},
                    errorCode: 'NOT_FOUND',
                    errorMessage: `GitHub user '${cleanHandle}' does not exist.`,
                };
            }

            if (res.status === 403 || res.status === 429) {
                return {
                    success: false,
                    portal: this.portal,
                    handle: cleanHandle,
                    targetFieldsContent: {},
                    errorCode: 'RATE_LIMITED',
                    errorMessage: 'GitHub API rate limit exceeded.',
                };
            }

            if (!res.ok) {
                return {
                    success: false,
                    portal: this.portal,
                    handle: cleanHandle,
                    targetFieldsContent: {},
                    errorCode: 'NETWORK_ERROR',
                    errorMessage: `GitHub API returned HTTP ${res.status}`,
                };
            }

            const data = (await res.json()) as any;
            if (!data?.id) {
                return {
                    success: false,
                    portal: this.portal,
                    handle: cleanHandle,
                    targetFieldsContent: {},
                    errorCode: 'INVALID_RESPONSE',
                    errorMessage: 'Invalid response from GitHub API',
                };
            }

            const targetFieldsContent: Record<string, string | null | undefined> = {
                oauth_identity: String(data.id),
                login: String(data.login || cleanHandle),
            };

            return {
                success: true,
                portal: this.portal,
                handle: cleanHandle,
                targetFieldsContent,
                rawProfile: data,
            };
        } catch (err: any) {
            const isTimeout = err?.name === 'AbortError' || err?.code === 'ABORT_ERR';
            return {
                success: false,
                portal: this.portal,
                handle: cleanHandle,
                targetFieldsContent: {},
                errorCode: isTimeout ? 'RATE_LIMITED' : 'NETWORK_ERROR',
                errorMessage: isTimeout
                    ? 'GitHub API request timed out'
                    : (err?.message || 'Failed to connect to GitHub API'),
            };
        }
    }

    /**
     * Verifies that the authenticated Orbix user owns the GitHub identity matching the handle.
     * Compares immutable numeric GitHub user IDs.
     */
    public async verifyOAuthOwnership(userId: string, targetHandle: string): Promise<{
        verified: boolean;
        githubId?: string;
        resolvedHandle?: string;
        errorCode?: 'AUTH_REQUIRED' | 'IDENTITY_MISMATCH' | 'CLAIMED_BY_ANOTHER_USER' | 'NOT_FOUND' | 'NETWORK_ERROR';
        errorMessage?: string;
    }> {
        // 1. Fetch authenticated user's linked github_id from database
        const userRes = await query(`
            SELECT id, username, github_id 
            FROM public.users 
            WHERE id = $1 
            LIMIT 1;
        `, [userId]);

        if (userRes.rows.length === 0) {
            return {
                verified: false,
                errorCode: 'AUTH_REQUIRED',
                errorMessage: 'Authenticated user not found',
            };
        }

        const userGithubId = userRes.rows[0].github_id;
        if (!userGithubId || typeof userGithubId !== 'string' || userGithubId.trim() === '') {
            return {
                verified: false,
                errorCode: 'AUTH_REQUIRED',
                errorMessage: 'Your Orbix account is not yet linked to GitHub via OAuth. Please sign in or link with GitHub in Settings first.',
            };
        }

        // 2. Fetch target GitHub profile to resolve immutable numeric provider ID
        const profileResult = await this.fetchProfile(targetHandle);
        if (!profileResult.success) {
            return {
                verified: false,
                errorCode: profileResult.errorCode === 'NOT_FOUND' ? 'NOT_FOUND' : 'NETWORK_ERROR',
                ...(profileResult.errorMessage !== undefined && { errorMessage: profileResult.errorMessage }),
            };
        }

        const targetNumericId = profileResult.targetFieldsContent['oauth_identity'];
        const resolvedLogin = profileResult.targetFieldsContent['login'] || targetHandle;

        // 3. Match numeric provider IDs
        if (String(userGithubId).trim() !== String(targetNumericId).trim()) {
            return {
                verified: false,
                errorCode: 'IDENTITY_MISMATCH',
                errorMessage: `Your linked GitHub OAuth identity (ID: ${userGithubId}) does not match the GitHub handle '${targetHandle}' (ID: ${targetNumericId}).`,
            };
        }

        // 4. Ensure no other user already owns this GitHub account
        const conflictRes = await query(`
            SELECT id, username 
            FROM public.users 
            WHERE github_id = $1 AND id != $2 
            LIMIT 1;
        `, [userGithubId, userId]);

        if (conflictRes.rows.length > 0) {
            return {
                verified: false,
                errorCode: 'CLAIMED_BY_ANOTHER_USER',
                errorMessage: 'This GitHub account is already linked to another Orbix account.',
            };
        }

        return {
            verified: true,
            githubId: userGithubId,
            resolvedHandle: resolvedLogin,
        };
    }

    public extractCandidates(_fetchResult: AdapterFetchResult): string[] {
        // GitHub uses OAuth provider ID binding, not bio challenge extraction
        return [];
    }

    public getInstructions(_token: string): VerificationInstructions {
        return {
            fieldName: 'oauth_identity',
            displayFieldName: 'GitHub OAuth',
            instructions: 'GitHub ownership is verified using GitHub OAuth. Click Link with GitHub to authorize and confirm account ownership.',
            profileSettingsUrl: '/api/auth/github',
        };
    }
}
