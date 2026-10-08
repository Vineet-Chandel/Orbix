import { query } from "./src/database/client.js";
import redis from "./src/redis/client.js";
import express from "express";
import authRouter from "./src/Routes/auth/auth.js";

const app = express();
app.use(express.json());
app.set("trust proxy", true);
app.use("/auth", authRouter);

const PORT = 3456;

app.listen(PORT, async () => {
    console.log("=== RUNNING SECURITY AUDIT TESTS ===");

    // 1. Clear DB and Redis
    await query("DELETE FROM users;");
    await redis.flushall();
    console.log("-> Cleared DB and Redis");

    const req = async (path: string, body: any, headers = {}) => {
        const res = await fetch(`http://localhost:${PORT}${path}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...headers },
            body: JSON.stringify(body)
        });
        const resBody = await res.json();
        if (res.status === 400) console.log("400 Error:", resBody);
        return { status: res.status, body: resBody };
    };

    // 2. Test Signup Rate Limiting
    console.log("\n-> Testing Signup Rate Limiting");
    for (let i = 0; i < 6; i++) {
        await req("/auth/signup", {
            firstName: "John",
            lastName: "Doe",
            gmail: `spam${i}@gmail.com`,
            username: `spam${i}`,
            password: "A3q@9F!zxQ!23!_",
            termsAccepted: true
        });
    }
    const resRateLimitSignup = await req("/auth/signup", {
        firstName: "John",
        lastName: "Doe",
        gmail: `spam6@gmail.com`,
        username: `spam6`,
        password: "A3q@9F!zxQ!23!_",
        termsAccepted: true
    });
    console.log("Signup Rate Limit Status:", resRateLimitSignup.status);

    // 3. Test Normal Signup
    const resSignup = await req("/auth/signup", {
            firstName: "Vineet",
            lastName: "Chandel",
            gmail: "vineet@gmail.com",
            username: "vineet",
            password: "A3q@9F!zxQ!23!_",
            termsAccepted: true
    }, { "X-Forwarded-For": "1.2.3.4" });
    console.log("Signup Status:", resSignup.status);

    // 4. Test Signin (Cache Miss)
    let start = Date.now();
    const resSignin1 = await req("/auth/signin", {
        gmail: "vineet@gmail.com",
        password: "A3q@9F!zxQ!23!_"
    }, { "X-Forwarded-For": "1.2.3.4" });
    console.log("First Signin Time (Cache Miss):", Date.now() - start, "ms", "Status:", resSignin1.status);

    // 5. Test Signin (Cache Hit)
    start = Date.now();
    const resSignin2 = await req("/auth/signin", {
        gmail: "vineet@gmail.com",
        password: "A3q@9F!zxQ!23!_"
    }, { "X-Forwarded-For": "1.2.3.4" });
    console.log("Second Signin Time (Cache Hit):", Date.now() - start, "ms", "Status:", resSignin2.status);

    // 6. Test Normalization
    start = Date.now();
    const resSignin3 = await req("/auth/signin", {
        gmail: "VINEET@gmail.com",
        password: "A3q@9F!zxQ!23!_"
    }, { "X-Forwarded-For": "1.2.3.4" });
    console.log("Third Signin Time (Normalization, Cache Hit):", Date.now() - start, "ms", "Status:", resSignin3.status);

    // 7. Test Nonexistent account timing
    start = Date.now();
    const resSignin4 = await req("/auth/signin", {
        gmail: "nonexistent@gmail.com",
        password: "A3q@9F!zxQ!23!_"
    }, { "X-Forwarded-For": "1.2.3.4" });
    console.log("Nonexistent Signin Time:", Date.now() - start, "ms", "Status:", resSignin4.status);

    // 8. Test Rate Limiting
    for (let i = 0; i < 10; i++) {
        await req("/auth/signin", {
            gmail: "vineet@gmail.com",
            password: "WrongPassword!"
        }, { "X-Forwarded-For": "1.2.3.4" });
    }
    const resSignin5 = await req("/auth/signin", {
        gmail: "vineet@gmail.com",
        password: "WrongPassword!"
    }, { "X-Forwarded-For": "1.2.3.4" });
    console.log("Rate Limit Signin Status:", resSignin5.status);

    // 9. Reset rate limit via successful signin
    const resSignin6 = await req("/auth/signin", {
        gmail: "vineet@gmail.com",
        password: "A3q@9F!zxQ!23!_"
    }, { "X-Forwarded-For": "4.3.2.1" });
    console.log("Signin from new IP Status:", resSignin6.status);

    process.exit(0);
});
