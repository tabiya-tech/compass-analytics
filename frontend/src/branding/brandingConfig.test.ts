import { beforeEach, describe, expect, it } from "vitest";
import { HttpResponse, http } from "msw";
import { server } from "@/mocks/server";
import {
  getAppName,
  getBrowserTabTitle,
  getFaviconUrl,
  getLogoInverseUrl,
  getLogoUrl,
  getMetaDescription,
  getThemeTokens,
  loadBrandingConfig,
} from "./brandingConfig";

describe("brandingConfig", () => {
  describe("loadBrandingConfig", () => {
    it("should apply values from a successfully fetched branding.json", async () => {
      // GIVEN branding.json responds with a custom app name and theme
      const givenAppName = "Acme Analytics";
      const givenThemeColor = "#ff0000";
      server.use(
        http.get("/branding.json", () =>
          HttpResponse.json({
            appName: givenAppName,
            theme: { "tabiya-blue": givenThemeColor },
          })
        )
      );

      // WHEN the branding config is loaded
      await loadBrandingConfig();

      // THEN the app name getter should return the given app name
      expect(getAppName()).toEqual(givenAppName);
      // AND the theme getter should contain the given color
      expect(getThemeTokens()["tabiya-blue"]).toEqual(givenThemeColor);
    });

    it("should fall back to defaults when the branding.json request fails", async () => {
      // GIVEN branding.json responds with a server error
      server.use(http.get("/branding.json", () => new HttpResponse(null, { status: 500 })));

      // WHEN the branding config is loaded
      await loadBrandingConfig();

      // THEN the app name getter should fall back to the default
      expect(getAppName()).toEqual("Compass Analytics");
      // AND the theme getter should return an empty object rather than throwing
      expect(getThemeTokens()).toEqual({});
    });

    it("should fall back to defaults when branding.json is malformed", async () => {
      // GIVEN branding.json responds with invalid JSON
      server.use(http.get("/branding.json", () => new HttpResponse("not json", { status: 200 })));

      // WHEN the branding config is loaded
      await loadBrandingConfig();

      // THEN the app name getter should fall back to the default
      expect(getAppName()).toEqual("Compass Analytics");
    });
  });

  describe("getters", () => {
    beforeEach(async () => {
      // GIVEN branding.json is unreachable, resetting getters to their defaults
      server.use(http.get("/branding.json", () => new HttpResponse(null, { status: 500 })));
      await loadBrandingConfig();
    });

    it("should return default app name and browser tab title when unset", () => {
      expect(getAppName()).toEqual("Compass Analytics");
      expect(getBrowserTabTitle()).toEqual("Compass Analytics");
    });

    it("should return default asset URLs when unset", () => {
      expect(getLogoUrl()).toEqual("/logos/tabiya-logo-color.svg");
      expect(getLogoInverseUrl()).toEqual("/logos/tabiya-logo-white.svg");
      expect(getFaviconUrl()).toEqual("/logos/tabiya-logo-color.svg");
    });

    it("should return undefined meta description when unset", () => {
      expect(getMetaDescription()).toBeUndefined();
    });
  });
});
