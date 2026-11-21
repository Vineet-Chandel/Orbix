import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { CollegeVerificationService } from "../../services/verification/collegeVerificationService.js";
import { CollegeOcrService } from "../../services/verification/collegeOcrService.js";

const upload = multer({
    storage: multer.memoryStorage(),
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
        const result = await CollegeVerificationService.getStatus(userId);
        return res.status(200).json(result);
    } catch (err: any) {
        console.error("[CollegeVerification] Status fetch error:", err);
        return res.status(500).json({
            success: false,
            message: err.message || "Failed to retrieve college verification status",
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

/**
 * POST /api/verification/college/submit
 * Submits an official college verification application with documents.
 */
studentCollegeVerificationRouter.post(
    "/submit",
    authenticate,
    requireStudentAccount,
    upload.array("documents", 2),
    async (req: Request, res: Response) => {
        try {
            const userId = req.user!.id;

            const rawFiles = req.files as Express.Multer.File[] | undefined;
            if (!rawFiles || rawFiles.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "At least one document image is required.",
                });
            }

            const {
                collegeId,
                documentType = "student_id",
                studentName,
                enrollmentNumber,
                courseName,
                academicYear,
                institutionEmail,
                phoneNumber,
                ocrConfidence = 0,
                extractedData: rawExtractedData,
            } = req.body;

            if (!collegeId) {
                return res.status(400).json({
                    success: false,
                    message: "Selected college ID is required.",
                });
            }

            let parsedExtractedData: any = {};
            if (rawExtractedData) {
                try {
                    parsedExtractedData = typeof rawExtractedData === "string" ? JSON.parse(rawExtractedData) : rawExtractedData;
                } catch {
                    parsedExtractedData = {};
                }
            }

            const files = rawFiles.map((f) => ({
                buffer: f.buffer,
                originalname: f.originalname,
                mimetype: f.mimetype,
                size: f.size,
            }));

            const result = await CollegeVerificationService.submitApplication({
                userId,
                collegeId,
                documentType,
                files,
                extractedData: parsedExtractedData,
                studentName: studentName ? String(studentName).trim() : null,
                enrollmentNumber: enrollmentNumber ? String(enrollmentNumber).trim() : null,
                courseName: courseName ? String(courseName).trim() : null,
                academicYear: academicYear ? String(academicYear).trim() : null,
                institutionEmail: institutionEmail ? String(institutionEmail).trim() : null,
                phoneNumber: phoneNumber ? String(phoneNumber).trim() : null,
                ocrConfidence: Number(ocrConfidence) || 0,
            });

            return res.status(201).json(result);
        } catch (err: any) {
            console.error("[CollegeVerification] Submission error:", err);
            const statusCode = err.statusCode || 500;
            return res.status(statusCode).json({
                success: false,
                message: err.message || "Failed to submit college verification application.",
            });
        }
    }
);

/**
 * POST /api/verification/college/email/send
 * Dispatches an institutional email verification link with domain matching.
 */
studentCollegeVerificationRouter.post("/email/send", authenticate, requireStudentAccount, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;

        const { email, collegeId } = req.body;
        if (!email || !collegeId) {
            return res.status(400).json({
                success: false,
                message: "Both email address and collegeId are required.",
            });
        }

        const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "unknown";
        const userAgent = req.headers["user-agent"] || "unknown";

        const result = await CollegeVerificationService.sendInstitutionalEmailToken({
            userId,
            email,
            collegeId,
            ipAddress: ip,
            userAgent,
        });

        return res.status(200).json(result);
    } catch (err: any) {
        console.error("[CollegeVerification] Send email error:", err);
        const statusCode = err.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: err.message || "Failed to send institutional verification email.",
            cooldownRemainingSeconds: err.cooldownRemainingSeconds || 0,
        });
    }
});

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

/**
 * POST /api/verification/college/phone/send-otp
 * Dispatches an SMS verification OTP to the student's phone.
 */
studentCollegeVerificationRouter.post("/phone/send-otp", authenticate, requireStudentAccount, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;

        const { phone } = req.body;
        if (!phone) {
            return res.status(400).json({ success: false, message: "Phone number is required." });
        }

        const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "unknown";
        const userAgent = req.headers["user-agent"] || "unknown";

        const result = await CollegeVerificationService.sendPhoneOtp({
            userId,
            phone,
            ipAddress: ip,
            userAgent,
        });

        return res.status(200).json(result);
    } catch (err: any) {
        console.error("[CollegeVerification] Phone send OTP error:", err);
        const statusCode = err.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: err.message || "Failed to send SMS verification code.",
            cooldownRemainingSeconds: err.cooldownRemainingSeconds || 0,
        });
    }
});

/**
 * POST /api/verification/college/phone/verify-otp
 * Verifies the 6-digit SMS OTP.
 */
studentCollegeVerificationRouter.post("/phone/verify-otp", authenticate, requireStudentAccount, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;

        const { phone, otp } = req.body;
        if (!phone || !otp) {
            return res.status(400).json({ success: false, message: "Phone number and 6-digit OTP code are required." });
        }

        const result = await CollegeVerificationService.verifyPhoneOtp({
            userId,
            phone,
            otp,
        });

        return res.status(200).json(result);
    } catch (err: any) {
        console.error("[CollegeVerification] Phone verify OTP error:", err);
        const statusCode = err.statusCode || 400;
        return res.status(statusCode).json({
            success: false,
            message: err.message || "Failed to verify phone OTP.",
        });
    }
});
