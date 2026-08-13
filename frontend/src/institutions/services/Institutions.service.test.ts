import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import { InstitutionsApiError, InstitutionsService } from "@/institutions/services/Institutions.service";
import type { InstitutionsQuery, InstitutionsResponse } from "@/institutions/institutions.types";

const givenToken = "some-id-token";

const givenQuery: InstitutionsQuery = {
  search: "skills",
  regions: ["Lusaka", "Copperbelt"],
  sort: { by: "active_users", direction: "asc" },
  page: 2,
  page_size: 25,
};

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
  page: 2,
  page_size: 25,
  totals: { jobseekers_reached: 3987, skills_reports: 1076, institutions: 1 },
  available_regions: ["Copperbelt", "Lusaka"],
};

describe("InstitutionsService", () => {
  it("should ask the endpoint for the searched, filtered, sorted and paged slice of institutions", async () => {
    // GIVEN an institutions endpoint that records how it was called
    let actualUrl: URL | undefined;
    server.use(
      http.get("/api/institutions", ({ request }) => {
        actualUrl = new URL(request.url);
        return HttpResponse.json(givenResponse);
      })
    );

    // WHEN the institutions are fetched for the given query
    await InstitutionsService.getInstance().getInstitutions(givenQuery, givenToken);

    // THEN the search, sort and pagination travel as query parameters
    expect(actualUrl?.pathname).toBe("/api/institutions");
    expect(actualUrl?.searchParams.get("search")).toBe("skills");
    expect(actualUrl?.searchParams.get("sort_by")).toBe("active_users");
    expect(actualUrl?.searchParams.get("sort_dir")).toBe("asc");
    expect(actualUrl?.searchParams.get("page")).toBe("2");
    expect(actualUrl?.searchParams.get("page_size")).toBe("25");
    // AND every selected region travels as its own repeated parameter
    expect(actualUrl?.searchParams.getAll("region")).toEqual(["Lusaka", "Copperbelt"]);
  });

  it("should send the caller's token as a bearer token", async () => {
    // GIVEN an institutions endpoint that records the authorization header
    let actualAuthorization: string | null = null;
    server.use(
      http.get("/api/institutions", ({ request }) => {
        actualAuthorization = request.headers.get("Authorization");
        return HttpResponse.json(givenResponse);
      })
    );

    // WHEN the institutions are fetched
    await InstitutionsService.getInstance().getInstitutions(givenQuery, givenToken);

    // THEN the token is presented as a bearer token
    expect(actualAuthorization).toBe(`Bearer ${givenToken}`);
  });

  it("should return the institutions, totals and region options the endpoint responds with", async () => {
    // GIVEN an institutions endpoint that responds with a page of institutions
    server.use(http.get("/api/institutions", () => HttpResponse.json(givenResponse)));

    // WHEN the institutions are fetched
    const actual = await InstitutionsService.getInstance().getInstitutions(givenQuery, givenToken);

    // THEN the response comes back untouched
    expect(actual).toEqual(givenResponse);
  });

  it("should throw an InstitutionsApiError when the endpoint rejects the request", async () => {
    // GIVEN an institutions endpoint that refuses the request
    server.use(http.get("/api/institutions", () => new HttpResponse(null, { status: 403 })));

    // WHEN the institutions are fetched
    const actualPromise = InstitutionsService.getInstance().getInstitutions(givenQuery, givenToken);

    // THEN the failure surfaces as an API error carrying the status
    await expect(actualPromise).rejects.toThrow(InstitutionsApiError);
    await expect(actualPromise).rejects.toMatchObject({ status: 403 });
  });
});
