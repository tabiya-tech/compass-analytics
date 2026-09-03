import type { AssignRoleRequest, ManagedUser, MeResponse, RoleRecord, UserRoleView } from "@/user/user.types";

export const USER_API_BASE = "/api";

export class UserApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "UserApiError";
    this.status = status;
  }
}

export class UserService {
  private static instance: UserService | null = null;

  static getInstance(): UserService {
    UserService.instance ??= new UserService();
    return UserService.instance;
  }

  private async _send(path: string, token: string, init?: RequestInit): Promise<Response> {
    const url = new URL(`${USER_API_BASE}${path}`, window.location.origin);
    const response = await fetch(url.toString(), {
      ...init,
      headers: { ...init?.headers, Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new UserApiError(response.status, `User API error: ${response.status}`);
    }
    return response;
  }

  async register(token: string, options?: { name?: string; organization?: string }): Promise<void> {
    const body: Record<string, string> = {};
    if (options?.name) body.name = options.name;
    if (options?.organization) body.organization = options.organization;
    const hasBody = Object.keys(body).length > 0;

    const url = new URL(`${USER_API_BASE}/users/register`, window.location.origin);
    const response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(hasBody ? { "Content-Type": "application/json" } : {}),
      },
      body: hasBody ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      throw new UserApiError(response.status, `Register API error: ${response.status}`);
    }
  }

  async getMe(token: string): Promise<MeResponse> {
    const url = new URL(`${USER_API_BASE}/me`, window.location.origin);
    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new UserApiError(response.status, `User API error: ${response.status}`);
    }
    return response.json() as Promise<MeResponse>;
  }

  async getRoles(token: string): Promise<RoleRecord[]> {
    const response = await this._send("/roles", token);
    return response.json() as Promise<RoleRecord[]>;
  }

  async getManagedUsers(token: string): Promise<ManagedUser[]> {
    const response = await this._send("/users", token);
    return response.json() as Promise<ManagedUser[]>;
  }

  async assignRole(userId: string, request: AssignRoleRequest, token: string): Promise<UserRoleView> {
    const response = await this._send(`/users/${encodeURIComponent(userId)}/roles`, token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    return response.json() as Promise<UserRoleView>;
  }

  async revokeRole(userId: string, userRoleId: string, token: string): Promise<void> {
    await this._send(`/users/${encodeURIComponent(userId)}/roles/${encodeURIComponent(userRoleId)}`, token, {
      method: "DELETE",
    });
  }
}
