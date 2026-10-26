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

        await redis.hset(key, dataToSet);
        await redis.expire(key, CACHE_TTL);
    } catch (err: any) {
        console.warn("[Redis Cache] Failed to cache user details:", err?.message || err);
    }
};

const getUserDetailsCache = async (gmail: string): Promise<IUserDetails | null> => {
    try {
        if (!gmail) return null;
        const normalizedGmail = gmail.toLowerCase().trim();
        const key = `auth:user:gmail:${normalizedGmail}`;

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
            gmail: user.gmail || normalizedGmail,
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

const deleteUserDetailsCache = async (gmail: string) => {
    try {
        if (!gmail) return;
        const normalizedGmail = gmail.toLowerCase().trim();
        const key = `auth:user:gmail:${normalizedGmail}`;

        await redis.del(key);
    } catch (err: any) {
        console.warn("[Redis Cache] Failed to delete user details cache:", err?.message || err);
    }
};

export {
    userDetailsCache,
    getUserDetailsCache,
    deleteUserDetailsCache
};
