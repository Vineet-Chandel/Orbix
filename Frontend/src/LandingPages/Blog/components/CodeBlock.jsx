import React, { useState, useMemo } from 'react';
import { Copy, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import Prism from 'prismjs';

import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-docker';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-javascript';

function normalizeLanguage(lang) {
  if (!lang) return 'plaintext';
  const l = lang.toLowerCase().trim();
  if (l === 'js') return 'javascript';
  if (l === 'ts') return 'javascript';
  if (l === 'sh' || l === 'shell' || l === 'zsh') return 'bash';
  if (l === 'yml') return 'yaml';
  if (l === 'docker') return 'docker';
  if (l === 'dockerfile') return 'docker';
  if (l === 'py') return 'python';
  return l;
}

export function CodeBlock({ code, language = 'plaintext', className = '' }) {
  const [copied, setCopied] = useState(false);
  const normalizedLang = normalizeLanguage(language);

  const highlightedHtml = useMemo(() => {
    const rawCode = String(code || '').replace(/\n$/, '');
    const grammar = Prism.languages[normalizedLang] || Prism.languages.plaintext;
    try {
      return Prism.highlight(rawCode, grammar, normalizedLang);
    } catch {
      return Prism.highlight(rawCode, Prism.languages.plaintext, 'plaintext');
    }
  }, [code, normalizedLang]);

  const handleCopy = async () => {
    const rawCode = String(code || '').replace(/\n$/, '');
    try {
      await navigator.clipboard.writeText(rawCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code to clipboard', err);
    }
  };

  return (
    <div
      className={`my-6 border-2 border-black dark:border-white bg-[#0e0f12] text-zinc-100 shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#ffffff] overflow-hidden ${className}`}
    >
      {/* Code Header Bar */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 bg-black border-b-2 border-black dark:border-zinc-800 text-xs">
        <span className="font-mono text-xs font-bold uppercase tracking-wider text-black bg-[#fde047] px-2 py-0.5 border border-black select-none">
          {language || 'code'}
        </span>
        <motion.button
          type="button"
          onClick={handleCopy}
          whileHover={{ x: -1, y: -1 }}
          whileTap={{ x: 1, y: 1 }}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-bold border-2 border-black transition-colors focus:outline-none ${
            copied
              ? 'bg-[#a6ff70] text-black shadow-[1.5px_1.5px_0px_#000000]'
              : 'bg-white text-black shadow-[2px_2px_0px_#000000] hover:bg-slate-100'
          }`}
          aria-label={copied ? 'Code copied to clipboard' : 'Copy code to clipboard'}
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
        </motion.button>
      </div>

      {/* Code Body */}
      <div className="overflow-x-auto p-4 text-[13px] leading-relaxed font-mono bg-[#090a0d]">
        <pre className="m-0 p-0 bg-transparent">
          <code
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
            className={`language-${normalizedLang}`}
          />
        </pre>
      </div>
    </div>
  );
}
