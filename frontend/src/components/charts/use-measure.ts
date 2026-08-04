import { useEffect, useRef, useState } from "react";

/**
 * Tracks the rendered width of an element, so a chart sizes itself to the card
 * it is dropped into. Height is always given explicitly by the caller.
 */
export function useMeasure<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    setWidth(element.getBoundingClientRect().width);
    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // borderBoxSize is the reliable read; contentRect lags in some browsers.
        setWidth(entry.borderBoxSize?.[0]?.inlineSize ?? entry.contentRect.width);
      }
    });
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  return [ref, width];
}
