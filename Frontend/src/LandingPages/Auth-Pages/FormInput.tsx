import { useState } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";

interface FormInputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    icon?: ReactNode;
    isPassword?: boolean;
    helperText?: string;
    hideLabel?: boolean;
}

export const FormInput = ({
    label,
    error,
    icon,
    isPassword,
    helperText,
    hideLabel = false,
    id,
    type = "text",
    className = "",
    placeholder,
    ...props
}: FormInputProps) => {
    const [showPassword, setShowPassword] = useState(false);
    const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, "-")}` : undefined);
    const actualType = isPassword ? (showPassword ? "text" : "password") : type;

    return (
        <div className="w-full space-y-1">
            {label && !hideLabel && (
                <div className="flex items-center justify-between px-1">
                    <label
                        htmlFor={inputId}
                        className="block text-xs font-black uppercase tracking-wider text-black"
                    >
                        {label}
                    </label>
                    {helperText && (
                        <span className="text-[11px] font-medium text-neutral-600">{helperText}</span>
                    )}
                </div>
            )}

            <div
                className={`relative flex items-center rounded-full border-2 bg-white px-5 transition-all duration-200 ${
                    error
                        ? "border-rose-600 shadow-[2px_2px_0px_#e11d48] focus-within:shadow-[3px_3px_0px_#e11d48]"
                        : "border-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000] focus-within:shadow-[4px_4px_0px_#000] focus-within:border-black"
                }`}
            >
                {/* Prefix Icon */}
                {icon && (
                    <span className="mr-3 flex-shrink-0 text-neutral-500">
                        {icon}
                    </span>
                )}

                {/* Input element */}
                <input
                    id={inputId}
                    type={actualType}
                    placeholder={placeholder || label}
                    className={`h-12 w-full bg-transparent text-sm font-semibold text-black placeholder:text-neutral-400 placeholder:font-normal focus:outline-none ${className}`}
                    {...props}
                />

                {/* Password toggle */}
                {isPassword && (
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="ml-2 flex-shrink-0 p-1 text-neutral-500 hover:text-black transition-colors focus:outline-none cursor-pointer"
                        tabIndex={-1}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                        {showPassword ? (
                            // Eye Off Icon
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                            </svg>
                        ) : (
                            // Eye Slash / Eye Icon matching screenshot
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                            </svg>
                        )}
                    </button>
                )}
            </div>

            {/* Error Message */}
            {error && (
                <p className="flex items-center gap-1.5 text-xs font-bold text-rose-600 px-3 pt-1">
                    <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span>{error}</span>
                </p>
            )}
        </div>
    );
};
