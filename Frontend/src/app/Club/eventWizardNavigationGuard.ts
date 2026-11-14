/**
 * ORBIX — Create New Club Event: Sequential Step Navigation Guard & Validation
 *
 * Core rule: A user must complete all required fields in the preceding steps
 * before accessing any subsequent step.
 * Backward navigation (targetStep <= currentStep) is always unrestricted.
 */

export interface FormValidationState {
    title: string;
    startsAt: string;
    endsAt?: string;
    registrationUrl?: string;
    locationType?: string;
    venueOrLocation?: string;
    status?: string;
    isTeamEvent?: boolean;
    minTeamSize?: number;
    maxTeamSize?: number;
    coverImageUrl?: string;
}

export interface FormErrors {
    title?: string;
    startsAt?: string;
    endsAt?: string;
    registrationUrl?: string;
    venueOrLocation?: string;
    teamSize?: string;
}

export interface WizardNavigationState {
    form: FormValidationState;
    stages: Array<unknown>;
    totalQuestions: number;
    isUploadingBanner?: boolean;
}

export interface StepValidationResult {
    isValid: boolean;
    errorMessage?: string;
    errors?: FormErrors;
}

export interface NavigationGuardResult {
    allowed: boolean;
    targetStep: number;
    blockingStep?: number;
    errorMessage?: string;
    step1Errors?: FormErrors;
}

export const URL_REGEX = /^(https?:\/\/)([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?(\?.*)?$/i;

/**
 * Validates Step 1: Event Information & Schedule
 */
export const validateStep1 = (currentForm: FormValidationState): StepValidationResult => {
    const errs: FormErrors = {};

    // 1. Title validation
    const trimmedTitle = currentForm.title?.trim() || "";
    if (!trimmedTitle) {
        errs.title = "Event title is required.";
    } else if (trimmedTitle.length < 3) {
        errs.title = "Title must be at least 3 characters.";
    } else if (trimmedTitle.length > 120) {
        errs.title = "Title cannot exceed 120 characters.";
    }

    // 2. Starts At validation
    if (!currentForm.startsAt) {
        errs.startsAt = "Event start date and time is required.";
    } else {
        const startDate = new Date(currentForm.startsAt);
        if (isNaN(startDate.getTime())) {
            errs.startsAt = "Please enter a valid start date and time.";
        }
    }

    // 3. Ends At validation
    if (currentForm.endsAt) {
        const endDate = new Date(currentForm.endsAt);
        if (isNaN(endDate.getTime())) {
            errs.endsAt = "Please enter a valid end date and time.";
        } else if (currentForm.startsAt) {
            const startDate = new Date(currentForm.startsAt);
            if (!isNaN(startDate.getTime()) && endDate.getTime() <= startDate.getTime()) {
                errs.endsAt = "End date and time must be strictly after the start date and time.";
            }
        }
    }

    // 4. Registration URL validation
    if (currentForm.registrationUrl && currentForm.registrationUrl.trim()) {
        const regUrl = currentForm.registrationUrl.trim();
        if (!URL_REGEX.test(regUrl)) {
            errs.registrationUrl = "Must be a valid URL starting with http:// or https:// (e.g. https://forms.gle/...)";
        }
    }

    // 5. Venue or Location details validation for in_person / hybrid when published
    if (currentForm.status === "published" && (currentForm.locationType === "in_person" || currentForm.locationType === "hybrid")) {
        if (!currentForm.venueOrLocation || !currentForm.venueOrLocation.trim()) {
            errs.venueOrLocation = "Venue / campus room is recommended for published in-person sessions.";
        }
    }

    // 6. Team size validation if team event enabled
    if (currentForm.isTeamEvent) {
        const min = Number(currentForm.minTeamSize) || 1;
        const max = Number(currentForm.maxTeamSize) || 4;
        if (min < 1) {
            errs.teamSize = "Minimum team size must be at least 1.";
        } else if (max < min) {
            errs.teamSize = `Maximum team size cannot be smaller than minimum (${min}).`;
        } else if (max > 50) {
            errs.teamSize = "Maximum team size cannot exceed 50.";
        }
    }

    const firstError =
        errs.title ||
        errs.startsAt ||
        errs.endsAt ||
        errs.registrationUrl ||
        errs.teamSize;

    return {
        isValid: !firstError,
        errorMessage: firstError || undefined,
        errors: errs,
    };
};

/**
 * Validates Step 2: Timeline & Stage Architecture
 */
export const validateStep2 = (stages?: Array<unknown> | null): StepValidationResult => {
    if (!stages || stages.length === 0) {
        return {
            isValid: false,
            errorMessage: "Please configure at least 1 round/stage in your timeline.",
        };
    }
    return { isValid: true };
};

/**
 * Validates Step 3: Registration Form Builder
 */
export const validateStep3 = (totalQuestions: number): StepValidationResult => {
    if (totalQuestions <= 0) {
        return {
            isValid: false,
            errorMessage: "The registration form cannot be empty. Please include at least 1 question for participants.",
        };
    }
    return { isValid: true };
};

/**
 * Validates Step 4: Event Banner Studio & Catalog Preview
 */
export const validateStep4 = (coverImageUrl?: string | null, isUploadingBanner?: boolean): StepValidationResult => {
    if (isUploadingBanner) {
        return {
            isValid: false,
            errorMessage: "Please wait for your banner upload to complete.",
        };
    }
    if (!coverImageUrl || !coverImageUrl.trim()) {
        return {
            isValid: false,
            errorMessage: "Please select or upload a banner for your event.",
        };
    }
    return { isValid: true };
};

/**
 * Centralized sequential navigation guard.
 *
 * Rules:
 * - targetStep <= currentStep (backward / same step navigation) is ALWAYS permitted.
 * - targetStep > currentStep requires all preceding steps (1 to targetStep - 1) to be valid.
 * - If a preceding step fails, navigation is blocked and the earliest incomplete step is returned.
 */
export const evaluateStepNavigation = (
    currentStep: number,
    targetStep: number,
    state: WizardNavigationState
): NavigationGuardResult => {
    // Backward or same-step navigation is unrestricted
    if (targetStep <= currentStep) {
        return {
            allowed: true,
            targetStep,
        };
    }

    // Forward Step 2+ requires Step 1 valid
    if (targetStep >= 2) {
        const step1 = validateStep1(state.form);
        if (!step1.isValid) {
            return {
                allowed: false,
                targetStep,
                blockingStep: 1,
                errorMessage: step1.errorMessage || "Please correct the highlighted fields in Step 1 before proceeding.",
                step1Errors: step1.errors,
            };
        }
    }

    // Forward Step 3+ requires Step 2 valid
    if (targetStep >= 3) {
        const step2 = validateStep2(state.stages);
        if (!step2.isValid) {
            return {
                allowed: false,
                targetStep,
                blockingStep: 2,
                errorMessage: step2.errorMessage || "Please configure at least 1 round/stage in your timeline.",
            };
        }
    }

    // Forward Step 4+ requires Step 3 valid
    if (targetStep >= 4) {
        const step3 = validateStep3(state.totalQuestions);
        if (!step3.isValid) {
            return {
                allowed: false,
                targetStep,
                blockingStep: 3,
                errorMessage: step3.errorMessage || "The registration form cannot be empty. Please include at least 1 question for participants.",
            };
        }
    }

    // Forward Step 5 requires Step 4 valid
    if (targetStep >= 5) {
        const step4 = validateStep4(state.form.coverImageUrl, state.isUploadingBanner);
        if (!step4.isValid) {
            return {
                allowed: false,
                targetStep,
                blockingStep: 4,
                errorMessage: step4.errorMessage || "Please select or upload a banner for your event.",
            };
        }
    }

    return {
        allowed: true,
        targetStep,
    };
};

/**
 * Computes the highest step the user is currently permitted to navigate to based on completion.
 */
export const getMaxPermittedStep = (state: WizardNavigationState): number => {
    if (!validateStep1(state.form).isValid) return 1;
    if (!validateStep2(state.stages).isValid) return 2;
    if (!validateStep3(state.totalQuestions).isValid) return 3;
    if (!validateStep4(state.form.coverImageUrl, state.isUploadingBanner).isValid) return 4;
    return 5;
};
