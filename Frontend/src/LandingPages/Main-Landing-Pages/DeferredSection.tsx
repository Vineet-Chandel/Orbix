import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react';

/** Cache real layout before skipping offscreen paint; visible modals keep normal positioning. */
function ShowcaseContent({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || !('IntersectionObserver' in window)) return;
    element.style.containIntrinsicHeight = `auto ${element.offsetHeight}px`;
    const observer = new IntersectionObserver(([entry]) => {
      element.style.contentVisibility = entry.isIntersecting ? 'visible' : 'auto';
    }, { rootMargin: '300px 0px' });
    observer.observe(element);
    return () => {
      observer.disconnect();
      element.style.contentVisibility = 'visible';
    };
  }, []);
  return <div ref={ref} className="w-full">{children}</div>;
}

/** Load showcases shortly before they enter view; keep their state on return visits. */
export function DeferredSection({ children, height = 700 }: { children: ReactNode; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(() => typeof window !== 'undefined' && !('IntersectionObserver' in window));
  useEffect(() => {
    const element = ref.current;
    if (!element || !('IntersectionObserver' in window)) return;
    const reveal = () => {
      setReady(true);
      observer.disconnect();
    };
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) reveal();
    }, { rootMargin: '2000px 0px' });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, []);
  const placeholder = <div style={{ height }} aria-hidden="true" />;
  return <div ref={ref} className="w-full">{ready ? <Suspense fallback={placeholder}><ShowcaseContent>{children}</ShowcaseContent></Suspense> : placeholder}</div>;
}
