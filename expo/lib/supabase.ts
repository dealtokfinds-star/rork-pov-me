import { createClient } from "@supabase/supabase-js";

import { getValidAccessToken } from "@/lib/token";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Supabase client configured for Rork Auth.
 *
 * Rork Auth JWTs (stored in SecureStore under "access_token") are fed to
 * Supabase via the `accessToken` callback so Row Level Security using
 * `user_id()` resolves to the signed-in Rork user.
 *
 * The callback goes through `getValidAccessToken`, which checks the `exp`
 * claim and transparently refreshes via `/oauth/refresh` when the token is
 * expired — preventing the "exp claim timestamp check failed" error that
 * occurs when a stale JWT is handed to PostgREST after expiry.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: {} },
  auth: { persistSession: false },
  accessToken: async () => getValidAccessToken(),
});
