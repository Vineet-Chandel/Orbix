interface CacheClient {
    status: string;
    get(key: string): Promise<string | null>;
    set(key: string, value: string, mode: "EX", ttl: number): Promise<unknown>;
}

/** A cache outage must not add Redis reconnect delays to a database request. */
export function createReadThroughCache(client: CacheClient, budgetMs = 75) {
    const inFlight = new Map<string, Promise<unknown>>();
    return async function cached<T>(key: string, ttl: number, load: () => Promise<T>): Promise<T> {
        const pending = inFlight.get(key);
        if (pending) return pending as Promise<T>;
        const task = (async () => {
            if (client.status === "ready") {
                let timer: ReturnType<typeof setTimeout> | undefined;
                try {
                    const value = await Promise.race([
                        client.get(key),
                        new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), budgetMs); }),
                    ]);
                    if (value !== null) return JSON.parse(value) as T;
                } catch { /* Cache misses, invalid JSON and cache errors all fall back to DB. */ }
                finally { if (timer) clearTimeout(timer); }
            }
            const result = await load();
            if (client.status === "ready") {
                void client.set(key, JSON.stringify(result), "EX", ttl).catch(() => undefined);
            }
            return result;
        })();
        inFlight.set(key, task);
        try { return await task; }
        finally { if (inFlight.get(key) === task) inFlight.delete(key); }
    };
}
