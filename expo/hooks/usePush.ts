import { useEffect, useRef, useState, useCallback } from "react";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { callEdge } from "@/lib/edge";

/**
 * Push notifications — registers the device token with the backend and
 * surfaces incoming notifications while the app is running.
 *
 * Flow:
 *  1. On mount, request notification permission (iOS prompt / Android no-op).
 *  2. Get the Expo push token via Notifications.getExpoPushTokenAsync.
 *  3. Upsert it to the push_tokens table via the register-push edge function.
 *  4. Subscribe to incoming notifications to show in-app banners / route.
 *
 * The send-push edge function (called by other edge functions / webhooks)
 * delivers actual pushes via the Expo Push API.
 */

// Configure how notifications appear while the app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface PushNotification {
  id: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
}

export function usePushNotifications() {
  const [token, setToken] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<Notifications.PermissionStatus | null>(null);
  const [lastNotification, setLastNotification] = useState<PushNotification | null>(null);
  const registeredRef = useRef<boolean>(false);

  const register = useCallback(async (): Promise<void> => {
    if (registeredRef.current) return;

    try {
      const { status: existing } = await Notifications.getPermissionsAsync();
      let status = existing;
      if (existing !== "granted") {
        const result = await Notifications.requestPermissionsAsync();
        status = result.status;
      }
      setPermissionStatus(status);

      if (status !== "granted") {
        console.log("[povme] Push permission not granted");
        return;
      }

      // Android requires a notification channel
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
          name: "POVMe",
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#CCFF00",
        });
      }

      const tokenResult = await Notifications.getExpoPushTokenAsync({
        projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
      });
      const pushToken = tokenResult.data;
      setToken(pushToken);
      registeredRef.current = true;

      // Register with backend
      await callEdge("register-push", {
        token: pushToken,
        platform: Platform.OS,
        app_version: "1.0.0",
      }).catch((err) => {
        console.log("[povme] register-push failed", err);
        registeredRef.current = false;
      });
    } catch (err) {
      console.log("[povme] push registration error", err);
    }
  }, []);

  useEffect(() => {
    register();

    // Listen for incoming notifications while app is open
    const sub = Notifications.addNotificationReceivedListener((notification) => {
      const content = notification.request.content;
      setLastNotification({
        id: notification.request.identifier,
        title: content.title ?? "",
        body: content.body ?? "",
        data: content.data as Record<string, unknown>,
      });
    });

    // Listen for notification taps (to route the user)
    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      // The root layout / router can observe lastNotification or this event
      // to navigate. For now, surface the data.
      console.log("[povme] notification tapped", data);
    });

    return () => {
      sub.remove();
      responseSub.remove();
    };
  }, [register]);

  return {
    token,
    permissionStatus,
    lastNotification,
    register,
  };
}
