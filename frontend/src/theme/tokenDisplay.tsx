import { useEffect, useRef, useState } from "react";

/** Reads a CSS custom property's resolved value directly off the document root. */
export function readCssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Reads a computed style property off a live DOM node, updating on window resize. */
export function useComputedStyle(ref: React.RefObject<HTMLElement | null>, property: keyof CSSStyleDeclaration) {
  const [value, setValue] = useState("");

  useEffect(() => {
    const read = () => {
      if (!ref.current) return;
      const computed = getComputedStyle(ref.current)[property];
      setValue(typeof computed === "string" ? computed : "");
    };
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, [ref, property]);

  return value;
}

function hexToRgb(hex: string): [number, number, number] | null {
  const match = hex.replace("#", "").match(/^([0-9a-f]{6})$/i);
  if (!match) return null;
  const int = parseInt(match[1], 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const channel = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(rgbA: [number, number, number], rgbB: [number, number, number]): number {
  const lumA = relativeLuminance(rgbA) + 0.05;
  const lumB = relativeLuminance(rgbB) + 0.05;
  return Math.max(lumA, lumB) / Math.min(lumA, lumB);
}

/** Picks whichever of black/white/Oxford Blue yields the highest WCAG contrast ratio against a hex background. */
export function contrastTextFor(hexOrCss: string): string {
  const rgb = hexToRgb(hexOrCss);
  if (!rgb) return "#002147"; // fallback: Oxford Blue reads fine on most non-hex (e.g. rgba) surfaces here

  const candidates: [string, [number, number, number]][] = [
    ["#ffffff", [255, 255, 255]],
    ["#002147", [0, 33, 71]],
  ];
  return candidates.reduce((best, candidate) =>
    contrastRatio(rgb, candidate[1]) > contrastRatio(rgb, best[1]) ? candidate : best
  )[0];
}

export function Swatch({ cssVar, label, height = "4rem" }: { cssVar: string; label?: string; height?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [resolved, setResolved] = useState("");

  useEffect(() => {
    if (ref.current) {
      setResolved(getComputedStyle(ref.current).backgroundColor);
    }
  }, []);

  const rawValue = readCssVar(cssVar);
  const textColor = contrastTextFor(rawValue);

  return (
    <div
      ref={ref}
      style={{
        height,
        width: "100%",
        borderRadius: "var(--radius-sm)",
        background: `var(${cssVar})`,
        color: textColor,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        padding: "0.5rem 0.75rem",
        fontFamily: "var(--font-mono)",
        fontSize: "11px",
        lineHeight: 1.4,
        border: "1px solid var(--border-subtle)",
      }}
    >
      <span style={{ fontWeight: 600 }}>{label ?? cssVar}</span>
      <span>{cssVar}</span>
      <span>{rawValue || resolved}</span>
    </div>
  );
}

export function TokenSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: "2.5rem" }}>
      <h2
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "12px",
          letterSpacing: "2px",
          textTransform: "uppercase",
          color: "var(--green-3)",
          marginBottom: "1rem",
          fontWeight: 500,
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

export function TokenGrid({ min = "180px", children }: { min?: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(auto-fill, minmax(${min}, 1fr))`,
        gap: "0.75rem",
      }}
    >
      {children}
    </div>
  );
}
