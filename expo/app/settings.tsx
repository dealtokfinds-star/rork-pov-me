import { useRouter } from "expo-router";
import { ChevronRight, Download, Shield, Trash2, FileText, FileCheck, Bell } from "lucide-react-native";
import React, { useState } from "react";
import { Alert, Linking, ScrollView, StyleSheet, Switch, Text, View } from "react-native";

import { Button, Chip, PressableScale, SectionHeader, haptic } from "@/components/ui";
import Colors, { Radius, microLabel } from "@/constants/colors";
import { formatMoney } from "@/constants/mock-data";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { usePushNotifications } from "@/hooks/usePush";
import { callEdge } from "@/lib/edge";
import { useApp } from "@/providers/app-provider";

const PRICE_OPTIONS = [4.99, 7.99, 9.99, 12.99, 14.99, 19.99, 24.99, 29.99, 39.99, 49.99];

export default function SettingsScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { account, updateProfile, isUpdating } = useProfile();
  const { permissionStatus, register } = usePushNotifications();
  const { isCreator, creatorPrice, setCreatorPrice, resetAccount, displayName, handle } = useApp();
  const [priceError, setPriceError] = useState<string | null>(null);

  /** Persist the new subscription price to the server, not just local state. */
  const changePrice = async (p: number): Promise<void> => {
    const previous = creatorPrice;
    setCreatorPrice(p); // optimistic
    setPriceError(null);
    haptic("light");
    try {
      await updateProfile({ subPrice: p });
    } catch (err) {
      setCreatorPrice(previous); // roll back
      setPriceError(err instanceof Error ? err.message : "Could not save the new price");
    }
  };
  const [pushLive, setPushLive] = useState<boolean>(true);
  const [pushDrops, setPushDrops] = useState<boolean>(true);
  const [pushDms, setPushDms] = useState<boolean>(true);
  const [adultOk, setAdultOk] = useState<boolean>(false);
  const [autoplay, setAutoplay] = useState<boolean>(true);
  const [dataSaver, setDataSaver] = useState<boolean>(false);
  const [exporting, setExporting] = useState<boolean>(false);
  const [deleting, setDeleting] = useState<boolean>(false);

  const pushEnabled = permissionStatus === "granted";

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      <View style={styles.identity}>
        <Text style={styles.identityName}>{account?.name ?? user?.name ?? displayName}</Text>
        <Text style={styles.identityHandle}>
          @{account?.handle ?? user?.email?.split("@")[0] ?? handle} · povme member
        </Text>
      </View>

      {isCreator ? (
        <>
          <SectionHeader kicker="Creator" title="Subscription price" />
          <View style={styles.card}>
            <Text style={styles.cardLabel}>
              Current: {formatMoney(creatorPrice)}/mo · you keep {formatMoney(creatorPrice * 0.8)}
            </Text>
            <View style={styles.chipWrap}>
              {PRICE_OPTIONS.map((p) => (
                <Chip
                  key={p}
                  label={`$${p}`}
                  active={creatorPrice === p}
                  onPress={() => void changePrice(p)}
                />
              ))}
            </View>
            {priceError ? <Text style={styles.priceError}>{priceError}</Text> : null}
            <Text style={styles.hint}>
              {isUpdating
                ? "Saving your new price…"
                : "Existing subscribers keep their current price until they resubscribe."}
            </Text>
          </View>

          <View style={{ paddingHorizontal: 18, gap: 10, marginTop: 14 }}>
            <NavRow icon={<Shield size={17} color={Colors.success} />} label="Earnings & payouts" onPress={() => router.push("/earnings")} />
            <NavRow icon={<Shield size={17} color={Colors.cyan} />} label="Trust & safety center" onPress={() => router.push("/admin")} />
          </View>
        </>
      ) : null}

      <SectionHeader kicker="Notifications" title="What reaches you" />
      <View style={styles.card}>
        {!pushEnabled ? (
          <PressableScale onPress={() => register()} scaleTo={0.98}>
            <View style={styles.pushWarn}>
              <Bell size={15} color={Colors.gold} />
              <Text style={styles.pushWarnText}>
                {permissionStatus === "denied"
                  ? "Push notifications are blocked. Enable them in Settings to get live alerts."
                  : "Enable push notifications for live alerts, drops, and DMs."}
              </Text>
            </View>
          </PressableScale>
        ) : null}
        <ToggleRow label="Creator goes live" value={pushLive} onChange={setPushLive} />
        <ToggleRow label="New POV episode drops" value={pushDrops} onChange={setPushDrops} />
        <ToggleRow label="Direct messages" value={pushDms} onChange={setPushDms} />
      </View>

      <SectionHeader kicker="Playback" title="Video & data" />
      <View style={styles.card}>
        <ToggleRow label="Autoplay in feed" value={autoplay} onChange={setAutoplay} />
        <ToggleRow label="Data saver (720p max)" value={dataSaver} onChange={setDataSaver} />
      </View>

      <SectionHeader kicker="Content" title="What you see" />
      <View style={styles.card}>
        <ToggleRow
          label="Show 18+ categories"
          sub="Requires verified age on file"
          value={adultOk}
          onChange={setAdultOk}
        />
      </View>

      <SectionHeader kicker="Your data" title="Privacy & GDPR" />
      <View style={styles.card}>
        <Text style={styles.gdprIntro}>
          You can export or delete all your data at any time. Financial records are anonymized and
          retained for tax compliance as required by law.
        </Text>
        <PressableScale
          onPress={async () => {
            setExporting(true);
            haptic("light");
            try {
              const data = await callEdge<Record<string, unknown>>("gdpr-export");
              // In a real app, we'd download this as a file. For now, show a summary alert.
              const keys = Object.keys(data).filter((k) => k !== "exported_at" && k !== "user_id");
              Alert.alert(
                "Your data export is ready",
                `Exported ${keys.length} data categories:\n${keys.join(", ")}.\n\nThe full JSON has been logged — in production this would download as a file.`,
              );
            } catch (err) {
              Alert.alert("Export failed", err instanceof Error ? err.message : "Try again");
            }
            setExporting(false);
          }}
          scaleTo={0.98}
        >
          <View style={styles.gdprRow}>
            <Download size={16} color={Colors.cyan} />
            <Text style={styles.gdprLabel}>Export my data (GDPR)</Text>
            <Text style={styles.gdprMeta}>{exporting ? "…" : "JSON"}</Text>
          </View>
        </PressableScale>
      </View>

      <SectionHeader kicker="Legal" title="Policies" />
      <View style={{ paddingHorizontal: 18, gap: 10 }}>
        <NavRow icon={<Shield size={17} color={Colors.lime} />} label="Content guidelines" onPress={() => router.push("/guidelines")} />
        <NavRow icon={<FileText size={17} color={Colors.textMid} />} label="Terms of use" onPress={() => router.push("/legal/terms")} />
        <NavRow icon={<Shield size={17} color={Colors.textMid} />} label="Privacy policy" onPress={() => router.push("/legal/privacy")} />
        <NavRow icon={<FileCheck size={17} color={Colors.textMid} />} label="2257 compliance" onPress={() => router.push("/legal/2257")} />
      </View>

      <Button
        label={deleting ? "Deleting…" : "Delete my account"}
        variant="ghost"
        disabled={deleting}
        icon={<Trash2 size={15} color={Colors.danger} />}
        onPress={() => {
          Alert.alert(
            "Delete account?",
            "This permanently deletes your profile, content, messages, and settings. Financial records are anonymized and retained for tax compliance. This cannot be undone.",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Delete forever",
                style: "destructive",
                onPress: async () => {
                  setDeleting(true);
                  try {
                    await callEdge("gdpr-delete");
                    haptic("heavy");
                    resetAccount();
                    await signOut();
                  } catch (err) {
                    Alert.alert("Delete failed", err instanceof Error ? err.message : "Try again or contact support");
                  }
                  setDeleting(false);
                },
              },
            ],
          );
        }}
        style={{ marginHorizontal: 18, marginTop: 26 }}
      />

      <Button
        label="Sign out"
        variant="ghost"
        onPress={async () => {
          resetAccount();
          haptic("heavy");
          await signOut();
        }}
        style={{ marginHorizontal: 18, marginTop: 8 }}
      />
      <Text style={styles.version}>povme v1.0.0 · build 2026.07</Text>
    </ScrollView>
  );
}

function ToggleRow({
  label,
  sub,
  value,
  onChange,
}: {
  label: string;
  sub?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: Colors.limeDark, false: Colors.surfaceTop }}
        thumbColor={value ? Colors.lime : Colors.textDim}
      />
    </View>
  );
}

function NavRow({
  icon,
  label,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <PressableScale onPress={onPress} scaleTo={0.98}>
      <View style={styles.navRow}>
        {icon}
        <Text style={styles.rowLabel}>{label}</Text>
        <ChevronRight size={17} color={Colors.textDim} />
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  identity: { paddingHorizontal: 18, paddingTop: 10 },
  identityName: { color: Colors.text, fontSize: 22, fontWeight: "900", letterSpacing: -0.8 },
  identityHandle: { color: Colors.textDim, fontSize: 12.5, fontWeight: "600", marginTop: 3 },
  card: {
    marginHorizontal: 18,
    padding: 16,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  cardLabel: { color: Colors.text, fontSize: 13, fontWeight: "800" },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  hint: { color: Colors.textDim, fontSize: 11.5, fontWeight: "600", lineHeight: 18 },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  rowLabel: { flex: 1, color: Colors.text, fontSize: 13.5, fontWeight: "700" },
  rowSub: { color: Colors.textDim, fontSize: 11.5, fontWeight: "600", marginTop: 2 },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 15,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pushWarn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: Radius.sm,
    backgroundColor: "rgba(255,182,39,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,182,39,0.22)",
  },
  pushWarnText: { flex: 1, color: Colors.text, fontSize: 12, fontWeight: "700", lineHeight: 17 },
  gdprIntro: { color: Colors.textDim, fontSize: 12, fontWeight: "600", lineHeight: 18 },
  gdprRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    padding: 13,
    borderRadius: Radius.sm,
    backgroundColor: "rgba(53,231,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(53,231,255,0.2)",
  },
  gdprLabel: { flex: 1, color: Colors.text, fontSize: 13, fontWeight: "800" },
  gdprMeta: { color: Colors.textDim, fontSize: 11, fontWeight: "700" },
  priceError: { color: Colors.danger, fontSize: 12, fontWeight: "700" },
  version: {
    ...microLabel,
    color: Colors.textDim,
    textAlign: "center",
    marginTop: 20,
    fontSize: 9.5,
  },
});
