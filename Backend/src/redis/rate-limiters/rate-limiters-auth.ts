import redis from "../client.js";
interface Iidentity {
    email: string,
    ip: string
}

const failsOccursSignin = async ({ email, ip }: Iidentity) => {
    const key = `auth:signin:fail:${email}:${ip}`;
    const multi = redis.multi();
    multi.incr(key);
    multi.ttl(key);
    const results = await multi.exec();
    
    if (!results) return 1;

    const failures = results[0]?.[1] as number;
    const ttl = results[1]?.[1] as number;

    if (ttl === -1) {
        await redis.expire(key, 15 * 60);
    }
    return failures;
}

const failsOccursSignup = async ({ ip }: { ip: string }) => {
    const key = `auth:signup:fail:${ip}`;
    const multi = redis.multi();
    multi.incr(key);
    multi.ttl(key);
    const results = await multi.exec();
    
    if (!results) return 1;

    const attempts = results[0]?.[1] as number;
    const ttl = results[1]?.[1] as number;

    if (ttl === -1) {
        await redis.expire(key, 60 * 60); // 1 hour for signup limit
    }
    return attempts;
}

const resetSigninFailures = async ({ email, ip }: Iidentity) => {
    const key = `auth:signin:fail:${email}:${ip}`;
    await redis.del(key);
}

const getFailures = async ({ email, ip }: Iidentity) => {
    const key = `auth:signin:fail:${email}:${ip}`;
    const failures = await redis.get(key);
    return failures ? parseInt(failures, 10) : 0;
}

export {
    failsOccursSignin,
    failsOccursSignup,
    resetSigninFailures,
    getFailures
};