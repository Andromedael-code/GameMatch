import { initializeApp } from "firebase/app";
import { browserLocalPersistence, getAuth, setPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { readRequiredEnv } from "./env";

const firebaseConfig = {
  apiKey: readRequiredEnv("VITE_FIREBASE_API_KEY"),
  authDomain: readRequiredEnv("VITE_FIREBASE_AUTH_DOMAIN"),
  projectId: readRequiredEnv("VITE_FIREBASE_PROJECT_ID"),
  storageBucket: readRequiredEnv("VITE_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: readRequiredEnv("VITE_FIREBASE_MESSAGING_SENDER_ID"),
  appId: readRequiredEnv("VITE_FIREBASE_APP_ID"),
};

const firebaseApp = initializeApp(firebaseConfig);

export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);

let persistencePromise;

export function ensureAuthPersistence() {
  if (!persistencePromise) {
    persistencePromise = setPersistence(auth, browserLocalPersistence).catch(() => undefined);
  }

  return persistencePromise;
}
