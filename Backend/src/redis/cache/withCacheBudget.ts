import { setTimeout, clearTimeout } from "node:timers";

/** Cache timeouts are misses. Callers must still validate security state in PostgreSQL. */
export async function withCacheBudget<T>(read: () => Promise<T>, budgetMs = 75): Promise<T | undefined> {
    let cancelTimeout: (() => void) | undefined;
    try {
        return await Promise.race([
            read(),
            new Promise<undefined>((resolve) => {
                const timer = setTimeout(() => resolve(undefined), budgetMs);
                cancelTimeout = () => clearTimeout(timer);
            }),
        ]);
    } catch { return undefined; }
    finally { cancelTimeout?.(); }
}
