import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { auth, ensureAuthPersistence } from "../lib/firebase";

export async function signIn(email, password) {
  await ensureAuthPersistence();
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signUp(email, password) {
  await ensureAuthPersistence();
  return createUserWithEmailAndPassword(auth, email, password);
}
