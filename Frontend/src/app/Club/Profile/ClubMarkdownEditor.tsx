import React, { useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
    Bold,
    Italic,
    Heading2,
    Heading3,
    List,
    ListOrdered,
    Link as LinkIcon,
    Quote,
    Code,
    Eye,
    Edit3,
} from "lucide-react";

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

    // Calculate word and character count
    const charCount = value.length;
    const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;

    return (
        <div className="rounded-xl border-2 border-black bg-white shadow-[2px_2px_0px_#000] overflow-hidden flex flex-col">
            {/* Toolbar Header */}
            <div className="px-3 py-2 bg-[#FAF6EE] border-b-2 border-black flex flex-wrap items-center justify-between gap-2">
                {/* Write / Preview Tab Toggle */}
                <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-black shadow-[1px_1px_0px_#000]">
                    <button
                        type="button"
                        onClick={() => setMode("write")}
                        className={`px-2.5 py-1 text-xs font-black rounded-md flex items-center gap-1.5 transition-colors cursor-pointer ${
                            mode === "write"
                                ? "bg-black text-[#a2ff86]"
                                : "text-neutral-700 hover:text-black hover:bg-neutral-100"
                        }`}
                    >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Write</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setMode("preview")}
                        className={`px-2.5 py-1 text-xs font-black rounded-md flex items-center gap-1.5 transition-colors cursor-pointer ${
                            mode === "preview"
                                ? "bg-black text-[#a2ff86]"
                                : "text-neutral-700 hover:text-black hover:bg-neutral-100"
                        }`}
                    >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Preview</span>
                    </button>
                </div>

                {/* Formatting Buttons (visible in Write mode) */}
                {mode === "write" && (
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            title="Bold"
                            onClick={() => applyFormat("**", "**", "bold text")}
                            className="p-1.5 text-neutral-800 hover:bg-white rounded-md border border-transparent hover:border-black transition-all cursor-pointer"
                        >
                            <Bold className="w-3.5 h-3.5" />
                        </button>
                        <button
                            type="button"
                            title="Italic"
                            onClick={() => applyFormat("*", "*", "italic text")}
                            className="p-1.5 text-neutral-800 hover:bg-white rounded-md border border-transparent hover:border-black transition-all cursor-pointer"
                        >
                            <Italic className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-px h-4 bg-black/20 mx-0.5" />
                        <button
                            type="button"
                            title="Heading 2"
                            onClick={() => handleInsertHeading(2)}
                            className="p-1.5 text-neutral-800 hover:bg-white rounded-md border border-transparent hover:border-black transition-all cursor-pointer"
                        >
                            <Heading2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                            type="button"
                            title="Heading 3"
                            onClick={() => handleInsertHeading(3)}
                            className="p-1.5 text-neutral-800 hover:bg-white rounded-md border border-transparent hover:border-black transition-all cursor-pointer"
                        >
                            <Heading3 className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-px h-4 bg-black/20 mx-0.5" />
                        <button
                            type="button"
                            title="Bullet List"
                            onClick={() => applyFormat("- ", "", "item")}
                            className="p-1.5 text-neutral-800 hover:bg-white rounded-md border border-transparent hover:border-black transition-all cursor-pointer"
                        >
                            <List className="w-3.5 h-3.5" />
                        </button>
                        <button
                            type="button"
                            title="Numbered List"
                            onClick={() => applyFormat("1. ", "", "item")}
                            className="p-1.5 text-neutral-800 hover:bg-white rounded-md border border-transparent hover:border-black transition-all cursor-pointer"
                        >
                            <ListOrdered className="w-3.5 h-3.5" />
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
                            title="Blockquote"
                            onClick={() => applyFormat("> ", "", "quote")}
                            className="p-1.5 text-neutral-800 hover:bg-white rounded-md border border-transparent hover:border-black transition-all cursor-pointer"
                        >
                            <Quote className="w-3.5 h-3.5" />
                        </button>
                        <button
                            type="button"
                            title="Code Block"
                            onClick={() => applyFormat("```\n", "\n```", "code")}
                            className="p-1.5 text-neutral-800 hover:bg-white rounded-md border border-transparent hover:border-black transition-all cursor-pointer"
                        >
                            <Code className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}

                {/* Word & Char counter */}
                <div className="text-[11px] font-bold text-neutral-500">
                    {wordCount} words · {charCount} chars
                </div>
            </div>

            {/* Content Area */}
            {mode === "write" ? (
                <textarea
                    ref={textareaRef}
                    rows={8}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    className={`w-full p-4 bg-white text-xs font-mono text-black placeholder:text-neutral-400 focus:outline-none resize-y ${minHeight}`}
                />
            ) : (
                <div className={`p-4 bg-white prose prose-sm max-w-none text-xs text-neutral-800 overflow-y-auto ${minHeight}`}>
                    {value.trim() ? (
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                                h1: ({ children }) => <h1 className="text-lg font-black text-black pb-1 border-b border-black/20 mb-3">{children}</h1>,
                                h2: ({ children }) => <h2 className="text-base font-black text-black pb-1 border-b border-black/10 mt-4 mb-2">{children}</h2>,
                                h3: ({ children }) => <h3 className="text-sm font-bold text-black mt-3 mb-1.5">{children}</h3>,
                                p: ({ children }) => <p className="text-xs text-neutral-700 leading-relaxed mb-3">{children}</p>,
                                ul: ({ children }) => <ul className="list-disc list-inside space-y-1 mb-3 text-xs text-neutral-700">{children}</ul>,
                                ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 mb-3 text-xs text-neutral-700">{children}</ol>,
                                li: ({ children }) => <li className="text-xs text-neutral-700">{children}</li>,
                                blockquote: ({ children }) => (
                                    <blockquote className="border-l-4 border-black pl-3 py-1 my-2 bg-[#FAF6EE] text-xs italic font-medium text-neutral-700">
                                        {children}
                                    </blockquote>
                                ),
                                a: ({ href, children }) => (
                                    <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline font-bold hover:text-blue-800">
                                        {children}
                                    </a>
                                ),
                                code: ({ children }) => {
                                    return (
                                        <code className="px-1.5 py-0.5 rounded-md bg-[#FAF6EE] border border-black/20 text-[11px] font-mono text-black">
                                            {children}
                                        </code>
                                    );
                                },
                            }}
                        >
                            {value}
                        </ReactMarkdown>
                    ) : (
                        <div className="py-8 text-center text-xs font-bold text-neutral-400 italic">
                            Nothing to preview yet. Write some markdown content above!
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
