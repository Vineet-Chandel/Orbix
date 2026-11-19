import { useState } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { AlertCircle, Eye, EyeOff } from "lucide-react";

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
                            <Eye className="h-5 w-5" />
                        ) : (
                            <EyeOff className="h-5 w-5" />
                        )}
                    </button>
                )}
            </div>

            {/* Error Message */}
            {error && (
                <p className="flex items-center gap-1.5 text-xs font-bold text-rose-600 px-3 pt-1">
                    <AlertCircle className="h-3.5 w-3.5 stroke-[2.5] flex-shrink-0" />
                    <span>{error}</span>
                </p>
            )}
        </div>
    );
};
