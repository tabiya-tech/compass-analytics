import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import { InstitutionsApiError, InstitutionsService } from "@/institutions/services/Institutions.service";
import type { InstitutionsResponse } from "@/institutions/institutions.types";

const givenToken = "some-id-token";

const givenResponse: InstitutionsResponse = {
  items: [
    {
      id: "inst-1",
      name: "Lusaka Skills Hub",
      region: "Lusaka",
      registered_users: 3987,
      active_users: 1521,
      module_started_pct: { "build-your-profile": 49 },
      skills_reports: 1076,
    },
  ],
  total: 1,
  page: 1,
  page_size: 1,
  totals: { jobseekers_reached: 3987, skills_reports: 1076, institutions: 1 },
  available_regions: ["Copperbelt", "Lusaka"],
};

describe("InstitutionsService", () => {
  it("should ask the endpoint for the institutions, with no query parameters", async () => {
    // GIVEN an institutions endpoint that records how it was called — the endpoint always
    // returns the whole portfolio in one response, so there is nothing to parameterize
    let actualUrl: URL | undefined;
    server.use(
      http.get("/api/analytics/institutions", ({ request }) => {
        actualUrl = new URL(request.url);
        return HttpResponse.json(givenResponse);
      })
    );

    // WHEN the institutions are fetched
    await InstitutionsService.getInstance().getInstitutions(givenToken);

    // THEN the request carries no query parameters
    expect(actualUrl?.pathname).toBe("/api/analytics/institutions");
    expect(actualUrl?.search).toBe("");
  });

  it("should send the caller's token as a bearer token", async () => {
    // GIVEN an institutions endpoint that records the authorization header
    let actualAuthorization: string | null = null;
    server.use(
      http.get("/api/analytics/institutions", ({ request }) => {
        actualAuthorization = request.headers.get("Authorization");
        return HttpResponse.json(givenResponse);
      })
    );

    // WHEN the institutions are fetched
    await InstitutionsService.getInstance().getInstitutions(givenToken);

    // THEN the token is presented as a bearer token
    expect(actualAuthorization).toBe(`Bearer ${givenToken}`);
  });

  it("should return the institutions, totals and region options the endpoint responds with", async () => {
    // GIVEN an institutions endpoint that responds with a page of institutions
    server.use(http.get("/api/analytics/institutions", () => HttpResponse.json(givenResponse)));

    // WHEN the institutions are fetched
    const actual = await InstitutionsService.getInstance().getInstitutions(givenToken);

    // THEN the response comes back untouched
    expect(actual).toEqual(givenResponse);
  });

  it("should throw an InstitutionsApiError when the endpoint rejects the request", async () => {
    // GIVEN an institutions endpoint that refuses the request
    server.use(http.get("/api/analytics/institutions", () => new HttpResponse(null, { status: 403 })));

    // WHEN the institutions are fetched
    const actualPromise = InstitutionsService.getInstance().getInstitutions(givenToken);

    // THEN the failure surfaces as an API error carrying the status
    await expect(actualPromise).rejects.toThrow(InstitutionsApiError);
    await expect(actualPromise).rejects.toMatchObject({ status: 403 });
  });
});
