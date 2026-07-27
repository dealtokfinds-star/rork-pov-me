import * as SecureStore from "expo-secure-store";

/** Base URL for Supabase Edge Functions. Edge functions are deployed to the
 *  project's Supabase instance under /functions/v1/<slug>. We derive this from
 *  EXPO_PUBLIC_SUPABASE_URL (always set) rather than EXPO_PUBLIC_RORK_FUNCTIONS_URL,
 *  which is not guaranteed to point at the Supabase functions endpoint. */
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const FUNCTIONS_URL = `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1`;

/** Fetch wrapper for Supabase Edge Functions with Rork Auth JWT. */
export async function callEdge<T = unknown>(
  slug: string,
  body?: unknown,
  init?: { method?: "POST" | "GET"; headers?: Record<string, string> },
): Promise<T> {
  const token = await SecureStore.getItemAsync("access_token");
  const method = init?.method ?? "POST";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers ?? {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${FUNCTIONS_URL}/${slug}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => ({})) as T;
  if (!response.ok) {
    const err = data as { error?: string };
    throw new Error(err.error ?? `Request failed (${response.status})`);
  }
  return data;
}

export { FUNCTIONS_URL };

// Re-export the legacy name for any callers that still import it.
export const LEGACY_FUNCTIONS_URL = process.env.EXPO_PUBLIC_RORK_FUNCTIONS_URL ?? FUNCTIONS_URL;
