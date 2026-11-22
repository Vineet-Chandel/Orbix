/**
 * ORBIX PLATFORM ACCOUNT OWNERSHIP VERIFICATION - CRYPTOGRAPHIC SERVICE
 * 
 * Cryptographically secure challenge token generation, hashing, candidate extraction,
 * and timing-safe verification.
 * 
 * Security Guarantees:
 * 1. Tokens are generated using CSPRNG with rejection sampling to eliminate modulo bias.
 * 2. Plaintext tokens are NEVER persisted or logged; only SHA-256 hashes are stored.
 * 3. Token extraction from public profile fields uses strict boundary-aware regex to prevent
 *    partial matching or false positives in multiline/markdown/text fields.
 * 4. Token comparisons utilize constant-time comparison (crypto.timingSafeEqual) to eliminate
 *    timing side-channel attacks.
 */

import crypto from 'crypto';
import type { ChallengeTokenResult, ValidationResult } from '../../types/verification.js';

/**
 * Base62 alphanumeric character set for token entropy payload.
 * 62 characters: [0-9, A-Z, a-z]
 */
const BASE62_CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/**
 * Rejection sampling threshold for unbiased byte-to-base62 mapping.
 * 256 % 62 = 8; 256 - 8 = 248.
 * Discarding bytes >= 248 ensures perfectly uniform distribution across all 62 characters.
 */
const BASE62_REJECTION_THRESHOLD = 248;

/** Token prefix to eliminate ambiguity in public profile fields */
export const CHALLENGE_TOKEN_PREFIX = 'orbix-v-';

/** Length of the random Base62 payload (22 Base62 chars provide ~131 bits of entropy > 128 bits) */
export const CHALLENGE_RANDOM_PAYLOAD_LENGTH = 22;

/** Total expected length of a valid challenge token (8 prefix + 22 payload = 30 chars) */
export const CHALLENGE_TOKEN_TOTAL_LENGTH = CHALLENGE_TOKEN_PREFIX.length + CHALLENGE_RANDOM_PAYLOAD_LENGTH;

/** Length of the display prefix for audit logs and safe UI previews (e.g. 'orbix-v-xxxx') */
export const CHALLENGE_DISPLAY_PREFIX_LENGTH = 12;

/**
 * Regex pattern for extracting challenge tokens from profile text.
 * Boundary-aware:
 * - (?:^|[^0-9a-zA-Z_-]): must be preceded by start-of-string or non-token boundary character.
 * - (orbix-v-[0-9a-zA-Z]{22}): captures exactly the 30-character prefixed token with full 128+ bit entropy.
 * - (?![0-9a-zA-Z_-]): must not be followed by alphanumeric or hyphen/underscore characters.
 */
export const CHALLENGE_TOKEN_REGEX = /(?:^|[^0-9a-zA-Z_-])(orbix-v-[0-9a-zA-Z]{22})(?![0-9a-zA-Z_-])/g;

/**
 * Validates whether an expected hash is a valid 64-character hexadecimal SHA-256 string.
 */
const SHA256_HEX_REGEX = /^[0-9a-fA-F]{64}$/;

/**
 * Generates an unbiased cryptographically secure random string of specified length
 * from the Base62 character set using rejection sampling.
 * 
 * @param length Number of characters to generate
 * @returns Uniform random Base62 string
 */
export function generateRandomBase62(length: number): string {
    if (length <= 0) {
        return '';
    }

    const chars: string[] = [];
    // Request double the bytes needed to amortize CSPRNG calls while accounting for rejection
    const batchSize = Math.max(32, length * 2);

    while (chars.length < length) {
        const randomBytes = crypto.randomBytes(batchSize);
        for (const byte of randomBytes) {
            if (chars.length >= length) break;
            if (byte < BASE62_REJECTION_THRESHOLD) {
                chars.push(BASE62_CHARSET.charAt(byte % BASE62_CHARSET.length));
            }
        }
    }

    return chars.join('');
}

/**
 * Computes the lowercase SHA-256 hexadecimal hash of a string.
 * 
 * @param token Plaintext token to hash
 * @returns 64-character lowercase hexadecimal hash
 */
export function hashChallengeToken(token: string): string {
    return crypto
        .createHash('sha256')
        .update(token, 'utf8')
        .digest('hex')
        .toLowerCase();
}

/**
 * Generates a complete verification challenge token bundle.
 * 
 * @returns {ChallengeTokenResult} Plaintext token, SHA-256 hash, and safe display prefix
 */
export function generateChallengeToken(): ChallengeTokenResult {
    const payload = generateRandomBase62(CHALLENGE_RANDOM_PAYLOAD_LENGTH);
    const plaintextToken = `${CHALLENGE_TOKEN_PREFIX}${payload}`;
    const tokenHash = hashChallengeToken(plaintextToken);
    const tokenDisplayPrefix = plaintextToken.slice(0, CHALLENGE_DISPLAY_PREFIX_LENGTH);

    return {
        plaintextToken,
        tokenHash,
        tokenDisplayPrefix,
    };
}

/**
 * Extracts all unique candidate verification tokens from arbitrary text (bio, aboutMe, name, etc.).
 * Tolerates null, undefined, objects, numbers, and multiline text safely without throwing.
 * 
 * @param fieldContent Arbitrary content from an external profile field
 * @returns Array of unique candidate tokens matching the orbix-v-[0-9a-zA-Z]{22} format
 */
export function extractChallengeCandidates(fieldContent: unknown): string[] {
    if (typeof fieldContent !== 'string' || fieldContent.trim() === '') {
        return [];
    }

    const candidates: string[] = [];
    const regex = new RegExp(CHALLENGE_TOKEN_REGEX);
    let match: RegExpExecArray | null;

    while ((match = regex.exec(fieldContent)) !== null) {
        if (match[1]) {
            candidates.push(match[1]);
        }
    }

    // Return deduplicated array while preserving order of first appearance
    return Array.from(new Set(candidates));
}

/**
 * Compares an extracted candidate token against an expected SHA-256 hash using constant-time comparison.
 * 
 * @param candidate Extracted candidate token string
 * @param expectedHash 64-character hexadecimal SHA-256 hash stored in database
 * @returns true if candidate's SHA-256 matches expectedHash, false otherwise
 */
export function verifyCandidateMatch(candidate: string, expectedHash: string): boolean {
    if (typeof candidate !== 'string' || typeof expectedHash !== 'string') {
        return false;
    }

    if (!SHA256_HEX_REGEX.test(expectedHash)) {
        return false;
    }

    try {
        const candidateHash = hashChallengeToken(candidate);
        const candidateBuffer = Buffer.from(candidateHash, 'hex');
        const expectedBuffer = Buffer.from(expectedHash.toLowerCase(), 'hex');

        if (candidateBuffer.length !== expectedBuffer.length) {
            return false;
        }

        return crypto.timingSafeEqual(candidateBuffer, expectedBuffer);
    } catch {
        return false;
    }
}

/**
 * Validates a public profile field against an expected challenge token hash.
 * Scans the field for candidate tokens and executes constant-time hash checks on each candidate.
 * 
 * @param fieldContent Public profile field value (bio, about me, location, etc.)
 * @param expectedHash Stored SHA-256 hash for the active challenge
 * @returns ValidationResult indicating match status and the matching candidate token if found
 */
export function validateProfileFieldForToken(
    fieldContent: unknown,
    expectedHash: string
): ValidationResult {
    const candidates = extractChallengeCandidates(fieldContent);

    for (const candidate of candidates) {
        if (verifyCandidateMatch(candidate, expectedHash)) {
            return {
                matched: true,
                matchedCandidate: candidate,
            };
        }
    }

    return {
        matched: false,
    };
}
