require('dotenv').config();
const Redis = require('ioredis');

console.log("Host:", process.env.REDIS_HOST);
console.log("Port:", process.env.REDIS_PORT);

const redis = new Redis({
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379,
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
    connectTimeout: 5000,
});

redis.on("connect", () => {
    console.log("Redis connected!");
    process.exit(0);
});

redis.on("error", (err) => {
    console.error("Redis error:", err);
    process.exit(1);
});
