import React from "react";
import { AlertTriangle } from "lucide-react";

interface ErrorBoundaryProps {
    children: React.ReactNode;
    fallbackContent?: string;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

/**
 * Resilient Error Boundary that prevents markdown preview syntax errors
 * from crashing the entire page or unmounting the host view.
 */
export class MarkdownErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error("Markdown Preview Error caught by boundary:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="my-4 p-5 rounded-2xl border-2 border-black bg-rose-50 shadow-[4px_4px_0px_#000] text-black">
                    <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                        <h4 className="text-sm font-black text-rose-900">
                            Markdown Preview Notice
                        </h4>
                    </div>
                    <p className="text-xs text-rose-800 mb-3 font-medium">
                        Unable to render some rich formatting in preview mode. Displaying plain content below:
                    </p>
                    <div className="p-3 bg-white rounded-xl border border-black/20 text-xs font-mono whitespace-pre-wrap overflow-x-auto max-h-60 text-neutral-800 select-all">
                        {this.props.fallbackContent || "Raw content unavailable."}
                    </div>
                    <button
                        type="button"
                        onClick={() => this.setState({ hasError: false, error: null })}
                        className="mt-3 px-3 py-1.5 rounded-lg bg-black text-white text-xs font-black uppercase tracking-wider hover:bg-neutral-800 cursor-pointer"
                    >
                        Try Re-rendering
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}
