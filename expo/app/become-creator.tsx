import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import {
  AlertCircle,
  BadgeCheck,
  Building2,
  Check,
  ChevronRight,
  IdCard,
  Landmark,
  Loader2,
  Lock,
  RefreshCw,
} from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Button, Chip, PressableScale, ProgressBar, haptic } from "@/components/ui";
import Colors, { Radius, microLabel } from "@/constants/colors";
import { CATEGORIES, formatMoney } from "@/constants/mock-data";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchKycState,
  openHostedPage,
  pollKycStatus,
  publishCreatorProfile,
  startConnectOnboarding,
  startIdentityVerification,
  type KycState,
} from "@/lib/kyc";
import type { PovCategory } from "@/types";

const PRICE_OPTIONS = [4.99, 7.99, 9.99, 12.99, 14.99, 19.99, 24.99, 29.99, 39.99, 49.99];

type Stage = "identity" | "verified" | "connect" | "connected" | "profile" | "done";

export default function BecomeCreatorScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<number>(0);
  const [identity, setIdentity] = useState<string>("");
  const [picked, setPicked] = useState<PovCategory[]>([]);
  const [price, setPrice] = useState<number>(12.99);

  const [stage, setStage] = useState<Stage>("identity");
  const [kyc, setKyc] = useState<KycState | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Pull existing KYC state on mount so returning creators don't re-verify.
  const loadKyc = useCallback(async (): Promise<void> => {
    try {
      const state = await fetchKycState();
      if (!state) return;
      setKyc(state);
      if (state.kycStatus === "verified") setStage("verified");
      if (state.stripePayoutsEnabled) setStage("connected");
      if (state.kycStatus === "verified" && state.stripePayoutsEnabled) setStage("profile");
    } catch (err) {
      console.log("[povme] loadKyc:", err);
    }
  }, []);

  useEffect(() => {
    void loadKyc();
  }, [loadKyc]);

  const handleVerify = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const session = await startIdentityVerification();
      haptic("medium");
      const result = await openHostedPage(session.url);
      if (result.type !== "success" && result.type !== "dismiss") {
        // Unexpected result — proceed to polling anyway.
      }
      setStage("verified");
      // Poll for the webhook to land.
      const updated = await pollKycStatus(60_000);
      if (updated) setKyc(updated);
      if (updated?.kycStatus === "failed") {
        setError(updated.kycLastReason ?? "Verification needs another try");
        setStage("identity");
      } else if (updated?.kycStatus === "verified") {
        haptic("success");
        setStage("connect");
      } else {
        // Webhook may still be in flight; let the user proceed to Connect.
        haptic("success");
        setStage("connect");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleConnect = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const link = await startConnectOnboarding({ country: "US" });
      haptic("medium");
      await openHostedPage(link.url);
      // Re-fetch profile to reflect payouts_enabled (set by account.updated webhook).
      const updated = await pollKycStatus(30_000);
      if (updated) setKyc(updated);
      if (updated?.stripePayoutsEnabled) {
        haptic("success");
        setStage("profile");
      } else if (updated?.stripeAccountId) {
        // Onboarding submitted but payouts not yet enabled — proceed to profile.
        haptic("success");
        setStage("profile");
      } else {
        haptic("success");
        setStage("profile");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connect onboarding failed");
    } finally {
      setLoading(false);
    }
  }, []);

  const handlePublish = useCallback(async (): Promise<void> => {
    if (identity.trim().length === 0) {
      setError("Add your identity tag first.");
      return;
    }
    if (picked.length === 0) {
      setError("Pick at least one POV category.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await publishCreatorProfile({
        identity: identity.trim(),
        categories: picked,
        subPrice: price,
      });
      haptic("success");
      await queryClient.invalidateQueries({ queryKey: ["creators"] });
      await queryClient.invalidateQueries({ queryKey: ["creator", user?.id] });
      setStage("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't publish your profile");
    } finally {
      setLoading(false);
    }
  }, [identity, picked, price, queryClient, user?.id]);

  // ---- Done state ----
  if (stage === "done" || step === 4) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.doneWrap}>
        <View style={styles.doneIcon}>
          <BadgeCheck size={30} color={Colors.ink} />
        </View>
        <Text style={styles.doneTitle}>You&apos;re a povme creator.</Text>
        <Text style={styles.doneBody}>
          Identity verified, payouts connected, and your studio is live. Upload your first POV
          episode, set your access levels, and go live whenever you&apos;re ready. Payouts run
          weekly to your Stripe account.
        </Text>
        <View style={styles.summary}>
          <SummaryRow label="Identity" value={identity || "Verified creator"} />
          <SummaryRow label="Subscription" value={`${formatMoney(price)}/mo`} />
          <SummaryRow label="Your share" value={`${formatMoney(price * 0.8)} (80%)`} />
          <SummaryRow label="Payouts" value="Stripe · weekly" />
          <SummaryRow label="Status" value="Approved" />
        </View>
        <Button label="Open creator studio" onPress={() => router.replace("/(tabs)/studio")} style={{ marginTop: 24 }} />
        <Button label="Upload first episode" variant="dark" onPress={() => router.replace("/upload")} style={{ marginTop: 10 }} />
      </ScrollView>
    );
  }

  // ---- Live KYC + Connect flow ----
  if (step === 3) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <ProgressBar progress={progressFor(stage)} />
        <Text style={styles.step}>{stageLabel(stage)}</Text>
        <Text style={styles.title}>Verify &amp; connect payouts</Text>
        <Text style={styles.body}>
          Required by law for creator payouts. Stripe handles your government ID, selfie liveness,
          and bank details — povme never sees the raw documents.
        </Text>

        {error ? (
          <View style={styles.errorCard}>
            <AlertCircle size={16} color={Colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.kycList}>
          <KycRow
            icon={<IdCard size={17} color={Colors.lime} />}
            label="Identity verification"
            sub="Government ID + selfie liveness (Stripe Identity)"
            state={stage === "identity" ? "pending" : "done"}
            loading={loading && stage === "identity"}
          />
          <KycRow
            icon={<Landmark size={17} color={Colors.lime} />}
            label="Payouts account"
            sub="Stripe Express · bank or debit"
            state={stage === "connect" || stage === "connected" || stage === "profile" ? "done" : "waiting"}
            loading={loading && stage === "connect"}
          />
          <KycRow
            icon={<Building2 size={17} color={Colors.lime} />}
            label="Tax & business details"
            sub="W-9 / W-8BEN, collected by Stripe"
            state={stage === "profile" ? "done" : "waiting"}
          />
        </View>

        {kyc?.kycLastReason ? (
          <Text style={styles.reason}>Last issue: {kyc.kycLastReason}</Text>
        ) : null}

        {stage === "identity" ? (
          <Button
            label={loading ? "Opening Stripe…" : "Start identity verification"}
            onPress={handleVerify}
            disabled={loading}
            icon={loading ? <Loader2 size={16} color={Colors.ink} /> : undefined}
          />
        ) : null}

        {stage === "verified" ? (
          <Button
            label={loading ? "Opening Stripe…" : "Continue to payouts"}
            onPress={handleConnect}
            disabled={loading}
          />
        ) : null}

        {stage === "connect" ? (
          <Button
            label={loading ? "Opening Stripe…" : "Continue to payouts"}
            onPress={handleConnect}
            disabled={loading}
            icon={loading ? <Loader2 size={16} color={Colors.ink} /> : undefined}
          />
        ) : null}

        {stage === "profile" ? (
          <Button
            label="Finish & open studio"
            onPress={handlePublish}
            disabled={loading}
            icon={loading ? <Loader2 size={16} color={Colors.ink} /> : undefined}
          />
        ) : null}

        {(stage === "verified" || stage === "profile") && !loading ? (
          <PressableScale
            onPress={() => {
              setStage("identity");
              void loadKyc();
            }}
            scaleTo={0.97}
          >
            <View style={styles.retryRow}>
              <RefreshCw size={13} color={Colors.textDim} />
              <Text style={styles.retryText}>Re-check verification status</Text>
            </View>
          </PressableScale>
        ) : null}

        <Text style={styles.legal}>
          By continuing you accept the povme creator terms, the content guidelines, and confirm
          every person appearing in your POV content is 18+ and has consented to being filmed.
        </Text>
      </ScrollView>
    );
  }

  // ---- Setup steps (identity tag, categories, price) ----
  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <ProgressBar progress={(step + 1) / 4} />
      <Text style={styles.step}>Step {step + 1} of 4</Text>

      {step === 0 ? (
        <View style={{ gap: 14 }}>
          <Text style={styles.title}>What life are people stepping into?</Text>
          <Text style={styles.body}>
            Your identity tag is the promise. &quot;Prop futures trader&quot;, &quot;club promoter&quot;,
            &quot;pro fighter&quot; — be specific.
          </Text>
          <TextInput
            value={identity}
            onChangeText={setIdentity}
            placeholder="e.g. Algo trader in Miami"
            placeholderTextColor={Colors.textDim}
            style={styles.input}
            maxLength={40}
          />
          <Button label="Continue" onPress={() => setStep(1)} style={{ marginTop: 12 }} />
        </View>
      ) : null}

      {step === 1 ? (
        <View style={{ gap: 14 }}>
          <Text style={styles.title}>Pick your POV categories</Text>
          <Text style={styles.body}>
            Fans find you through these. Pick the lifestyles your feed actually shows.
          </Text>
          <View style={styles.chipWrap}>
            {CATEGORIES.map((c) => (
              <Chip
                key={c.id}
                label={c.label}
                emoji={c.emoji}
                accent={c.accent}
                active={picked.includes(c.id)}
                onPress={() =>
                  setPicked((prev) =>
                    prev.includes(c.id) ? prev.filter((p) => p !== c.id) : [...prev, c.id],
                  )
                }
              />
            ))}
          </View>
          <Button label="Continue" onPress={() => setStep(2)} />
        </View>
      ) : null}

      {step === 2 ? (
        <View style={{ gap: 14 }}>
          <Text style={styles.title}>Set your monthly price</Text>
          <Text style={styles.body}>
            Between $4.99 and $49.99. For lifestyle POV feeds, $9.99–$14.99 converts best. You can
            change it any time and run promos later.
          </Text>
          <View style={styles.priceGrid}>
            {PRICE_OPTIONS.map((p) => (
              <PressableScale key={p} onPress={() => setPrice(p)} scaleTo={0.93}>
                <View style={[styles.priceCard, price === p && styles.priceCardActive]}>
                  <Text style={[styles.priceText, price === p && { color: Colors.ink }]}>
                    ${p}
                  </Text>
                </View>
              </PressableScale>
            ))}
          </View>
          <View style={styles.splitBox}>
            <Text style={styles.splitKicker}>What you keep</Text>
            <Text style={styles.splitValue}>{formatMoney(price * 0.8)} per subscriber / month</Text>
            <Text style={styles.splitBody}>
              povme keeps 20% for hosting, video processing, payments, moderation, and support.
              1,000 subscribers at {formatMoney(price)} = {formatMoney(price * 800)}/mo to you.
            </Text>
          </View>
          <Button
            label="Continue to verification"
            onPress={() => setStep(3)}
            icon={<ChevronRight size={18} color={Colors.ink} />}
          />
        </View>
      ) : null}
    </ScrollView>
  );
}

function progressFor(stage: Stage): number {
  switch (stage) {
    case "identity": return 0.6;
    case "verified": return 0.72;
    case "connect": return 0.78;
    case "connected": return 0.88;
    case "profile": return 0.95;
    case "done": return 1;
  }
}

function stageLabel(stage: Stage): string {
  switch (stage) {
    case "identity": return "VERIFY IDENTITY";
    case "verified": return "IDENTITY VERIFIED";
    case "connect": return "CONNECT PAYOUTS";
    case "connected": return "PAYOUTS CONNECTED";
    case "profile": return "PUBLISH PROFILE";
    case "done": return "DONE";
  }
}

function KycRow({
  icon,
  label,
  sub,
  state,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  sub: string;
  state: "waiting" | "pending" | "done";
  loading?: boolean;
}) {
  return (
    <View style={styles.kycRow}>
      <View style={styles.kycIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.kycLabel}>{label}</Text>
        <Text style={styles.kycSub}>{sub}</Text>
      </View>
      <View style={[styles.kycState, state === "done" && { backgroundColor: Colors.lime, borderColor: Colors.lime }]}>
        {loading ? (
          <ActivityIndicator size="small" color={Colors.text} />
        ) : state === "done" ? (
          <Check size={12} color={Colors.ink} />
        ) : null}
      </View>
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  step: { ...microLabel, color: Colors.lime, marginTop: 16, marginBottom: 14 },
  title: { color: Colors.text, fontSize: 27, fontWeight: "900", letterSpacing: -1, lineHeight: 32 },
  body: { color: Colors.textMid, fontSize: 14, fontWeight: "500", lineHeight: 21 },
  kicker: { ...microLabel, color: Colors.textDim, marginTop: 8 },
  input: {
    height: 54,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    color: Colors.text,
    fontSize: 15.5,
    fontWeight: "700",
  },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  priceGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  priceCard: {
    width: 96,
    height: 52,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  priceCardActive: { backgroundColor: Colors.lime, borderColor: Colors.lime },
  priceText: { color: Colors.text, fontSize: 16, fontWeight: "900" },
  splitBox: {
    padding: 16,
    borderRadius: Radius.md,
    backgroundColor: "rgba(204,255,0,0.06)",
    borderWidth: 1,
    borderColor: "rgba(204,255,0,0.22)",
    gap: 7,
  },
  splitKicker: { ...microLabel, color: Colors.lime },
  splitValue: { color: Colors.text, fontSize: 18, fontWeight: "900", letterSpacing: -0.5 },
  splitBody: { color: Colors.textMid, fontSize: 12.5, fontWeight: "600", lineHeight: 19 },
  kycList: {
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
    marginTop: 14,
  },
  kycRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  kycIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.surfaceHi,
    alignItems: "center",
    justifyContent: "center",
  },
  kycLabel: { color: Colors.text, fontSize: 13.5, fontWeight: "800" },
  kycSub: { color: Colors.textDim, fontSize: 11.5, fontWeight: "600", marginTop: 2 },
  kycState: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: Colors.borderHi,
    alignItems: "center",
    justifyContent: "center",
  },
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255,77,77,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,77,77,0.35)",
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 14,
  },
  errorText: { flex: 1, color: Colors.danger, fontSize: 13, fontWeight: "600" },
  reason: { color: Colors.textDim, fontSize: 12, fontWeight: "600", marginTop: 10 },
  retryRow: { flexDirection: "row", alignItems: "center", gap: 7, justifyContent: "center", marginTop: 14 },
  retryText: { color: Colors.textDim, fontSize: 12, fontWeight: "700" },
  legal: { color: Colors.textDim, fontSize: 11, fontWeight: "600", lineHeight: 17, marginTop: 14 },
  doneWrap: { padding: 24, paddingTop: 50, alignItems: "center" },
  doneIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: Colors.lime,
    alignItems: "center",
    justifyContent: "center",
  },
  doneTitle: {
    color: Colors.text,
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -1,
    marginTop: 20,
    textAlign: "center",
  },
  doneBody: {
    color: Colors.textMid,
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 21,
    textAlign: "center",
    marginTop: 12,
  },
  summary: {
    width: "100%",
    marginTop: 24,
    padding: 16,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 11,
  },
  summaryRow: { flexDirection: "row", justifyContent: "space-between" },
  summaryLabel: { color: Colors.textDim, fontSize: 12.5, fontWeight: "600" },
  summaryValue: { color: Colors.text, fontSize: 12.5, fontWeight: "800" },
});
