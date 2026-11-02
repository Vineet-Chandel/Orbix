import React, { useMemo, useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkEmoji from "remark-emoji";
import rehypeRaw from "rehype-raw";
import rehypeKatex from "rehype-katex";
import {
    Info,
    Lightbulb,
    AlertTriangle,
    AlertCircle,
    ShieldAlert,
    ExternalLink,
    Hash,
    Copy,
    Check,
    ImageOff,
} from "lucide-react";
import { highlightCode } from "../../../utils/prismHelper";
import { safeSanitizeSvg, extractText, githubSlug } from "./markdownUtils";
import { MarkdownErrorBoundary } from "./MarkdownErrorBoundary";

export { MarkdownErrorBoundary };

/**
 * Lazy-loaded and sanitized Mermaid diagram renderer.
 */
interface MermaidBlockProps {
    code: string;
}

export const MermaidBlock: React.FC<MermaidBlockProps> = ({ code }) => {
    const [svg, setSvg] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [showSource, setShowSource] = useState(false);

    useEffect(() => {
        let isMounted = true;
        let tempContainer: HTMLDivElement | null = null;
        let renderedId: string | null = null;

        async function renderDiagram() {
            setLoading(true);
            setError(null);
            try {
                // Attach a temporary render sandbox to document.body so SVG getBBox has a real render tree
                tempContainer = document.createElement("div");
                tempContainer.style.position = "fixed";
                tempContainer.style.left = "-99999px";
                tempContainer.style.top = "0";
                tempContainer.style.width = "800px";
                tempContainer.style.height = "600px";
                tempContainer.style.opacity = "0";
                tempContainer.style.pointerEvents = "none";
                document.body.appendChild(tempContainer);

                const mermaidModule = await import("mermaid");
                const mermaid = mermaidModule.default;
                mermaid.initialize({
                    startOnLoad: false,
                    theme: "default",
                    securityLevel: "strict",
                    fontFamily: "inherit",
                });

                // Yield to next animation frame so DOM render tree is calculated
                await new Promise((r) => requestAnimationFrame(r));

                const uniqueId = `mermaid-svg-${Math.random().toString(36).substring(2, 9)}`;
                renderedId = uniqueId;
                const { svg: rawSvg } = await mermaid.render(uniqueId, code, tempContainer);

                if (isMounted) {
                    const cleanSvg = safeSanitizeSvg(rawSvg);
                    setSvg(cleanSvg);
                }
            } catch (err: any) {
                if (isMounted) {
                    setError(err?.message || "Failed to parse or render Mermaid diagram syntax.");
                }
            } finally {
                if (renderedId) {
                    const orphan = document.getElementById(`d${renderedId}`);
                    if (orphan && orphan.parentNode) {
                        orphan.parentNode.removeChild(orphan);
                    }
                }
                if (tempContainer && document.body.contains(tempContainer)) {
                    document.body.removeChild(tempContainer);
                    tempContainer = null;
                }
                if (isMounted) setLoading(false);
            }
        }

        renderDiagram();
        return () => {
            isMounted = false;
            if (renderedId) {
                const orphan = document.getElementById(`d${renderedId}`);
                if (orphan && orphan.parentNode) {
                    orphan.parentNode.removeChild(orphan);
                }
            }
            if (tempContainer && document.body.contains(tempContainer)) {
                document.body.removeChild(tempContainer);
                tempContainer = null;
            }
        };
    }, [code]);

    if (loading) {
        return (
            <div className="my-5 p-6 rounded-xl border-2 border-black bg-[#FAF6EE] shadow-[3px_3px_0px_#000] flex flex-col items-center justify-center gap-2 text-neutral-600 animate-pulse">
                <div className="w-5 h-5 border-2 border-black border-t-[#a2ff86] rounded-full animate-spin" />
                <span className="text-xs font-mono font-bold">Rendering Mermaid diagram...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="my-5 rounded-xl border-2 border-black bg-rose-50 p-4 shadow-[3px_3px_0px_#000] space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-rose-800 text-xs font-bold">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>Invalid Mermaid Diagram Syntax</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowSource((prev) => !prev)}
                        className="px-2 py-0.5 rounded-md bg-white border border-black text-[11px] font-mono font-bold hover:bg-neutral-100 transition-colors cursor-pointer"
                    >
                        {showSource ? "Hide Source" : "View Source"}
                    </button>
                </div>
                <p className="text-[11px] font-mono text-rose-700 bg-rose-100/60 p-2 rounded-lg break-words">
                    {error}
                </p>
                {showSource && (
                    <pre className="p-3 bg-[#181824] text-neutral-200 rounded-lg text-xs font-mono overflow-x-auto m-0">
                        <code>{code}</code>
                    </pre>
                )}
            </div>
        );
    }

    return (
        <div className="my-5 p-4 sm:p-6 bg-white border-2 border-black rounded-xl shadow-[3px_3px_0px_#000] overflow-x-auto flex justify-center items-center">
            <div
                dangerouslySetInnerHTML={{ __html: svg || "" }}
                className="w-full flex justify-center [&>svg]:max-w-full [&>svg]:h-auto"
            />
        </div>
    );
};

/**
 * Fenced Code Block component with Prism syntax coloring & copy feedback.
 */
interface CodeBlockProps {
    code: string;
    language?: string;
}

export const ClubCodeBlock: React.FC<CodeBlockProps> = ({ code, language = "" }) => {
    const [copied, setCopied] = useState(false);
    const trimmedCode = String(code || "").replace(/\n$/, "");
    const lowerLang = (language || "").toLowerCase().trim();

    // Route mermaid blocks directly to Mermaid renderer
    if (lowerLang === "mermaid") {
        return <MermaidBlock code={trimmedCode} />;
    }

    const { html: highlightedHtml, normalizedLang } = useMemo(() => {
        return highlightCode(trimmedCode, language);
    }, [trimmedCode, language]);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(trimmedCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Clipboard copy failed:", err);
        }
    };

    const displayLabel = normalizedLang !== "plaintext" ? normalizedLang : language || "code";

    return (
        <div className="my-5 rounded-xl border-2 border-black bg-[#181824] shadow-[4px_4px_0px_#000] overflow-hidden text-neutral-100">
            {/* Code Header Bar */}
            <div className="flex items-center justify-between px-3 sm:px-4 py-2 bg-[#0e0f17] border-b-2 border-black text-xs">
                <span className="font-mono text-[11px] font-black uppercase tracking-wider text-black bg-[#FFE566] px-2 py-0.5 rounded-md border border-black shadow-[1px_1px_0px_#000] select-none">
                    {displayLabel}
                </span>

                <button
                    type="button"
                    onClick={handleCopy}
                    className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-bold rounded-lg border-2 border-black transition-all cursor-pointer ${
                        copied
                            ? "bg-[#a2ff86] text-black shadow-[1.5px_1.5px_0px_#000]"
                            : "bg-white text-black hover:bg-neutral-100 shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px]"
                    }`}
                    aria-label={copied ? "Code copied to clipboard" : "Copy code"}
                >
                    {copied ? (
                        <>
                            <Check className="w-3 h-3 stroke-[3]" />
                            <span>COPIED!</span>
                        </>
                    ) : (
                        <>
                            <Copy className="w-3 h-3 stroke-[2.5]" />
                            <span>COPY</span>
                        </>
                    )}
                </button>
            </div>

            {/* Code Body Container */}
            <div className="markdown-code overflow-x-auto p-4 text-xs sm:text-[13px] leading-relaxed font-mono bg-[#181824]">
                <pre className="m-0 p-0 font-mono bg-transparent">
                    <code
                        dangerouslySetInnerHTML={{ __html: highlightedHtml }}
                        className={`language-${normalizedLang}`}
                    />
                </pre>
            </div>
        </div>
    );
};

/**
 * GitHub Callout / Alert parser and renderer.
 */
interface CalloutBlockquoteProps {
    children?: React.ReactNode;
}

export const CalloutBlockquote: React.FC<CalloutBlockquoteProps> = ({ children }) => {
    const rawText = extractText(children);
    const match = rawText.match(/^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*([\s\S]*)$/i);

    if (!match) {
        return (
            <blockquote className="my-4 border-l-4 border-black bg-[#FAF6EE] px-4 py-2.5 text-sm italic font-medium text-neutral-800 rounded-r-xl">
                {children}
            </blockquote>
        );
    }

    const alertType = match[1].toUpperCase() as "NOTE" | "TIP" | "IMPORTANT" | "WARNING" | "CAUTION";

    // Clean [!TYPE] marker from the rendered child nodes
    let stripped = false;
    const stripMarker = (node: any): any => {
        if (stripped) return node;
        if (typeof node === "string") {
            if (/^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i.test(node)) {
                stripped = true;
                return node.replace(/^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i, "");
            }
            return node;
        }
        if (Array.isArray(node)) {
            return node.map((child) => stripMarker(child));
        }
        if (React.isValidElement(node) && (node.props as any)?.children) {
            return React.cloneElement(node as React.ReactElement<any>, {
                children: stripMarker((node.props as any).children),
            });
        }
        return node;
    };

    const cleanedContent = stripMarker(children);

    const alertConfigs = {
        NOTE: {
            label: "Note",
            icon: Info,
            containerClass: "border-l-4 border-sky-500 bg-sky-50/70 text-sky-950",
            badgeClass: "bg-sky-500 text-white",
        },
        TIP: {
            label: "Tip",
            icon: Lightbulb,
            containerClass: "border-l-4 border-emerald-500 bg-emerald-50/70 text-emerald-950",
            badgeClass: "bg-emerald-500 text-white",
        },
        IMPORTANT: {
            label: "Important",
            icon: AlertCircle,
            containerClass: "border-l-4 border-purple-500 bg-purple-50/70 text-purple-950",
            badgeClass: "bg-purple-500 text-white",
        },
        WARNING: {
            label: "Warning",
            icon: AlertTriangle,
            containerClass: "border-l-4 border-amber-500 bg-amber-50/70 text-amber-950",
            badgeClass: "bg-amber-500 text-black",
        },
        CAUTION: {
            label: "Caution",
            icon: ShieldAlert,
            containerClass: "border-l-4 border-rose-500 bg-rose-50/70 text-rose-950",
            badgeClass: "bg-rose-500 text-white",
        },
    };

    const config = alertConfigs[alertType] || alertConfigs.NOTE;
    const Icon = config.icon;

    return (
        <div
            className={`my-5 rounded-xl border-2 border-black p-4 text-sm leading-relaxed shadow-[3px_3px_0px_#000] ${config.containerClass}`}
        >
            <div className="flex items-center gap-2 mb-2 font-black">
                <span
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-mono font-bold uppercase tracking-wider border border-black shadow-[1px_1px_0px_#000] ${config.badgeClass}`}
                >
                    <Icon className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>{config.label}</span>
                </span>
            </div>
            <div className="[&>p]:m-0 [&>p+p]:mt-2 font-normal text-neutral-900 leading-relaxed">
                {cleanedContent}
            </div>
        </div>
    );
};

/**
 * Image component with fallback placeholder on broken image load.
 */
interface SafeImageProps {
    src?: string;
    alt?: string;
    title?: string;
}

export const SafeImage: React.FC<SafeImageProps> = ({ src, alt = "", title }) => {
    const [hasError, setHasError] = useState(false);

    const safeSrc = useMemo(() => {
        if (!src) return "";
        const clean = src.trim();
        // Disallow dangerous script protocols
        if (/^(javascript:|data:text\/html)/i.test(clean)) {
            return "";
        }
        return clean;
    }, [src]);

    if (hasError || !safeSrc) {
        return (
            <span className="my-4 p-4 rounded-xl border-2 border-dashed border-black/30 bg-[#FAF6EE] flex items-center gap-3 text-neutral-600 text-xs font-bold block">
                <ImageOff className="w-5 h-5 text-neutral-400 shrink-0" />
                <span>Image unavailable: {alt || safeSrc || "(missing URL)"}</span>
            </span>
        );
    }

    return (
        <span className="block my-5 text-center">
            <img
                src={safeSrc}
                alt={alt}
                title={title}
                onError={() => setHasError(true)}
                className="max-w-full h-auto rounded-xl border-2 border-black shadow-[3px_3px_0px_#000] object-contain inline-block mx-auto"
                loading="lazy"
            />
            {alt && (
                <span className="block text-center text-xs font-medium text-neutral-500 mt-2 italic">
                    {alt}
                </span>
            )}
        </span>
    );
};

/**
 * Factory for creating heading components with unique slug IDs and anchor permalinks.
 */
function createHeading(level: 1 | 2 | 3 | 4 | 5 | 6, idCounterMap: Map<string, number>) {
    return ({ children, ...props }: any) => {
        const rawText = extractText(children);
        const baseSlug = githubSlug(rawText) || `section-${level}`;

        let id = baseSlug;
        const count = idCounterMap.get(baseSlug) || 0;
        if (count > 0) {
            id = `${baseSlug}-${count}`;
        }
        idCounterMap.set(baseSlug, count + 1);

        const styleClasses: Record<number, string> = {
            1: "text-2xl sm:text-3xl font-black text-black tracking-tight mt-8 mb-4 pb-2 border-b-2 border-black/15",
            2: "text-xl sm:text-2xl font-black text-black tracking-tight mt-7 mb-3 pb-1.5 border-b border-black/15",
            3: "text-lg sm:text-xl font-black text-black mt-6 mb-2.5",
            4: "text-base sm:text-lg font-bold text-black mt-5 mb-2",
            5: "text-sm sm:text-base font-bold uppercase tracking-wider text-neutral-800 mt-4 mb-1.5",
            6: "text-xs sm:text-sm font-bold uppercase tracking-wider text-neutral-500 mt-3 mb-1",
        };

        const anchor = (
            <span className="relative">
                {children}
                <a
                    href={`#${id}`}
                    className="inline-flex items-center ml-2 text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-black focus:opacity-100 focus:outline-none"
                    aria-label={`Direct anchor link to ${rawText}`}
                    title={`Direct link to ${rawText}`}
                >
                    <Hash className="w-4 h-4 stroke-[2.5]" />
                </a>
            </span>
        );

        const cls = `group relative scroll-mt-24 ${styleClasses[level] || ""}`;

        if (level === 1) return <h1 id={id} className={cls} {...props}>{anchor}</h1>;
        if (level === 2) return <h2 id={id} className={cls} {...props}>{anchor}</h2>;
        if (level === 3) return <h3 id={id} className={cls} {...props}>{anchor}</h3>;
        if (level === 4) return <h4 id={id} className={cls} {...props}>{anchor}</h4>;
        if (level === 5) return <h5 id={id} className={cls} {...props}>{anchor}</h5>;
        return <h6 id={id} className={cls} {...props}>{anchor}</h6>;
    };
}

interface ClubMarkdownRendererProps {
    content: string;
    className?: string;
}

/**
 * Production-Grade GitHub-Style Markdown Renderer for Club Profiles & Editor Previews.
 */
export const ClubMarkdownRenderer: React.FC<ClubMarkdownRendererProps> = ({
    content,
    className = "",
}) => {
    // Unique ID counter per render pass ensuring 1:1 deterministic heading anchor resolution
    const idCounterMap = useMemo(() => new Map<string, number>(), [content]);

    const components: any = useMemo(() => {
        return {
            h1: createHeading(1, idCounterMap),
            h2: createHeading(2, idCounterMap),
            h3: createHeading(3, idCounterMap),
            h4: createHeading(4, idCounterMap),
            h5: createHeading(5, idCounterMap),
            h6: createHeading(6, idCounterMap),

            p: ({ children, ...props }: any) => (
                <div className="my-3 text-sm leading-relaxed text-neutral-800" {...props}>
                    {children}
                </div>
            ),

            strong: ({ children }: any) => <strong className="font-black text-black">{children}</strong>,
            em: ({ children }: any) => <em className="italic">{children}</em>,
            del: ({ children }: any) => <del className="line-through text-neutral-500">{children}</del>,
            ins: ({ children }: any) => <ins className="underline decoration-2 text-neutral-900">{children}</ins>,
            mark: ({ children }: any) => <mark className="bg-[#FFE566] px-1 py-0.5 rounded text-black font-semibold">{children}</mark>,
            sub: ({ children }: any) => <sub className="text-[10px] align-sub font-medium">{children}</sub>,
            sup: ({ children }: any) => <sup className="text-[10px] align-super font-medium">{children}</sup>,
            abbr: ({ children, title, ...props }: any) => (
                <abbr title={title} className="cursor-help underline decoration-dotted" {...props}>
                    {children}
                </abbr>
            ),

            blockquote: CalloutBlockquote,

            ul: ({ children, ...props }: any) => (
                <ul className="my-3 ml-6 list-disc space-y-1.5 text-sm text-neutral-800 marker:text-black" {...props}>
                    {children}
                </ul>
            ),

            ol: ({ children, start, ...props }: any) => (
                <ol
                    start={start}
                    className="my-3 ml-6 list-decimal space-y-1.5 text-sm text-neutral-800 marker:text-black marker:font-black"
                    {...props}
                >
                    {children}
                </ol>
            ),

            li: ({ children, checked, ...props }: any) => {
                // Task list item checkbox
                if (checked !== null && checked !== undefined) {
                    return (
                        <li className="flex items-start gap-2.5 my-1.5 list-none -ml-6 text-sm text-neutral-800">
                            <input
                                type="checkbox"
                                checked={checked}
                                readOnly
                                disabled
                                className="mt-1 h-4 w-4 rounded border-2 border-black accent-[#a2ff86] cursor-default shrink-0"
                            />
                            <span className={checked ? "line-through text-neutral-400 font-medium" : "text-neutral-900 font-medium"}>
                                {children}
                            </span>
                        </li>
                    );
                }
                return (
                    <li className="leading-relaxed text-sm text-neutral-800" {...props}>
                        {children}
                    </li>
                );
            },

            // Pass through pre wrapper so ClubCodeBlock manages its own block container
            pre: ({ children }: any) => <>{children}</>,

            code: ({ className: codeClass, children, ...props }: any) => {
                const match = /language-(\w+)/.exec(codeClass || "");
                const codeText = extractText(children);
                const isMultiline = codeText.includes("\n");

                // Fenced block code
                if (match || isMultiline) {
                    return (
                        <ClubCodeBlock
                            language={match ? match[1] : ""}
                            code={codeText}
                        />
                    );
                }

                // Inline code badge
                return (
                    <code
                        className="px-1.5 py-0.5 rounded-md bg-[#FAF6EE] text-[#e06c75] font-mono text-[12px] border border-black/20 font-semibold break-words"
                        {...props}
                    >
                        {children}
                    </code>
                );
            },

            table: ({ children, ...props }: any) => (
                <div className="my-6 w-full overflow-x-auto rounded-xl border-2 border-black shadow-[3px_3px_0px_#000] bg-white">
                    <table className="w-full text-left text-sm border-collapse min-w-full" {...props}>
                        {children}
                    </table>
                </div>
            ),

            thead: ({ children, ...props }: any) => (
                <thead className="bg-[#FAF6EE] border-b-2 border-black text-xs font-black uppercase tracking-wider text-black" {...props}>
                    {children}
                </thead>
            ),

            tbody: ({ children, ...props }: any) => (
                <tbody className="divide-y divide-black/10 bg-white" {...props}>
                    {children}
                </tbody>
            ),

            tr: ({ children, ...props }: any) => (
                <tr className="hover:bg-neutral-50 transition-colors" {...props}>
                    {children}
                </tr>
            ),

            th: ({ children, style, ...props }: any) => (
                <th
                    style={style}
                    className="px-4 py-3 font-black text-black border-r border-black/10 last:border-r-0 whitespace-nowrap"
                    {...props}
                >
                    {children}
                </th>
            ),

            td: ({ children, style, ...props }: any) => (
                <td
                    style={style}
                    className="px-4 py-3 text-neutral-800 border-r border-black/10 last:border-r-0 align-top leading-relaxed"
                    {...props}
                >
                    {children}
                </td>
            ),

            a: ({ href, children, ...props }: any) => {
                const cleanHref = (href || "").trim();
                // Block dangerous scripting schemes for untrusted user inputs
                const isUnsafe = /^(javascript:|data:|vbscript:)/i.test(cleanHref);
                const safeHref = isUnsafe ? "#" : cleanHref;
                const isExternal = safeHref.startsWith("http://") || safeHref.startsWith("https://");

                return (
                    <a
                        href={safeHref}
                        className="text-blue-600 underline font-semibold hover:text-blue-800 transition-colors inline-flex items-baseline gap-0.5"
                        {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                        {...props}
                    >
                        <span>{children}</span>
                        {isExternal && <ExternalLink className="w-3 h-3 ml-0.5 inline self-center opacity-70" />}
                    </a>
                );
            },

            img: ({ src, alt, title, ...props }: any) => (
                <SafeImage src={src} alt={alt} title={title} {...props} />
            ),

            hr: () => (
                <hr className="my-8 border-t-2 border-black/15" />
            ),

            details: ({ children, ...props }: any) => (
                <details
                    className="my-4 p-4 rounded-xl border-2 border-black shadow-[2px_2px_0px_#000] bg-white group"
                    {...props}
                >
                    {children}
                </details>
            ),

            summary: ({ children, ...props }: any) => (
                <summary
                    className="font-black text-sm text-black cursor-pointer select-none hover:text-neutral-700 focus:outline-none"
                    {...props}
                >
                    {children}
                </summary>
            ),

            kbd: ({ children, ...props }: any) => (
                <kbd
                    className="px-1.5 py-0.5 text-xs font-mono font-bold bg-[#FAF6EE] text-black border border-black rounded shadow-[1px_1px_0px_#000]"
                    {...props}
                >
                    {children}
                </kbd>
            ),

            section: ({ children, "data-footnotes": isFootnotes, ...props }: any) => {
                if (isFootnotes) {
                    return (
                        <section
                            className="mt-8 pt-4 border-t-2 border-black/15 text-xs text-neutral-600 space-y-2"
                            {...props}
                        >
                            <h4 className="font-mono text-[11px] font-black uppercase tracking-wider text-black">
                                Footnotes
                            </h4>
                            {children}
                        </section>
                    );
                }
                return <section {...props}>{children}</section>;
            },

            // Disallow and neutralize dangerous embedded executable HTML elements
            style: () => null,
            script: () => null,
            iframe: () => null,
            object: () => null,
            embed: () => null,
            link: () => null,
            meta: () => null,
            base: () => null,
            form: () => null,
        };
    }, [idCounterMap]);

    if (!content || !content.trim()) {
        return (
            <div className="py-8 text-center text-xs font-bold text-neutral-400 italic">
                Nothing to preview yet. Write some markdown content above!
            </div>
        );
    }

    return (
        <MarkdownErrorBoundary fallbackContent={content}>
            <div className={`club-markdown-preview prose prose-neutral max-w-none text-neutral-900 ${className}`}>
                <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath, remarkEmoji]}
                    rehypePlugins={[rehypeRaw, [rehypeKatex, { throwOnError: false, strict: false, errorColor: "#cc0000" }]]}
                    components={components}
                >
                    {content}
                </ReactMarkdown>
            </div>
        </MarkdownErrorBoundary>
    );
};
