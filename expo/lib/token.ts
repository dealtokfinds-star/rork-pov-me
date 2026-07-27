import * as SecureStore from "expo-secure-store";

const AUTH_URL = process.env.EXPO_PUBLIC_RORK_AUTH_URL!;
const APP_KEY = process.env.EXPO_PUBLIC_RORK_APP_KEY!;

/** Refresh this many ms before the token actually expires, to avoid races. */
const EXPIRY_SKEW_MS = 60_000;

interface JwtPayload {
  sub?: string;
  email?: string;
  name?: string;
  picture?: string;
  exp?: number;
}

/** Decode a JWT payload (no verification — Rork Auth verifies server-side). */
export function decodeJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(base64)) as JwtPayload;
    return payload;
  } catch {
    return null;
  }
}

/** True if the token is missing or past its expiry (with skew). */
export function isTokenExpired(token: string | null): boolean {
  if (!token) return true;
  const payload = decodeJwt(token);
  if (!payload?.exp) return true;
  return payload.exp * 1000 - EXPIRY_SKEW_MS < Date.now();
}

// Single-flight refresh: concurrent callers share the same in-flight promise
// so we never hit /oauth/refresh more than once at a time.
let refreshPromise: Promise<string | null> | null = null;

/**
 * Refresh the access token using the stored refresh token. Returns the new
 * access token (also persisted to SecureStore), or null if there is no
 * valid refresh token. Thread-safe via single-flight.
 */
export function refreshToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const rt = await SecureStore.getItemAsync("refresh_token");
      if (!rt) return null;

      const response = await fetch(`${AUTH_URL}/oauth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ app_key: APP_KEY, refresh_token: rt }),
      });

      if (!response.ok) {
        // Refresh token is invalid/expired — clear everything so the user
        // is prompted to sign in again rather than looping on bad tokens.
        await SecureStore.deleteItemAsync("access_token");
        await SecureStore.deleteItemAsync("refresh_token");
        return null;
      }

      const { access_token, refresh_token: newRt } = (await response.json()) as {
        access_token: string;
        refresh_token: string;
      };
      await SecureStore.setItemAsync("access_token", access_token);
      if (newRt) await SecureStore.setItemAsync("refresh_token", newRt);
      return access_token;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

/**
 * Return a valid (non-expired) access token, refreshing if necessary.
 * This is the single entry point both the Supabase client and the edge
 * function fetcher use, so RLS never sees a stale JWT.
 *
 * Returns null if the user is not signed in (no refresh token available).
 */
export async function getValidAccessToken(): Promise<string | null> {
  const token = await SecureStore.getItemAsync("access_token");
  if (!isTokenExpired(token)) return token;
  return refreshToken();
}
