import redis from "../client.js";

interface IUserDetails {
    id: string;
    firstName: string;
    middleName: string | undefined;
    lastName: string;
    gmail: string;
    username: string;
    password_hash: string;
    termsAccepted: boolean | string;
}

const CACHE_TTL = 24 * 60 * 60; // 1 day

const userDetailsCache = async (user: IUserDetails) => {
    const key = `auth:user:gmail:${user.gmail}`;
    await redis.hset(key, {
        id: user.id,
        firstName: user.firstName,
        middleName: user.middleName ?? "",
        lastName: user.lastName,
        gmail: user.gmail,
        username: user.username,
        password_hash: user.password_hash,
        termsAccepted: String(user.termsAccepted)
    });
    await redis.expire(key, CACHE_TTL);
};

const getUserDetailsCache = async (gmail: string) => {
    const key = `auth:user:gmail:${gmail}`;
    const user = await redis.hgetall(key);
    if (Object.keys(user).length === 0) {
        return null;
    }
    return {
        ...user,
        termsAccepted: user.termsAccepted === "true"
    };
};

const deleteUserDetailsCache = async (gmail: string) => {
    const key = `auth:user:gmail:${gmail}`;
    await redis.del(key);
};

export {
    userDetailsCache,
    getUserDetailsCache,
    deleteUserDetailsCache
};