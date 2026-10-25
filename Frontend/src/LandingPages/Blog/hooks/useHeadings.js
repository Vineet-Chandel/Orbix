import { useMemo } from 'react';
import { slugify } from '../utils/slugify';

/**
 * Parses markdown text to extract structured heading information (H1 - H4)
 * with deterministic slugs, levels, and unique IDs.
 *
 * @param {string} markdownText - Raw markdown content
 * @returns {Array<{ id: string, text: string, level: number }>}
 */
export function useHeadings(markdownText) {
  return useMemo(() => {
    if (!markdownText || typeof markdownText !== 'string') {
      return [];
    }

    const headingRegex = /^(#{1,4})\s+(.+)$/gm;
    const items = [];
    const idCountMap = new Map();

    let match;
    while ((match = headingRegex.exec(markdownText)) !== null) {
      const hashes = match[1];
      const rawText = match[2].trim();
      const level = hashes.length;

      // Clean raw text (remove markdown links, bold, italics, code)
      const cleanText = rawText
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [link](url) -> link
        .replace(/[*_`~]/g, '')                   // formatting chars
        .replace(/<[^>]*>/g, '')                  // HTML tags
        .trim();

      if (!cleanText) continue;

      let baseSlug = slugify(cleanText);
      if (!baseSlug) {
        baseSlug = `section-${items.length + 1}`;
      }

      // Handle duplicate headings
      let uniqueSlug = baseSlug;
      const count = idCountMap.get(baseSlug) || 0;
      if (count > 0) {
        uniqueSlug = `${baseSlug}-${count}`;
      }
      idCountMap.set(baseSlug, count + 1);

      items.push({
        id: uniqueSlug,
        text: cleanText,
        level,
      });
    }

    return items;
  }, [markdownText]);
}
