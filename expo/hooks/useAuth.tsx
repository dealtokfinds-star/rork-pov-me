import * as Crypto from "expo-crypto";
import * as Linking from "expo-linking";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import "react-native-get-random-values";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

const AUTH_URL = process.env.EXPO_PUBLIC_RORK_AUTH_URL!;
const APP_KEY = process.env.EXPO_PUBLIC_RORK_APP_KEY!;
const PROJECT_ID = process.env.EXPO_PUBLIC_PROJECT_ID!;

/**
 * Generate a high-entropy PKCE code verifier (43-128 chars, unreserved set).
 * Uses expo-crypto's native randomBytes — works in Hermes (where the Web
 * `crypto.subtle` / `crypto.getRandomValues` APIs are unavailable).
 */
function generateCodeVerifier(): string {
  const bytes = Crypto.getRandomBytes(32);
  return base64UrlEncode(bytes);
}

/**
 * Compute the S256 PKCE code challenge = base64url(sha256(verifier)).
 * Uses expo-crypto's native digest, which is available on every platform
 * (Hermes does not implement `crypto.subtle.digest`).
 */
async function generateCodeChallenge(verifier: string): Promise<string> {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    verifier,
    { encoding: Crypto.CryptoEncoding.BASE64 },
  );
  // digestStringAsync returns standard base64; convert to URL-safe + strip padding.
  return digest.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  picture?: string;
}

/** Decode the JWT payload to extract user info and check expiration. */
function userFromToken(token: string): AuthUser | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(base64));

    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return null;
    }

    return {
      id: payload.sub,
      email: payload.email ?? "",
      name: payload.name,
      picture: payload.picture,
    };
  } catch {
    return null;
  }
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
  const codeVerifierRef = useRef<string | null>(null);

  const clearError = useCallback((): void => {
    setError(null);
  }, []);

  const refreshToken = useCallback(async (): Promise<void> => {
    const storedRefreshToken = await SecureStore.getItemAsync("refresh_token");
    if (!storedRefreshToken) {
      setUser(null);
      return;
    }

    const response = await fetch(`${AUTH_URL}/oauth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_key: APP_KEY, refresh_token: storedRefreshToken }),
    });

    if (!response.ok) {
      await SecureStore.deleteItemAsync("access_token");
      await SecureStore.deleteItemAsync("refresh_token");
      setUser(null);
      return;
    }

    const { access_token } = await response.json();
    await SecureStore.setItemAsync("access_token", access_token);
    setUser(userFromToken(access_token));
  }, []);

  const checkAuth = useCallback(async (): Promise<void> => {
    try {
      const accessToken = await SecureStore.getItemAsync("access_token");
      if (!accessToken) {
        const refreshTokenStored = await SecureStore.getItemAsync("refresh_token");
        if (refreshTokenStored) {
          await refreshToken();
        }
        return;
      }

      const decoded = userFromToken(accessToken);
      if (decoded) {
        setUser(decoded);
      } else {
        await refreshToken();
      }
    } catch (err) {
      console.error("[povme] Auth check failed:", err);
    } finally {
      setIsLoading(false);
    }
  }, [refreshToken]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const exchangeCode = useCallback(
    async (code: string): Promise<void> => {
      const verifier = codeVerifierRef.current;
      if (!verifier) return;
      codeVerifierRef.current = null;

      const response = await fetch(`${AUTH_URL}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ app_key: APP_KEY, code, code_verifier: verifier }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const message = body.error || `Token exchange failed (${response.status})`;
        console.error(`[povme] Token exchange failed (${response.status}):`, body);
        setError(message);
        return;
      }

      const { access_token, refresh_token, user: userData } = await response.json();

      await SecureStore.setItemAsync("access_token", access_token);
      await SecureStore.setItemAsync("refresh_token", refresh_token);

      setUser(userData ?? userFromToken(access_token));
    },
    [],
  );

  const handleDeepLink = useCallback(
    (event: { url: string }) => {
      try {
        const url = new URL(event.url);
        if (url.pathname === "/auth/callback") {
          const code = url.searchParams.get("code");
          if (code) {
            void exchangeCode(code);
          }
        }
      } catch (err) {
        console.error("[povme] Deep link handling failed:", err);
        setError(err instanceof Error ? err.message : "Sign in failed");
      }
    },
    [exchangeCode],
  );

  // Handle the initial URL if the app was cold-launched from an OAuth redirect.
  // addEventListener("url") only fires for links that arrive *after* mount, so
  // we also check getInitialURL() on startup to catch cold-launch callbacks.
  useEffect(() => {
    const subscription = Linking.addEventListener("url", handleDeepLink);
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url });
    });
    return () => subscription.remove();
  }, [handleDeepLink]);

  const signIn = useCallback(
    async (provider: "google" | "apple"): Promise<void> => {
      setIsSigningIn(true);
      setError(null);
      try {
        const verifier = generateCodeVerifier();
        const challenge = await generateCodeChallenge(verifier);
        codeVerifierRef.current = verifier;

        const isWeb = Platform.OS === "web";
        const target = "rn";
        const env = isWeb ? "preview" : "native";

        const response = await fetch(`${AUTH_URL}/oauth/initiate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            app_key: APP_KEY,
            provider,
            code_challenge: challenge,
            target,
            env,
          }),
        });

        if (!response.ok) {
          codeVerifierRef.current = null;
          const body = await response.json().catch(() => ({}));
          const message = body.error || `Sign in failed (${response.status})`;
          console.error(`[povme] Auth initiate failed (${response.status}):`, body);
          setError(message);
          return;
        }

        const { auth_url } = await response.json();

        if (isWeb) {
          const popup = window.open(auth_url, "_blank", "width=500,height=650");

          await new Promise<void>((resolve, reject) => {
            const onMessage = (event: MessageEvent) => {
              if (event.data?.type !== "rork_auth_callback") return;
              window.removeEventListener("message", onMessage);
              clearInterval(pollTimer);
              const code = event.data.code;
              if (code) {
                exchangeCode(code).then(resolve, reject);
              } else {
                reject(new Error("No code received"));
              }
            };
            window.addEventListener("message", onMessage);

            const pollTimer = setInterval(() => {
              if (popup?.closed) {
                clearInterval(pollTimer);
                window.removeEventListener("message", onMessage);
                codeVerifierRef.current = null;
                resolve();
              }
            }, 500);
          });
        } else {
          const redirectUrl = `rork-${PROJECT_ID}://auth/callback`;
          const result = await WebBrowser.openAuthSessionAsync(auth_url, redirectUrl);

          if (result.type === "success") {
            const url = new URL(result.url);
            const code = url.searchParams.get("code");
            if (code) {
              await exchangeCode(code);
            } else {
              console.error("[povme] Auth callback missing code param:", result.url);
              setError("Sign-in callback was missing the authorization code.");
            }
          } else if (result.type === "cancel" || result.type === "dismiss") {
            // User closed the browser — not an error, just cancelled.
            codeVerifierRef.current = null;
          } else {
            console.error("[povme] Auth session unexpected result:", result);
            setError("Sign-in was interrupted. Please try again.");
          }
        }
      } catch (err) {
        console.error("[povme] Sign in failed:", err);
        setError(err instanceof Error ? err.message : "Sign in failed");
      } finally {
        setIsSigningIn(false);
      }
    },
    [exchangeCode],
  );

  const signOut = useCallback(async (): Promise<void> => {
    await SecureStore.deleteItemAsync("access_token");
    await SecureStore.deleteItemAsync("refresh_token");
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
