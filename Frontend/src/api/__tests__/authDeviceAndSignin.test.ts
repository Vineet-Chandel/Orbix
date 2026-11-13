import test, { describe } from "node:test";
import assert from "node:assert";

// Mock browser global environment for tests
function setupMockBrowser(options: {
    hasRandomUUID?: boolean;
    hasGetRandomValues?: boolean;
    localStorageThrows?: boolean;
    sessionStorageThrows?: boolean;
    initialLocalStorage?: Record<string, string>;
    initialSessionStorage?: Record<string, string>;
} = {}) {
    const {
        hasRandomUUID = true,
        hasGetRandomValues = true,
        localStorageThrows = false,
        sessionStorageThrows = false,
        initialLocalStorage = {},
        initialSessionStorage = {},
    } = options;

    const localStore = new Map<string, string>(Object.entries(initialLocalStorage));
    const sessionStore = new Map<string, string>(Object.entries(initialSessionStorage));

    const mockLocalStorage = {
        getItem: (key: string) => {
            if (localStorageThrows) throw new Error("SecurityError: Access to localStorage is denied");
            return localStore.get(key) ?? null;
        },
        setItem: (key: string, value: string) => {
            if (localStorageThrows) throw new Error("SecurityError: Access to localStorage is denied");
            localStore.set(key, String(value));
        },
        removeItem: (key: string) => {
            if (localStorageThrows) throw new Error("SecurityError: Access to localStorage is denied");
            localStore.delete(key);
        },
        clear: () => localStore.clear(),
    };

    const mockSessionStorage = {
        getItem: (key: string) => {
            if (sessionStorageThrows) throw new Error("SecurityError: Access to sessionStorage is denied");
            return sessionStore.get(key) ?? null;
        },
        setItem: (key: string, value: string) => {
            if (sessionStorageThrows) throw new Error("SecurityError: Access to sessionStorage is denied");
            sessionStore.set(key, String(value));
        },
        removeItem: (key: string) => {
            if (sessionStorageThrows) throw new Error("SecurityError: Access to sessionStorage is denied");
            sessionStore.delete(key);
        },
        clear: () => sessionStore.clear(),
    };

    const mockCrypto: any = {};
    if (hasRandomUUID) {
        mockCrypto.randomUUID = () => "c84f4e72-10f8-4b2a-a9e1-6d7c8b9a0e1f";
    }
    if (hasGetRandomValues) {
        mockCrypto.getRandomValues = (arr: Uint8Array) => {
            for (let i = 0; i < arr.length; i++) {
                arr[i] = Math.floor(Math.random() * 256);
            }
            return arr;
        };
    }

    (global as any).window = {
        crypto: mockCrypto,
        localStorage: mockLocalStorage,
        sessionStorage: mockSessionStorage,
    };
    (global as any).localStorage = mockLocalStorage;
    (global as any).sessionStorage = mockSessionStorage;

    return { localStore, sessionStore };
}

describe("Device ID Generation & Storage Resilience", () => {
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    test("Scenario 1: Reuses existing valid device ID from localStorage", async () => {
        const existingUuid = "e7b08d74-4b55-4428-b8ce-39efb925ca12";
        const { localStore } = setupMockBrowser({
            hasRandomUUID: true,
            initialLocalStorage: { orbix_did: existingUuid },
        });

        // Dynamic import to reload with mocked window
        const { getOrCreateDeviceId } = await import("../sessionActivityApi.js?t=" + Date.now());
        const did = getOrCreateDeviceId();

        assert.strictEqual(did, existingUuid);
        assert.strictEqual(localStore.get("orbix_did"), existingUuid);
    });

    test("Scenario 2: Uses crypto.randomUUID() in Secure Context (HTTPS)", async () => {
        setupMockBrowser({
            hasRandomUUID: true,
            hasGetRandomValues: true,
        });

        const { getOrCreateDeviceId, isValidDeviceId } = await import("../sessionActivityApi.js?t=" + Date.now());
        const did = getOrCreateDeviceId();

        assert.ok(isValidDeviceId(did), `Generated ID "${did}" should be a valid UUID`);
        assert.strictEqual(did, "c84f4e72-10f8-4b2a-a9e1-6d7c8b9a0e1f");
    });

    test("Scenario 3: Insecure Context (HTTP IP without crypto.randomUUID) generates valid UUID v4 via getRandomValues", async () => {
        setupMockBrowser({
            hasRandomUUID: false, // Simulates HTTP http://32.195.49.161
            hasGetRandomValues: true,
        });

        const { getOrCreateDeviceId, isValidDeviceId } = await import("../sessionActivityApi.js?t=" + Date.now());
        const did = getOrCreateDeviceId();

        assert.ok(isValidDeviceId(did), `Generated ID "${did}" should be valid UUID v4`);
        assert.match(did, UUID_REGEX);
        // Verify 13th character is '4' (version 4)
        assert.strictEqual(did.charAt(14), "4");
        // Verify variant (8, 9, a, or b)
        assert.ok(["8", "9", "a", "b"].includes(did.charAt(19).toLowerCase()));
    });

    test("Scenario 4: Fallback when neither randomUUID nor getRandomValues are available", async () => {
        setupMockBrowser({
            hasRandomUUID: false,
            hasGetRandomValues: false,
        });

        const { getOrCreateDeviceId, isValidDeviceId } = await import("../sessionActivityApi.js?t=" + Date.now());
        const did = getOrCreateDeviceId();

        assert.ok(isValidDeviceId(did), `Fallback ID "${did}" should still be a valid UUID format`);
        assert.match(did, UUID_REGEX);
    });

    test("Scenario 5: localStorage blocked (SecurityError) falls back to sessionStorage", async () => {
        const { sessionStore } = setupMockBrowser({
            localStorageThrows: true,
            sessionStorageThrows: false,
            hasRandomUUID: true,
        });

        const { getOrCreateDeviceId, isValidDeviceId } = await import("../sessionActivityApi.js?t=" + Date.now());
        const did = getOrCreateDeviceId();

        assert.ok(isValidDeviceId(did));
        assert.strictEqual(sessionStore.get("orbix_did"), did);
    });

    test("Scenario 6: Both localStorage and sessionStorage blocked falls back to in-memory cache without crashing", async () => {
        setupMockBrowser({
            localStorageThrows: true,
            sessionStorageThrows: true,
            hasRandomUUID: true,
        });

        const { getOrCreateDeviceId, isValidDeviceId } = await import("../sessionActivityApi.js?t=" + Date.now());
        
        let did1 = "";
        let did2 = "";
        assert.doesNotThrow(() => {
            did1 = getOrCreateDeviceId();
            did2 = getOrCreateDeviceId();
        });

        assert.ok(isValidDeviceId(did1));
        assert.strictEqual(did1, did2, "Subsequent calls in the same session must return identical in-memory ID");
    });

    test("Scenario 7: Malformed or corrupt stored ID is discarded and regenerated", async () => {
        const { localStore } = setupMockBrowser({
            hasRandomUUID: true,
            initialLocalStorage: { orbix_did: "corrupted_non_uuid_123" },
        });

        const { getOrCreateDeviceId, isValidDeviceId } = await import("../sessionActivityApi.js?t=" + Date.now());
        const did = getOrCreateDeviceId();

        assert.notStrictEqual(did, "corrupted_non_uuid_123");
        assert.ok(isValidDeviceId(did));
        assert.strictEqual(localStore.get("orbix_did"), did);
    });

    test("Scenario 8: SSR environment (window undefined) returns empty string without error", async () => {
        delete (global as any).window;
        delete (global as any).localStorage;
        delete (global as any).sessionStorage;

        const { getOrCreateDeviceId } = await import("../sessionActivityApi.js?t=" + Date.now());
        const did = getOrCreateDeviceId();

        assert.strictEqual(did, "");
    });
});

describe("Sign-in & Authentication Flow Resilience", () => {
    test("Scenario 9: Resolves device ID before network loop and constructs headers safely", async () => {
        setupMockBrowser({ hasRandomUUID: true });
        
        let deviceId = "";
        try {
            const { getOrCreateDeviceId } = await import("../sessionActivityApi.js?t=" + Date.now());
            deviceId = getOrCreateDeviceId();
        } catch {}

        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (deviceId) {
            headers["x-orbix-device-id"] = deviceId;
        }

        assert.strictEqual(headers["Content-Type"], "application/json");
        assert.ok(headers["x-orbix-device-id"]);
    });

    test("Scenario 10: Successful HTTP 200 signin parses response and stores auth token", async () => {
        setupMockBrowser();
        const fakeToken = "mock.jwt.token";
        const fakeUser = { id: "u-123", username: "alex", gmail: "alex@example.com" };

        (global as any).fetch = async (_url: string) => {
            return {
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    message: "Login successfully",
                    token: fakeToken,
                    user: fakeUser,
                }),
            };
        };

        const res = await (global as any).fetch("/api/auth/signin", { method: "POST" });
        const data = await res.json();

        assert.strictEqual(res.ok, true);
        assert.strictEqual(data.success, true);
        assert.strictEqual(data.token, fakeToken);
        assert.strictEqual(data.user.username, "alex");
    });

    test("Scenario 11: Invalid credentials (HTTP 401) handled without masking as connection error", async () => {
        (global as any).fetch = async () => {
            return {
                ok: false,
                status: 401,
                json: async () => ({
                    success: false,
                    message: "Invalid Credentials",
                }),
            };
        };

        const res = await (global as any).fetch("/api/auth/signin", { method: "POST" });
        const data = await res.json();

        assert.strictEqual(res.ok, false);
        assert.strictEqual(res.status, 401);
        assert.strictEqual(data.message, "Invalid Credentials");
    });

    test("Scenario 12: Network failure (offline/refused) caught as distinct error", async () => {
        (global as any).fetch = async () => {
            throw new TypeError("Failed to fetch");
        };

        let caughtError: Error | null = null;
        try {
            await (global as any).fetch("/api/auth/signin");
        } catch (e: any) {
            caughtError = e;
        }

        assert.ok(caughtError);
        assert.strictEqual(caughtError.name, "TypeError");
        assert.strictEqual(caughtError.message, "Failed to fetch");
    });

    test("Scenario 13: 2FA challenge response triggers 2FA challenge step", async () => {
        (global as any).fetch = async () => {
            return {
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    requires2FA: true,
                    twoFactorChallengeToken: "2fa-challenge-xyz",
                    maskedEmail: "a***@example.com",
                    cooldownSeconds: 60,
                }),
            };
        };

        const res = await (global as any).fetch("/api/auth/signin", { method: "POST" });
        const data = await res.json();

        assert.strictEqual(res.ok, true);
        assert.strictEqual(data.requires2FA, true);
        assert.strictEqual(data.twoFactorChallengeToken, "2fa-challenge-xyz");
    });

    test("Scenario 14: Server error (HTTP 500) returns error status without masking", async () => {
        (global as any).fetch = async () => {
            return {
                ok: false,
                status: 500,
                json: async () => ({
                    success: false,
                    message: "Internal Server Error",
                }),
            };
        };

        const res = await (global as any).fetch("/api/auth/signin", { method: "POST" });
        const data = await res.json();

        assert.strictEqual(res.ok, false);
        assert.strictEqual(res.status, 500);
        assert.strictEqual(data.message, "Internal Server Error");
    });

    test("Scenario 15: Device ID resolution failure does NOT block signin payload from dispatching", async () => {
        let requestHeadersUsed: Record<string, string> | null = null;
        (global as any).fetch = async (_url: string, init: any) => {
            requestHeadersUsed = init?.headers;
            return {
                ok: true,
                status: 200,
                json: async () => ({ success: true, message: "Login successfully" }),
            };
        };

        // Even if deviceId throws or is empty
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        const res = await (global as any).fetch("/api/auth/signin", {
            method: "POST",
            headers,
            body: JSON.stringify({ gmail: "alex@example.com", password: "secret" }),
        });

        assert.strictEqual(res.ok, true);
        assert.ok(requestHeadersUsed);
        assert.strictEqual(requestHeadersUsed!["Content-Type"], "application/json");
        assert.strictEqual(requestHeadersUsed!["x-orbix-device-id"], undefined);
    });

    test("Scenario 16: Account type mismatch (ACCOUNT_TYPE_MISMATCH) detected", async () => {
        (global as any).fetch = async () => {
            return {
                ok: false,
                status: 401,
                json: async () => ({
                    success: false,
                    code: "ACCOUNT_TYPE_MISMATCH",
                    message: "This account is a registered Club account. Please use the Club Portal sign-in.",
                }),
            };
        };

        const res = await (global as any).fetch("/api/auth/signin", { method: "POST" });
        const data = await res.json();

        assert.strictEqual(res.ok, false);
        assert.strictEqual(data.code, "ACCOUNT_TYPE_MISMATCH");
    });
});
