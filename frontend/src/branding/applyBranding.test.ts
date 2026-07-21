import { beforeEach, describe, expect, it } from "vitest";
import { HttpResponse, http } from "msw";
import { server } from "@/mocks/server";
import { applyBranding } from "./applyBranding";

describe("applyBranding", () => {
  beforeEach(() => {
    // GIVEN a clean document, so each test observes only its own mutations
    document.title = "";
    document.documentElement.style.cssText = "";
    document.querySelectorAll('meta[name="description"], link[rel="icon"]').forEach((el) => el.remove());
  });

  it("should set CSS custom properties, title, meta description, and favicon from branding.json", async () => {
    // GIVEN branding.json responds with custom theme tokens and metadata
    const givenTitle = "Acme Tab Title";
    const givenDescription = "Acme's description";
    const givenFavicon = "/acme-favicon.svg";
    const givenBlue = "#123456";
    server.use(
      http.get("/branding.json", () =>
        HttpResponse.json({
          browserTabTitle: givenTitle,
          metaDescription: givenDescription,
          assets: { favicon: givenFavicon },
          theme: { "tabiya-blue": givenBlue },
        })
      )
    );

    // WHEN branding is applied
    await applyBranding();

    // THEN the document title should be set
    expect(document.title).toEqual(givenTitle);
    // AND the meta description should be set
    expect(document.querySelector('meta[name="description"]')?.getAttribute("content")).toEqual(givenDescription);
    // AND the favicon link should be set
    expect(document.querySelector('link[rel="icon"]')?.getAttribute("href")).toEqual(givenFavicon);
    // AND the CSS custom property should be set on the root element
    expect(document.documentElement.style.getPropertyValue("--tabiya-blue")).toEqual(givenBlue);
  });

  it("should not throw and should leave the document unchanged when branding.json is unreachable", async () => {
    // GIVEN branding.json is unreachable
    server.use(http.get("/branding.json", () => new HttpResponse(null, { status: 500 })));

    // WHEN branding is applied
    await applyBranding();

    // THEN the document title should fall back to the default app name
    expect(document.title).toEqual("Compass Analytics");
    // AND the favicon link should fall back to the default asset URL
    expect(document.querySelector('link[rel="icon"]')?.getAttribute("href")).toEqual("/logos/tabiya-logo-color.svg");
  });
});
