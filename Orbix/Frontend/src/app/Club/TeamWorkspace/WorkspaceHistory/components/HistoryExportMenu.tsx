// Frontend/src/app/Club/TeamWorkspace/WorkspaceHistory/components/HistoryExportMenu.tsx
import React, { useState, useRef, useEffect } from "react";
import { Download, FileSpreadsheet, FileJson, ChevronDown, RefreshCw } from "lucide-react";

interface HistoryExportMenuProps {
    exporting: boolean;
    disabled?: boolean;
    onExport: (format: "csv" | "json") => void;
}

export const HistoryExportMenu: React.FC<HistoryExportMenuProps> = ({
    exporting,
    disabled = false,
    onExport,
}) => {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const handleOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handleOutside);
        return () => document.removeEventListener("mousedown", handleOutside);
    }, [open]);

    return (
        <div className="relative" ref={containerRef}>
            <button
                type="button"
                disabled={disabled || exporting}
                onClick={() => setOpen((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FFE566] hover:bg-[#fbd83a] text-black text-xs font-black border-2 border-black rounded-lg shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition disabled:opacity-50"
            >
                {exporting ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                    <Download className="w-3.5 h-3.5" />
                )}
                <span>Export</span>
                <ChevronDown className="w-3.5 h-3.5" />
            </button>

            {open && (
                <div className="absolute right-0 mt-1.5 w-44 bg-white border-2 border-black rounded-xl shadow-[4px_4px_0px_#000] py-1 z-30">
                    <button
                        type="button"
                        onClick={() => {
                            setOpen(false);
                            onExport("csv");
                        }}
                        className="w-full px-3 py-2 text-left text-xs font-bold text-black hover:bg-[#A6FF70] flex items-center gap-2 transition"
                    >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        <span>Export as CSV</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setOpen(false);
                            onExport("json");
                        }}
                        className="w-full px-3 py-2 text-left text-xs font-bold text-black hover:bg-[#FFE566] flex items-center gap-2 transition"
                    >
                        <FileJson className="w-3.5 h-3.5" />
                        <span>Export as JSON</span>
                    </button>
                </div>
            )}
        </div>
    );
};
