import { describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import { UserService, UserApiError } from "@/user/User.service";
import type { MeResponse } from "@/user/user.types";

const givenMe: MeResponse = {
  user_id: "u1",
  email: "u@example.com",
  name: "U",
  role: "funder",
  scope: { type: "all", institution_ids: [] },
  active_modules: ["build-your-profile"],
};

describe("UserService.getMe", () => {
  it("should return the parsed profile on a successful response", async () => {
    // GIVEN the /api/me endpoint returns a profile
    server.use(http.get("/api/me", () => HttpResponse.json(givenMe)));

    // WHEN getMe is called
    const actual = await UserService.getInstance().getMe("token");

    // THEN the parsed profile is returned
    expect(actual).toEqual(givenMe);
  });

  it("should throw a UserApiError with the status on a non-2xx response", async () => {
    // GIVEN the endpoint returns 404
    server.use(http.get("/api/me", () => new HttpResponse(null, { status: 404 })));

    // WHEN getMe is called
    // THEN a UserApiError carrying the 404 status is thrown
    await expect(UserService.getInstance().getMe("token")).rejects.toMatchObject({
      name: "UserApiError",
      status: 404,
    });
    await expect(UserService.getInstance().getMe("token")).rejects.toBeInstanceOf(UserApiError);
  });
});
