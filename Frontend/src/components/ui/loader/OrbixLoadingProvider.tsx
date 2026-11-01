import React, { useState, useRef, useCallback, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { OrbixLoadingContext } from "./OrbixLoadingContext";
import type {
    LoaderTask,
    ShowLoaderOptions,
    UpdateLoaderOptions,
    OrbixLoadingContextValue,
} from "./loader.types";
import { DEFAULT_DELAY_MS, DEFAULT_MIN_DURATION_MS } from "./loader.constants";
import { generateTaskId } from "./loader.utils";
import { OrbixLoader } from "./OrbixLoader";

interface OrbixLoadingProviderProps {
    children: React.ReactNode;
    defaultDelay?: number;
    defaultMinDuration?: number;
}

export const OrbixLoadingProvider: React.FC<OrbixLoadingProviderProps> = ({
    children,
    defaultDelay = DEFAULT_DELAY_MS,
    defaultMinDuration = DEFAULT_MIN_DURATION_MS,
}) => {
    // Map of active concurrent tasks keyed by taskId
    const tasksRef = useRef<Map<string, LoaderTask>>(new Map());
    const [activeTask, setActiveTask] = useState<LoaderTask | null>(null);
    const [isDelayedShowing, setIsDelayedShowing] = useState<boolean>(false);

    // Timers
    const delayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const minDurationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const shownAtRef = useRef<number | null>(null);

    // Clear all pending timers on unmount
    useEffect(() => {
        return () => {
            if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
            if (minDurationTimerRef.current) clearTimeout(minDurationTimerRef.current);
        };
    }, []);

    // Get the most relevant active task to display (newest task)
    const getLatestTask = useCallback((): LoaderTask | null => {
        const tasks = Array.from(tasksRef.current.values());
        if (tasks.length === 0) return null;
        return tasks[tasks.length - 1];
    }, []);

    const showLoader = useCallback(
        (options?: ShowLoaderOptions): string => {
            const id = options?.id || generateTaskId("global-load");
            const delay = options?.delay ?? defaultDelay;
            const minDuration = options?.minDuration ?? defaultMinDuration;

            const task: LoaderTask = {
                id,
                label: options?.label || "Loading...",
                description: options?.description,
                progress: options?.progress,
                variant: options?.variant || "fullscreen",
                startTime: Date.now(),
                delay,
                minDuration,
            };

            tasksRef.current.set(id, task);
            setActiveTask(task);

            // If already showing, keep showing
            if (isDelayedShowing) {
                return id;
            }

            // If delay is 0, show immediately
            if (delay <= 0) {
                shownAtRef.current = Date.now();
                setIsDelayedShowing(true);
                return id;
            }

            // Otherwise, schedule display after delay debounce
            if (!delayTimerRef.current) {
                delayTimerRef.current = setTimeout(() => {
                    delayTimerRef.current = null;
                    if (tasksRef.current.size > 0) {
                        shownAtRef.current = Date.now();
                        setIsDelayedShowing(true);
                    }
                }, delay);
            }

            return id;
        },
        [defaultDelay, defaultMinDuration, isDelayedShowing]
    );

    const updateLoader = useCallback((options: UpdateLoaderOptions) => {
        const id = options.id;
        const task = id ? tasksRef.current.get(id) : null;

        if (task) {
            if (options.label !== undefined) task.label = options.label;
            if (options.description !== undefined) task.description = options.description;
            if (options.progress !== undefined) task.progress = options.progress;
            tasksRef.current.set(id!, task);
        }

        setActiveTask((prev) => {
            if (!prev) return null;
            if (id && prev.id !== id) return prev;
            return {
                ...prev,
                ...(options.label !== undefined && { label: options.label }),
                ...(options.description !== undefined && { description: options.description }),
                ...(options.progress !== undefined && { progress: options.progress }),
            };
        });
    }, []);

    const completeHide = useCallback(() => {
        setIsDelayedShowing(false);
        setActiveTask(null);
        shownAtRef.current = null;
        if (minDurationTimerRef.current) {
            clearTimeout(minDurationTimerRef.current);
            minDurationTimerRef.current = null;
        }
    }, []);

    const hideLoader = useCallback(
        (id?: string) => {
            if (id) {
                tasksRef.current.delete(id);
            } else {
                // Force clear all active operations
                tasksRef.current.clear();
            }

            // If tasks remain, switch active display to the next task
            if (tasksRef.current.size > 0) {
                const latest = getLatestTask();
                setActiveTask(latest);
                return;
            }

            // All tasks finished: cancel pending delay if loader hasn't displayed yet
            if (delayTimerRef.current) {
                clearTimeout(delayTimerRef.current);
                delayTimerRef.current = null;
            }

            // If loader is not currently visible, reset immediately
            if (!shownAtRef.current) {
                completeHide();
                return;
            }

            // Respect minDuration to avoid a jarring blink if it just appeared
            const elapsed = Date.now() - shownAtRef.current;
            const remainingMin = Math.max(0, defaultMinDuration - elapsed);

            if (remainingMin > 0) {
                if (!minDurationTimerRef.current) {
                    minDurationTimerRef.current = setTimeout(() => {
                        completeHide();
                    }, remainingMin);
                }
            } else {
                completeHide();
            }
        },
        [completeHide, defaultMinDuration, getLatestTask]
    );

    const withGlobalLoading = useCallback(
        async <T,>(fn: () => Promise<T>, options?: ShowLoaderOptions): Promise<T> => {
            const id = showLoader(options);
            try {
                return await fn();
            } finally {
                hideLoader(id);
            }
        },
        [showLoader, hideLoader]
    );

    const contextValue: OrbixLoadingContextValue = {
        isLoading: tasksRef.current.size > 0,
        isDelayedShowing,
        activeTask,
        showLoader,
        hideLoader,
        updateLoader,
        withGlobalLoading,
    };

    return (
        <OrbixLoadingContext.Provider value={contextValue}>
            {children}

            {/* Global Animated Fullscreen / Overlay Loader */}
            <AnimatePresence>
                {isDelayedShowing && activeTask && (
                    <OrbixLoader
                        key={activeTask.id}
                        size="lg"
                        variant={activeTask.variant || "fullscreen"}
                        progress={activeTask.progress}
                    />
                )}
            </AnimatePresence>
        </OrbixLoadingContext.Provider>
    );
};
