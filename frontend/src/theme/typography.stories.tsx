import { useRef } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { TokenSection, useComputedStyle } from "./tokenDisplay";

const SIZE_TOKENS: { cssVar: string; label: string; fontVar?: string; weightVar?: string }[] = [
  { cssVar: "--text-display", label: "Display", weightVar: "--weight-semibold" },
  { cssVar: "--text-h1", label: "H1", weightVar: "--weight-semibold" },
  { cssVar: "--text-h2", label: "H2", weightVar: "--weight-semibold" },
  { cssVar: "--text-h3", label: "H3", weightVar: "--weight-bold" },
  { cssVar: "--text-h4", label: "H4", weightVar: "--weight-bold" },
  { cssVar: "--text-lead", label: "Lead", weightVar: "--weight-regular" },
  { cssVar: "--text-body", label: "Body", weightVar: "--weight-regular" },
  { cssVar: "--text-small", label: "Small", weightVar: "--weight-regular" },
  { cssVar: "--text-stat", label: "Stat", weightVar: "--weight-semibold" },
];

function TypographySample({ cssVar, label, weightVar }: { cssVar: string; label: string; weightVar?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const computedSize = useComputedStyle(ref, "fontSize");

  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: "1.5rem",
        padding: "0.75rem 0",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      <span
        style={{
          width: 220,
          flexShrink: 0,
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--grey-text)",
        }}
      >
        {label} · {cssVar}
        <br />
        {computedSize}
      </span>
      <span
        ref={ref}
        style={{
          fontFamily: "var(--font-primary)",
          fontSize: `var(${cssVar})`,
          fontWeight: weightVar ? `var(${weightVar})` : undefined,
          color: "var(--tabiya-blue)",
          lineHeight: 1.15,
        }}
      >
        Compass Analytics
      </span>
    </div>
  );
}

function EyebrowSample() {
  const ref = useRef<HTMLDivElement>(null);
  const computedSize = useComputedStyle(ref, "fontSize");

  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: "1.5rem",
        padding: "0.75rem 0",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      <span
        style={{ width: 220, flexShrink: 0, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--grey-text)" }}
      >
        Eyebrow · --text-eyebrow-size
        <br />
        {computedSize}
      </span>
      <span
        ref={ref}
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-eyebrow-size)",
          letterSpacing: "var(--tracking-eyebrow)",
          textTransform: "uppercase",
          color: "var(--text-eyebrow)",
          fontWeight: 500,
        }}
      >
        Reach & Engagement
      </span>
    </div>
  );
}

function FontFamilies() {
  return (
    <TokenSection title="Font families">
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div style={{ fontFamily: "var(--font-primary)", fontSize: 20, color: "var(--tabiya-blue)" }}>
          DM Sans (--font-primary) — The quick brown fox jumps over the lazy dog
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 16, color: "var(--tabiya-blue)" }}>
          DM Mono (--font-mono) — The quick brown fox jumps over the lazy dog
        </div>
      </div>
    </TokenSection>
  );
}

function FontWeights() {
  const weights: { cssVar: string; label: string }[] = [
    { cssVar: "--weight-regular", label: "Regular (400)" },
    { cssVar: "--weight-medium", label: "Medium (500)" },
    { cssVar: "--weight-semibold", label: "Semibold (600)" },
    { cssVar: "--weight-bold", label: "Bold (700)" },
  ];
  return (
    <TokenSection title="Font weights">
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {weights.map((w) => (
          <div
            key={w.cssVar}
            style={{
              fontFamily: "var(--font-primary)",
              fontWeight: `var(${w.cssVar})`,
              fontSize: 18,
              color: "var(--tabiya-blue)",
            }}
          >
            {w.label} — Compass Analytics
          </div>
        ))}
      </div>
    </TokenSection>
  );
}

function TypographyShowcase() {
  return (
    <div style={{ padding: "2rem", maxWidth: 960 }}>
      <TokenSection title="Type scale">
        {SIZE_TOKENS.map((token) => (
          <TypographySample key={token.cssVar} {...token} />
        ))}
        <EyebrowSample />
      </TokenSection>
      <FontFamilies />
      <FontWeights />
    </div>
  );
}

const meta = {
  title: "Style/Typography",
  component: TypographyShowcase,
  tags: ["autodocs"],
} satisfies Meta<typeof TypographyShowcase>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TypeScale: Story = {};
