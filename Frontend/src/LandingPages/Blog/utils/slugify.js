/**
 * Generates a URL-friendly, deterministic slug from a string.
 * Used for heading anchors, table of contents navigation, and scroll spy.
 * 
 * @param {string} text - The heading text to slugify
 * @returns {string} - Slugified string
 */
export function slugify(text) {
  if (!text || typeof text !== 'string') return '';
  
  return text
    .toString()
    .toLowerCase()
    .trim()
    // Remove markdown formatting like bold, italic, inline code
    .replace(/[*_`~]/g, '')
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Replace non-alphanumeric chars (keep hyphens and spaces)
    .replace(/[^\w\s-]/g, '')
    // Replace whitespace with hyphens
    .replace(/[\s_-]+/g, '-')
    // Trim leading/trailing hyphens
    .replace(/^-+|-+$/g, '');
}

/**
 * Extracts plain text from React children / Markdown AST nodes.
 * 
 * @param {any} children
 * @returns {string}
 */
export function extractText(children) {
  if (typeof children === 'string') return children;
  if (typeof children === 'number') return String(children);
  if (!children) return '';
  if (Array.isArray(children)) return children.map(extractText).join('');
  if (children.props && children.props.children) {
    return extractText(children.props.children);
  }
  return '';
}
