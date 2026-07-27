import * as SecureStore from "expo-secure-store";

const FUNCTIONS_URL = process.env.EXPO_PUBLIC_RORK_FUNCTIONS_URL!;

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
