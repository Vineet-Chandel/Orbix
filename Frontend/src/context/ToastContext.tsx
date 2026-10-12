import { createContext, useContext, useState, useCallback, useRef } from "react";
import type { ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { parseError } from "../utils/errorParser";

export type ToastType = "error" | "success" | "warning" | "info";

export interface ToastOptions {
    title?: string;
    duration?: number;
}

export interface ToastItem {
    id: string;
    type: ToastType;
    title: string;
    message: string;
    duration: number;
}

interface ToastContextValue {
    show: (type: ToastType, message: string, options?: ToastOptions) => void;
    error: (message: string, options?: ToastOptions) => void;
    success: (message: string, options?: ToastOptions) => void;
    warning: (message: string, options?: ToastOptions) => void;
    info: (message: string, options?: ToastOptions) => void;
    handleError: (error: unknown, fallbackMessage?: string) => Promise<void>;
    dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider = ({ children }: { children: ReactNode }) => {
    // Newest toast is at index 0 (front of the stack)
    const [toasts, setToasts] = useState<ToastItem[]>([]);
    const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

    const dismiss = useCallback((id: string) => {
        const timer = timersRef.current.get(id);
        if (timer) {
            clearTimeout(timer);
            timersRef.current.delete(id);
        }
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const show = useCallback(
        (type: ToastType, message: string, options?: ToastOptions) => {
            const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
            const duration = options?.duration ?? 5000;

            const defaultTitles: Record<ToastType, string> = {
                error: "Action Failed",
                success: "Success",
                warning: "Attention Required",
                info: "Information",
            };

            const newToast: ToastItem = {
                id,
                type,
                title: options?.title || defaultTitles[type],
                message,
                duration,
            };

            setToasts((prev) => [newToast, ...prev].slice(0, 5));

            if (duration > 0) {
                const timer = setTimeout(() => {
                    dismiss(id);
                }, duration);
                timersRef.current.set(id, timer);
            }
        },
        [dismiss]
    );

    const error = useCallback(
        (message: string, options?: ToastOptions) => show("error", message, options),
        [show]
    );

    const success = useCallback(
        (message: string, options?: ToastOptions) => show("success", message, options),
        [show]
    );

    const warning = useCallback(
        (message: string, options?: ToastOptions) => show("warning", message, options),
        [show]
    );

    const info = useCallback(
        (message: string, options?: ToastOptions) => show("info", message, options),
        [show]
    );

    /**
     * Production-level global error handler:
     * Parses any error shape and surfaces it in the stacked bottom notification.
     */
    const handleError = useCallback(
        async (err: unknown, fallbackMessage?: string) => {
            const parsed = await parseError(err, "Action Failed", fallbackMessage);
            error(parsed.message, { title: parsed.title });
        },
        [error]
    );

    return (
        <ToastContext.Provider
            value={{
                show,
                error,
                success,
                warning,
                info,
                handleError,
                dismiss,
            }}
        >
            {children}

            {/* Stacked Bottom Notifications Portal */}
            <div
                aria-live="polite"
                aria-atomic="true"
                className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none flex flex-col items-center w-full max-w-[460px] px-4"
            >
                <div className="relative w-full flex flex-col items-center justify-end min-h-[90px]">
                    <AnimatePresence mode="popLayout">
                        {toasts.slice(0, 3).map((item, index) => {
                            // Stack calculation:
                            // index 0: Frontmost card (newest)
                            // index 1: Behind by -12px, scaled down
                            // index 2: Behind by -24px, scaled down further
                            const isFront = index === 0;
                            const yOffset = -index * 12;
                            const scale = 1 - index * 0.05;
                            const opacity = index === 0 ? 1 : index === 1 ? 0.85 : 0.6;
                            const zIndex = 30 - index * 10;

                            return (
                                <motion.div
                                    key={item.id}
                                    layout
                                    initial={{ opacity: 0, y: 50, scale: 0.92 }}
                                    animate={{
                                        opacity,
                                        y: yOffset,
                                        scale,
                                    }}
                                    exit={{ opacity: 0, y: 25, scale: 0.88 }}
                                    transition={{
                                        type: "spring",
                                        stiffness: 420,
                                        damping: 30,
                                        mass: 0.8,
                                    }}
                                    style={{
                                        zIndex,
                                        position: isFront ? "relative" : "absolute",
                                        bottom: 0,
                                    }}
                                    className="w-full pointer-events-auto"
                                >
                                    <div className="relative flex items-start gap-3.5 rounded-2xl border border-neutral-200/90 bg-white p-4 shadow-[0_12px_36px_rgba(0,0,0,0.14),0_2px_8px_rgba(0,0,0,0.06)] text-neutral-900 overflow-hidden">
                                        {/* Icon based on notification type */}
                                        <div className="flex-shrink-0 mt-0.5">
                                            {item.type === "error" && (
                                                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-50 border border-rose-200 text-rose-600">
                                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                                                        <circle cx="12" cy="12" r="10" />
                                                        <line x1="12" y1="8" x2="12" y2="12" />
                                                        <line x1="12" y1="16" x2="12.01" y2="16" />
                                                    </svg>
                                                </span>
                                            )}
                                            {item.type === "success" && (
                                                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600">
                                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                                        <polyline points="20 6 9 17 4 12" />
                                                    </svg>
                                                </span>
                                            )}
                                            {item.type === "warning" && (
                                                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-50 border border-amber-200 text-amber-600">
                                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                    </svg>
                                                </span>
                                            )}
                                            {item.type === "info" && (
                                                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-50 border border-indigo-200 text-indigo-600">
                                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                                                        <circle cx="12" cy="12" r="10" />
                                                        <line x1="12" y1="16" x2="12" y2="12" />
                                                        <line x1="12" y1="8" x2="12.01" y2="8" />
                                                    </svg>
                                                </span>
                                            )}
                                        </div>

                                        {/* Content: Title & Message */}
                                        <div className="flex-1 min-w-0 pr-2">
                                            <div className="flex items-center gap-2">
                                                <h4 className="text-sm font-bold text-neutral-950 tracking-tight leading-snug truncate">
                                                    {item.title}
                                                </h4>
                                                {toasts.length > 1 && isFront && (
                                                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-100 text-neutral-600 border border-neutral-200">
                                                        +{toasts.length - 1} more
                                                    </span>
                                                )}
                                            </div>
                                            <p className="mt-0.5 text-xs text-neutral-600 leading-relaxed break-words font-normal">
                                                {item.message}
                                            </p>
                                        </div>

                                        {/* Dismiss Button */}
                                        <button
                                            type="button"
                                            onClick={() => dismiss(item.id)}
                                            className="flex-shrink-0 text-neutral-400 hover:text-neutral-700 transition-colors p-1 rounded-lg hover:bg-neutral-100 focus:outline-none"
                                            aria-label="Dismiss notification"
                                        >
                                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                                <line x1="18" y1="6" x2="6" y2="18" />
                                                <line x1="6" y1="6" x2="18" y2="18" />
                                            </svg>
                                        </button>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            </div>
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error("useToast must be used within a ToastProvider");
    }
    return context;
};
