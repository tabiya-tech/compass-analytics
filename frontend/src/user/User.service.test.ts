import { describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import { UserService, UserApiError } from "@/user/User.service";
import type { ManagedUser, MeResponse, UserRoleView } from "@/user/user.types";

const givenMe: MeResponse = {
  user_id: "u1",
  email: "u@example.com",
  name: "U",
  organization: null,
  role: "funder",
  permissions: ["dashboard:view", "institutions:view"],
  scope: { institution_ids: null },
  active_modules: ["build-your-profile"],
};

const givenUserRole: UserRoleView = {
  role_id: "role-funder",
  role_name: "funder",
  institution_id: null,
  granted_by: null,
  granted_at: null,
};

const givenManagedUsers: ManagedUser[] = [
  { user_id: "user-7", email: "v@example.com", name: "Vaani Mumba", roles: [givenUserRole] },
  { user_id: "user-8", email: "k@example.com", name: "Kunda Tembo", roles: [] },
];

describe("UserService.getMe", () => {
  it("should return the parsed profile on a successful response", async () => {
    server.use(http.get("/api/me", () => HttpResponse.json(givenMe)));

    const actual = await UserService.getInstance().getMe("token");

    expect(actual).toEqual(givenMe);
  });

  it("should throw a UserApiError with the status on a non-2xx response", async () => {
    server.use(http.get("/api/me", () => new HttpResponse(null, { status: 404 })));

    await expect(UserService.getInstance().getMe("token")).rejects.toMatchObject({
      name: "UserApiError",
      status: 404,
    });
    await expect(UserService.getInstance().getMe("token")).rejects.toBeInstanceOf(UserApiError);
  });
});

describe("UserService.register", () => {
  it("should post no body when called with nothing to give", async () => {
    let actualBody: string | null = null;
    let hadContentType = true;
    server.use(
      http.post("/api/users/register", async ({ request }) => {
        actualBody = await request.text();
        hadContentType = request.headers.has("content-type");
        return new HttpResponse(null, { status: 201 });
      })
    );

    await UserService.getInstance().register("token");

    expect(actualBody).toBe("");
    expect(hadContentType).toBe(false);
  });

  it("should post only the name when that's the only thing given", async () => {
    let actualBody: unknown;
    server.use(
      http.post("/api/users/register", async ({ request }) => {
        actualBody = await request.json();
        return new HttpResponse(null, { status: 201 });
      })
    );

    await UserService.getInstance().register("token", { name: "Kunda Tembo" });

    expect(actualBody).toEqual({ name: "Kunda Tembo" });
  });

  it("should post both fields when both are given, as the registration form does", async () => {
    let actualBody: unknown;
    server.use(
      http.post("/api/users/register", async ({ request }) => {
        actualBody = await request.json();
        return new HttpResponse(null, { status: 201 });
      })
    );

    await UserService.getInstance().register("token", { name: "Kunda Tembo", organization: "Acme Corp" });

    expect(actualBody).toEqual({ name: "Kunda Tembo", organization: "Acme Corp" });
  });

  it("should throw a UserApiError with the status on a non-2xx response", async () => {
    server.use(http.post("/api/users/register", () => new HttpResponse(null, { status: 500 })));

    await expect(UserService.getInstance().register("token")).rejects.toMatchObject({
      name: "UserApiError",
      status: 500,
    });
  });
});

describe("UserService.getManagedUsers", () => {
  it("should return the parsed users on a successful response", async () => {
    server.use(http.get("/api/users", () => HttpResponse.json(givenManagedUsers)));

    const actual = await UserService.getInstance().getManagedUsers("token");

    expect(actual).toEqual(givenManagedUsers);
  });

  it("should send the caller's token as a bearer token", async () => {
    let actualAuthorization: string | null = null;
    server.use(
      http.get("/api/users", ({ request }) => {
        actualAuthorization = request.headers.get("Authorization");
        return HttpResponse.json(givenManagedUsers);
      })
    );

    await UserService.getInstance().getManagedUsers("token");

    expect(actualAuthorization).toBe("Bearer token");
  });

  it("should throw a UserApiError with the status on a non-2xx response", async () => {
    server.use(http.get("/api/users", () => new HttpResponse(null, { status: 403 })));

    await expect(UserService.getInstance().getManagedUsers("token")).rejects.toMatchObject({
      name: "UserApiError",
      status: 403,
    });
    await expect(UserService.getInstance().getManagedUsers("token")).rejects.toBeInstanceOf(UserApiError);
  });
});

describe("UserService.assignRole", () => {
  it("should post the role and institution under the target user", async () => {
    let actualUrl: URL | undefined;
    let actualBody: unknown;
    server.use(
      http.post("/api/users/:userId/roles", async ({ request }) => {
        actualUrl = new URL(request.url);
        actualBody = await request.json();
        return HttpResponse.json(givenUserRole, { status: 201 });
      })
    );

    const actual = await UserService.getInstance().assignRole(
      "user-7",
      { role_id: "role-implementer", institution_id: "inst-1" },
      "token"
    );

    expect(actualUrl?.pathname).toBe("/api/users/user-7/roles");
    expect(actualBody).toEqual({ role_id: "role-implementer", institution_id: "inst-1" });
    expect(actual).toEqual(givenUserRole);
  });

  it("should escape a user id that would otherwise change the path", async () => {
    let actualUrl: URL | undefined;
    server.use(
      http.post("/api/users/:userId/roles", ({ request }) => {
        actualUrl = new URL(request.url);
        return HttpResponse.json(givenUserRole, { status: 201 });
      })
    );

    await UserService.getInstance().assignRole("user/7", { role_id: "role-funder", institution_id: null }, "token");

    expect(actualUrl?.pathname).toBe("/api/users/user%2F7/roles");
  });

  it("should throw a UserApiError with the status on a non-2xx response", async () => {
    server.use(http.post("/api/users/:userId/roles", () => new HttpResponse(null, { status: 403 })));

    await expect(
      UserService.getInstance().assignRole("user-7", { role_id: "role-implementer", institution_id: null }, "token")
    ).rejects.toMatchObject({ name: "UserApiError", status: 403 });
  });
});

describe("UserService.revokeRole", () => {
  it("should delete the user role at its own address under the user that holds it", async () => {
    let actualUrl: URL | undefined;
    let actualMethod: string | undefined;
    server.use(
      http.delete("/api/users/:userId/roles/:userRoleId", ({ request }) => {
        actualUrl = new URL(request.url);
        actualMethod = request.method;
        return new HttpResponse(null, { status: 204 });
      })
    );

    await UserService.getInstance().revokeRole("user-7", "role-funder", "token");

    expect(actualMethod).toBe("DELETE");
    expect(actualUrl?.pathname).toBe("/api/users/user-7/roles/role-funder");
  });

  it("should escape ids that would otherwise change the path", async () => {
    let actualUrl: URL | undefined;
    server.use(
      http.delete("/api/users/:userId/roles/:userRoleId", ({ request }) => {
        actualUrl = new URL(request.url);
        return new HttpResponse(null, { status: 204 });
      })
    );

    await UserService.getInstance().revokeRole("user/7", "role/funder", "token");

    expect(actualUrl?.pathname).toBe("/api/users/user%2F7/roles/role%2Ffunder");
  });

  it("should throw a UserApiError with the status on a non-2xx response", async () => {
    server.use(http.delete("/api/users/:userId/roles/:userRoleId", () => new HttpResponse(null, { status: 404 })));

    await expect(UserService.getInstance().revokeRole("user-7", "missing", "token")).rejects.toMatchObject({
      name: "UserApiError",
      status: 404,
    });
  });
});
