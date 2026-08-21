import type { Meta, StoryObj } from "@storybook/react-vite";
import { Swatch, TokenGrid, TokenSection } from "./tokenDisplay";

function ColorPalette() {
  return (
    <div style={{ padding: "2rem", background: "var(--background)", maxWidth: 960 }}>
      <TokenSection title="Core brand">
        <TokenGrid>
          <Swatch cssVar="--tabiya-blue" label="Oxford / Tabiya Blue" />
          <Swatch cssVar="--tabiya-green" label="Tabiya Green" />
          <Swatch cssVar="--light-green" label="Light Green" />
          <Swatch cssVar="--tabiya-grey" label="Tabiya Grey" />
        </TokenGrid>
      </TokenSection>

      <TokenSection title="Tonal greens">
        <TokenGrid>
          <Swatch cssVar="--green-2" label="Green 2" />
          <Swatch cssVar="--green-3" label="Green 3" />
          <Swatch cssVar="--fold-navy" label="Fold Navy" />
        </TokenGrid>
      </TokenSection>

      <TokenSection title="Neutrals">
        <TokenGrid>
          <Swatch cssVar="--white" label="White" />
          <Swatch cssVar="--grey-text" label="Grey Text" />
          <Swatch cssVar="--black" label="Black" />
        </TokenGrid>
      </TokenSection>

      <TokenSection title="Semantic text">
        <TokenGrid>
          <Swatch cssVar="--text-strong" label="Text Strong" />
          <Swatch cssVar="--text-muted" label="Text Muted" />
          <Swatch cssVar="--text-inverse" label="Text Inverse" />
          <Swatch cssVar="--text-eyebrow" label="Text Eyebrow" />
        </TokenGrid>
      </TokenSection>

      <TokenSection title="Surfaces">
        <TokenGrid>
          <Swatch cssVar="--surface-page" label="Surface Page" />
          <Swatch cssVar="--surface-card" label="Surface Card" />
          <Swatch cssVar="--surface-info" label="Surface Info" />
          <Swatch cssVar="--surface-feature" label="Surface Feature" />
          <Swatch cssVar="--surface-dark" label="Surface Dark" />
        </TokenGrid>
      </TokenSection>

      <TokenSection title="Accent & borders">
        <TokenGrid>
          <Swatch cssVar="--accent" label="Accent" />
          <Swatch cssVar="--accent-on" label="Accent On" />
          <Swatch cssVar="--border-subtle" label="Border Subtle" />
          <Swatch cssVar="--border-strong" label="Border Strong" />
        </TokenGrid>
      </TokenSection>

      <TokenSection title="shadcn semantic palette">
        <TokenGrid>
          <Swatch cssVar="--background" label="Background" />
          <Swatch cssVar="--foreground" label="Foreground" />
          <Swatch cssVar="--card" label="Card" />
          <Swatch cssVar="--primary" label="Primary" />
          <Swatch cssVar="--secondary" label="Secondary" />
          <Swatch cssVar="--muted" label="Muted" />
          <Swatch cssVar="--muted-foreground" label="Muted Foreground" />
          <Swatch cssVar="--destructive" label="Destructive" />
        </TokenGrid>
      </TokenSection>

      <TokenSection title="Status palette">
        <TokenGrid>
          <Swatch cssVar="--success" label="Success" />
          <Swatch cssVar="--info" label="Info" />
          <Swatch cssVar="--warning" label="Warning" />
          <Swatch cssVar="--error" label="Error" />
        </TokenGrid>
      </TokenSection>

      <TokenSection title="Sidebar">
        <TokenGrid>
          <Swatch cssVar="--sidebar" label="Sidebar" />
          <Swatch cssVar="--sidebar-foreground" label="Sidebar Foreground" />
          <Swatch cssVar="--sidebar-primary" label="Sidebar Primary" />
          <Swatch cssVar="--sidebar-primary-foreground" label="Sidebar Primary Fg" />
        </TokenGrid>
      </TokenSection>

      <TokenSection title="Brand gradient">
        <div
          style={{
            height: "4rem",
            borderRadius: "var(--radius-sm)",
            background: "var(--gradient-brand)",
            border: "1px solid var(--border-subtle)",
          }}
        />
      </TokenSection>
    </div>
  );
}

const meta = {
  title: "Style/Colors",
  component: ColorPalette,
  tags: ["autodocs"],
} satisfies Meta<typeof ColorPalette>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Palette: Story = {};
