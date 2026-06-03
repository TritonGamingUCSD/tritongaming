import { useEffect, useRef, RefObject } from "react";

/**
 * Fades sections in as they enter the viewport using IntersectionObserver.
 * Opacity-only (no scale/transform) keeps compositing cheap on all screen sizes.
 */
export function useScrollFocus<T extends HTMLElement>(): RefObject<T> {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Start dimmed; CSS transition handles the smooth fade
    el.style.opacity = "0.35";
    el.style.transition = "opacity 0.7s cubic-bezier(0.22, 1, 0.36, 1)";
    el.style.willChange = "opacity";

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          // Fully visible or mostly in view → opaque; otherwise dimmed
          (entry.target as HTMLElement).style.opacity = entry.isIntersecting ? "1" : "0.35";
        }
      },
      {
        // Fire when ≥15% of the element is visible
        threshold: 0.15,
      }
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
      el.style.willChange = "";
    };
  }, []);

  return ref as RefObject<T>;
}
