import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import type { User } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { supabase } from "@/lib/supabase";

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  picture?: string;
}

/** Map a Supabase auth user to the app's AuthUser shape. */
function mapUser(supabaseUser: User): AuthUser {
  return {
    id: supabaseUser.id,
    email: supabaseUser.email ?? "",
    name:
      (supabaseUser.user_metadata?.full_name as string | undefined) ??
      (supabaseUser.user_metadata?.name as string | undefined),
    picture:
      (supabaseUser.user_metadata?.avatar_url as string | undefined) ??
      (supabaseUser.user_metadata?.picture as string | undefined),
  };
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isSigningIn: boolean;
  error: string | null;
  signIn: (provider: "google" | "apple") => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback((): void => {
    setError(null);
  }, []);

  // ─── Initialise: restore session + subscribe to auth state changes ──────
  useEffect(() => {
    let mounted = true;

    const init = async (): Promise<void> => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!mounted) return;
      if (session?.user) {
        setUser(mapUser(session.user));
      }
      setIsLoading(false);
    };
    void init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (session?.user) {
        setUser(mapUser(session.user));
      } else {
        setUser(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // ─── Sign in via Supabase OAuth (Google / Apple) ─────────────────────────
  const signIn = useCallback(
    async (provider: "google" | "apple"): Promise<void> => {
      setIsSigningIn(true);
      setError(null);
      try {
        const isWeb = Platform.OS === "web";

        // On web, let the SDK redirect the browser directly —
        // detectSessionInUrl picks up the hash params on return.
        if (isWeb) {
          const redirectTo = `${window.location.origin}/sign-in`;
          const { error: oauthError } = await supabase.auth.signInWithOAuth({
            provider,
            options: { redirectTo },
          });
          if (oauthError) throw oauthError;
          return; // Browser navigates away — no more code runs here.
        }

        // On native, open an in-app browser session and parse the callback.
        const redirectUrl = Linking.createURL("auth/callback");

        const { data, error: oauthError } =
          await supabase.auth.signInWithOAuth({
            provider,
            options: {
              redirectTo: redirectUrl,
              skipBrowserRedirect: true,
            },
          });

        if (oauthError) throw oauthError;
        if (!data.url) throw new Error("No OAuth URL returned");

        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectUrl,
        );

        if (result.type === "success") {
          // Supabase appends tokens as hash params to the redirect URL.
          const hashIndex = result.url.indexOf("#");
          if (hashIndex < 0) {
            throw new Error("Callback URL missing hash fragment");
          }
          const params = new URLSearchParams(result.url.slice(hashIndex + 1));
          const access_token = params.get("access_token");
          const refresh_token = params.get("refresh_token");

          if (!access_token || !refresh_token) {
            throw new Error("Callback URL missing access or refresh token");
          }

          const { error: sessionError } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });
          if (sessionError) throw sessionError;
          // onAuthStateChange will update `user`.
        } else if (result.type === "cancel" || result.type === "dismiss") {
          // User closed the browser — not an error.
        } else {
          setError("Sign-in was interrupted. Please try again.");
        }
      } catch (err) {
        console.error("[povme] Sign in failed:", err);
        setError(err instanceof Error ? err.message : "Sign in failed");
      } finally {
        setIsSigningIn(false);
      }
    },
    [],
  );

  const signOut = useCallback(async (): Promise<void> => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, isLoading, isSigningIn, error, signIn, signOut, clearError }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
