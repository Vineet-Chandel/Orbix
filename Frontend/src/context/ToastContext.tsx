import { createContext, useContext, useState, useCallback, useRef } from "react";
import type { ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, CheckCircle2, AlertTriangle, Info, X } from "lucide-react";
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
                                    <div className={`relative flex items-start gap-3.5 rounded-2xl border-2 border-black p-4 shadow-[4px_4px_0px_#000] overflow-hidden ${
                                        item.type === "error" ? "bg-rose-50" :
                                        item.type === "success" ? "bg-emerald-50" :
                                        item.type === "warning" ? "bg-amber-50" :
                                        "bg-[#FAF6EE]"
                                    }`}>
                                        {/* Icon based on notification type */}
                                        <div className="flex-shrink-0 mt-0.5">
                                            {item.type === "error" && (
                                                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FF4D4D] border-2 border-black text-white shadow-[2px_2px_0px_#000]">
                                                    <AlertCircle className="w-5 h-5 stroke-[2.5]" />
                                                </span>
                                            )}
                                            {item.type === "success" && (
                                                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#a2ff86] border-2 border-black text-black shadow-[2px_2px_0px_#000]">
                                                    <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                                                </span>
                                            )}
                                            {item.type === "warning" && (
                                                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFE566] border-2 border-black text-black shadow-[2px_2px_0px_#000]">
                                                    <AlertTriangle className="w-5 h-5 stroke-[2.5]" />
                                                </span>
                                            )}
                                            {item.type === "info" && (
                                                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-300 border-2 border-black text-black shadow-[2px_2px_0px_#000]">
                                                    <Info className="w-5 h-5 stroke-[2.5]" />
                                                </span>
                                            )}
                                        </div>

                                        {/* Content: Title & Message */}
                                        <div className="flex-1 min-w-0 pr-1">
                                            <div className="flex items-center gap-2">
                                                <h4 className="text-sm font-black text-black tracking-tight leading-snug truncate">
                                                    {item.title}
                                                </h4>
                                                {toasts.length > 1 && isFront && (
                                                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-[#FFE566] text-black border-2 border-black shadow-[1px_1px_0px_#000]">
                                                        +{toasts.length - 1} more
                                                    </span>
                                                )}
                                            </div>
                                            <p className="mt-0.5 text-xs text-neutral-800 leading-relaxed break-words font-bold">
                                                {item.message}
                                            </p>
                                        </div>

                                        {/* Dismiss Button */}
                                        <button
                                            type="button"
                                            onClick={() => dismiss(item.id)}
                                            className="flex-shrink-0 text-black hover:bg-black hover:text-white transition-all p-1.5 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[1px_1px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] active:shadow-none focus:outline-none cursor-pointer"
                                            aria-label="Dismiss notification"
                                        >
                                            <X className="w-4 h-4 stroke-[2.5]" />
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
