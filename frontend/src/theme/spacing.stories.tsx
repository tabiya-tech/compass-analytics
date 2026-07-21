import { useRef } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { TokenSection, useComputedStyle } from "./tokenDisplay";

const SPACING_TOKENS = [
  { cssVar: "--space-3xs", label: "3xs" },
  { cssVar: "--space-2xs", label: "2xs" },
  { cssVar: "--space-xs", label: "xs" },
  { cssVar: "--space-sm", label: "sm" },
  { cssVar: "--space-md", label: "md" },
  { cssVar: "--space-lg", label: "lg" },
  { cssVar: "--space-xl", label: "xl" },
];

function SpacingElement({ cssVar, label }: { cssVar: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const computedPadding = useComputedStyle(ref, "padding");

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
      <div
        style={{
          border: "1px dashed var(--border-strong)",
          borderRadius: "var(--radius-sm)",
        }}
      >
        <div
          ref={ref}
          style={{
            padding: `var(${cssVar})`,
            background: "var(--tabiya-grey)",
          }}
        >
          <div style={{ width: 32, height: 32, background: "var(--tabiya-green)", borderRadius: "var(--radius-sm)" }} />
        </div>
      </div>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--grey-text)", textAlign: "center" }}>
        {label} · {cssVar}
        <br />
        {computedPadding}
      </span>
    </div>
  );
}

function SpacingShowcase() {
  return (
    <div style={{ padding: "2rem" }}>
      <TokenSection title="Spacing scale (~1.5x ratio)">
        <div style={{ display: "flex", flexWrap: "wrap", gap: "2rem", alignItems: "flex-end" }}>
          {SPACING_TOKENS.map((token) => (
            <SpacingElement key={token.cssVar} {...token} />
          ))}
        </div>
      </TokenSection>
    </div>
  );
}

const meta = {
  title: "Style/Spacing",
  component: SpacingShowcase,
  tags: ["autodocs"],
} satisfies Meta<typeof SpacingShowcase>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Scale: Story = {};
