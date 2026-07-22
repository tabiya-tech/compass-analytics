import { describe, expect, it } from "vitest";
import { Locale, SupportedLocales } from "@/i18n/constants";
import enGb from "./en-GB/translation.json";

const localeResources: Record<Locale, Record<string, unknown>> = {
  [Locale.EN_GB]: enGb,
};

/** Recursively replaces every leaf value with a placeholder, leaving only the key shape. */
function keyShape(value: unknown): unknown {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, keyShape(v)]));
  }
  return "-";
}

describe("locale resources", () => {
  it.each(SupportedLocales)("should have a translation resource for %s", (locale) => {
    expect(localeResources[locale]).toBeDefined();
  });

  const [referenceLocale, ...otherLocales] = SupportedLocales;

  it.each(otherLocales)("should have the same key shape as %s does against the reference locale", (locale) => {
    // GIVEN the reference locale's key shape (leaf values replaced with a placeholder)
    const givenReferenceShape = keyShape(localeResources[referenceLocale]);

    // WHEN we compute the key shape of the other locale
    const actualShape = keyShape(localeResources[locale]);

    // THEN the two shapes should be identical — same keys, same nesting, no extras or omissions
    expect(actualShape).toEqual(givenReferenceShape);
  });
});
