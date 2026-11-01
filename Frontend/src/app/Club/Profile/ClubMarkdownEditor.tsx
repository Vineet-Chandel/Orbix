import React, { useState, useRef } from "react";
import {
    Bold,
    Italic,
    Strikethrough,
    Heading1,
    Heading2,
    Heading3,
    List,
    ListOrdered,
    CheckSquare,
    Link as LinkIcon,
    Quote,
    Code,
    Table as TableIcon,
    AlertCircle,
    Eye,
    Edit3,
} from "lucide-react";
import { ClubMarkdownRenderer } from "./ClubMarkdownRenderer";

interface ClubMarkdownEditorProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    minHeight?: string;
}

export const ClubMarkdownEditor: React.FC<ClubMarkdownEditorProps> = ({
    value,
    onChange,
    placeholder = "Write a rich description about your club, history, initiatives, workshops, flagship hackathons...",
    minHeight = "min-h-[260px]",
}) => {
    const [mode, setMode] = useState<"write" | "preview">("write");
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Apply formatting to current selection in textarea
    const applyFormat = (prefix: string, suffix = "", defaultText = "") => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = value.substring(start, end) || defaultText;

        const replacement = `${prefix}${selectedText}${suffix}`;
        const nextValue = value.substring(0, start) + replacement + value.substring(end);
        onChange(nextValue);

        setTimeout(() => {
            textarea.focus();
            const newCursor = start + prefix.length + selectedText.length;
            textarea.setSelectionRange(newCursor, newCursor);
        }, 0);
    };

    const handleInsertHeading = (level: number) => {
        const hashes = "#".repeat(level) + " ";
        applyFormat(hashes, "", "Heading");
    };

    const handleInsertLink = () => {
        const url = prompt("Enter link URL:", "https://");
        if (url) {
            applyFormat("[", `](${url})`, "Link text");
        }
    };

    const handleInsertTable = () => {
        const tableTemplate = "\n| Column 1 | Column 2 | Column 3 |\n| :--- | :---: | ---: |\n| Item 1 | Item 2 | Item 3 |\n| Data A | Data B | Data C |\n";
        applyFormat("", "", tableTemplate);
    };

    const handleInsertAlert = () => {
        const alertTemplate = "\n> [!NOTE]\n> Write your note or announcement here.\n";
        applyFormat("", "", alertTemplate);
    };

    // Calculate accurate word and character count
    const charCount = value.length;
    const wordCount = value.trim() ? value.trim().split(/\s+/).filter(Boolean).length : 0;

    return (
        <div className="rounded-xl border-2 border-black bg-white shadow-[3px_3px_0px_#000] overflow-hidden flex flex-col">
            {/* Toolbar Header */}
            <div className="px-3 py-2 bg-[#FAF6EE] border-b-2 border-black flex flex-wrap items-center justify-between gap-2 select-none">
                {/* Write / Preview Tab Toggle */}
                <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-black shadow-[1px_1px_0px_#000]">
                    <button
                        type="button"
                        onClick={() => setMode("write")}
                        className={`px-2.5 py-1 text-xs font-black rounded-md flex items-center gap-1.5 transition-colors cursor-pointer ${
                            mode === "write"
                                ? "bg-[#a2ff86] text-black"
                                : "text-neutral-700 hover:text-black hover:bg-neutral-100"
                        }`}
                        title="Write Markdown Source"
                    >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Write</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setMode("preview")}
                        className={`px-2.5 py-1 text-xs font-black rounded-md flex items-center gap-1.5 transition-colors cursor-pointer ${
                            mode === "preview"
                                ? "bg-[#a2ff86] text-black"
                                : "text-neutral-700 hover:text-black hover:bg-neutral-100"
                        }`}
                        title="Live Rendered Preview"
                    >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Preview</span>
                    </button>
                </div>

                {/* Formatting Buttons (visible in Write mode) */}
                {mode === "write" && (
                    <div className="flex items-center gap-0.5 flex-wrap">
                        <button
                            type="button"
                            title="Bold (**text**)"
                            onClick={() => applyFormat("**", "**", "bold text")}
                            className="p-1.5 text-neutral-800 hover:bg-white rounded-md border border-transparent hover:border-black transition-all cursor-pointer"
                        >
                            <Bold className="w-3.5 h-3.5" />
                        </button>
                        <button
                            type="button"
                            title="Italic (*text*)"
                            onClick={() => applyFormat("*", "*", "italic text")}
                            className="p-1.5 text-neutral-800 hover:bg-white rounded-md border border-transparent hover:border-black transition-all cursor-pointer"
                        >
                            <Italic className="w-3.5 h-3.5" />
                        </button>
                        <button
                            type="button"
                            title="Strikethrough (~~text~~)"
                            onClick={() => applyFormat("~~", "~~", "strikethrough text")}
                            className="p-1.5 text-neutral-800 hover:bg-white rounded-md border border-transparent hover:border-black transition-all cursor-pointer"
                        >
                            <Strikethrough className="w-3.5 h-3.5" />
                        </button>

                        <span className="w-px h-4 bg-black/20 mx-0.5" />

                        <button
                            type="button"
                            title="Heading 1 (# Heading)"
                            onClick={() => handleInsertHeading(1)}
                            className="p-1.5 text-neutral-800 hover:bg-white rounded-md border border-transparent hover:border-black transition-all cursor-pointer"
                        >
                            <Heading1 className="w-3.5 h-3.5" />
                        </button>
                        <button
                            type="button"
                            title="Heading 2 (## Heading)"
                            onClick={() => handleInsertHeading(2)}
                            className="p-1.5 text-neutral-800 hover:bg-white rounded-md border border-transparent hover:border-black transition-all cursor-pointer"
                        >
                            <Heading2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                            type="button"
                            title="Heading 3 (### Heading)"
                            onClick={() => handleInsertHeading(3)}
                            className="p-1.5 text-neutral-800 hover:bg-white rounded-md border border-transparent hover:border-black transition-all cursor-pointer"
                        >
                            <Heading3 className="w-3.5 h-3.5" />
                        </button>

                        <span className="w-px h-4 bg-black/20 mx-0.5" />

                        <button
                            type="button"
                            title="Bullet List (- item)"
                            onClick={() => applyFormat("- ", "", "item")}
                            className="p-1.5 text-neutral-800 hover:bg-white rounded-md border border-transparent hover:border-black transition-all cursor-pointer"
                        >
                            <List className="w-3.5 h-3.5" />
                        </button>
                        <button
                            type="button"
                            title="Numbered List (1. item)"
                            onClick={() => applyFormat("1. ", "", "item")}
                            className="p-1.5 text-neutral-800 hover:bg-white rounded-md border border-transparent hover:border-black transition-all cursor-pointer"
                        >
                            <ListOrdered className="w-3.5 h-3.5" />
                        </button>
                        <button
                            type="button"
                            title="Task List (- [ ] item)"
                            onClick={() => applyFormat("- [ ] ", "", "task")}
                            className="p-1.5 text-neutral-800 hover:bg-white rounded-md border border-transparent hover:border-black transition-all cursor-pointer"
                        >
                            <CheckSquare className="w-3.5 h-3.5" />
                        </button>

                        <span className="w-px h-4 bg-black/20 mx-0.5" />

                        <button
                            type="button"
                            title="Insert Link"
                            onClick={handleInsertLink}
                            className="p-1.5 text-neutral-800 hover:bg-white rounded-md border border-transparent hover:border-black transition-all cursor-pointer"
                        >
                            <LinkIcon className="w-3.5 h-3.5" />
                        </button>
                        <button
                            type="button"
                            title="Blockquote (> quote)"
                            onClick={() => applyFormat("> ", "", "quote")}
                            className="p-1.5 text-neutral-800 hover:bg-white rounded-md border border-transparent hover:border-black transition-all cursor-pointer"
                        >
                            <Quote className="w-3.5 h-3.5" />
                        </button>
                        <button
                            type="button"
                            title="Code Block (```language)"
                            onClick={() => applyFormat("```typescript\n", "\n```", "// code")}
                            className="p-1.5 text-neutral-800 hover:bg-white rounded-md border border-transparent hover:border-black transition-all cursor-pointer"
                        >
                            <Code className="w-3.5 h-3.5" />
                        </button>
                        <button
                            type="button"
                            title="GFM Table Template"
                            onClick={handleInsertTable}
                            className="p-1.5 text-neutral-800 hover:bg-white rounded-md border border-transparent hover:border-black transition-all cursor-pointer"
                        >
                            <TableIcon className="w-3.5 h-3.5" />
                        </button>
                        <button
                            type="button"
                            title="GitHub Alert Template"
                            onClick={handleInsertAlert}
                            className="p-1.5 text-neutral-800 hover:bg-white rounded-md border border-transparent hover:border-black transition-all cursor-pointer"
                        >
                            <AlertCircle className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}

                {/* Word & Char counter */}
                <div className="text-[11px] font-mono font-bold text-neutral-600 bg-white px-2 py-0.5 rounded border border-black/20">
                    {wordCount} words · {charCount} chars
                </div>
            </div>

            {/* Content Area */}
            {mode === "write" ? (
                <textarea
                    ref={textareaRef}
                    rows={12}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    className={`w-full p-4 bg-white text-xs sm:text-sm font-mono text-black placeholder:text-neutral-400 focus:outline-none resize-y leading-relaxed ${minHeight}`}
                    spellCheck="false"
                />
            ) : (
                <div className={`p-4 sm:p-6 bg-white overflow-y-auto ${minHeight}`}>
                    <ClubMarkdownRenderer content={value} />
                </div>
            )}
        </div>
    );
};
