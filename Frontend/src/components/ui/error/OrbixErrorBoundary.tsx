import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertOctagon, RefreshCw, RotateCcw, Home } from "lucide-react";
import { OrbixLogo } from "../../OrbixLogo";

export interface OrbixErrorBoundaryProps {
    level?: "app" | "route" | "section";
    onReset?: () => void;
    fallback?: ReactNode;
    children: ReactNode;
}

interface OrbixErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

export class OrbixErrorBoundary extends Component<
    OrbixErrorBoundaryProps,
    OrbixErrorBoundaryState
> {
    constructor(props: OrbixErrorBoundaryProps) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        };
    }

    static getDerivedStateFromError(error: Error): Partial<OrbixErrorBoundaryState> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        this.setState({ errorInfo });
        if (import.meta.env.DEV) {
            console.error("[OrbixErrorBoundary caught error]:", error, errorInfo);
        }
    }

    handleReset = () => {
        if (this.props.onReset) {
            this.props.onReset();
        }
        this.setState({ hasError: false, error: null, errorInfo: null });
    };

    handleHardReload = () => {
        window.location.reload();
    };

    handleGoHome = () => {
        window.location.href = "/";
    };

    render() {
        if (!this.state.hasError) {
            return this.props.children;
        }

        if (this.props.fallback) {
            return this.props.fallback;
        }

        const { level = "route" } = this.props;
        const error = this.state.error;
        const errorMessage = error?.message || "";

        // Check if this is a chunk / dynamic import error
        const isChunkError =
            (error as any)?.isChunkError ||
            errorMessage.includes("dynamically imported module") ||
            errorMessage.includes("Loading chunk") ||
            errorMessage.includes("Failed to fetch") ||
            error?.name === "ChunkLoadError";

        // =========================================================================
        // SECTION LEVEL ERROR FALLBACK
        // =========================================================================
        if (level === "section") {
            return (
                <div
                    className="w-full rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] p-6 text-center space-y-3"
                    role="alert"
                >
                    <div className="w-10 h-10 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center text-rose-600 mx-auto">
                        <AlertOctagon className="w-5 h-5 stroke-[2.5]" />
                    </div>
                    <div className="space-y-1">
                        <h4 className="text-sm font-black text-black">
                            {isChunkError ? "Content Load Interrupted" : "Section Display Error"}
                        </h4>
                        <p className="text-xs font-medium text-neutral-600 max-w-sm mx-auto">
                            {isChunkError
                                ? "A temporary network drop interrupted loading this section."
                                : "An isolated rendering issue occurred in this section."}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={this.handleReset}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#a2ff86] hover:bg-[#8ef56e] text-black border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[0.5px] active:translate-y-[0.5px] text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
                    >
                        <RefreshCw className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Retry</span>
                    </button>
                </div>
            );
        }

        // =========================================================================
        // ROUTE LEVEL ERROR FALLBACK
        // =========================================================================
        if (level === "route") {
            return (
                <div
                    className="min-h-[60vh] w-full flex items-center justify-center p-4 sm:p-6"
                    role="alert"
                >
                    <div className="max-w-md w-full rounded-3xl bg-white border-2 border-black shadow-[6px_6px_0px_#000] p-6 sm:p-8 text-center space-y-5">
                        <div className="w-14 h-14 rounded-2xl bg-[#FFE566] border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-center text-black mx-auto">
                            <AlertOctagon className="w-7 h-7 stroke-[2.5]" />
                        </div>

                        <div className="space-y-2">
                            <span className="inline-block px-3 py-0.5 rounded-full bg-black text-white text-[10px] font-black uppercase tracking-widest">
                                {isChunkError ? "Network Interruption" : "Route Error"}
                            </span>
                            <h2 className="text-xl font-black text-black tracking-tight leading-snug">
                                {isChunkError ? "Failed to Load Page Resource" : "Page Couldn't Be Rendered"}
                            </h2>
                            <p className="text-xs sm:text-sm font-medium text-neutral-600 leading-relaxed">
                                {isChunkError
                                    ? "This page could not load. Check your connection and try again, or reload the page."
                                    : "An unexpected error occurred while loading this view. Please try again."}
                            </p>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 pt-2">
                            <button
                                type="button"
                                onClick={this.handleReset}
                                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#a2ff86] hover:bg-[#8ef56e] text-black border-2 border-black shadow-[2px_2px_0px_#000] text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
                            >
                                <RotateCcw className="w-4 h-4 stroke-[2.5]" />
                                <span>Try Again</span>
                            </button>
                            <button
                                type="button"
                                onClick={this.handleHardReload}
                                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#FAF6EE] hover:bg-neutral-100 text-black border-2 border-black shadow-[2px_2px_0px_#000] text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
                            >
                                <RefreshCw className="w-4 h-4 stroke-[2.5]" />
                                <span>Reload</span>
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        // =========================================================================
        // APPLICATION ROOT LEVEL ERROR FALLBACK
        // =========================================================================
        return (
            <div
                className="min-h-screen w-full bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:18px_18px] flex flex-col items-center justify-center p-4 sm:p-6 select-none"
                role="alert"
            >
                <div className="max-w-lg w-full rounded-3xl bg-white border-3 border-black shadow-[8px_8px_0px_#000] p-6 sm:p-10 text-center space-y-6">
                    {/* Header Brand */}
                    <div className="flex items-center justify-center gap-2.5">
                        <div className="w-10 h-10 flex items-center justify-center">
                            <OrbixLogo className="w-full h-full text-black" />
                        </div>
                        <span className="text-2xl font-black text-black tracking-tight">Orbix</span>
                    </div>

                    <div className="w-16 h-16 rounded-2xl bg-[#FF6B6B] border-2 border-black shadow-[4px_4px_0px_#000] flex items-center justify-center text-black mx-auto">
                        <AlertOctagon className="w-8 h-8 stroke-[2.5]" />
                    </div>

                    <div className="space-y-2">
                        <span className="inline-block px-3 py-0.5 rounded-full bg-black text-white text-[10px] font-black uppercase tracking-widest">
                            System Protection
                        </span>
                        <h1 className="text-2xl sm:text-3xl font-black text-black tracking-tight leading-tight">
                            Application Recovery
                        </h1>
                        <p className="text-xs sm:text-sm font-medium text-neutral-600 leading-relaxed max-w-md mx-auto">
                            Something went wrong. Reload Orbix to continue.
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                        <button
                            type="button"
                            onClick={this.handleHardReload}
                            className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#a2ff86] hover:bg-[#8ef56e] text-black border-2 border-black shadow-[3px_3px_0px_#000] active:translate-x-[0.5px] active:translate-y-[0.5px] text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
                        >
                            <RefreshCw className="w-4 h-4 stroke-[2.5]" />
                            <span>Reload Orbix</span>
                        </button>
                        <button
                            type="button"
                            onClick={this.handleGoHome}
                            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#FAF6EE] hover:bg-neutral-100 text-black border-2 border-black shadow-[3px_3px_0px_#000] active:translate-x-[0.5px] active:translate-y-[0.5px] text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
                        >
                            <Home className="w-4 h-4 stroke-[2.5]" />
                            <span>Homepage</span>
                        </button>
                    </div>
                </div>
            </div>
        );
    }
}

export default OrbixErrorBoundary;
