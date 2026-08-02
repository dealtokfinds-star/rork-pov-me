import { useQueryClient } from "@tanstack/react-query";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import * as WebBrowser from "expo-web-browser";
import React, { useEffect } from "react";
import { Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import Colors from "@/constants/colors";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { usePushNotifications } from "@/hooks/usePush";
import { supabase } from "@/lib/supabase";
import { AppProvider } from "@/providers/app-provider";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

/**
 * Syncs the signed-in Rork user into the Supabase `profiles` table so RLS
 * policies using `user_id()` resolve correctly and the user has a row.
 */
function useProfileSync() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const sync = async (attempt = 0): Promise<void> => {
      const { error } = await supabase.from("profiles").upsert(
        {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar_url: user.picture,
        },
        { onConflict: "id" },
      );
      if (cancelled) return;
      if (error) {
        // PostgREST rejects JWTs whose `iat` is ahead of the server clock
        // ("JWT issued at future") — common in cloud preview environments
        // with clock skew. Retry once after a short delay so real time catches
        // up to the token's issued-at claim.
        if (attempt < 3 && /future|exp claim|iat/i.test(error.message)) {
          setTimeout(() => { if (!cancelled) void sync(attempt + 1); }, 2000 << attempt);
          return;
        }
        console.error("[povme] profile sync failed:", error.message);
      } else {
        void queryClient.invalidateQueries({ queryKey: ["creator", user.id] });
      }
    };
    void sync();
    return () => { cancelled = true; };
  }, [user, queryClient]);
}

function RootLayoutNav() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.bg },
        headerTintColor: Colors.text,
        headerTitleStyle: { fontWeight: "800" },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: Colors.bg },
        headerBackTitle: "Back",
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="sign-in" options={{ headerShown: false, animation: "fade" }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false, animation: "slide_from_right" }} />
      <Stack.Screen name="episode/[id]" options={{ headerShown: false, animation: "fade_from_bottom" }} />
      <Stack.Screen name="live/[id]" options={{ headerShown: false, animation: "fade" }} />
      <Stack.Screen name="creator/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="subscribe/[id]" options={{ presentation: "modal", title: "Subscribe" }} />
      <Stack.Screen name="unlock/[id]" options={{ presentation: "modal", title: "Unlock POV" }} />
      <Stack.Screen name="tip/[id]" options={{ presentation: "modal", title: "Send a tip" }} />
      <Stack.Screen name="wallet" options={{ presentation: "modal", title: "Wallet" }} />
      <Stack.Screen name="upload" options={{ presentation: "modal", title: "New episode" }} />
      <Stack.Screen name="golive" options={{ presentation: "modal", title: "Go live" }} />
      <Stack.Screen name="host" options={{ headerShown: false, animation: "fade" }} />
      <Stack.Screen name="become-creator" options={{ presentation: "modal", title: "Become a creator" }} />
      <Stack.Screen name="subscriptions" options={{ title: "Subscriptions" }} />
      <Stack.Screen name="earnings" options={{ title: "Earnings & payouts" }} />
      <Stack.Screen name="analytics" options={{ title: "Analytics" }} />
      <Stack.Screen name="notifications" options={{ title: "Notifications" }} />
      <Stack.Screen name="saved" options={{ title: "Saved POVs" }} />
      <Stack.Screen name="settings" options={{ title: "Settings" }} />
      <Stack.Screen name="edit-profile" options={{ title: "Edit profile" }} />
      <Stack.Screen name="guidelines" options={{ title: "Content guidelines" }} />
      <Stack.Screen name="legal/terms" options={{ title: "Terms of Use" }} />
      <Stack.Screen name="legal/privacy" options={{ title: "Privacy Policy" }} />
      <Stack.Screen name="legal/2257" options={{ title: "2257 Compliance" }} />
      <Stack.Screen name="admin" options={{ title: "Trust & safety" }} />
      <Stack.Screen name="messages/index" options={{ title: "Messages" }} />
      <Stack.Screen name="messages/[id]" options={{ title: "" }} />
      <Stack.Screen name="payment/success" options={{ headerShown: false, animation: "fade" }} />
      <Stack.Screen name="payment/cancel" options={{ headerShown: false, animation: "fade" }} />
    </Stack>
  );
}

/**
 * Gates the app on auth. Shows a minimal loading state while auth resolves,
 * then routes to sign-in if there is no user. The signed-in user also gets a
 * profile row synced to Supabase.
 */
function AuthGate() {
  const { user, isLoading, isGuest } = useAuth();
  const router = useRouter();
  useProfileSync();
  // Register for push notifications once the user is signed in
  const { lastNotification } = usePushNotifications();

  useEffect(() => {
    if (!lastNotification) return;
    const data = lastNotification.data;
    if (data?.type === "live" && data.stream_id) {
      router.push(`/live/${data.stream_id}` as never);
    } else if (data?.type === "dm" && data.thread_id) {
      router.push(`/messages/${data.thread_id}` as never);
    } else if (data?.type === "episode" && data.episode_id) {
      router.push(`/episode/${data.episode_id}` as never);
    }
  }, [lastNotification, router]);

  useEffect(() => {
    if (isLoading) return;
    if (!user && !isGuest) {
      router.replace("/sign-in");
    }
  }, [user, isLoading, isGuest, router]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.bg, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: Colors.text, fontSize: 22, fontWeight: "900", letterSpacing: -1 }}>
          POV<Text style={{ color: Colors.lime }}>ME</Text>
        </Text>
      </View>
    );
  }

  return <RootLayoutNav />;
}

export default function RootLayout() {
  useEffect(() => {
    // Critical for OAuth: cleans up any pending auth session redirect on
    // app launch. Without this, the Google/Apple sign-in redirect can be
    // silently dropped on native devices.
    WebBrowser.maybeCompleteAuthSession();
    SystemUI.setBackgroundColorAsync(Colors.bg).catch(() => {});
    SplashScreen.hideAsync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppProvider>
          <GestureHandlerRootView style={{ flex: 1, backgroundColor: Colors.bg }}>
            <StatusBar style="light" />
            <AuthGate />
          </GestureHandlerRootView>
        </AppProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
