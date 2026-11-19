import { useEffect, useState, type RefObject } from 'react';

/** Keep ambient animation work limited to visible content in an active tab. */
export function useVisibleMotion(ref: RefObject<HTMLElement | null>) {
  const [active, setActive] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let visible = false;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setActive(visible && !document.hidden && !preference.matches);
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      update();
    });
    observer.observe(element);
    document.addEventListener('visibilitychange', update);
    preference.addEventListener('change', update);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', update);
      preference.removeEventListener('change', update);
    };
  }, [ref]);
  return active;
}
