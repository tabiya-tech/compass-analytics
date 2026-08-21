import type { GrantView, ManagedUser, MeResponse, RoleRequest } from "@/user/user.types";

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

  async register(token: string): Promise<void> {
    const url = new URL(`${USER_API_BASE}/users/register`, window.location.origin);
    const response = await fetch(url.toString(), {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      throw new UserApiError(response.status, `Register API error: ${response.status}`);
    }
  }

  /** Fetches the caller's profile. Throws UserApiError on a non-2xx response. */
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

  /** Every provisioned user with the grants they hold. Requires access-management:manage. */
  async getManagedUsers(token: string): Promise<ManagedUser[]> {
    const response = await this._send("/users", token);
    return response.json() as Promise<ManagedUser[]>;
  }

  /** Assigns a role; the server expands it into one grant per permission. */
  async assignRole(userId: string, request: RoleRequest, token: string): Promise<GrantView[]> {
    const response = await this._send(`/users/${encodeURIComponent(userId)}/roles`, token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    return response.json() as Promise<GrantView[]>;
  }

  async revokePermission(userId: string, grantId: string, token: string): Promise<void> {
    await this._send(`/users/${encodeURIComponent(userId)}/grants/${encodeURIComponent(grantId)}`, token, {
      method: "DELETE",
    });
  }
}
