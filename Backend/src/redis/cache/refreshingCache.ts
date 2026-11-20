import { withCacheBudget } from "./withCacheBudget.js";

interface CacheClient {
    status: string;
    get(key: string): Promise<string | null>;
    set(key: string, value: string, mode: "EX", ttl: number): Promise<unknown>;
}
interface Entry<T> { data: T; fetchedAt: number }

/** For PUBLIC external feeds only. Never use stale data for permissions or sessions. */
export function createRefreshingCache<T>(client: CacheClient, options: {
    freshMs: number; staleMs: number; minRefreshMs?: number; now?: () => number;
}) {
    const entries = new Map<string, Entry<T>>();
    const pending = new Map<string, Promise<T>>();
    const now = options.now || Date.now;

    function refresh(key: string, load: () => Promise<T>): Promise<T> {
        const existing = pending.get(key);
        if (existing) return existing;
        const task = Promise.resolve().then(load).then((data) => {
            const entry = { data, fetchedAt: now() };
            entries.delete(key);
            entries.set(key, entry);
            if (entries.size > 24) entries.delete(entries.keys().next().value!);
            if (client.status === "ready") {
                void client.set(key, JSON.stringify(entry), "EX", Math.ceil(options.staleMs / 1000)).catch(() => undefined);
            }
            return data;
        }).finally(() => { pending.delete(key); });
        pending.set(key, task);
        return task;
    }

    return async (key: string, load: () => Promise<T>, force = false): Promise<T> => {
        let entry = entries.get(key);
        if (!entry && client.status === "ready") {
            const raw = await withCacheBudget(() => client.get(key));
            if (raw) {
                try {
                    const parsed = JSON.parse(raw);
                    if (parsed && typeof parsed.fetchedAt === "number" && "data" in parsed) entry = parsed;
                } catch { /* Corrupt entries are misses. */ }
            }
        }
        if (entry) {
            entries.set(key, entry);
            const age = now() - entry.fetchedAt;
            // Public refresh parameters cannot force a fetch on every request.
            if (age >= 0 && age < (force ? (options.minRefreshMs ?? 30_000) : options.freshMs)) return entry.data;
            if (!force && age >= 0 && age < options.staleMs) {
                void refresh(key, load).catch(() => undefined);
                return entry.data;
            }
        }
        return refresh(key, load);
    };
}
