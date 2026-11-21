import { hasWeakPattern } from "./weakPatterns";

export interface PasswordCriterion {
    id: string;
    label: string;
    isMet: boolean;
}

export interface PasswordStrengthResult {
    score: number; // 0 to 6
    percentage: number; // 0 to 100
    label: string;
    colorClass: string;
    barColorClass: string;
    criteria: PasswordCriterion[];
    isValid: boolean;
}

export function evaluatePassword(password: string): PasswordStrengthResult {
    const trimmed = password || "";
    
    const hasMinLength = trimmed.length >= 8 && trimmed.length <= 128;
    const hasUppercase = /[A-Z]/.test(trimmed);
    const hasLowercase = /[a-z]/.test(trimmed);
    const hasNumber = /[0-9]/.test(trimmed);
    const hasSymbol = /[^A-Za-z0-9]/.test(trimmed);
    const noPattern = trimmed.length > 0 && !hasWeakPattern(trimmed);

    const criteria: PasswordCriterion[] = [
        { id: "length", label: "At least 8 characters", isMet: hasMinLength },
        { id: "uppercase", label: "At least 1 uppercase letter (A-Z)", isMet: hasUppercase },
        { id: "lowercase", label: "At least 1 lowercase letter (a-z)", isMet: hasLowercase },
        { id: "number", label: "At least 1 number (0-9)", isMet: hasNumber },
        { id: "symbol", label: "At least 1 special character (!@#$...)", isMet: hasSymbol },
        { id: "noWeakPattern", label: "No common weak patterns (e.g., 123, qwerty, password)", isMet: noPattern },
    ];

    const score = criteria.filter((c) => c.isMet).length;
    const percentage = Math.round((score / criteria.length) * 100);

    let label = "Enter a password";
    let colorClass = "text-neutral-400";
    let barColorClass = "bg-neutral-300";

    if (trimmed.length > 0) {
        if (score <= 2) {
            label = "Very Weak";
            colorClass = "text-rose-600";
            barColorClass = "bg-rose-500";
        } else if (score === 3) {
            label = "Weak";
            colorClass = "text-amber-600";
            barColorClass = "bg-amber-500";
        } else if (score === 4) {
            label = "Fair";
            colorClass = "text-yellow-600";
            barColorClass = "bg-yellow-500";
        } else if (score === 5) {
            label = "Good";
            colorClass = "text-blue-600";
            barColorClass = "bg-blue-500";
        } else {
            label = "Rock Solid";
            colorClass = "text-emerald-600";
            barColorClass = "bg-emerald-500";
        }
    }

    return {
        score,
        percentage,
        label,
        colorClass,
        barColorClass,
        criteria,
        isValid: score === 6,
    };
}
