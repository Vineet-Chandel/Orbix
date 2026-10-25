import React, { useState, useEffect } from 'react';

/**
 * Neo-Brutalist reading progress indicator.
 * Positioned cleanly at z-50 with high-contrast color matching the reference palette.
 */
export function ReadingProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight <= 0) {
        setProgress(0);
        return;
      }
      const scrolled = (window.scrollY / docHeight) * 100;
      setProgress(Math.min(100, Math.max(0, scrolled)));
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <div
      className="fixed top-14 left-0 right-0 z-50 h-[3px] bg-black/10 dark:bg-white/10 pointer-events-none"
      role="progressbar"
      aria-label="Reading progress"
      aria-valuenow={Math.round(progress)}
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <div
        className="h-full bg-[#a6ff70] dark:bg-[#a6ff70] border-r-2 border-black dark:border-white transition-[width] duration-75 ease-out shadow-[0_1px_2px_rgba(0,0,0,0.4)]"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
