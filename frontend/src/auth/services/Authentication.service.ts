import type { LoginRequest, RegisterRequest } from "@/auth/auth.types";

export const AUTH_API_BASE = "/api/auth";

export class AuthApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "AuthApiError";
    this.status = status;
    this.code = code;
  }
}

export class AuthenticationService {
  private static instance: AuthenticationService | null = null;

  static getInstance(): AuthenticationService {
    AuthenticationService.instance ??= new AuthenticationService();
    return AuthenticationService.instance;
  }

  async login(_request: LoginRequest): Promise<void> {
    // TODO: call the auth API.
  }

  async register(_request: RegisterRequest): Promise<void> {
    // TODO: call the auth API.
  }

  async loginWithGoogle(): Promise<void> {
    // TODO: call the auth API.
  }

  logout(): void {
    // TODO: clear the session.
  }
}
