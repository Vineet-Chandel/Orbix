import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Info,
  Lightbulb,
  AlertTriangle,
  AlertCircle,
  ShieldAlert,
  Link as LinkIcon,
  ExternalLink,
} from 'lucide-react';
import { CodeBlock } from './CodeBlock';
import { slugify, extractText } from '../utils/slugify';

/**
 * Parses and renders callout banners if a blockquote starts with [!TYPE].
 */
function CalloutBlockquote({ children }) {
  const textContent = extractText(children);
  const match = textContent.match(/^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*([\s\S]*)$/i);

  if (!match) {
    return (
      <blockquote className="my-6 border-l-2 border-zinc-300 dark:border-zinc-700 pl-4 py-1 italic text-zinc-600 dark:text-zinc-400">
        {children}
      </blockquote>
    );
  }

  const type = match[1].toUpperCase();
  // Strip the [!TYPE] marker from the rendered child
  const stripPrefix = (nodes) => {
    if (typeof nodes === 'string') {
      return nodes.replace(/^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i, '');
    }
    if (Array.isArray(nodes)) {
      return nodes.map((n, i) => (i === 0 ? stripPrefix(n) : n));
    }
    if (nodes && nodes.props && nodes.props.children) {
      return React.cloneElement(nodes, {
        children: stripPrefix(nodes.props.children),
      });
    }
    return nodes;
  };

  const cleanedChildren = stripPrefix(children);

  const configs = {
    NOTE: {
      label: 'Note',
      icon: Info,
      containerClass: 'bg-white dark:bg-zinc-900 text-black dark:text-zinc-100',
      badgeClass: 'bg-[#67e8f9] text-black border border-black',
    },
    TIP: {
      label: 'Tip',
      icon: Lightbulb,
      containerClass: 'bg-white dark:bg-zinc-900 text-black dark:text-zinc-100',
      badgeClass: 'bg-[#a6ff70] text-black border border-black',
    },
    IMPORTANT: {
      label: 'Important',
      icon: AlertCircle,
      containerClass: 'bg-white dark:bg-zinc-900 text-black dark:text-zinc-100',
      badgeClass: 'bg-[#c084fc] text-black border border-black',
    },
    WARNING: {
      label: 'Warning',
      icon: AlertTriangle,
      containerClass: 'bg-[#fde047]/20 dark:bg-amber-950/20 text-black dark:text-zinc-100',
      badgeClass: 'bg-[#fde047] text-black border border-black',
    },
    CAUTION: {
      label: 'Caution',
      icon: ShieldAlert,
      containerClass: 'bg-[#fda4af]/20 dark:bg-rose-950/20 text-black dark:text-zinc-100',
      badgeClass: 'bg-[#fda4af] text-black border border-black',
    },
  };

  const config = configs[type] || configs.NOTE;
  const IconComponent = config.icon;

  return (
    <div className={`my-6 border-2 border-black dark:border-white shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#ffffff] p-5 text-sm leading-relaxed ${config.containerClass}`}>
      <div className="flex items-center gap-2 mb-2.5 font-bold">
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-mono uppercase tracking-wider ${config.badgeClass}`}>
          <IconComponent className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>{config.label}</span>
        </span>
      </div>
      <div className="prose-content [&>p]:m-0 [&>p+p]:mt-2">
        {cleanedChildren}
      </div>
    </div>
  );
}

/**
 * Creates heading component that auto-assigns anchor ID and provides hoverable permalink.
 */
function createHeading(level, idCounterMap) {
  const Tag = `h${level}`;

  return ({ children, ...props }) => {
    const rawText = extractText(children);
    let baseSlug = slugify(rawText) || `section-${level}`;

    // Compute unique ID matching TOC parsing
    let id = baseSlug;
    const count = idCounterMap.get(baseSlug) || 0;
    if (count > 0) {
      id = `${baseSlug}-${count}`;
    }
    idCounterMap.set(baseSlug, count + 1);

    const sizeClasses = {
      1: 'text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mt-10 mb-6 pb-3 border-b border-zinc-200 dark:border-zinc-800',
      2: 'text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 mt-12 mb-4 pb-2 border-b border-zinc-100 dark:border-zinc-800/60',
      3: 'text-xl sm:text-2xl font-semibold text-zinc-800 dark:text-zinc-200 mt-8 mb-3',
      4: 'text-lg font-semibold text-zinc-800 dark:text-zinc-200 mt-6 mb-2',
      5: 'text-base font-semibold text-zinc-700 dark:text-zinc-300 mt-4 mb-2',
      6: 'text-sm font-semibold text-zinc-600 dark:text-zinc-400 mt-4 mb-1 uppercase tracking-wider',
    };

    return (
      <Tag
        id={id}
        className={`group relative scroll-mt-24 ${sizeClasses[level] || ''}`}
        {...props}
      >
        <span className="relative">
          {children}
          <a
            href={`#${id}`}
            className="inline-flex items-center ml-2 text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-zinc-900 dark:hover:text-zinc-100 focus:opacity-100 focus:outline-none"
            aria-label={`Direct link to ${rawText}`}
            title={`Direct link to ${rawText}`}
          >
            <LinkIcon className="w-4 h-4" />
          </a>
        </span>
      </Tag>
    );
  };
}

/**
 * DocumentRenderer component responsible for transforming Markdown
 * into an accessible, beautiful reading interface.
 */
export function DocumentRenderer({ content }) {
  // Fresh ID counter map for each render pass to ensure 1:1 match with TOC
  const idCounterMap = useMemo(() => new Map(), [content]);

  const components = useMemo(() => {
    return {
      h1: createHeading(1, idCounterMap),
      h2: createHeading(2, idCounterMap),
      h3: createHeading(3, idCounterMap),
      h4: createHeading(4, idCounterMap),
      h5: createHeading(5, idCounterMap),
      h6: createHeading(6, idCounterMap),

      p: ({ children, ...props }) => (
        <p className="my-4 text-base leading-relaxed text-zinc-700 dark:text-zinc-300" {...props}>
          {children}
        </p>
      ),

      a: ({ href, children, ...props }) => {
        const isExternal = href && (href.startsWith('http://') || href.startsWith('https://'));
        return (
          <a
            href={href}
            className="inline-flex items-baseline gap-0.5 font-medium text-zinc-900 dark:text-zinc-100 underline underline-offset-4 decoration-zinc-400/80 hover:decoration-zinc-900 dark:decoration-zinc-600 dark:hover:decoration-zinc-100 transition-colors"
            {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            {...props}
          >
            <span>{children}</span>
            {isExternal && <ExternalLink className="w-3 h-3 ml-0.5 inline self-center opacity-70" />}
          </a>
        );
      },

      ul: ({ children, ...props }) => (
        <ul className="my-4 ml-6 list-disc space-y-1.5 text-zinc-700 dark:text-zinc-300 marker:text-zinc-400 dark:marker:text-zinc-600" {...props}>
          {children}
        </ul>
      ),

      ol: ({ children, ...props }) => (
        <ol className="my-4 ml-6 list-decimal space-y-1.5 text-zinc-700 dark:text-zinc-300 marker:text-zinc-500 marker:font-medium dark:marker:text-zinc-500" {...props}>
          {children}
        </ol>
      ),

      li: ({ children, checked, ...props }) => {
        // Task list item
        if (checked !== null && checked !== undefined) {
          return (
            <li className="flex items-start gap-2.5 my-1.5 list-none -ml-6 text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={checked}
                readOnly
                className="mt-1 h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:ring-0 cursor-default accent-zinc-900 dark:accent-zinc-100"
              />
              <span className={checked ? 'line-through text-zinc-400 dark:text-zinc-500' : ''}>
                {children}
              </span>
            </li>
          );
        }
        return (
          <li className="leading-relaxed" {...props}>
            {children}
          </li>
        );
      },

      blockquote: CalloutBlockquote,

      // Pre wrapper - pass through so CodeBlock manages container
      pre: ({ children }) => <>{children}</>,

      code: ({ className, children, ...props }) => {
        const match = /language-(\w+)/.exec(className || '');
        const codeText = String(children);
        const isMultiline = codeText.includes('\n');

        // Block code
        if (match || isMultiline) {
          return (
            <CodeBlock
              language={match ? match[1] : ''}
              code={codeText}
            />
          );
        }

        // Inline code
        return (
          <code
            className="px-1.5 py-0.5 rounded text-[13px] font-mono bg-zinc-100 dark:bg-zinc-800/80 text-zinc-800 dark:text-zinc-200 border border-zinc-200/80 dark:border-zinc-700/80"
            {...props}
          >
            {children}
          </code>
        );
      },

      table: ({ children, ...props }) => (
        <div className="my-6 w-full overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <table className="w-full text-left text-sm border-collapse" {...props}>
            {children}
          </table>
        </div>
      ),

      thead: ({ children, ...props }) => (
        <thead className="bg-zinc-50 dark:bg-zinc-900/80 border-b border-zinc-200 dark:border-zinc-800 text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400" {...props}>
          {children}
        </thead>
      ),

      tbody: ({ children, ...props }) => (
        <tbody className="divide-y divide-zinc-200/70 dark:divide-zinc-800/70 bg-white dark:bg-zinc-950" {...props}>
          {children}
        </tbody>
      ),

      tr: ({ children, ...props }) => (
        <tr className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/40 transition-colors" {...props}>
          {children}
        </tr>
      ),

      th: ({ children, ...props }) => (
        <th className="px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-100" {...props}>
          {children}
        </th>
      ),

      td: ({ children, ...props }) => (
        <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300 align-top" {...props}>
          {children}
        </td>
      ),

      hr: () => (
        <hr className="my-10 border-t border-zinc-200 dark:border-zinc-800" />
      ),

      img: ({ src, alt, ...props }) => (
        <figure className="my-6">
          <img
            src={src}
            alt={alt || ''}
            className="rounded-lg border border-zinc-200 dark:border-zinc-800 max-w-full h-auto"
            loading="lazy"
            {...props}
          />
          {alt && (
            <figcaption className="mt-2 text-center text-xs text-zinc-500 dark:text-zinc-400">
              {alt}
            </figcaption>
          )}
        </figure>
      ),
    };
  }, [idCounterMap]);

  return (
    <article className="document-article max-w-[820px] mx-auto px-4 sm:px-8 py-8 lg:py-12">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </article>
  );
}
