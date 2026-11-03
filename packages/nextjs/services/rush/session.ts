import type { LoginMethod } from "~~/types/rush";

const METHOD_KEY = "rush.loginMethod";
let method: LoginMethod | null = null;
let restored = false;
const listeners = new Set<() => void>();

export const getLoginMethod = () => method;
export const getServerLoginMethod = () => null;

export function subscribeLoginMethod(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setLoginMethod(next: LoginMethod | null) {
  if (next === null) localStorage.removeItem(METHOD_KEY);
  else localStorage.setItem(METHOD_KEY, next);
  method = next;
  restored = true;
  listeners.forEach(listener => listener());
}

export function restoreLoginMethod() {
  if (restored) return;
  restored = true;
  const stored = localStorage.getItem(METHOD_KEY);
  method = stored === "burner" || stored === "passkey" || stored === "wallet" ? stored : null;
  listeners.forEach(listener => listener());
}
