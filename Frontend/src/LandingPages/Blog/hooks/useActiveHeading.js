import { useState, useEffect } from 'react';

/**
 * Tracks the heading ID currently being read based on scroll position.
 * 
 * @param {Array<{ id: string }>} headings - List of heading objects
 * @param {number} topOffset - Header offset in pixels (defaults to 100px)
 * @returns {string} activeId - The ID of the active heading
 */
export function useActiveHeading(headings, topOffset = 100) {
  const [activeId, setActiveId] = useState('');

  useEffect(() => {
    if (!headings || headings.length === 0) {
      setActiveId('');
      return;
    }

    const headingIds = headings.map((h) => h.id);

    const handleScroll = () => {
      const scrollPosition = window.scrollY + topOffset;
      const elements = headingIds
        .map((id) => document.getElementById(id))
        .filter(Boolean);

      if (elements.length === 0) return;

      // Find the heading that is closest to but above the top offset
      let currentActiveId = elements[0].id;

      for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        const top = el.offsetTop;

        if (scrollPosition >= top - 20) {
          currentActiveId = el.id;
        } else {
          break;
        }
      }

      // Check if user is at the very bottom of page
      if (
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 50
      ) {
        currentActiveId = elements[elements.length - 1].id;
      }

      setActiveId(currentActiveId);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    // Initial check
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [headings, topOffset]);

  return activeId;
}
