import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { Compass, Home, Radio, User, Video } from "lucide-react-native";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";

import Colors from "@/constants/colors";
import { useLiveNow } from "@/hooks/useLiveNow";

export default function TabLayout() {
  // Realtime: keeps LIVE badges on creator cards/avatars in sync with the
  // live_streams table without manual refreshes.
  useLiveNow();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.lime,
        tabBarInactiveTintColor: Colors.textDim,
        tabBarStyle: {
          position: "absolute",
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: Colors.border,
          backgroundColor: Platform.OS === "ios" ? "transparent" : "rgba(10,10,12,0.97)",
          elevation: 0,
          height: Platform.OS === "ios" ? 86 : 68,
          paddingTop: 8,
        },
        tabBarBackground: () =>
          Platform.OS === "ios" ? (
            <BlurView intensity={38} tint="dark" style={StyleSheet.absoluteFill}>
              <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(10,10,12,0.72)" }]} />
            </BlurView>
          ) : null,
        tabBarLabelStyle: { fontSize: 10, fontWeight: "800", letterSpacing: 0.2 },
        sceneStyle: { backgroundColor: Colors.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Feed",
          tabBarIcon: ({ color, focused }) => (
            <Home size={22} color={color} fill={focused ? color : "transparent"} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: "Explore",
          tabBarIcon: ({ color }) => <Compass size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="live"
        options={{
          title: "Live",
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.liveActive : undefined}>
              <Radio size={22} color={focused ? Colors.magenta : color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="studio"
        options={{
          title: "Studio",
          tabBarIcon: ({ color }) => <Video size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "You",
          tabBarIcon: ({ color, focused }) => (
            <User size={22} color={color} fill={focused ? color : "transparent"} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  liveActive: {
    shadowColor: Colors.magenta,
    shadowOpacity: 0.9,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
});
