import type { MeResponse } from "@/user/user.types";

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
}
