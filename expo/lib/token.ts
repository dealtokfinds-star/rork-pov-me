import { supabase } from "@/lib/supabase";

/**
 * Return a valid (non-expired) Supabase Auth access token, refreshing if
 * necessary. Used by the edge function fetcher (`edge.ts`) and the storage
 * upload helper (`storageUpload.ts`) — the Supabase client itself handles
 * auth headers automatically for all DB and Storage queries.
 *
 * Returns null if the user is not signed in.
 */
export async function getValidAccessToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;

  // If the access token is expired, refresh the session.
  if (session.expires_at && session.expires_at * 1000 < Date.now()) {
    const {
      data: { session: newSession },
    } = await supabase.auth.refreshSession();
    return newSession?.access_token ?? null;
  }

  return session.access_token;
}
