import { describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import { UserService, UserApiError } from "@/user/User.service";
import { Action, Subject } from "@/access/ability";
import { Role } from "@/access/roles";
import { ALL_INSTITUTIONS, type GrantView, type ManagedUser, type MeResponse } from "@/user/user.types";

const givenMe: MeResponse = {
  user_id: "u1",
  email: "u@example.com",
  name: "U",
  permissions: ["dashboard:view", "institutions:view"],
  scope: { type: "all", institution_ids: [] },
  active_modules: ["build-your-profile"],
};

const givenGrant: GrantView = {
  grant_id: "grant-7",
  subject: Subject.Dashboard,
  action: Action.View,
  institution_id: "inst-7",
};

const givenManagedUsers: ManagedUser[] = [
  { user_id: "user-7", email: "v@example.com", name: "Vaani Mumba", grants: [givenGrant] },
  { user_id: "user-8", email: "k@example.com", name: "Kunda Tembo", grants: [] },
];

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

describe("UserService.getManagedUsers", () => {
  it("should return the parsed users on a successful response", async () => {
    // GIVEN the /api/users endpoint returns the managed users
    server.use(http.get("/api/users", () => HttpResponse.json(givenManagedUsers)));

    // WHEN getManagedUsers is called
    const actual = await UserService.getInstance().getManagedUsers("token");

    // THEN the parsed users are returned
    expect(actual).toEqual(givenManagedUsers);
  });

  it("should send the caller's token as a bearer token", async () => {
    // GIVEN the endpoint records the authorization it was called with
    let actualAuthorization: string | null = null;
    server.use(
      http.get("/api/users", ({ request }) => {
        actualAuthorization = request.headers.get("Authorization");
        return HttpResponse.json(givenManagedUsers);
      })
    );

    // WHEN getManagedUsers is called
    await UserService.getInstance().getManagedUsers("token");

    // THEN the token is presented as a bearer token
    expect(actualAuthorization).toBe("Bearer token");
  });

  it("should throw a UserApiError with the status on a non-2xx response", async () => {
    // GIVEN the caller may not manage access
    server.use(http.get("/api/users", () => new HttpResponse(null, { status: 403 })));

    // WHEN getManagedUsers is called
    // THEN a UserApiError carrying the 403 status is thrown
    await expect(UserService.getInstance().getManagedUsers("token")).rejects.toMatchObject({
      name: "UserApiError",
      status: 403,
    });
    await expect(UserService.getInstance().getManagedUsers("token")).rejects.toBeInstanceOf(UserApiError);
  });
});

describe("UserService.assignRole", () => {
  it("should post the role and its scope under the target user", async () => {
    // GIVEN the endpoint records the request it was called with
    let actualUrl: URL | undefined;
    let actualBody: unknown;
    server.use(
      http.post("/api/users/:userId/roles", async ({ request }) => {
        actualUrl = new URL(request.url);
        actualBody = await request.json();
        return HttpResponse.json([givenGrant], { status: 201 });
      })
    );

    // WHEN the implementer role is assigned across the whole deployment
    const actual = await UserService.getInstance().assignRole(
      "user-7",
      { role: Role.Implementer, institution_id: ALL_INSTITUTIONS },
      "token"
    );

    // THEN the role is posted under that user, naming the scope it applies to
    expect(actualUrl?.pathname).toBe("/api/users/user-7/roles");
    expect(actualBody).toEqual({ role: "implementer", institution_id: "*" });
    // AND the grants the server expanded it into come back
    expect(actual).toEqual([givenGrant]);
  });

  it("should escape a user id that would otherwise change the path", async () => {
    // GIVEN a user id containing a slash
    let actualUrl: URL | undefined;
    server.use(
      http.post("/api/users/:userId/roles", ({ request }) => {
        actualUrl = new URL(request.url);
        return HttpResponse.json([givenGrant], { status: 201 });
      })
    );

    // WHEN a role is assigned to them
    await UserService.getInstance().assignRole(
      "user/7",
      { role: Role.Funder, institution_id: ALL_INSTITUTIONS },
      "token"
    );

    // THEN the id stays a single path segment
    expect(actualUrl?.pathname).toBe("/api/users/user%2F7/roles");
  });

  it("should throw a UserApiError with the status on a non-2xx response", async () => {
    // GIVEN the endpoint refuses the role
    server.use(http.post("/api/users/:userId/roles", () => new HttpResponse(null, { status: 403 })));

    // WHEN a role is assigned
    const actualPromise = UserService.getInstance().assignRole(
      "user-7",
      { role: Role.Implementer, institution_id: ALL_INSTITUTIONS },
      "token"
    );

    // THEN a UserApiError carrying the 403 status is thrown
    await expect(actualPromise).rejects.toMatchObject({ name: "UserApiError", status: 403 });
  });
});

describe("UserService.revokePermission", () => {
  it("should delete the grant at its own address under the user that holds it", async () => {
    // GIVEN the endpoint records the request it was called with
    let actualUrl: URL | undefined;
    let actualMethod: string | undefined;
    server.use(
      http.delete("/api/users/:userId/grants/:grantId", ({ request }) => {
        actualUrl = new URL(request.url);
        actualMethod = request.method;
        return new HttpResponse(null, { status: 204 });
      })
    );

    // WHEN the grant is revoked
    await UserService.getInstance().revokePermission("user-7", "grant-7", "token");

    // THEN it is deleted at the grant's own address
    expect(actualMethod).toBe("DELETE");
    expect(actualUrl?.pathname).toBe("/api/users/user-7/grants/grant-7");
  });

  it("should escape ids that would otherwise change the path", async () => {
    // GIVEN a user id and grant id containing a slash
    let actualUrl: URL | undefined;
    server.use(
      http.delete("/api/users/:userId/grants/:grantId", ({ request }) => {
        actualUrl = new URL(request.url);
        return new HttpResponse(null, { status: 204 });
      })
    );

    // WHEN the grant is revoked
    await UserService.getInstance().revokePermission("user/7", "grant/7", "token");

    // THEN both ids stay single path segments
    expect(actualUrl?.pathname).toBe("/api/users/user%2F7/grants/grant%2F7");
  });

  it("should throw a UserApiError with the status on a non-2xx response", async () => {
    // GIVEN no grant holds that id
    server.use(http.delete("/api/users/:userId/grants/:grantId", () => new HttpResponse(null, { status: 404 })));

    // WHEN the grant is revoked
    // THEN a UserApiError carrying the 404 status is thrown
    await expect(UserService.getInstance().revokePermission("user-7", "missing", "token")).rejects.toMatchObject({
      name: "UserApiError",
      status: 404,
    });
  });
});
