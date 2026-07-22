import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { LocalesLabels, Locale } from "@/i18n/constants";

describe("LanguageSwitcher", () => {
  it("should show the current locale's native-language label", () => {
    render(<LanguageSwitcher />);

    expect(screen.getByText(LocalesLabels[Locale.EN_GB])).toBeInTheDocument();
  });

  it("should have an accessible label from the real translation string", () => {
    render(<LanguageSwitcher />);

    expect(screen.getByRole("combobox", { name: "Language" })).toBeInTheDocument();
  });
});
