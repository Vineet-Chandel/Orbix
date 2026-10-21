import redis from "../client.js";

export interface IUserDetails {
    id: string;
    firstName: string;
    middleName: string | undefined;
    lastName: string;
    gmail: string;
    username: string;
    password_hash?: string;
    termsAccepted: boolean | string;
}

const CACHE_TTL = 24 * 60 * 60; // 1 day

const userDetailsCache = async (user: IUserDetails) => {
    try {
        if (!user.gmail) return;
        const key = `auth:user:gmail:${user.gmail}`;
        await redis.hset(key, {
            id: user.id,
            firstName: user.firstName,
            middleName: user.middleName ?? "",
            lastName: user.lastName,
            gmail: user.gmail,
            username: user.username,
            password_hash: user.password_hash ?? "",
            termsAccepted: String(user.termsAccepted)
        });
        await redis.expire(key, CACHE_TTL);
    } catch (err: any) {
        console.warn("[Redis Cache] Failed to cache user details:", err?.message || err);
    }
};

const getUserDetailsCache = async (gmail: string): Promise<IUserDetails | null> => {
    try {
        if (!gmail) return null;
        const key = `auth:user:gmail:${gmail}`;

        const user = await redis.hgetall(key);
        if (!user || Object.keys(user).length === 0) {
            return null;
        }
        return {
            ...(user as any),
            termsAccepted: user.termsAccepted === "true"
        } as IUserDetails;
    } catch (err: any) {
        console.warn("[Redis Cache] Failed to get user details from cache:", err?.message || err);
        return null;
    }
};

const deleteUserDetailsCache = async (gmail: string) => {
    try {
        const key = `auth:user:gmail:${gmail}`;

        await redis.del(key);
    } catch (err: any) {
        throw new Error("Key not founded")
    }
};

export {
    userDetailsCache,
    getUserDetailsCache,
    deleteUserDetailsCache
};