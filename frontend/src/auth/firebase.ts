import { initializeApp, getApps } from "firebase/app";
import type { FirebaseApp } from "firebase/app";

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
}

function getFirebaseConfig(): FirebaseConfig {
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "",
  };
}

let _app: FirebaseApp | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (_app) return _app;
  const existing = getApps();
  _app = existing.length > 0 ? existing[0] : initializeApp(getFirebaseConfig());
  return _app;
}
