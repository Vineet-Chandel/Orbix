import React, { useRef, useEffect } from "react";

export interface OtpSegmentedInputProps {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    onComplete?: (code: string) => void;
    autoFocus?: boolean;
}

export default function OtpSegmentedInput({
    value,
    onChange,
    disabled = false,
    onComplete,
    autoFocus = false,
}: OtpSegmentedInputProps) {
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const digits = (value + "      ").slice(0, 6).split("");

    useEffect(() => {
        if (autoFocus && !disabled) {
            // Focus first empty digit, or the first input if empty
            const firstEmptyIndex = digits.findIndex((d) => !d.trim());
            const focusTarget = firstEmptyIndex !== -1 ? firstEmptyIndex : 0;
            const timer = setTimeout(() => {
                inputRefs.current[focusTarget]?.focus();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [autoFocus, disabled]);

    const handleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value.replace(/\D/g, "");
        const char = raw.slice(-1);
        const newDigits = [...digits];
        newDigits[index] = char;
        const nextVal = newDigits.join("").trim();
        onChange(nextVal);

        if (char && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
        if (nextVal.length === 6 && onComplete) {
            onComplete(nextVal);
        }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Backspace") {
            if (!digits[index].trim() && index > 0) {
                const newDigits = [...digits];
                newDigits[index - 1] = "";
                const nextVal = newDigits.join("").trim();
                onChange(nextVal);
                inputRefs.current[index - 1]?.focus();
            }
        } else if (e.key === "ArrowLeft" && index > 0) {
            inputRefs.current[index - 1]?.focus();
        } else if (e.key === "ArrowRight" && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
        if (pasted) {
            onChange(pasted);
            const nextIdx = Math.min(pasted.length, 5);
            inputRefs.current[nextIdx]?.focus();
            if (pasted.length === 6 && onComplete) {
                onComplete(pasted);
            }
        }
    };

    return (
        <div className="flex items-center justify-between gap-1.5 sm:gap-2.5 max-w-sm mx-auto" role="group" aria-label="6-digit verification code input">
            {[0, 1, 2, 3, 4, 5].map((idx) => (
                <input
                    key={idx}
                    ref={(el) => { inputRefs.current[idx] = el; }}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]*"
                    maxLength={1}
                    disabled={disabled}
                    value={digits[idx].trim()}
                    onChange={(e) => handleChange(idx, e)}
                    onKeyDown={(e) => handleKeyDown(idx, e)}
                    onPaste={handlePaste}
                    aria-label={`Digit ${idx + 1}`}
                    className="w-10 h-12 sm:w-12 sm:h-14 text-center font-mono text-xl sm:text-2xl font-black rounded-xl bg-[#FAF6EE] border-2 border-black text-black shadow-[2px_2px_0px_#000] focus:bg-white focus:shadow-[4px_4px_0px_#000] focus:scale-105 focus:outline-none transition-all disabled:opacity-50"
                />
            ))}
        </div>
    );
}
