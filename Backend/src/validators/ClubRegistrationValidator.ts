import validator from "validator";
import { ValidationError } from "./SignupValidator.js";

export const VALID_CLUB_CATEGORIES = [
    "coding",
    "technology",
    "ai_ml",
    "robotics",
    "entrepreneurship",
    "cultural",
    "sports",
    "other",
] as const;

export type ClubCategory = (typeof VALID_CLUB_CATEGORIES)[number];

export interface ClubRegistrationInput {
    // Club info
    clubName: string;
    collegeName: string;
    collegeCity: string;
    collegeState: string;
    collegeCountry?: string;
    clubCategory: string;
    clubDescription?: string;

    // Representative info
    contactPersonName: string;
    contactPersonRole: string;
    contactEmail: string;
    collegeOfficialEmail?: string;
    contactPhone?: string;

    // Verification references
    collegeWebsiteUrl?: string;
    clubWebsiteUrl?: string;
    clubSocialUrl?: string;

    // Account credentials
    username: string;
    password: string;
    confirmPassword?: string;

    // Consent
    termsAccepted: boolean;
    privacyPolicyAccepted: boolean;
}

export interface ValidatedClubRegistrationData {
    clubName: string;
    collegeName: string;
    collegeCity: string;
    collegeState: string;
    collegeCountry: string;
    clubCategory: ClubCategory;
    clubDescription: string | null;

    contactPersonName: string;
    contactPersonRole: string;
    contactEmail: string;
    collegeOfficialEmail: string | null;
    contactPhone: string | null;

    collegeWebsiteUrl: string | null;
    clubWebsiteUrl: string | null;
    clubSocialUrl: string | null;

    username: string;
    password: string;

    termsAccepted: boolean;
    privacyPolicyAccepted: boolean;
}

const URL_REGEX = /^https?:\/\/.+/i;

export default function ClubRegistrationValidator(data: any): ValidatedClubRegistrationData {
    if (!data || typeof data !== "object") {
        throw new ValidationError("Invalid registration payload.");
    }

    // 1. Legal Consent
    if (data.termsAccepted !== true) {
        throw new ValidationError("You must accept the Terms of Service.");
    }
    if (data.privacyPolicyAccepted !== true) {
        throw new ValidationError("You must accept the Privacy Policy.");
    }

    // 2. Club Identity
    const clubName = typeof data.clubName === "string" ? data.clubName.trim() : "";
    if (!clubName || clubName.length < 2 || clubName.length > 120) {
        throw new ValidationError("Club name is required and must be between 2 and 120 characters.");
    }

    const collegeName = typeof data.collegeName === "string" ? data.collegeName.trim() : "";
    if (!collegeName || collegeName.length < 2 || collegeName.length > 200) {
        throw new ValidationError("College / University name is required and must be between 2 and 200 characters.");
    }

    const collegeCity = typeof data.collegeCity === "string" ? data.collegeCity.trim() : "";
    if (!collegeCity) {
        throw new ValidationError("College city is required.");
    }

    const collegeState = typeof data.collegeState === "string" ? data.collegeState.trim() : "";
    if (!collegeState) {
        throw new ValidationError("College state / region is required.");
    }

    const collegeCountry = typeof data.collegeCountry === "string" && data.collegeCountry.trim()
        ? data.collegeCountry.trim()
        : "India";

    const rawCat = typeof data.clubCategory === "string" ? data.clubCategory.trim().toLowerCase() : "";
    const CATEGORY_MAP: Record<string, ClubCategory> = {
        coding: "coding",
        "coding and competitive programming": "coding",
        technology: "technology",
        tech: "technology",
        ai_ml: "ai_ml",
        "ai / machine learning": "ai_ml",
        "ai/ml": "ai_ml",
        robotics: "robotics",
        entrepreneurship: "entrepreneurship",
        cultural: "cultural",
        sports: "sports",
        other: "other",
    };
    const clubCategory = CATEGORY_MAP[rawCat] || (VALID_CLUB_CATEGORIES.includes(rawCat as ClubCategory) ? (rawCat as ClubCategory) : null);
    if (!clubCategory) {
        throw new ValidationError(
            `Club category must be one of: ${VALID_CLUB_CATEGORIES.join(", ")}.`
        );
    }

    const clubDescription = typeof data.clubDescription === "string" && data.clubDescription.trim()
        ? data.clubDescription.trim()
        : null;

    // 3. Representative Info
    const contactPersonName = typeof data.contactPersonName === "string" ? data.contactPersonName.trim() : "";
    if (!contactPersonName || contactPersonName.length < 2 || contactPersonName.length > 100) {
        throw new ValidationError("Representative full name is required (2-100 characters).");
    }

    const contactPersonRole = typeof data.contactPersonRole === "string" ? data.contactPersonRole.trim() : "";
    if (!contactPersonRole || contactPersonRole.length < 2 || contactPersonRole.length > 100) {
        throw new ValidationError("Representative position in club is required.");
    }

    const contactEmail = typeof data.contactEmail === "string" ? data.contactEmail.trim().toLowerCase() : "";
    if (!contactEmail || !validator.isEmail(contactEmail)) {
        throw new ValidationError("A valid primary account email address is required.");
    }

    let collegeOfficialEmail: string | null = null;
    if (typeof data.collegeOfficialEmail === "string" && data.collegeOfficialEmail.trim()) {
        const rawOfficial = data.collegeOfficialEmail.trim().toLowerCase();
        if (!validator.isEmail(rawOfficial)) {
            throw new ValidationError("Official college email must be a valid email format.");
        }
        collegeOfficialEmail = rawOfficial;
    }

    let contactPhone: string | null = null;
    if (typeof data.contactPhone === "string" && data.contactPhone.trim()) {
        const rawPhone = data.contactPhone.trim();
        if (!/^[+0-9\s\-()]{7,20}$/.test(rawPhone)) {
            throw new ValidationError("Please provide a valid phone number.");
        }
        contactPhone = rawPhone;
    }

    // 4. Verification References
    let collegeWebsiteUrl: string | null = null;
    if (typeof data.collegeWebsiteUrl === "string" && data.collegeWebsiteUrl.trim()) {
        const rawUrl = data.collegeWebsiteUrl.trim();
        if (!URL_REGEX.test(rawUrl)) {
            throw new ValidationError("College website URL must start with http:// or https://");
        }
        collegeWebsiteUrl = rawUrl;
    }

    let clubWebsiteUrl: string | null = null;
    if (typeof data.clubWebsiteUrl === "string" && data.clubWebsiteUrl.trim()) {
        const rawUrl = data.clubWebsiteUrl.trim();
        if (!URL_REGEX.test(rawUrl)) {
            throw new ValidationError("Club website URL must start with http:// or https://");
        }
        clubWebsiteUrl = rawUrl;
    }

    let clubSocialUrl: string | null = null;
    if (typeof data.clubSocialUrl === "string" && data.clubSocialUrl.trim()) {
        const rawUrl = data.clubSocialUrl.trim();
        if (!URL_REGEX.test(rawUrl)) {
            throw new ValidationError("Club social profile URL must start with http:// or https://");
        }
        clubSocialUrl = rawUrl;
    }

    // 5. Account Credentials
    const username = typeof data.username === "string" ? data.username.trim().toLowerCase() : "";
    if (!username || !/^[a-z0-9._-]{3,20}$/.test(username)) {
        throw new ValidationError("Username must be 3-20 characters: lowercase letters, numbers, dot, _, or -");
    }

    const password = typeof data.password === "string" ? data.password : "";
    if (!password || password.length < 8) {
        throw new ValidationError("Password must be at least 8 characters long.");
    }
    if (password.length > 128) {
        throw new ValidationError("Password cannot exceed 128 characters.");
    }
    if (!validator.isStrongPassword(password, { minLength: 8, minLowercase: 1, minUppercase: 1, minNumbers: 1, minSymbols: 1 })) {
        throw new ValidationError("Password must contain at least one uppercase letter, one lowercase letter, one number, and one symbol.");
    }

    if (data.confirmPassword !== undefined && data.confirmPassword !== password) {
        throw new ValidationError("Passwords do not match.");
    }

    return {
        clubName,
        collegeName,
        collegeCity,
        collegeState,
        collegeCountry,
        clubCategory,
        clubDescription,

        contactPersonName,
        contactPersonRole,
        contactEmail,
        collegeOfficialEmail,
        contactPhone,

        collegeWebsiteUrl,
        clubWebsiteUrl,
        clubSocialUrl,

        username,
        password,

        termsAccepted: true,
        privacyPolicyAccepted: true,
    };
}
