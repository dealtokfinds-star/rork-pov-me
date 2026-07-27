import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import {
  AlertCircle,
  BadgeCheck,
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  CreditCard,
  IdCard,
  Landmark,
  Loader2,
  Mail,
  ShieldCheck,
  Upload,
  Wallet,
} from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
  publishCreatorProfile,
  savePayoutDetails,
  submitKyc,
  type KycState,
} from "@/lib/creator-onboarding";
import type { PovCategory } from "@/types";

const PRICE_OPTIONS = [4.99, 7.99, 9.99, 12.99, 14.99, 19.99, 24.99, 29.99, 39.99, 49.99];

/** Frictionless flow: identity (optional) → payout → profile (consent-gated) → done. */
type Stage = "identity" | "payout" | "profile" | "done";

type DocKind = "front" | "back" | "selfie";

const CONSENT_COPY =
  "I confirm I am 18+ and every person appearing in my POV content is 18+ and has consented to being filmed and broadcast. POVMe is an 18+ platform.";

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

  /** Whether the optional identity-upload card is expanded. */
  const [idCardOpen, setIdCardOpen] = useState<boolean>(false);

  // KYC documents (local image URIs before upload) — all optional now.
  const [frontUri, setFrontUri] = useState<string | null>(null);
  const [backUri, setBackUri] = useState<string | null>(null);
  const [selfieUri, setSelfieUri] = useState<string | null>(null);

  // Payout details
  const [payoutMethod, setPayoutMethod] = useState<"paypal" | "bank" | null>(null);
  const [paypalEmail, setPaypalEmail] = useState<string>("");
  const [bankHolder, setBankHolder] = useState<string>("");
  const [bankAccount, setBankAccount] = useState<string>("");
  const [bankRouting, setBankRouting] = useState<string>("");
  const [bankCountry, setBankCountry] = useState<string>("");
  const [consentAgreed, setConsentAgreed] = useState<boolean>(false);

  // Pull existing state on mount so returning creators skip what they've done.
  const loadKyc = useCallback(async (): Promise<void> => {
    try {
      const state = await fetchKycState();
      if (!state) return;
      setKyc(state);
      // Prefill any saved profile fields so returning creators don't re-enter them.
      if (state.identity) setIdentity(state.identity);
      if (Array.isArray(state.categories) && state.categories.length > 0) {
        setPicked(state.categories as PovCategory[]);
      }
      if (typeof state.subPrice === "number" && state.subPrice > 0) {
        setPrice(state.subPrice);
      }
      // KYC no longer gates anything; just prefill payout method if present.
      if (state.payoutMethod) {
        setPayoutMethod(state.payoutMethod);
        if (state.payoutMethod === "paypal" && state.payoutPaypalEmail) {
          setPaypalEmail(state.payoutPaypalEmail);
        }
        setStage("profile");
        setStep(3);
      } else if (state.kycStatus === "verified") {
        // Already verified but no payout details yet.
        setStage("payout");
        setStep(3);
      }
    } catch (err) {
      console.log("[povme] loadKyc:", err);
    }
  }, []);

  useEffect(() => {
    void loadKyc();
  }, [loadKyc]);

  const pickImage = useCallback(async (kind: DocKind): Promise<void> => {
    haptic("light");
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.7,
    });
    if (result.canceled) return;
    const uri = result.assets[0].uri;
    if (kind === "front") setFrontUri(uri);
    else if (kind === "back") setBackUri(uri);
    else setSelfieUri(uri);
  }, []);

  /** Submit the optional ID upload. Auto-approves on the backend → verified instantly. */
  const handleSubmitKyc = useCallback(async (): Promise<void> => {
    if (!frontUri || !backUri || !selfieUri) {
      setError("Capture all three photos to submit.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await submitKyc({ frontUri, backUri, selfieUri });
      haptic("success");
      const updated = await fetchKycState();
      if (updated) setKyc(updated);
      // Auto-approved → straight to payout. No review stage.
      setStage("payout");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't submit your documents");
    } finally {
      setLoading(false);
    }
  }, [frontUri, backUri, selfieUri]);

  /** Skip ID upload entirely and jump to payout details. */
  const handleSkipIdentity = useCallback((): void => {
    haptic("light");
    setError(null);
    setStage("payout");
  }, []);

  const handleSavePayout = useCallback(async (): Promise<void> => {
    if (!payoutMethod) {
      setError("Pick a payout method.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (payoutMethod === "paypal") {
        if (!paypalEmail.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(paypalEmail.trim())) {
          setError("Enter a valid PayPal email.");
          setLoading(false);
          return;
        }
        await savePayoutDetails({ method: "paypal", paypalEmail: paypalEmail.trim() });
      } else {
        if (!bankHolder.trim() || !bankAccount.trim() || !bankRouting.trim() || !bankCountry.trim()) {
          setError("Fill in all bank fields.");
          setLoading(false);
          return;
        }
        await savePayoutDetails({
          method: "bank",
          bankAccountHolder: bankHolder.trim(),
          bankAccountNumber: bankAccount.trim(),
          bankRouting: bankRouting.trim(),
          bankCountry: bankCountry.trim().toUpperCase(),
        });
      }
      haptic("success");
      setStage("profile");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save payout details");
    } finally {
      setLoading(false);
    }
  }, [payoutMethod, paypalEmail, bankHolder, bankAccount, bankRouting, bankCountry]);

  const handlePublish = useCallback(async (): Promise<void> => {
    if (identity.trim().length === 0) {
      setError("Add your identity tag first.");
      return;
    }
    if (picked.length === 0) {
      setError("Pick at least one POV category.");
      return;
    }
    if (!consentAgreed) {
      setError("Tick the 18+ consent box to publish your profile.");
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
      await queryClient.invalidateQueries({ queryKey: ["profile", "me", user?.id] });
      setStage("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't publish your profile");
    } finally {
      setLoading(false);
    }
  }, [identity, picked, price, consentAgreed, queryClient, user?.id]);

  // ---- Done state ----
  if (stage === "done" || step === 4) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.doneWrap}>
        <View style={styles.doneIcon}>
          <BadgeCheck size={30} color={Colors.ink} />
        </View>
        <Text style={styles.doneTitle}>You&apos;re a povme creator.</Text>
        <Text style={styles.doneBody}>
          Your studio is live. Upload your first POV episode, set your access levels, and go live
          whenever you&apos;re ready. Payouts run weekly to your{" "}
          {payoutMethod === "paypal" ? "PayPal" : "bank account"}.
          {kyc?.kycStatus === "verified" ? " Identity verified — you have the badge." : ""}
        </Text>
        <View style={styles.summary}>
          <SummaryRow label="Identity" value={identity || "Verified creator"} />
          <SummaryRow label="Subscription" value={`${formatMoney(price)}/mo`} />
          <SummaryRow label="Your share" value={`${formatMoney(price * 0.8)} (80%)`} />
          <SummaryRow
            label="Payouts"
            value={payoutMethod === "paypal" ? "PayPal · weekly" : "Bank transfer · weekly"}
          />
          <SummaryRow
            label="Verified"
            value={kyc?.kycStatus === "verified" ? "Yes — badge on" : "Skipped (add later)"}
          />
          <SummaryRow label="Status" value="Live" />
        </View>
        <Button label="Open creator studio" onPress={() => router.replace("/(tabs)/studio")} style={{ marginTop: 24 }} />
        <Button label="Upload first episode" variant="dark" onPress={() => router.replace("/upload")} style={{ marginTop: 10 }} />
      </ScrollView>
    );
  }

  // ---- Live identity + payout flow (step 3) ----
  if (step === 3) {
    return (
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          <ProgressBar progress={progressFor(stage)} />
          <Text style={styles.step}>{stageLabel(stage)}</Text>
          <Text style={styles.title}>Set up payouts &amp; go live</Text>
          <Text style={styles.body}>
            Add how you want to get paid — povme pays you weekly via PayPal or bank transfer. ID
            upload is optional: verified creators get a badge and faster payout reviews. You can
            skip it and verify later.
          </Text>

          {error ? (
            <View style={styles.errorCard}>
              <AlertCircle size={16} color={Colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* ---- Stage: identity (optional) ---- */}
          {stage === "identity" ? (
            <View style={{ gap: 14, marginTop: 14 }}>
              {/* Optional identity verification card */}
              <PressableScale onPress={() => { setIdCardOpen((v) => !v); haptic("light"); }} scaleTo={0.99}>
                <View style={styles.optionalCard}>
                  <View style={styles.optionalHeader}>
                    <View style={styles.optionalIcon}>
                      <ShieldCheck size={18} color={Colors.lime} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.optionalTitle}>Verify your identity (optional)</Text>
                      <Text style={styles.optionalSub}>
                        Verified creators get a badge and faster payout reviews. Skip and verify
                        later if you want.
                      </Text>
                    </View>
                    <ChevronDown
                      size={18}
                      color={Colors.textDim}
                      style={{ transform: [{ rotate: idCardOpen ? "180deg" : "0deg" }] }}
                    />
                  </View>

                  {idCardOpen ? (
                    <View style={styles.optionalBody}>
                      <DocPicker
                        label="Front of ID"
                        sub="Driver's license, passport, or national ID"
                        icon={<IdCard size={18} color={Colors.lime} />}
                        uri={frontUri}
                        onPick={() => pickImage("front")}
                      />
                      <DocPicker
                        label="Back of ID"
                        sub="If your ID has a back side"
                        icon={<CreditCard size={18} color={Colors.cyan} />}
                        uri={backUri}
                        onPick={() => pickImage("back")}
                      />
                      <DocPicker
                        label="Selfie holding ID"
                        sub="Hold your ID next to your face"
                        icon={<Camera size={18} color={Colors.magenta} />}
                        uri={selfieUri}
                        onPick={() => pickImage("selfie")}
                      />
                      <Button
                        label={loading ? "Submitting…" : "Submit for review (optional)"}
                        onPress={handleSubmitKyc}
                        disabled={loading || !frontUri || !backUri || !selfieUri}
                        icon={loading ? <Loader2 size={16} color={Colors.ink} /> : undefined}
                        style={{ marginTop: 4 }}
                      />
                    </View>
                  ) : null}
                </View>
              </PressableScale>

              <Button
                label="Skip — continue to payouts"
                variant="dark"
                onPress={handleSkipIdentity}
                icon={<ChevronRight size={18} color={Colors.ink} />}
                style={{ marginTop: 4 }}
              />
            </View>
          ) : null}

          {/* ---- Stage: payout details ---- */}
          {stage === "payout" ? (
            <View style={{ gap: 14, marginTop: 14 }}>
              {kyc?.kycStatus === "verified" ? (
                <View style={styles.doneRow}>
                  <Check size={14} color={Colors.success} />
                  <Text style={styles.doneText}>Identity verified — badge is on</Text>
                </View>
              ) : null}
              <Text style={styles.sectionLabel}>How do you want to get paid?</Text>
              <View style={styles.methodRow}>
                <MethodOption
                  icon={<Wallet size={18} color={Colors.lime} />}
                  label="PayPal"
                  sub="Fastest — funds arrive instantly"
                  active={payoutMethod === "paypal"}
                  onPress={() => setPayoutMethod("paypal")}
                />
                <MethodOption
                  icon={<Landmark size={18} color={Colors.cyan} />}
                  label="Bank transfer"
                  sub="1–3 business days"
                  active={payoutMethod === "bank"}
                  onPress={() => setPayoutMethod("bank")}
                />
              </View>

              {payoutMethod === "paypal" ? (
                <View style={styles.fieldBox}>
                  <FieldLabel icon={<Mail size={14} color={Colors.textDim} />} label="PayPal email" />
                  <TextInput
                    value={paypalEmail}
                    onChangeText={setPaypalEmail}
                    placeholder="you@example.com"
                    placeholderTextColor={Colors.textDim}
                    style={styles.input}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              ) : null}

              {payoutMethod === "bank" ? (
                <View style={styles.fieldBox}>
                  <FieldLabel icon={<IdCard size={14} color={Colors.textDim} />} label="Account holder name" />
                  <TextInput
                    value={bankHolder}
                    onChangeText={setBankHolder}
                    placeholder="Jane Doe"
                    placeholderTextColor={Colors.textDim}
                    style={styles.input}
                    autoCapitalize="words"
                  />
                  <FieldLabel icon={<CreditCard size={14} color={Colors.textDim} />} label="Account number" />
                  <TextInput
                    value={bankAccount}
                    onChangeText={setBankAccount}
                    placeholder="000123456789"
                    placeholderTextColor={Colors.textDim}
                    style={styles.input}
                    keyboardType="number-pad"
                    autoCapitalize="none"
                  />
                  <FieldLabel icon={<Landmark size={14} color={Colors.textDim} />} label="Routing number" />
                  <TextInput
                    value={bankRouting}
                    onChangeText={setBankRouting}
                    placeholder="021000021"
                    placeholderTextColor={Colors.textDim}
                    style={styles.input}
                    keyboardType="number-pad"
                    autoCapitalize="none"
                  />
                  <FieldLabel icon={<Upload size={14} color={Colors.textDim} />} label="Country (2-letter code)" />
                  <TextInput
                    value={bankCountry}
                    onChangeText={setBankCountry}
                    placeholder="US"
                    placeholderTextColor={Colors.textDim}
                    style={styles.input}
                    autoCapitalize="characters"
                    maxLength={2}
                  />
                  <Text style={styles.secureNote}>
                    Only the last 4 digits of your account number are stored.
                  </Text>
                </View>
              ) : null}

              <Button
                label={loading ? "Saving…" : "Save payout details"}
                onPress={handleSavePayout}
                disabled={loading || !payoutMethod}
                icon={loading ? <Loader2 size={16} color={Colors.ink} /> : undefined}
                style={{ marginTop: 8 }}
              />
            </View>
          ) : null}

          {/* ---- Stage: publish profile (consent-gated) ---- */}
          {stage === "profile" ? (
            <View style={{ gap: 14, marginTop: 14 }}>
              <View style={styles.doneRow}>
                <Check size={14} color={Colors.success} />
                <Text style={styles.doneText}>
                  Payouts via {payoutMethod === "paypal" ? "PayPal" : "bank transfer"} · weekly
                </Text>
              </View>
              {kyc?.kycStatus === "verified" ? (
                <View style={styles.doneRow}>
                  <Check size={14} color={Colors.success} />
                  <Text style={styles.doneText}>Identity verified — badge is on</Text>
                </View>
              ) : (
                <View style={styles.doneRow}>
                  <Text style={styles.doneTextDim}>Identity not verified — add it any time</Text>
                </View>
              )}

              {/* Consent checkbox */}
              <Pressable
                onPress={() => { setConsentAgreed((v) => !v); haptic("light"); }}
                style={styles.consentRow}
              >
                <View style={[styles.checkbox, consentAgreed && styles.checkboxActive]}>
                  {consentAgreed ? <Check size={14} color={Colors.ink} /> : null}
                </View>
                <Text style={styles.consentText}>{CONSENT_COPY}</Text>
              </Pressable>

              <Button
                label={loading ? "Publishing…" : "Finish & open studio"}
                onPress={handlePublish}
                disabled={loading || !consentAgreed}
                icon={loading ? <Loader2 size={16} color={Colors.ink} /> : undefined}
                style={{ marginTop: 8 }}
              />
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ---- Setup steps (identity tag, categories, price) ----
  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <ProgressBar progress={(step + 1) / 4} />
      <Text style={styles.step}>Step {step + 1} of 4</Text>

      {error && step < 3 ? (
        <View style={styles.errorCard}>
          <AlertCircle size={16} color={Colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

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
          <Button
            label="Continue"
            onPress={() => {
              if (identity.trim().length === 0) {
                setError("Add your identity tag first.");
                return;
              }
              setError(null);
              setStep(1);
            }}
            style={{ marginTop: 12 }}
          />
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
          <Button
            label="Continue"
            onPress={() => {
              if (picked.length === 0) {
                setError("Pick at least one POV category.");
                return;
              }
              setError(null);
              setStep(2);
            }}
          />
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
            label="Continue to payouts"
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
    case "identity": return 0.55;
    case "payout": return 0.8;
    case "profile": return 0.95;
    case "done": return 1;
  }
}

function stageLabel(stage: Stage): string {
  switch (stage) {
    case "identity": return "IDENTITY (OPTIONAL)";
    case "payout": return "PAYOUT DETAILS";
    case "profile": return "PUBLISH PROFILE";
    case "done": return "DONE";
  }
}

function DocPicker({
  label,
  sub,
  icon,
  uri,
  onPick,
}: {
  label: string;
  sub: string;
  icon: React.ReactNode;
  uri: string | null;
  onPick: () => void;
}) {
  return (
    <PressableScale onPress={onPick} scaleTo={0.97}>
      <View style={styles.docBox}>
        {uri ? (
          <Image source={{ uri }} style={styles.docThumb} contentFit="cover" />
        ) : (
          <View style={styles.docPlaceholder}>
            {icon}
            <Camera size={22} color={Colors.textDim} style={{ marginTop: 6 }} />
          </View>
        )}
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.docLabel}>{label}</Text>
          <Text style={styles.docSub}>{sub}</Text>
          {uri ? (
            <Text style={styles.docChange}>Tap to retake</Text>
          ) : (
            <Text style={styles.docChange}>Tap to capture</Text>
          )}
        </View>
        {uri ? (
          <View style={styles.docCheck}>
            <Check size={12} color={Colors.ink} />
          </View>
        ) : null}
      </View>
    </PressableScale>
  );
}

function MethodOption({
  icon,
  label,
  sub,
  active,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  sub: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <PressableScale onPress={onPress} scaleTo={0.97} style={{ flex: 1 }}>
      <View style={[styles.methodCard, active && styles.methodCardActive]}>
        <View style={styles.methodIcon}>{icon}</View>
        <Text style={[styles.methodLabel, active && { color: Colors.ink }]}>{label}</Text>
        <Text style={[styles.methodSub, active && { color: Colors.ink }]}>{sub}</Text>
      </View>
    </PressableScale>
  );
}

function FieldLabel({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <View style={styles.fieldLabelRow}>
      {icon}
      <Text style={styles.fieldLabelText}>{label}</Text>
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
  sectionLabel: { color: Colors.text, fontSize: 15, fontWeight: "800", marginTop: 4 },
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
    marginBottom: 10,
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
  // Optional identity card
  optionalCard: {
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
  },
  optionalHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  optionalIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(204,255,0,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  optionalTitle: { color: Colors.text, fontSize: 14, fontWeight: "800" },
  optionalSub: { color: Colors.textDim, fontSize: 11.5, fontWeight: "600", marginTop: 3, lineHeight: 16 },
  optionalBody: { marginTop: 12, gap: 10 },
  // Doc picker
  docBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  docThumb: {
    width: 64,
    height: 80,
    borderRadius: 8,
    backgroundColor: Colors.surfaceHi,
  },
  docPlaceholder: {
    width: 64,
    height: 80,
    borderRadius: 8,
    backgroundColor: Colors.surfaceHi,
    alignItems: "center",
    justifyContent: "center",
  },
  docLabel: { color: Colors.text, fontSize: 14, fontWeight: "800" },
  docSub: { color: Colors.textDim, fontSize: 11.5, fontWeight: "600", marginTop: 2 },
  docChange: { color: Colors.lime, fontSize: 11, fontWeight: "700", marginTop: 6 },
  docCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.lime,
    alignItems: "center",
    justifyContent: "center",
  },
  // Payout method
  methodRow: { flexDirection: "row", gap: 10 },
  methodCard: {
    flex: 1,
    padding: 14,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 6,
  },
  methodCardActive: { backgroundColor: Colors.lime, borderColor: Colors.lime },
  methodIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  methodLabel: { color: Colors.text, fontSize: 14, fontWeight: "900" },
  methodSub: { color: Colors.textDim, fontSize: 11, fontWeight: "600" },
  fieldBox: { marginTop: 4 },
  fieldLabelRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6, marginTop: 4 },
  fieldLabelText: { color: Colors.textDim, fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6 },
  secureNote: { color: Colors.textDim, fontSize: 11, fontWeight: "600", marginTop: 4 },
  doneRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  doneText: { color: Colors.success, fontSize: 12.5, fontWeight: "700" },
  doneTextDim: { color: Colors.textDim, fontSize: 12.5, fontWeight: "600" },
  // Consent checkbox
  consentRow: { flexDirection: "row", alignItems: "flex-start", gap: 11, padding: 14, borderRadius: Radius.md, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, marginTop: 4 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.borderHi,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxActive: { backgroundColor: Colors.lime, borderColor: Colors.lime },
  consentText: { flex: 1, color: Colors.textMid, fontSize: 12.5, fontWeight: "600", lineHeight: 18 },
  // Done
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
