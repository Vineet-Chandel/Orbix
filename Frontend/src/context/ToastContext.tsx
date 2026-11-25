import { createContext, useContext, useState, useCallback, useRef, useMemo } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
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
const ToastActionSlotContext = createContext<HTMLDivElement | null>(null);

const toastEnter = { opacity: 0, y: 50, scale: 0.92 };
const toastExit = { opacity: 0, y: 25, scale: 0.88 };
const toastSpring = { type: "spring", stiffness: 420, damping: 30, mass: 0.8 } as const;

const toastStyles = {
    error: { Icon: AlertCircle, card: "bg-rose-50", icon: "bg-[#FF4D4D] text-white" },
    success: { Icon: CheckCircle2, card: "bg-emerald-50", icon: "bg-[#a2ff86] text-black" },
    warning: { Icon: AlertTriangle, card: "bg-amber-50", icon: "bg-[#FFE566] text-black" },
    info: { Icon: Info, card: "bg-[#FAF6EE]", icon: "bg-sky-300 text-black" },
} as const;

function ToastCard({ type, title, message, more = 0, onDismiss, actions }: {
    type: ToastType;
    title: string;
    message?: string;
    more?: number;
    onDismiss?: () => void;
    actions?: ReactNode;
}) {
    const { Icon, card, icon } = toastStyles[type];

    return (
        <div className={`relative flex items-start gap-3.5 rounded-2xl border-2 border-black p-4 shadow-[4px_4px_0px_#000] overflow-hidden ${card}`}>
            <div className={`flex h-9 w-9 shrink-0 mt-0.5 items-center justify-center rounded-xl border-2 border-black shadow-[2px_2px_0px_#000] ${icon}`}>
                <Icon aria-hidden="true" className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div className="flex-1 min-w-0 pr-1">
                <div role={actions ? "status" : undefined}>
                    <div className="flex items-center gap-2">
                        <h4 className="text-sm font-black text-black tracking-tight leading-snug truncate">{title}</h4>
                        {more > 0 && (
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-[#FFE566] text-black border-2 border-black shadow-[1px_1px_0px_#000]">
                                +{more} more
                            </span>
                        )}
                    </div>
                    {message && <p className="mt-0.5 text-xs text-neutral-800 leading-relaxed break-words font-bold">{message}</p>}
                </div>
                {actions && <div className="mt-2.5 flex flex-wrap justify-end gap-2">{actions}</div>}
            </div>
            {onDismiss && (
                <button
                    type="button"
                    onClick={onDismiss}
                    className="flex-shrink-0 text-black hover:bg-black hover:text-white transition-all p-1.5 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[1px_1px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] active:shadow-none focus:outline-none cursor-pointer"
                    aria-label="Dismiss notification"
                >
                    <X className="w-4 h-4 stroke-[2.5]" />
                </button>
            )}
        </div>
    );
}

export function ToastActionNotice({ open, title, actions }: { open: boolean; title: string; actions: ReactNode }) {
    const slot = useContext(ToastActionSlotContext);
    if (!slot) return null;

    return createPortal(
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={toastEnter}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={toastExit}
                    transition={toastSpring}
                    className="w-full max-w-xl sm:max-w-2xl lg:max-w-3xl pointer-events-auto"
                >
                    <div
                        role="status"
                        className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 rounded-2xl border-2 border-black p-3.5 sm:px-5 sm:py-3.5 shadow-[4px_4px_0px_#000] overflow-hidden bg-amber-50"
                    >
                        {/* Alert Icon & Text Content: Aligned and centered together */}
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 border-black bg-[#FFE566] text-black shadow-[2px_2px_0px_#000]">
                                <AlertTriangle aria-hidden="true" className="w-5 h-5 stroke-[2.5]" />
                            </div>
                            <h4 className="text-sm sm:text-base font-black text-black tracking-tight leading-snug truncate whitespace-nowrap">
                                {title}
                            </h4>
                        </div>

                        {/* Action Buttons: Just below on mobile, inline on tablet & laptop */}
                        <div className="flex items-center justify-end gap-2 shrink-0 w-full sm:w-auto [&>button]:flex-1 sm:[&>button]:flex-none [&>button]:justify-center">
                            {actions}
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>,
        slot
    );
}

export const ToastProvider = ({ children }: { children: ReactNode }) => {
    // Newest toast is at index 0 (front of the stack)
    const [toasts, setToasts] = useState<ToastItem[]>([]);
    const [actionSlot, setActionSlot] = useState<HTMLDivElement | null>(null);
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

    const contextValue = useMemo(
        () => ({
            show,
            error,
            success,
            warning,
            info,
            handleError,
            dismiss,
        }),
        [show, error, success, warning, info, handleError, dismiss]
    );

    const toastPortal = (
        <div
            className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] sm:bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] lg:bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-[99999] pointer-events-none flex flex-col items-center w-full px-3 sm:px-4 transition-all duration-200"
        >
            <div aria-live="polite" aria-atomic="true" className="relative w-full max-w-[460px] flex flex-col items-center justify-end">
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
                        const zIndex = 999999 - index * 10;

                        return (
                            <motion.div
                                key={item.id}
                                layout
                                initial={toastEnter}
                                animate={{
                                    opacity,
                                    y: yOffset,
                                    scale,
                                }}
                                exit={toastExit}
                                transition={toastSpring}
                                style={{
                                    zIndex,
                                    position: isFront ? "relative" : "absolute",
                                    bottom: 0,
                                }}
                                className="w-full pointer-events-auto"
                            >
                                <ToastCard
                                    type={item.type}
                                    title={item.title}
                                    message={item.message}
                                    more={isFront ? toasts.length - 1 : 0}
                                    onDismiss={() => dismiss(item.id)}
                                />
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>
            <div ref={setActionSlot} className="w-full flex justify-center mt-2 empty:hidden" />
        </div>
    );

    return (
        <ToastContext.Provider value={contextValue}>
            <ToastActionSlotContext.Provider value={actionSlot}>
                {children}
            </ToastActionSlotContext.Provider>
            {typeof document !== "undefined" ? createPortal(toastPortal, document.body) : toastPortal}
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
