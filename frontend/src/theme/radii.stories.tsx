import { useRef } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { TokenSection, useComputedStyle } from "./tokenDisplay";

const RADIUS_TOKENS = [
  { cssVar: "--radius-sm", label: "sm" },
  { cssVar: "--radius-card", label: "card" },
  { cssVar: "--radius-card-lg", label: "card-lg" },
  { cssVar: "--radius-tab", label: "tab" },
  { cssVar: "--radius-pill", label: "pill" },
  { cssVar: "--radius-full", label: "full" },
];

function RadiusElement({ cssVar, label }: { cssVar: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const computedRadius = useComputedStyle(ref, "borderRadius");
  const isPillLike = cssVar === "--radius-pill" || cssVar === "--radius-full";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
      <div
        ref={ref}
        style={{
          width: isPillLike ? 96 : 80,
          height: 80,
          borderRadius: `var(${cssVar})`,
          background: "var(--tabiya-blue)",
          border: "1.5px solid var(--tabiya-blue)",
        }}
      />
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--grey-text)", textAlign: "center" }}>
        {label} · {cssVar}
        <br />
        {computedRadius}
      </span>
    </div>
  );
}

function RadiiShowcase() {
  return (
    <div style={{ padding: "2rem" }}>
      <TokenSection title="Corner radii">
        <div style={{ display: "flex", flexWrap: "wrap", gap: "2rem" }}>
          {RADIUS_TOKENS.map((token) => (
            <RadiusElement key={token.cssVar} {...token} />
          ))}
        </div>
      </TokenSection>
    </div>
  );
}

const meta = {
  title: "Style/Radii",
  component: RadiiShowcase,
  tags: ["autodocs"],
} satisfies Meta<typeof RadiiShowcase>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Rounding: Story = {};
