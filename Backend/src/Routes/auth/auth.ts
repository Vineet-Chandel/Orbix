import express, { type Request, type Response } from 'express';
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import SignupValidator, { ValidationError } from '../../validators/SignupValidator.js';
import { query } from "../../database/client.js"
import SigninValidator from '../../validators/SigninValidator.js';
import { failsOccursSignin, failsOccursSignup, resetSigninFailures, getFailures } from '../../redis/rate-limiters/rate-limiters-auth.js';
import { getUserDetailsCache, userDetailsCache } from '../../redis/cache/cache-auth.js';
const authRouter = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error("FATAL: JWT_SECRET is not configured");
    process.exit(1);
}



authRouter.post('/signup', async (req: Request, res: Response) => {
    try {
        // Rate Limiting
        const ip = req.ip || "unknown";
        const attempts = await failsOccursSignup({ ip });
        if (attempts > 5) {
            return res.status(429).json({ success: false, message: "Too many signup attempts. Please try again later." });
        }

        // Validate Data
        const validatedData = SignupValidator(req.body);

        // Hash Password AFTER validation
        const hashedPassword = await bcrypt.hash(validatedData.password, 10);

        // 1. Insert into Database FIRST
        const result = await query(
            `
                INSERT INTO users (
                username,
                firstName,
                middleName,
                lastName,
                email,
                password,
                termsAccepted
            )  VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [
                validatedData.username,
                validatedData.firstName,
                validatedData.middleName || null,
                validatedData.lastName,
                validatedData.gmail,
                hashedPassword,
                validatedData.termsAccepted
            ]
        );

        // 2. Generate JWT ONLY IF Insert succeeds
        const token = jwt.sign(
            {
                gmail: validatedData.gmail,
                username: validatedData.username
            },
            JWT_SECRET,
            {
                expiresIn: "8h", // Aligned with cookie expiration
                issuer: "orbix",
                audience: "orbix-users"
            }
        );

        // 3. Set Cookie
        res.cookie("token", token, {
            httpOnly: true,
            // secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 8 * 60 * 60 * 1000 // 8 hours
        });

        // 4. Return Success
        return res.status(201).json({
            success: true,
            message: 'Account registered successfully!'
        });

    } catch (err: any) {
        // Handle Validation Errors cleanly
        if (err instanceof ValidationError) {
            return res.status(400).json({
                success: false,
                message: err.message
            });
        }

        // Handle Postgres Unique Constraint Violation
        if (err.code === '23505') {
            return res.status(409).json({
                success: false,
                message: 'Username or email already exists!'
            });
        }

        // Log actual error on server, but DO NOT leak to client
        console.error("Signup Internal Error:", err);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
})

authRouter.post('/signin', async (req: Request, res: Response) => {
    try {

        // -- Validation of the data from the request payload of the API 
        const validatedData = SigninValidator(req.body);


        // -- Rate Limiting
        const failures = await getFailures({
            email: validatedData.gmail,
            ip: req.ip || "unknown",
        });

        if (failures >= 10) {
            return res.status(429).json({
                success: false,
                message: "Too many failed attempts. Please try again later."
            });
        }


        // -- Caching with the redis 
        let user = await getUserDetailsCache(validatedData.gmail);

        if (!user) {
            // -- if the cache doesn't found -> query from the DB 
            const Result = await query(
                `SELECT
                id,
                firstName,
                middleName,
                lastName,
                email AS gmail,
                username,
                password AS password_hash,
                termsAccepted
            FROM users
            WHERE email = $1 OR username = $1
            LIMIT 1;`,
                [validatedData.gmail]
            );
            user = Result.rows[0];
            if (!user) {
                // Prevent timing attacks by running a dummy bcrypt compare
                // 10 rounds hash of empty string: "$2b$10$xyz..."
                await bcrypt.compare("dummy", "$2b$10$XN4E5x6gT3x7l3eUaR9UOuQYx8wO1bU1Jv3bT6D2p7t3Z6U1q9F4W");
                const failures = await failsOccursSignin({ email: validatedData.gmail, ip: req.ip || "unknown" })
                return res.status(401).json({
                    success: false,
                    message: "Invalid Credentials"
                });
            }
        }

        // -- Password verification
        const isPasswordValid = await bcrypt.compare(validatedData.password, user.password_hash);

        if (!isPasswordValid) {

            const failures = await failsOccursSignin({ email: validatedData.gmail, ip: req.ip || "unknown" })
            return res.status(401).json({
                success: false,
                message: "Invalid Credentials"
            });
        }

        // Generate JWT Session
        const token = jwt.sign(
            {
                sub: user.id,
                gmail: user.gmail,
                username: user.username
            },
            JWT_SECRET,
            {
                expiresIn: "8h",
                issuer: "orbix",
                audience: "orbix-users"
            }
        );

        // Set Cookie
        res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 8 * 60 * 60 * 1000 // 8 hours
        });

        // Strip password_hash before returning user
        const { password_hash, ...safeUser } = user;
        await resetSigninFailures({ email: validatedData.gmail, ip: req.ip || "unknown" })

        await userDetailsCache({ id: user.id, firstName: user.firstName, middleName: user.middleName, lastName: user.lastName, gmail: user.gmail, username: user.username, password_hash, termsAccepted: user.termsAccepted });
        return res.status(200).json({
            success: true, // FIXED: was previously false on success
            message: "Login successfully",
            user: safeUser
        });

    } catch (err: any) {
        if (err instanceof ValidationError) {
            return res.status(400).json({
                success: false,
                message: err.message
            });
        }

        console.error("Signin Internal Error:", err);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});


export default authRouter;