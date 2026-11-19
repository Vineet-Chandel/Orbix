import Prism from "prismjs";

// Import all required languages for syntax highlighting
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-tsx";
import "prismjs/components/prism-python";
import "prismjs/components/prism-c";
import "prismjs/components/prism-cpp";
import "prismjs/components/prism-java";
import "prismjs/components/prism-markup"; // HTML, XML, SVG
import "prismjs/components/prism-css";
import "prismjs/components/prism-json";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-sql";
import "prismjs/components/prism-yaml";
import "prismjs/components/prism-markdown";
import "prismjs/components/prism-docker";
import "prismjs/components/prism-go";
import "prismjs/components/prism-rust";
import "prismjs/components/prism-diff";

/**
 * Normalizes language aliases to supported Prism grammar identifiers.
 */
export function normalizeLanguage(lang?: string): string {
    if (!lang) return "plaintext";
    const l = lang.toLowerCase().trim();

    switch (l) {
        case "js":
            return "javascript";
        case "ts":
            return "typescript";
        case "jsx":
            return "jsx";
        case "tsx":
            return "tsx";
        case "py":
        case "python3":
            return "python";
        case "sh":
        case "shell":
        case "zsh":
            return "bash";
        case "yml":
            return "yaml";
        case "dockerfile":
            return "docker";
        case "golang":
            return "go";
        case "rs":
            return "rust";
        case "c++":
            return "cpp";
        case "h":
            return "c";
        case "hpp":
            return "cpp";
        case "html":
        case "xml":
        case "svg":
            return "markup";
        case "md":
            return "markdown";
        default:
            return Prism.languages[l] ? l : "plaintext";
    }
}

/**
 * Highlights source code using Prism.
 * Safely falls back to plaintext if grammar is missing or throws an error.
 */
export function highlightCode(code: string, language?: string): { html: string; normalizedLang: string } {
    const rawCode = String(code || "").replace(/\n$/, "");
    const normalizedLang = normalizeLanguage(language);

    if (normalizedLang === "plaintext" || !Prism.languages[normalizedLang]) {
        // Simple HTML-escaped plaintext
        const escaped = rawCode
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
        return { html: escaped, normalizedLang };
    }

    try {
        const grammar = Prism.languages[normalizedLang];
        const html = Prism.highlight(rawCode, grammar, normalizedLang);
        return { html, normalizedLang };
    } catch {
        const escaped = rawCode
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
        return { html: escaped, normalizedLang: "plaintext" };
    }
}
