import { useEffect, useRef, RefObject } from "react";

/**
 * Hook to add fade-in animations when elements scroll into view
 * Adds the 'reveal' or 'reveal-gradient' class when the element intersects the viewport
 */
export function useScrollReveal<T extends HTMLElement>(threshold = 0.1, useGradient = false): RefObject<T> {
  const ref = useRef<T>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          const className = useGradient ? "reveal-gradient" : "reveal";
          entry.target.classList.add(className);
          // Optional: unobserve after first intersection to avoid re-triggering
          observer.unobserve(entry.target);
        }
      },
      {
        threshold,
        rootMargin: "0px 0px -50px 0px", // Trigger when section is 1/4 into view
      }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
    };
  }, [threshold, useGradient]);

  return ref as RefObject<T>;
}
