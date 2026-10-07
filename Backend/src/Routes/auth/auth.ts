import express, { type Request, type Response } from 'express';
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import SignupValidator, { ValidationError } from '../../validators/SignupValidator.js';
import { query } from "../../database/client.js"
import SigninValidator from '../../validators/SigninValidator.js';
const authRouter = express.Router();
interface Iidentity {
    firstName: string,
    middleName: string | undefined,
    lastName: string,
    gmail: string,
    password: string,
    username: string,
    termsAccepted: boolean,
}
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error("FATAL: JWT_SECRET is not configured");
    process.exit(1);
}

authRouter.post('/signup', async (req: Request, res: Response) => {
    try {
        // Validate Data
        const validatedData = SignupValidator(req.body);

        // Hash Password AFTER validation
        const hashedPassword = await bcrypt.hash(validatedData.password, 10);

        // 1. Insert into Database FIRST
        const result = await query(
            `
                INSERT INTO users (
                username,
                first_name,
                middle_name,
                last_name,
                gmail,
                password_hash,
                terms_accepted
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
        const validatedData = SigninValidator(req.body);

        const Result = await query(
            `SELECT
                id,
                first_name,
                middle_name,
                last_name,
                gmail,
                username,
                password_hash
            FROM users
            WHERE gmail = $1 OR username = $1
            LIMIT 1;`, 
            [validatedData.identity]
        );

        const user = Result.rows[0];

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid Credentials"
            });
        }

        const isPasswordValid = await bcrypt.compare(validatedData.password, user.password_hash);

        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: "Invalid Credentials"
            });
        }

        // Generate JWT
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