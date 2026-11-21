import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import { checkVerificationRateLimit } from "../../services/verification/verificationRateLimiter.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { CollegeVerificationService } from "../../services/verification/collegeVerificationService.js";
import { SheerIdVerificationService } from "../../services/verification/sheerIdVerificationService.js";
import { CollegeOcrService } from "../../services/verification/collegeOcrService.js";

const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter: (_req, file, callback) => {
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) return callback(new Error("Use a JPG, PNG or WEBP image."));
        callback(null, true);
    },
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB per document
        files: 2, // At most 2 files (front and back)
    },
});

/**
 * Ensures student college verification endpoints are strictly restricted to authenticated non-club student accounts.
 */
const requireStudentAccount = (req: Request, res: Response, next: NextFunction) => {
    if (!req.user?.id) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    if (req.user.accountType === "club" || req.user.account_type === "club") {
        return res.status(403).json({
            success: false,
            message: "Club accounts use the dedicated club verification workflow and cannot access student college verification.",
        });
    }
    next();
};

export const studentCollegeVerificationRouter = Router();

const limitVerification = (action: string, maximum: number): ((req: Request, res: Response, next: NextFunction) => Promise<void>) => async (req, res, next) => {
    try {
        const limit = await checkVerificationRateLimit(`college:${action}:${req.user!.id}`, 'confirm', maximum, 60);
        if (!limit.allowed) {
            res.setHeader('Retry-After', limit.resetInSeconds);
            res.status(limit.code === 'SERVICE_UNAVAILABLE' ? 503 : 429).json({ success: false,
                message: limit.code === 'SERVICE_UNAVAILABLE' ? 'Verification is temporarily unavailable.' : 'Please wait a moment before trying again.' });
            return;
        }
        next();
    } catch (error) { next(error); }
};


// =========================================================================
// STUDENT COLLEGE VERIFICATION ROUTES
// =========================================================================

/**
 * GET /api/verification/college/status
 * Retrieves current student's college verification status and history.
 */
studentCollegeVerificationRouter.get("/status", authenticate, requireStudentAccount, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const result = await SheerIdVerificationService.status(userId);
        return res.status(200).json(result);
    } catch (err: any) {
        console.error("[CollegeVerification] Status fetch error:", err);
        return res.status(500).json({
            success: false,
            message: "Could not load verification. Please try again later.",
        });
    }
});

/**
 * POST /api/verification/college/ocr-preview
 * Runs isolated OCR on uploaded document image to return structured fields without committing application.
 */
studentCollegeVerificationRouter.post(
    "/ocr-preview",
    authenticate,
    requireStudentAccount,
    limitVerification("ocr", 3),
    upload.single("document"),
    async (req: Request, res: Response) => {
        try {
            const file = req.file;
            if (!file) {
                return res.status(400).json({
                    success: false,
                    message: "Please upload a student ID or ERP screenshot image to scan.",
                });
            }

            const expectedCollegeName = (req.body?.collegeName || "").trim();
            const result = await CollegeOcrService.processDocumentImage(file.buffer, expectedCollegeName);

            return res.status(200).json(result);
        } catch (err: any) {
            console.error("[CollegeVerification] OCR preview error:", err);
            return res.status(500).json({
                success: false,
                confidence: 0,
                error: err.message || "OCR service error",
                extractedFields: {
                    studentName: null,
                    collegeName: null,
                    enrollmentNumber: null,
                    courseName: null,
                    academicYear: null,
                    institutionEmail: null,
                    phoneNumber: null,
                },
            });
        }
    }
);

// Legacy clients cannot bypass provider verification with OCR confidence or uploaded fields.
studentCollegeVerificationRouter.post("/submit", authenticate, requireStudentAccount, (_req, res) =>
    res.status(410).json({ success: false, message: "Please use the new enrollment verification flow." }));
studentCollegeVerificationRouter.post("/email/send", authenticate, requireStudentAccount, (_req, res) =>
    res.status(410).json({ success: false, message: "Continue enrollment verification to complete any required email checks." }));

for (const action of ["session", "refresh"] as const) {
    studentCollegeVerificationRouter.post(`/${action}`, authenticate, requireStudentAccount, limitVerification(action, action === "session" ? 6 : 4), async (req, res) => {
        try {
            const result = action === "session"
                ? await SheerIdVerificationService.start(req.user!.id, req.body || {})
                : await SheerIdVerificationService.refresh(req.user!.id);
            return res.json(result);
        } catch (error: any) {
            if (!error.statusCode) console.error("[CollegeVerification] Provider operation failed");
            return res.status(error.statusCode || 503).json({ success: false,
                message: error.statusCode ? error.message : "Verification is temporarily unavailable. Please try again." });
        }
    });
}

/**
 * GET & POST /api/verification/college/email/verify
 * Validates the single-use institutional email token strictly for the authenticated owner.
 */
const handleEmailTokenVerification = async (req: Request, res: Response) => {
    try {
        const token = (req.query.token as string) || req.body?.token;
        if (!token) {
            return res.status(400).json({ success: false, message: "Verification token is required." });
        }

        const userId = req.user!.id;
        const verificationId = (req.query.verificationId as string) || req.body?.verificationId;
        const result = await CollegeVerificationService.verifyInstitutionalEmailToken(token, userId, verificationId);

        return res.status(200).json(result);
    } catch (err: any) {
        console.error("[CollegeVerification] Token verification error:", err);
        const statusCode = err.statusCode || 400;
        return res.status(statusCode).json({
            success: false,
            message: err.message || "Email verification failed or link has expired.",
        });
    }
};

studentCollegeVerificationRouter.get("/email/verify", authenticate, requireStudentAccount, handleEmailTokenVerification);
studentCollegeVerificationRouter.post("/email/verify", authenticate, requireStudentAccount, handleEmailTokenVerification);

// Mobile verification is not supported. Keep explicit retirement responses for older clients.
for (const path of ["/phone/send-otp", "/phone/verify-otp"]) {
    studentCollegeVerificationRouter.post(path, authenticate, requireStudentAccount, (_req, res) =>
        res.status(410).json({ success: false, message: "Phone verification has been removed. Use email verification." }));
}
