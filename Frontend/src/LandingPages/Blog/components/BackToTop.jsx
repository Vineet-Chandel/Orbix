import React, { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Neo-Brutalist floating Back-to-Top button.
 */
export function BackToTop() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(window.scrollY > 400);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
    window.history.pushState(null, '', ' ');
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.button
          type="button"
          onClick={scrollToTop}
          initial={{ opacity: 0, scale: 0.8, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 10 }}
          whileHover={{ x: -2, y: -2, boxShadow: '5px 5px 0px #000000' }}
          whileTap={{ x: 2, y: 2, boxShadow: '0px 0px 0px #000000' }}
          className="fixed bottom-6 right-6 z-30 p-3 border-2 border-black dark:border-white bg-[#a6ff70] text-black shadow-[3px_3px_0px_#000000] dark:shadow-[3px_3px_0px_#ffffff] focus:outline-none select-none flex items-center gap-1.5 font-mono text-xs font-bold"
          aria-label="Scroll back to top of document"
          title="Back to top"
        >
          <ArrowUp className="w-4 h-4 stroke-[3]" />
          <span className="hidden sm:inline">TOP</span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
