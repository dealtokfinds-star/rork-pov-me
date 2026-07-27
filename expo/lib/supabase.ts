import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Supabase client configured for Rork Auth.
 *
 * Rork Auth JWTs (stored in SecureStore under "access_token") are fed to
 * Supabase via the `accessToken` callback so Row Level Security using
 * `user_id()` resolves to the signed-in Rork user.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: {} },
  auth: { persistSession: false },
  accessToken: async () => {
    const token = await SecureStore.getItemAsync("access_token");
    return token ?? null;
  },
});
