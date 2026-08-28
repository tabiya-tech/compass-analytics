import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  updateProfile,
  type UserCredential,
} from "firebase/auth";
import type { LoginRequest, RegisterRequest } from "@/auth/auth.types";
import { getFirebaseApp } from "@/auth/firebase";

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

function mapFirebaseError(error: unknown): AuthApiError {
  const code = (error as { code?: string }).code ?? "";
  if (code === "auth/user-not-found" || code === "auth/wrong-password" || code === "auth/invalid-credential") {
    return new AuthApiError(401, "invalid_credentials", "Invalid email or password.");
  }
  if (code === "auth/email-already-in-use") {
    return new AuthApiError(409, "email_taken", "An account with this email already exists.");
  }
  return new AuthApiError(500, "unknown", "An unexpected error occurred.");
}

export class AuthenticationService {
  private static instance: AuthenticationService | null = null;

  static getInstance(): AuthenticationService {
    AuthenticationService.instance ??= new AuthenticationService();
    return AuthenticationService.instance;
  }

  private get _auth() {
    return getAuth(getFirebaseApp());
  }

  async login(request: LoginRequest): Promise<UserCredential> {
    try {
      return await signInWithEmailAndPassword(this._auth, request.email, request.password);
    } catch (error) {
      throw mapFirebaseError(error);
    }
  }

  async register(request: RegisterRequest): Promise<UserCredential> {
    try {
      const credential = await createUserWithEmailAndPassword(this._auth, request.email, request.password);
      // Without this the form's name is dropped — nothing downstream of it ever gets one.
      await updateProfile(credential.user, { displayName: request.name });
      return credential;
    } catch (error) {
      throw mapFirebaseError(error);
    }
  }

  async loginWithGoogle(): Promise<UserCredential> {
    try {
      return await signInWithPopup(this._auth, new GoogleAuthProvider());
    } catch (error) {
      throw mapFirebaseError(error);
    }
  }

  logout(): Promise<void> {
    return signOut(this._auth);
  }
}
