import redis from "../client.js";

interface Iidentity {
    email: string;
    ip: string;
}

const failsOccursSignin = async ({ email, ip }: Iidentity) => {
    try {
        if (!redis || redis.status !== "ready") return 1;
        const key = `auth:signin:fail:${email.toLowerCase().trim()}:${ip}`;
        const multi = redis.multi();
        multi.incr(key);
        multi.ttl(key);
        const results = await multi.exec();

        if (!results) return 1;

        const failures = (results[0]?.[1] as number) || 1;
        const ttl = (results[1]?.[1] as number) || -1;

        if (ttl === -1) {
            await redis.expire(key, 15 * 60).catch(() => {});
        }
        return failures;
    } catch (err: any) {
        console.warn("[Redis RateLimiter] failsOccursSignin error:", err?.message || err);
        return 1;
    }
};

const failsOccursSignup = async ({ ip }: { ip: string }) => {
    try {
        if (!redis || redis.status !== "ready") return 1;
        const key = `auth:signup:fail:${ip}`;
        const multi = redis.multi();
        multi.incr(key);
        multi.ttl(key);
        const results = await multi.exec();

        if (!results) return 1;

        const attempts = (results[0]?.[1] as number) || 1;
        const ttl = (results[1]?.[1] as number) || -1;

        if (ttl === -1) {
            await redis.expire(key, 60 * 60).catch(() => {}); // 1 hour for signup limit
        }
        return attempts;
    } catch (err: any) {
        console.warn("[Redis RateLimiter] failsOccursSignup error:", err?.message || err);
        return 1;
    }
};

const resetSigninFailures = async ({ email, ip }: Iidentity) => {
    try {
        if (!redis || redis.status !== "ready") return;
        const key = `auth:signin:fail:${email.toLowerCase().trim()}:${ip}`;
        await redis.del(key);
    } catch (err: any) {
        console.warn("[Redis RateLimiter] resetSigninFailures error:", err?.message || err);
    }
};

const getFailures = async ({ email, ip }: Iidentity) => {
    try {
        if (!redis || redis.status !== "ready") return 0;
        const key = `auth:signin:fail:${email.toLowerCase().trim()}:${ip}`;
        const failures = await redis.get(key);
        return failures ? parseInt(failures, 10) : 0;
    } catch (err: any) {
        console.warn("[Redis RateLimiter] getFailures error:", err?.message || err);
        return 0;
    }
};

export {
    failsOccursSignin,
    failsOccursSignup,
    resetSigninFailures,
    getFailures
};