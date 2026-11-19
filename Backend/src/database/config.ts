import { URL } from "url";
import net from "net";

/**
 * ORBIX DATABASE IDENTITY & FAIL-CLOSED CONFIGURATION RESOLVER
 * 
 * Strict Zero-Trust Architecture:
 * - Unconditionally blocks connections to shared Supabase project (bhixamqnpcbstfwvmmog) in staging
 * - Mandates explicit expected database identity verification before opening any pool
 * - Strictly prevents staging mode from silently falling back to production/shared URLs
 * - Sanitizes all connection strings and credentials from error outputs
 */

export const FORBIDDEN_DATABASE_IDENTIFIERS: readonly string[] = Object.freeze([
    "bhixamqnpcbstfwvmmog",
]);

export type DatabaseTargetEnv = "development" | "staging" | "production" | "test";

export interface ParsedDatabaseUrl {
    rawUrl: string;
    protocol: string;
    host: string;
    port: number;
    database: string;
    username: string;
}

export interface ResolveDatabaseOptions {
    env?: Record<string, string | undefined> | undefined;
    targetEnv?: DatabaseTargetEnv | undefined;
    connectionString?: string | undefined;
    expectedIdentity?: string | undefined;
}

export interface ResolvedDatabaseConfig {
    environment: DatabaseTargetEnv;
    connectionString: string;
    parsed: ParsedDatabaseUrl;
    ssl: boolean | { rejectUnauthorized: boolean };
    isStaging: boolean;
    isProduction: boolean;
    isDevelopment: boolean;
}

/**
 * Scrubs credentials and secrets from database error strings.
 */
export function sanitizeDatabaseError(msg: string): string {
    if (!msg) return "";
    return msg
        .replace(/postgres(ql)?:\/\/[^:]+:[^@]+@/gi, "postgresql://[REDACTED]:[REDACTED]@")
        .replace(/password=[^\s;]+/gi, "password=[REDACTED]")
        .replace(/token=[^\s;]+/gi, "token=[REDACTED]");
}

/**
 * Authoritatively decodes URL-encoded database names.
 * Throws if the percent-encoding sequence is malformed.
 */
export function safeDecodeDatabaseName(raw: string): string {
    const clean = raw.replace(/^\//, "").trim();
    if (!clean) return "";
    try {
        return decodeURIComponent(clean).toLowerCase();
    } catch {
        throw new Error(`Database configuration error: Malformed URL-encoded database name '${clean}'.`);
    }
}

/**
 * Authoritatively parses and validates PostgreSQL connection URI.
 * Guarantees protocol and host safety without leaking passwords.
 * Rejects multi-host strings and ambiguous destination query parameters.
 */
export function parseDatabaseUrl(urlStr: string): ParsedDatabaseUrl {
    if (!urlStr || typeof urlStr !== "string" || !urlStr.trim()) {
        throw new Error("Database configuration error: Connection URL cannot be empty or undefined.");
    }

    const cleanUrl = urlStr.trim();

    // Reject multi-host connection URLs in the authority
    const afterProto = cleanUrl.replace(/^[a-zA-Z0-9+.-]+:\/\//, "");
    const authority = (afterProto.split("/")[0] ?? "").split("?")[0] ?? "";
    if (authority.includes(",")) {
        throw new Error(
            "Database configuration error: Multi-host connection URLs are not supported for isolated database identity enforcement."
        );
    }

    let parsed: URL;
    try {
        parsed = new URL(cleanUrl);
    } catch {
        throw new Error("Database configuration error: Malformed database URL (failed to parse as valid URI).");
    }

    if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
        throw new Error(
            `Database configuration error: Invalid protocol '${parsed.protocol}'. Expected 'postgres:' or 'postgresql:'.`
        );
    }

    if (!parsed.hostname) {
        throw new Error("Database configuration error: Malformed database URL (missing hostname).");
    }

    // Reject ambiguous destination query parameters that could alter target host, port, or db
    const ambiguousParams = ["host", "port", "dbname", "database"];
    for (const param of ambiguousParams) {
        if (parsed.searchParams.has(param)) {
            throw new Error(
                `Database configuration error: Connection URL contains ambiguous destination query parameter '${param}'. Destination must be defined explicitly in the URL authority and path.`
            );
        }
    }

    let host: string;
    try {
        host = normalizeHostname(parsed.hostname);
    } catch (normErr: any) {
        throw new Error(`Database configuration error: Malformed database URL (${normErr.message}).`);
    }

    if (!host || !isValidHostnameOrIp(host)) {
        throw new Error("Database configuration error: Malformed database URL (invalid or malformed hostname).");
    }
    const port = parsed.port ? parseInt(parsed.port, 10) : 5432;
    if (isNaN(port) || port < 1 || port > 65535) {
        throw new Error("Database configuration error: Malformed database URL (invalid port number).");
    }

    const rawDb = parsed.pathname ? parsed.pathname.replace(/^\//, "").trim() : "";
    if (!rawDb) {
        throw new Error("Database configuration error: Malformed database URL (missing database name in path).");
    }

    let database: string;
    try {
        database = safeDecodeDatabaseName(rawDb);
    } catch (dbErr: any) {
        throw new Error(`Database configuration error: Malformed database URL (${dbErr.message}).`);
    }

    if (!database) {
        throw new Error("Database configuration error: Malformed database URL (empty database name after decoding).");
    }

    return {
        rawUrl: cleanUrl,
        protocol: parsed.protocol,
        host,
        port,
        database,
        username: parsed.username || "",
    };
}

export const DISALLOWED_BROAD_IDENTITIES: readonly string[] = Object.freeze([
    "rds",
    "internal",
    "staging",
    "postgres",
    "postgresql",
    "aws",
    "database",
    "db",
    "cluster",
    "node",
    "prod",
    "production",
    "dev",
    "development",
    "test",
    "local",
    "localhost",
]);

export interface ParsedExpectedIdentity {
    host: string;
    port?: number | undefined;
    database?: string | undefined;
}

/**
 * Normalizes hostnames for strict comparison:
 * - Trims whitespace
 * - Converts to lowercase
 * - Accepts at most one optional trailing DNS root dot
 * - Strictly rejects multiple trailing dots
 */
export function normalizeHostname(raw: string): string {
    if (!raw || typeof raw !== "string") return "";
    let clean = raw.trim().toLowerCase();
    if (clean.endsWith("..")) {
        throw new Error("Database configuration error: Hostname cannot contain multiple trailing dots.");
    }
    if (clean.endsWith(".")) {
        clean = clean.slice(0, -1);
        if (clean.endsWith(".")) {
            throw new Error("Database configuration error: Hostname cannot contain multiple trailing dots.");
        }
    }
    return clean;
}

/**
 * Validates individual DNS hostname label (RFC 952 / 1123 compliant).
 * Conventional DNS hostnames strictly disallow underscores.
 */
export function isValidHostLabel(label: string): boolean {
    if (!label || label.length > 63) return false;
    if (label.includes("_")) return false; // Conventional DNS hostnames strictly disallow underscores
    if (label.startsWith("-") || label.endsWith("-")) return false;
    return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(label);
}

/**
 * Validates normalized hostname or IP address.
 * Rejects underscore labels, empty labels, multiple dots, and invalid IPs.
 */
export function isValidHostnameOrIp(host: string): boolean {
    if (!host || host.length > 253) return false;
    if (host === "localhost") return true;

    // IPv4 check
    const ipVer = net.isIP(host);
    if (ipVer === 4) {
        const octets = host.split(".");
        if (octets.length !== 4) return false;
        return octets.every(
            o => /^\d{1,3}$/.test(o) && Number(o) >= 0 && Number(o) <= 255 && (o === "0" || !o.startsWith("0"))
        );
    }

    // Bracketed IPv6 check (e.g. "[2001:db8::1]")
    if (host.startsWith("[") && host.endsWith("]")) {
        const inner = host.slice(1, -1);
        return net.isIP(inner) === 6;
    }

    // Unbracketed IPv6
    if (ipVer === 6) return true;

    // Reject consecutive dots or leading/trailing dots
    if (host.includes("..") || host.startsWith(".") || host.endsWith(".")) {
        return false;
    }

    const labels = host.split(".");
    if (labels.length < 2) return false;

    // TLD cannot be purely numeric (prevents 300.0.1.5 masquerading as domain)
    const lastLabel = labels[labels.length - 1];
    if (!lastLabel || /^\d+$/.test(lastLabel)) {
        return false;
    }

    return labels.every(isValidHostLabel);
}

/**
 * Authoritatively parses expected identity string supporting:
 * - complete destination (e.g. "staging-rds.orbix.internal:5432/orbix_staging")
 * - full connection URI (e.g. "postgresql://staging-rds.orbix.internal:5432/orbix_staging")
 * - partial destination components for validation (host, host:port, host/database)
 * 
 * Rejects query parameters, URL fragments, and multi-host comma-separated strings.
 */
export function parseExpectedIdentity(expected: string): ParsedExpectedIdentity | null {
    if (!expected || typeof expected !== "string") return null;
    let clean = expected.trim();
    if (!clean) return null;

    if (clean.includes("?") || clean.includes("#")) {
        throw new Error(
            `Database configuration error: Expected identity contains query parameters or URL fragment. Only destination format 'host:port/database' is permitted.`
        );
    }

    if (clean.includes(",")) {
        throw new Error(
            `Database configuration error: Multi-host expected identity is not supported. Exactly one destination 'host:port/database' must be specified.`
        );
    }

    // Check if full URI format was supplied
    if (clean.startsWith("postgresql://") || clean.startsWith("postgres://")) {
        try {
            const u = new URL(clean);
            if (!u.hostname) return null;
            const host = normalizeHostname(u.hostname);
            if (!isValidHostnameOrIp(host)) return null;

            let port: number | undefined;
            if (u.port) {
                port = parseInt(u.port, 10);
                if (isNaN(port) || port < 1 || port > 65535) return null;
            }

            let database: string | undefined;
            if (u.pathname && u.pathname !== "/") {
                database = safeDecodeDatabaseName(u.pathname);
                if (database.includes("/")) return null; // path traversal / multiple segments
            }

            return { host, port, database };
        } catch (e: any) {
            if (
                e.message.includes("Malformed URL-encoded") ||
                e.message.includes("Hostname cannot contain")
            ) {
                throw e;
            }
            return null;
        }
    }

    // Split database component if present: host[:port][/database]
    let hostPortPart = clean;
    let database: string | undefined;

    if (clean.includes("/")) {
        const slashIdx = clean.indexOf("/");
        hostPortPart = clean.slice(0, slashIdx).trim();
        const dbPart = clean.slice(slashIdx + 1).trim();

        if (!hostPortPart) return null; // Missing host e.g. /orbix_staging
        if (!dbPart) return null; // Missing db e.g. host/
        if (dbPart.includes("/")) return null; // Multiple slashes

        database = safeDecodeDatabaseName(dbPart);
    }

    // Parse host and optional port
    let hostPart = hostPortPart;
    let port: number | undefined;

    if (hostPortPart.startsWith("[")) {
        const closeIdx = hostPortPart.indexOf("]");
        if (closeIdx === -1) return null;
        hostPart = hostPortPart.slice(0, closeIdx + 1);
        const rest = hostPortPart.slice(closeIdx + 1);
        if (rest) {
            if (!rest.startsWith(":")) return null;
            const portStr = rest.slice(1);
            port = parseInt(portStr, 10);
            if (isNaN(port) || port < 1 || port > 65535 || String(port) !== portStr) return null;
        }
    } else if (hostPortPart.includes(":")) {
        const parts = hostPortPart.split(":");
        if (parts.length !== 2) return null; // Multiple colons (invalid or unbracketed IPv6)
        const p0 = parts[0];
        const p1 = parts[1];
        if (!p0 || !p1) return null;
        hostPart = p0.trim();
        const portStr = p1.trim();
        port = parseInt(portStr, 10);
        if (isNaN(port) || port < 1 || port > 65535 || String(port) !== portStr) return null;
    }

    let host: string;
    try {
        host = normalizeHostname(hostPart);
    } catch (normErr: any) {
        throw normErr;
    }
    if (!isValidHostnameOrIp(host)) return null;

    return { host, port, database };
}

/**
 * Authoritatively verifies whether a parsed database destination matches the expected identity.
 * - Compares normalized hostnames using exact equality (===), never substring matching.
 * - Handles at most one optional DNS trailing dot; rejects multiple trailing dots.
 * - Asserts exact numerical port equality.
 * - Asserts exact case-insensitive database name equality (with URL decoding).
 * - Strictly rejects broad/ambiguous identities ("rds", "internal", "staging", "postgres", "aws").
 * - Rejects forbidden identifiers (bhixamqnpcbstfwvmmog) by default.
 * - In staging mode (requireComplete !== false), strictly requires all three components: host, port, database.
 */
export function matchesExpectedIdentity(
    parsed: ParsedDatabaseUrl,
    expectedIdentity: string,
    options: { allowForbiddenIdentifiers?: boolean; requireComplete?: boolean } = {}
): boolean {
    if (!expectedIdentity || typeof expectedIdentity !== "string" || !expectedIdentity.trim()) {
        return false;
    }

    const cleanExpected = expectedIdentity.trim().toLowerCase();

    // 1. Forbidden identifier check (unless explicitly allowed in production validation)
    if (!options.allowForbiddenIdentifiers) {
        for (const forbidden of FORBIDDEN_DATABASE_IDENTIFIERS) {
            if (cleanExpected.includes(forbidden)) {
                return false;
            }
        }
    }

    // 2. Reject broad keywords
    const withoutProtocol = cleanExpected.replace(/^(postgresql|postgres):\/\//, "");
    for (const broad of DISALLOWED_BROAD_IDENTITIES) {
        if (
            withoutProtocol === broad ||
            withoutProtocol.startsWith(`${broad}/`) ||
            withoutProtocol.startsWith(`${broad}:`)
        ) {
            return false;
        }
    }

    // 3. Authoritative parse of expected identity
    let parsedExpected: ParsedExpectedIdentity | null;
    try {
        parsedExpected = parseExpectedIdentity(expectedIdentity);
    } catch {
        return false;
    }
    if (!parsedExpected) {
        return false;
    }

    // 4. Incomplete identity check (mandatory for staging by default)
    if (options.requireComplete !== false) {
        if (parsedExpected.port === undefined || !parsedExpected.database) {
            return false;
        }
    }

    // 5. Reject if parsed host or database is a broad keyword
    for (const broad of DISALLOWED_BROAD_IDENTITIES) {
        if (parsedExpected.host === broad || parsedExpected.database === broad) {
            return false;
        }
    }

    // 6. Hostname check: exact equality
    let normalizedParsedHost: string;
    try {
        normalizedParsedHost = normalizeHostname(parsed.host);
    } catch {
        return false;
    }
    if (normalizedParsedHost !== parsedExpected.host) {
        return false;
    }

    // 7. Port check: exact equality
    if (parsedExpected.port !== undefined && parsed.port !== parsedExpected.port) {
        return false;
    }

    // 8. Database check: exact equality (with URL decoding)
    if (parsedExpected.database !== undefined) {
        let normalizedParsedDb: string;
        try {
            normalizedParsedDb = safeDecodeDatabaseName(parsed.database);
        } catch {
            return false;
        }
        if (normalizedParsedDb !== parsedExpected.database) {
            return false;
        }
    }

    return true;
}

/**
 * Determines target environment from environment variables.
 */
export function resolveTargetEnvironment(env: Record<string, string | undefined> = process.env): DatabaseTargetEnv {
    const raw = (env.TARGET_ENV || env.APP_ENV || env.ORBIX_ENV || env.NODE_ENV || "development").trim().toLowerCase();
    if (raw === "staging") return "staging";
    if (raw === "production" || raw === "prod") return "production";
    if (raw === "test") return "test";
    return "development";
}

/**
 * Centralized, pure, fail-closed database configuration resolver.
 * Enforces strict environment boundaries and rejects forbidden databases.
 */
export function resolveDatabaseConfig(options: ResolveDatabaseOptions = {}): ResolvedDatabaseConfig {
    const env = options.env || process.env;
    const environment = options.targetEnv || resolveTargetEnvironment(env);

    let connectionString: string | undefined = options.connectionString;
    let expectedIdentity: string | undefined =
        options.expectedIdentity ||
        env.EXPECTED_STAGING_DB_IDENTITY ||
        env.STAGING_DB_IDENTITY ||
        env.EXPECTED_DATABASE_HOST ||
        env.EXPECTED_DATABASE_IDENTITY;

    // =========================================================================
    // 1. STAGING ENVIRONMENT (STRICTEST FAIL-CLOSED VALIDATION)
    // =========================================================================
    if (environment === "staging") {
        // Require explicit STAGING_DATABASE_URL
        if (!connectionString) {
            connectionString = env.STAGING_DATABASE_URL;
        }

        if (!connectionString || !connectionString.trim()) {
            throw new Error(
                "Database configuration error: Staging mode requires STAGING_DATABASE_URL to be explicitly configured. Fallback to SUPABASE_DB_URL or DATABASE_URL is strictly prohibited."
            );
        }

        // Require explicit expected staging identity
        if (!expectedIdentity || !expectedIdentity.trim()) {
            throw new Error(
                "Database configuration error: Staging mode requires an explicit expected database identity (EXPECTED_STAGING_DB_IDENTITY). Refusing to connect without independent identity verification."
            );
        }

        const cleanExpected = expectedIdentity.trim().toLowerCase();

        // Reject if expected identity contains forbidden identifiers
        for (const forbidden of FORBIDDEN_DATABASE_IDENTIFIERS) {
            if (cleanExpected.includes(forbidden)) {
                throw new Error(
                    `Database configuration error: Expected identity contains forbidden project identifier '${forbidden}'. This database is strictly forbidden.`
                );
            }
        }

        // Reject if expected identity contains production indicators
        const prodIndicators = ["prod-db", "production-db", "orbix-prod", "orbix_production", "rds.prod"];
        for (const ind of prodIndicators) {
            if (cleanExpected.includes(ind)) {
                throw new Error(
                    `Database configuration error: Expected identity contains production indicator '${ind}'. Configuring a production database is strictly prohibited in staging.`
                );
            }
        }

        // Reject broad or ambiguous expected identities
        const withoutProtocol = cleanExpected.replace(/^(postgresql|postgres):\/\//, "");
        for (const broad of DISALLOWED_BROAD_IDENTITIES) {
            if (
                withoutProtocol === broad ||
                withoutProtocol.startsWith(`${broad}/`) ||
                withoutProtocol.startsWith(`${broad}:`)
            ) {
                throw new Error(
                    `Database configuration error: Expected identity '${expectedIdentity.trim()}' is a broad keyword ('${broad}'). Explicit qualified identity required.`
                );
            }
        }

        // Validate format of expected identity
        const parsedExpected = parseExpectedIdentity(expectedIdentity);
        if (!parsedExpected) {
            throw new Error(
                `Database configuration error: Expected identity '${expectedIdentity.trim()}' is malformed or invalid. Provide a complete destination (e.g. 'staging-rds.orbix.internal:5432/orbix_staging').`
            );
        }

        // Staging strictly requires COMPLETE destination identity: host, port, and database
        if (parsedExpected.port === undefined) {
            throw new Error(
                `Database configuration error: Incomplete staging destination identity '${expectedIdentity.trim()}'. Staging mode strictly requires an explicit port. Expected format: 'host:port/database' (e.g. 'staging-rds.orbix.internal:5432/orbix_staging'). Hostname-only identities are rejected.`
            );
        }

        if (!parsedExpected.database) {
            throw new Error(
                `Database configuration error: Incomplete staging destination identity '${expectedIdentity.trim()}'. Staging mode strictly requires an explicit database name. Expected format: 'host:port/database' (e.g. 'staging-rds.orbix.internal:5432/orbix_staging'). Hostname-only identities are rejected.`
            );
        }

        // Parse connection URL
        const parsed = parseDatabaseUrl(connectionString);

        // Reject forbidden identifiers in parsed URL
        for (const forbidden of FORBIDDEN_DATABASE_IDENTIFIERS) {
            if (
                parsed.host.includes(forbidden) ||
                parsed.database.includes(forbidden) ||
                parsed.username.includes(forbidden) ||
                parsed.rawUrl.toLowerCase().includes(forbidden)
            ) {
                throw new Error(
                    `Database connection rejected: The shared Supabase project (${forbidden}) is strictly forbidden in staging mode.`
                );
            }
        }

        // Reject obvious production database indicators in staging mode
        for (const ind of prodIndicators) {
            if (parsed.host.includes(ind) || parsed.database.includes(ind)) {
                throw new Error(
                    `Database connection rejected: Host '${parsed.host}' appears to be a production database, which is strictly prohibited in staging.`
                );
            }
        }

        // Validate effective destination matches expected identity using exact equality
        if (!matchesExpectedIdentity(parsed, expectedIdentity, { requireComplete: true })) {
            throw new Error(
                `Database identity mismatch: Effective database destination '${parsed.host}:${parsed.port}/${parsed.database}' does not match expected staging identity '${expectedIdentity.trim()}'.`
            );
        }

        return {
            environment: "staging",
            connectionString: parsed.rawUrl,
            parsed,
            ssl: { rejectUnauthorized: false },
            isStaging: true,
            isProduction: false,
            isDevelopment: false,
        };
    }

    // =========================================================================
    // 2. PRODUCTION ENVIRONMENT
    // =========================================================================
    if (environment === "production") {
        if (!connectionString) {
            // Preserve production precedence: SUPABASE_DB_URL || DATABASE_URL
            connectionString = env.SUPABASE_DB_URL || env.DATABASE_URL;
        }

        if (!connectionString || !connectionString.trim()) {
            throw new Error(
                "Production database configuration error: Neither SUPABASE_DB_URL nor DATABASE_URL is configured."
            );
        }

        const parsed = parseDatabaseUrl(connectionString);

        const prodExpected =
            options.expectedIdentity ||
            env.EXPECTED_PRODUCTION_DB_IDENTITY ||
            env.PRODUCTION_DB_IDENTITY ||
            env.EXPECTED_DATABASE_HOST;

        if (prodExpected && !matchesExpectedIdentity(parsed, prodExpected, { allowForbiddenIdentifiers: true })) {
            throw new Error(
                `Production database identity mismatch: Effective host '${parsed.host}' does not match expected production identity '${prodExpected}'.`
            );
        }

        return {
            environment: "production",
            connectionString: parsed.rawUrl,
            parsed,
            ssl: { rejectUnauthorized: false },
            isStaging: false,
            isProduction: true,
            isDevelopment: false,
        };
    }

    // =========================================================================
    // 3. DEVELOPMENT & TEST ENVIRONMENTS
    // =========================================================================
    if (!connectionString) {
        connectionString =
            env.SUPABASE_DB_URL || env.DATABASE_URL || "postgresql://localhost:5432/orbix_dev";
    }

    const parsed = parseDatabaseUrl(connectionString);

    return {
        environment: environment === "test" ? "test" : "development",
        connectionString: parsed.rawUrl,
        parsed,
        ssl: parsed.host === "localhost" || parsed.host === "127.0.0.1" ? false : { rejectUnauthorized: false },
        isStaging: false,
        isProduction: false,
        isDevelopment: true,
    };
}
