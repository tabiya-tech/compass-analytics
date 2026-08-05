import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getAuth, onAuthStateChanged, type User } from "firebase/auth";
import { getFirebaseApp } from "@/auth/firebase";

export interface AuthContextValue {
  user: User | null;
  /** True during the initial Firebase auth state resolution — render nothing gated on auth until false. */
  loading: boolean;
  /** Returns the current user's Firebase ID token, refreshing it if needed. Throws if not signed in. */
  getIdToken: () => Promise<string>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }
  return context;
}

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getAuth(getFirebaseApp());
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  async function getIdToken(): Promise<string> {
    if (!user) throw new Error("Not signed in");
    return user.getIdToken();
  }

  return <AuthContext.Provider value={{ user, loading, getIdToken }}>{children}</AuthContext.Provider>;
}
