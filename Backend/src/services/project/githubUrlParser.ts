/**
 * GitHub Repository URL Normalizer & Validator
 *
 * Reliably validates, cleans, and normalizes GitHub repository URLs across
 * various input formats (standard URLs, .git suffixes, deep file/tree paths,
 * trailing slashes, shorthands), and rejects unsupported providers.
 */

export interface ParsedGithubUrl {
    owner: string;
    repo: string;
    canonicalUrl: string;
    normalizedFullName: string;
    branchHint?: string;
}

export class GithubUrlValidationError extends Error {
    public isUnsupportedProvider: boolean;

    constructor(message: string, isUnsupportedProvider = false) {
        super(message);
        this.name = "GithubUrlValidationError";
        this.isUnsupportedProvider = isUnsupportedProvider;
    }
}

// GitHub username rules: alphanumeric or single hyphens, max 39 chars, cannot start/end with hyphen
const GITHUB_OWNER_REGEX = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;

// GitHub repository rules: alphanumeric, hyphens, underscores, dots, max 100 chars
const GITHUB_REPO_REGEX = /^[a-zA-Z0-9_.-]{1,100}$/;

const KNOWN_UNSUPPORTED_DOMAINS = [
    "gitlab.com",
    "bitbucket.org",
    "sourceforge.net",
    "codeberg.org",
    "gitea.com",
    "azure.com",
    "dev.azure.com",
];

export function parseAndNormalizeGithubUrl(input: string): ParsedGithubUrl {
    if (!input || typeof input !== "string") {
        throw new GithubUrlValidationError("Please provide a GitHub repository URL or 'owner/repository' identifier.");
    }

    let raw = input.trim();

    // Check for explicit URI scheme / protocol to enforce strict SSRF protection
    if (raw.includes("://")) {
        let parsed: URL;
        try {
            parsed = new URL(raw);
        } catch {
            throw new GithubUrlValidationError("Malformed repository URL.");
        }

        if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
            throw new GithubUrlValidationError(`Unsupported protocol '${parsed.protocol}'. Only HTTPS/HTTP GitHub URLs are allowed.`);
        }

        const hostname = parsed.hostname.toLowerCase();
        if (hostname !== "github.com" && hostname !== "www.github.com") {
            throw new GithubUrlValidationError(
                `Unsupported repository host '${hostname}'. Only official GitHub repositories ('github.com') are accepted.`
            );
        }

        if (parsed.username || parsed.password) {
            throw new GithubUrlValidationError("Repository URLs containing credentials or userinfo are strictly prohibited.");
        }

        if (parsed.port && parsed.port !== "443" && parsed.port !== "80") {
            throw new GithubUrlValidationError("Repository URLs with non-standard ports are prohibited.");
        }
    }

    // Check for unsupported git providers
    for (const domain of KNOWN_UNSUPPORTED_DOMAINS) {
        if (raw.toLowerCase().includes(domain)) {
            const providerName = domain.split(".")[0];
            const capitalized = providerName.charAt(0).toUpperCase() + providerName.slice(1);
            throw new GithubUrlValidationError(
                `Only GitHub repositories are currently supported for automated intelligent extraction. ${capitalized} links cannot be automatically extracted. You can still add your project using manual entry.`,
                true
            );
        }
    }

    // Strip protocols, optional www, and domain
    // Match http://, https://, git@github.com:, ssh://git@github.com/
    let path = raw;

    // Handle SSH format: git@github.com:owner/repo.git
    if (/^git@github\.com:/i.test(path)) {
        path = path.replace(/^git@github\.com:/i, "");
    } else {
        // Handle standard web URLs (with or without https:// protocol)
        path = path.replace(/^(?:https?:\/\/)?(?:www\.)?github\.com\//i, "");
        // Handle git://
        path = path.replace(/^git:\/\/github\.com\//i, "");
    }

    // Remove leading and trailing slashes
    path = path.replace(/^\/+|\/+$/g, "");

    // Split path segments
    const segments = path.split("/").map((s) => s.trim()).filter(Boolean);

    if (segments.length < 2) {
        throw new GithubUrlValidationError(
            "Invalid repository format. Please enter a full GitHub URL (e.g. 'https://github.com/owner/repository') or 'owner/repository'."
        );
    }

    const owner = segments[0];
    let repo = segments[1];

    // Strip .git suffix if present
    if (repo.toLowerCase().endsWith(".git")) {
        repo = repo.slice(0, -4);
    }

    // Optional branch or path hint: e.g. /tree/main or /blob/main
    let branchHint: string | undefined;
    if (segments.length >= 4 && (segments[2] === "tree" || segments[2] === "blob")) {
        branchHint = segments[3];
    }

    // Validate owner format
    if (!GITHUB_OWNER_REGEX.test(owner)) {
        throw new GithubUrlValidationError(
            `'${owner}' is not a valid GitHub username or organization name.`
        );
    }

    // Validate repo format
    if (!GITHUB_REPO_REGEX.test(repo)) {
        throw new GithubUrlValidationError(
            `'${repo}' is not a valid GitHub repository name.`
        );
    }

    return {
        owner,
        repo,
        canonicalUrl: `https://github.com/${owner}/${repo}`,
        normalizedFullName: `${owner}/${repo}`,
        branchHint,
    };
}
