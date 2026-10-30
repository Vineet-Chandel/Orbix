import redis from "../client.js";

export interface IUserDetails {
    id: string;
    firstName: string;
    middleName?: string | undefined;
    lastName: string;
    gmail: string;
    username: string;
    password_hash?: string;
    termsAccepted: boolean | string;
    firstname?: string;
    middlename?: string;
    lastname?: string;
    termsaccepted?: boolean | string;
    accountType?: string;
    account_type?: string;
}

const CACHE_TTL = 24 * 60 * 60; // 1 day

const userDetailsCache = async (user: IUserDetails) => {
    try {
        if (!redis || redis.status !== "ready") return;
        if (!user || !user.gmail) return;
        const normalizedGmail = user.gmail.toLowerCase().trim();
        const key = `auth:user:gmail:${normalizedGmail}`;

        const dataToSet: Record<string, string> = {
            id: user.id || "",
            firstName: user.firstName || user.firstname || "",
            middleName: user.middleName || user.middlename || "",
            lastName: user.lastName || user.lastname || "",
            gmail: normalizedGmail,
            username: user.username || "",
            termsAccepted: String(user.termsAccepted ?? user.termsaccepted ?? false),
            accountType: user.accountType || user.account_type || "personal",
            account_type: user.accountType || user.account_type || "personal",
        };

        // Only store password_hash if a valid non-empty hash is provided (e.g., bcrypt hash)
        // Never overwrite an existing hash with an empty string
        if (user.password_hash && typeof user.password_hash === "string" && user.password_hash.trim().length >= 20) {
            dataToSet.password_hash = user.password_hash.trim();
        }

        const promises: Promise<any>[] = [
            redis.hset(key, dataToSet),
            redis.expire(key, CACHE_TTL),
        ];

        if (user.id) {
            promises.push(redis.set(`auth:user:id:${user.id}`, normalizedGmail, "EX", CACHE_TTL));
        }
        if (user.username) {
            promises.push(redis.set(`auth:user:username:${user.username.toLowerCase().trim()}`, normalizedGmail, "EX", CACHE_TTL));
        }

        await Promise.allSettled(promises);
    } catch (err: any) {
        console.warn("[Redis Cache] Failed to cache user details:", err?.message || err);
    }
};

const getUserDetailsCache = async (identifier: string): Promise<IUserDetails | null> => {
    try {
        if (!redis || redis.status !== "ready") return null;
        if (!identifier) return null;
        const clean = identifier.toLowerCase().trim();
        let targetGmail = clean;

        if (!clean.includes("@")) {
            // Identifier is username or UUID, look up email mapping first
            const mappedEmail = (await redis.get(`auth:user:username:${clean}`)) || (await redis.get(`auth:user:id:${clean}`));
            if (mappedEmail) {
                targetGmail = mappedEmail.toLowerCase().trim();
            }
        }

        const key = `auth:user:gmail:${targetGmail}`;
        const user = await redis.hgetall(key);
        if (!user || Object.keys(user).length === 0) {
            return null;
        }

        const firstName = user.firstName || user.firstname || "";
        const middleName = user.middleName || user.middlename || "";
        const lastName = user.lastName || user.lastname || "";
        const termsAccepted = user.termsAccepted === "true" || user.termsaccepted === "true";
        const accountType = user.accountType || user.account_type || "personal";

        return {
            ...(user as any),
            id: user.id || "",
            firstName,
            middleName,
            lastName,
            firstname: firstName,
            middlename: middleName,
            lastname: lastName,
            gmail: user.gmail || targetGmail,
            username: user.username || "",
            password_hash: user.password_hash || "",
            termsAccepted,
            termsaccepted: termsAccepted,
            accountType,
            account_type: accountType,
        } as IUserDetails;
    } catch (err: any) {
        console.warn("[Redis Cache] Failed to get user details from cache:", err?.message || err);
        return null;
    }
};

const deleteUserDetailsCache = async (identifier: string) => {
    try {
        if (!redis || redis.status !== "ready") return;
        if (!identifier) return;
        const clean = identifier.toLowerCase().trim();
        const promises: Promise<any>[] = [redis.del(`auth:user:gmail:${clean}`)];

        if (!clean.includes("@")) {
            promises.push(redis.del(`auth:user:username:${clean}`));
            promises.push(redis.del(`auth:user:id:${clean}`));
        } else {
            // Also attempt to clear username index if stored
            const cachedUser = await redis.hgetall(`auth:user:gmail:${clean}`);
            if (cachedUser?.username) {
                promises.push(redis.del(`auth:user:username:${cachedUser.username.toLowerCase().trim()}`));
            }
            if (cachedUser?.id) {
                promises.push(redis.del(`auth:user:id:${cachedUser.id}`));
            }
        }

        await Promise.allSettled(promises);
    } catch (err: any) {
        console.warn("[Redis Cache] Failed to delete user details cache:", err?.message || err);
    }
};

export {
    userDetailsCache,
    getUserDetailsCache,
    deleteUserDetailsCache
};
