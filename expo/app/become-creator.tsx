import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import {
  AlertCircle,
  BadgeCheck,
  Camera,
  Check,
  ChevronRight,
  IdCard,
  Image as ImageIcon,
  Landmark,
  Loader2,
  RefreshCw,
  Shield,
  Upload,
  Wallet,
} from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
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
import { CATEGORIES, formatMoney } from "@/lib/format";
import { useCategories } from "@/hooks/useDiscovery";
import { useAuth } from "@/hooks/useAuth";
import {
  connectStripePayouts,
  fetchKycState,
  pickIdPhoto,
  publishCreatorProfile,
  submitVerification,
  uploadIdPhoto,
  type KycState,
} from "@/lib/kyc";
import type { PovCategory } from "@/types";
import { FUNCTIONS_URL } from "@/lib/edge";
import * as WebBrowser from "expo-web-browser";

const PRICE_OPTIONS = [4.99, 7.99, 9.99, 12.99, 14.99, 19.99, 24.99, 29.99, 39.99, 49.99];

type Stage =
  | "identity"
  | "idPhoto"
  | "submitting"
  | "awaitingReview"
  | "payout"
  | "profile"
  | "done";

export default function BecomeCreatorScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: dbCategories } = useCategories();
  const allCategories = dbCategories ?? CATEGORIES;

  const [step, setStep] = useState<number>(0);
  const [identity, setIdentity] = useState<string>("");
  const [picked, setPicked] = useState<PovCategory[]>([]);
  const [price, setPrice] = useState<number>(12.99);

  const [stage, setStage] = useState<Stage>("identity");
  const [kyc, setKyc] = useState<KycState | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Self-attestation form
  const [legalName, setLegalName] = useState<string>("");
  const [dobMonth, setDobMonth] = useState<string>("");
  const [dobDay, setDobDay] = useState<string>("");
  const [dobYear, setDobYear] = useState<string>("");
  const [idPhotoBase64, setIdPhotoBase64] = useState<string | null>(null);
  const [storagePath, setStoragePath] = useState<string | null>(null);
  const [photoSource, setPhotoSource] = useState<"camera" | "library">("camera");

  // Stripe Connect onboarding
  const [stripeConnected, setStripeConnected] = useState<boolean>(false);
  const [connecting, setConnecting] = useState<boolean>(false);
  const [agreed, setAgreed] = useState<boolean>(false);

  // Pull existing KYC state on mount so returning creators don't re-verify.
  const loadKyc = useCallback(async (): Promise<void> => {
    try {
      const state = await fetchKycState();
      if (!state) return;
      setKyc(state);
      setLegalName(state.legalName ?? "");
      if (state.dateOfBirth) {
        const [y, m, d] = state.dateOfBirth.split("-");
        setDobYear(y);
        setDobMonth(m);
        setDobDay(d);
      }
      if (state.payoutsEnabled) setStripeConnected(true);

      if (state.kycStatus === "verified" && state.payoutsEnabled) {
        setStage("profile");
      } else if (state.kycStatus === "verified") {
        setStage("payout");
      } else if (state.kycStatus === "pending") {
        setStage("awaitingReview");
      } else if (state.hasUploadedId) {
        setStage("awaitingReview");
      }
    } catch (err) {
      console.log("[povme] loadKyc:", err);
    }
  }, []);

  useEffect(() => {
    void loadKyc();
  }, [loadKyc]);

  const dobString = `${dobYear}-${dobMonth.padStart(2, "0")}-${dobDay.padStart(2, "0")}`;
  const dobValid = (() => {
    const y = Number(dobYear);
    const m = Number(dobMonth);
    const d = Number(dobDay);
    if (!y || !m || !d) return false;
    if (y < 1900 || y > 2010) return false;
    if (m < 1 || m > 12) return false;
    if (d < 1 || d > 31) return false;
    const age = (Date.now() - new Date(dobString).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    return age >= 18;
  })();

  const handleTakePhoto = useCallback(async (source: "camera" | "library"): Promise<void> => {
    setError(null);
    try {
      const base64 = await pickIdPhoto(source);
      if (!base64) return;
      setIdPhotoBase64(base64);
      setPhotoSource(source);
      haptic("medium");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not pick photo");
    }
  }, []);

  const handleSubmitVerification = useCallback(async (): Promise<void> => {
    if (!legalName.trim()) {
      setError("Enter your legal name");
      return;
    }
    if (!dobValid) {
      setError("Enter a valid date of birth (must be 18+)");
      return;
    }
    if (!idPhotoBase64) {
      setError("Add a photo of your government ID");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setStage("submitting");
      const path = await uploadIdPhoto(idPhotoBase64);
      setStoragePath(path);
      await submitVerification({
        legalName: legalName.trim(),
        dateOfBirth: dobString,
        storagePath: path,
      });
      haptic("success");
      setStage("awaitingReview");
      await loadKyc();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification submission failed");
      setStage("idPhoto");
    } finally {
      setLoading(false);
    }
  }, [legalName, dobValid, dobString, idPhotoBase64, loadKyc]);

  const handleConnectStripe = useCallback(async (): Promise<void> => {
    if (!agreed) {
      setError("Agree to the creator terms first");
      return;
    }
    setLoading(true);
    setError(null);
    setConnecting(true);
    try {
      const result = await connectStripePayouts({ country: "US" });
      // If onboarding is already complete, no URL is returned.
      if (result.url) {
        if (Platform.OS === "web") {
          window.open(result.url, "_blank", "width=480,height=720");
        } else {
          const returnUrl = `${FUNCTIONS_URL}/update-payout-handle?done=1`;
          await WebBrowser.openAuthSessionAsync(result.url, returnUrl);
        }
      }
      haptic("success");
      // Re-pull state — the webhook may have already flipped payouts_enabled,
      // or the creator may still need to finish. Give the webhook a moment.
      await new Promise((r) => setTimeout(r, 1200));
      await loadKyc();
      setStripeConnected(true);
      setStage("profile");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start Stripe onboarding");
    } finally {
      setLoading(false);
      setConnecting(false);
    }
  }, [agreed, loadKyc]);

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
          Identity verified, Stripe connected, and your studio is live. Upload your first POV
          episode, set your access levels, and go live whenever you&apos;re ready. Payouts deposit
          to your bank via Stripe on a rolling schedule.
        </Text>
        <View style={styles.summary}>
          <SummaryRow label="Identity" value={identity || "Verified creator"} />
          <SummaryRow label="Subscription" value={`${formatMoney(price)}/mo`} />
          <SummaryRow label="Your share" value={`${formatMoney(price * 0.8)} (80%)`} />
          <SummaryRow label="Payouts" value="Stripe · automatic" />
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
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.screen}
          contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <ProgressBar progress={progressFor(stage)} />
          <Text style={styles.step}>{stageLabel(stage)}</Text>
          <Text style={styles.title}>Verify &amp; connect payouts</Text>
          <Text style={styles.body}>
            Required by law for creator payouts. Confirm your identity, upload a photo of your
            government ID, and connect Stripe. Our team reviews IDs within 24 hours.
          </Text>

          {error ? (
            <View style={styles.errorCard}>
              <AlertCircle size={16} color={Colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Step tracker */}
          <View style={styles.kycList}>
            <KycRow
              icon={<IdCard size={17} color={Colors.lime} />}
              label="Confirm identity"
              sub="Legal name, date of birth, 18+"
              state={stage === "identity" || stage === "idPhoto" || stage === "submitting"
                ? "pending"
                : stage === "awaitingReview"
                  ? "pending"
                  : "done"}
              loading={loading && stage === "submitting"}
            />
            <KycRow
              icon={<Camera size={17} color={Colors.lime} />}
              label="Upload government ID"
              sub="Driver's license, passport, or state ID"
              state={idPhotoBase64 || stage === "awaitingReview" || stage === "payout" || stage === "profile"
                ? "done"
                : stage === "idPhoto" || stage === "submitting"
                  ? "pending"
                  : "waiting"}
              loading={loading && stage === "submitting"}
            />
            <KycRow
              icon={<Wallet size={17} color={Colors.lime} />}
              label="Stripe payouts"
              sub="Bank account via Stripe Connect"
              state={stage === "payout" ? "pending" : stage === "profile" ? "done" : "waiting"}
              loading={loading && stage === "payout"}
            />
          </View>

          {kyc?.kycLastReason && kyc.kycStatus === "failed" ? (
            <Text style={styles.reason}>Last issue: {kyc.kycLastReason}</Text>
          ) : null}

          {/* Stage: identity form */}
          {stage === "identity" ? (
            <View style={{ gap: 12, marginTop: 18 }}>
              <Text style={styles.fieldLabel}>LEGAL NAME</Text>
              <TextInput
                value={legalName}
                onChangeText={setLegalName}
                placeholder="As it appears on your ID"
                placeholderTextColor={Colors.textDim}
                style={styles.input}
                autoCapitalize="words"
              />
              <Text style={styles.fieldLabel}>DATE OF BIRTH</Text>
              <View style={styles.dobRow}>
                <TextInput
                  value={dobMonth}
                  onChangeText={(v) => setDobMonth(v.replace(/[^0-9]/g, "").slice(0, 2))}
                  placeholder="MM"
                  placeholderTextColor={Colors.textDim}
                  style={[styles.input, styles.dobField]}
                  keyboardType="numeric"
                  maxLength={2}
                />
                <TextInput
                  value={dobDay}
                  onChangeText={(v) => setDobDay(v.replace(/[^0-9]/g, "").slice(0, 2))}
                  placeholder="DD"
                  placeholderTextColor={Colors.textDim}
                  style={[styles.input, styles.dobField]}
                  keyboardType="numeric"
                  maxLength={2}
                />
                <TextInput
                  value={dobYear}
                  onChangeText={(v) => setDobYear(v.replace(/[^0-9]/g, "").slice(0, 4))}
                  placeholder="YYYY"
                  placeholderTextColor={Colors.textDim}
                  style={[styles.input, styles.dobFieldWide]}
                  keyboardType="numeric"
                  maxLength={4}
                />
              </View>
              {dobMonth && dobDay && dobYear && !dobValid ? (
                <Text style={styles.fieldHint}>Must be 18 or older and a valid date.</Text>
              ) : null}

              <Button
                label="Continue to ID photo"
                onPress={() => setStage("idPhoto")}
                disabled={!legalName.trim() || !dobValid}
                icon={<ChevronRight size={18} color={Colors.ink} />}
                style={{ marginTop: 6 }}
              />
            </View>
          ) : null}

          {/* Stage: ID photo upload */}
          {stage === "idPhoto" ? (
            <View style={{ gap: 14, marginTop: 18 }}>
              {idPhotoBase64 ? (
                <View style={styles.idPreview}>
                  <Text style={styles.idPreviewText}>ID photo captured</Text>
                  <PressableScale onPress={() => setIdPhotoBase64(null)} scaleTo={0.9}>
                    <View style={styles.retakeBtn}>
                      <RefreshCw size={13} color={Colors.text} />
                      <Text style={styles.retakeText}>Retake</Text>
                    </View>
                  </PressableScale>
                </View>
              ) : (
                <View style={styles.uploadBox}>
                  <View style={styles.uploadIcon}>
                    <Upload size={26} color={Colors.lime} />
                  </View>
                  <Text style={styles.uploadTitle}>Upload your ID</Text>
                  <Text style={styles.uploadBody}>
                    Take a clear, well-lit photo of your driver&apos;s license, passport, or state
                    ID. All four corners visible, no glare.
                  </Text>
                </View>
              )}

              <View style={styles.uploadActions}>
                <PressableScale
                  style={{ flex: 1 }}
                  scaleTo={0.96}
                  hapticStyle="medium"
                  onPress={() => void handleTakePhoto("camera")}
                >
                  <View style={styles.uploadAction}>
                    <Camera size={18} color={Colors.ink} />
                    <Text style={styles.uploadActionText}>Take photo</Text>
                  </View>
                </PressableScale>
                <PressableScale
                  style={{ flex: 1 }}
                  scaleTo={0.96}
                  hapticStyle="medium"
                  onPress={() => void handleTakePhoto("library")}
                >
                  <View style={[styles.uploadAction, { backgroundColor: Colors.surfaceHi }]}>
                    <ImageIcon size={18} color={Colors.text} />
                    <Text style={[styles.uploadActionText, { color: Colors.text }]}>Choose file</Text>
                  </View>
                </PressableScale>
              </View>

              <View style={styles.secureNote}>
                <Shield size={13} color={Colors.cyan} />
                <Text style={styles.secureText}>
                  Stored encrypted. Only our review team can view it. Auto-deleted 90 days after
                  approval.
                </Text>
              </View>

              <Button
                label={loading ? "Submitting…" : "Submit for review"}
                onPress={() => void handleSubmitVerification()}
                disabled={!idPhotoBase64 || loading}
                icon={loading ? <Loader2 size={16} color={Colors.ink} /> : undefined}
                style={{ marginTop: 4 }}
              />
              <PressableScale onPress={() => setStage("identity")} scaleTo={0.97}>
                <Text style={styles.backLink}>Back to identity</Text>
              </PressableScale>
            </View>
          ) : null}

          {/* Stage: awaiting review */}
          {stage === "awaitingReview" ? (
            <View style={{ gap: 14, marginTop: 18 }}>
              <View style={styles.reviewBox}>
                <ActivityIndicator size="large" color={Colors.gold} />
                <Text style={styles.reviewTitle}>Under review</Text>
                <Text style={styles.reviewBody}>
                  Your ID is in the queue. Our team reviews within 24 hours. You&apos;ll get a
                  push notification when approved. Meanwhile, set up your payout handle so
                  you&apos;re ready to withdraw earnings the moment you&apos;re verified.
                </Text>
              </View>
              <Button
                label="Set up payouts while you wait"
                onPress={() => setStage("payout")}
                icon={<ChevronRight size={18} color={Colors.ink} />}
              />
              <PressableScale onPress={() => void loadKyc()} scaleTo={0.97}>
                <View style={styles.retryRow}>
                  <RefreshCw size={13} color={Colors.textDim} />
                  <Text style={styles.retryText}>Re-check verification status</Text>
                </View>
              </PressableScale>
            </View>
          ) : null}

          {/* Stage: Stripe Connect onboarding */}
          {stage === "payout" ? (
            <View style={{ gap: 14, marginTop: 18 }}>
              {stripeConnected ? (
                <View style={styles.verifiedBox}>
                  <BadgeCheck size={22} color={Colors.success} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.verifiedTitle}>Stripe connected</Text>
                    <Text style={styles.verifiedBody}>
                      Your bank details are on file with Stripe. Earnings will be deposited
                      automatically on a rolling schedule.
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.stripeBox}>
                  <View style={styles.stripeIconRow}>
                    <View style={styles.stripeBadge}>
                      <Landmark size={20} color={Colors.ink} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.stripeTitle}>Connect with Stripe</Text>
                      <Text style={styles.stripeSub}>
                        Stripe handles direct deposits to your bank account. You&apos;ll finish
                        onboarding on Stripe&apos;s secure page — povme never sees your bank
                        details.
                      </Text>
                    </View>
                  </View>
                  <View style={styles.stripePerks}>
                    <Text style={styles.perkLine}>• Automatic payouts to your bank</Text>
                    <Text style={styles.perkLine}>• 1–2 business day deposits</Text>
                    <Text style={styles.perkLine}>• Stripe-secure, PCI compliant</Text>
                  </View>
                </View>
              )}

              <PressableScale onPress={() => setAgreed((v) => !v)} scaleTo={0.97}>
                <View style={styles.termsRow}>
                  <View style={[styles.check, agreed && styles.checkActive]}>
                    {agreed ? <Check size={12} color={Colors.ink} /> : null}
                  </View>
                  <Text style={styles.termsText}>
                    I confirm every person in my POV content is 18+ and has consented, and I accept
                    the creator terms and content guidelines. I&apos;m responsible for my own
                    taxes.
                  </Text>
                </View>
              </PressableScale>

              <Button
                label={connecting ? "Opening Stripe…" : stripeConnected ? "Re-check status" : "Connect Stripe"}
                onPress={() => void handleConnectStripe()}
                disabled={loading || (!stripeConnected && !agreed)}
                icon={loading ? <Loader2 size={16} color={Colors.ink} /> : <ChevronRight size={18} color={Colors.ink} />}
              />
              {kyc?.kycStatus !== "verified" ? (
                <Text style={styles.fieldHint}>
                  You can connect Stripe now — payouts unlock once your ID is approved.
                </Text>
              ) : null}
              <PressableScale onPress={() => void loadKyc()} scaleTo={0.97}>
                <View style={styles.retryRow}>
                  <RefreshCw size={13} color={Colors.textDim} />
                  <Text style={styles.retryText}>Re-check verification status</Text>
                </View>
              </PressableScale>
            </View>
          ) : null}

          {/* Stage: publish profile */}
          {stage === "profile" ? (
            <View style={{ gap: 14, marginTop: 18 }}>
              <View style={styles.verifiedBox}>
                <BadgeCheck size={22} color={Colors.success} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.verifiedTitle}>Verified &amp; ready</Text>
                  <Text style={styles.verifiedBody}>
                    Identity approved · Stripe payouts connected. Finish your profile to
                    go live.
                  </Text>
                </View>
              </View>
              <Button
                label="Finish & open studio"
                onPress={() => void handlePublish()}
                disabled={loading}
                icon={loading ? <Loader2 size={16} color={Colors.ink} /> : undefined}
              />
            </View>
          ) : null}

          <Text style={styles.legal}>
            By continuing you accept the povme creator terms, the content guidelines, and confirm
            every person appearing in your POV content is 18+ and has consented to being filmed.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
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
            {allCategories.map((c) => (
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
    case "idPhoto": return 0.68;
    case "submitting": return 0.72;
    case "awaitingReview": return 0.78;
    case "payout": return 0.88;
    case "profile": return 0.95;
    case "done": return 1;
  }
}

function stageLabel(stage: Stage): string {
  switch (stage) {
    case "identity": return "CONFIRM IDENTITY";
    case "idPhoto": return "UPLOAD ID";
    case "submitting": return "SUBMITTING";
    case "awaitingReview": return "UNDER REVIEW";
    case "payout": return "CONNECT PAYOUTS";
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
  fieldLabel: { ...microLabel, color: Colors.textDim, marginTop: 4 },
  fieldHint: { color: Colors.textDim, fontSize: 12, fontWeight: "600", lineHeight: 18 },
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
  dobRow: { flexDirection: "row", gap: 9 },
  dobField: { flex: 1, textAlign: "center" },
  dobFieldWide: { flex: 1.6, textAlign: "center" },
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
  backLink: { color: Colors.textDim, fontSize: 12, fontWeight: "700", textAlign: "center", marginTop: 8 },
  legal: { color: Colors.textDim, fontSize: 11, fontWeight: "600", lineHeight: 17, marginTop: 14 },
  // ID upload
  uploadBox: {
    alignItems: "center",
    padding: 24,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  uploadIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(204,255,0,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  uploadTitle: { color: Colors.text, fontSize: 17, fontWeight: "900", letterSpacing: -0.3 },
  uploadBody: { color: Colors.textMid, fontSize: 12.5, fontWeight: "600", lineHeight: 18, textAlign: "center" },
  uploadActions: { flexDirection: "row", gap: 9 },
  uploadAction: {
    height: 52,
    borderRadius: Radius.md,
    backgroundColor: Colors.lime,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  uploadActionText: { color: Colors.ink, fontSize: 14, fontWeight: "900" },
  secureNote: {
    flexDirection: "row",
    gap: 9,
    padding: 13,
    borderRadius: Radius.md,
    backgroundColor: "rgba(53,231,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(53,231,255,0.22)",
  },
  secureText: { flex: 1, color: Colors.textMid, fontSize: 11.5, fontWeight: "600", lineHeight: 17 },
  idPreview: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: Radius.md,
    backgroundColor: "rgba(61,220,151,0.1)",
    borderWidth: 1,
    borderColor: "rgba(61,220,151,0.3)",
  },
  idPreviewText: { color: Colors.success, fontSize: 14, fontWeight: "800" },
  retakeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surfaceHi,
  },
  retakeText: { color: Colors.text, fontSize: 12, fontWeight: "700" },
  // Awaiting review
  reviewBox: {
    alignItems: "center",
    padding: 24,
    borderRadius: Radius.md,
    backgroundColor: "rgba(255,182,39,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,182,39,0.25)",
    gap: 12,
  },
  reviewTitle: { color: Colors.text, fontSize: 17, fontWeight: "900", letterSpacing: -0.3 },
  reviewBody: { color: Colors.textMid, fontSize: 12.5, fontWeight: "600", lineHeight: 19, textAlign: "center" },
  // Payout method
  methodGrid: { flexDirection: "row", gap: 9 },
  methodCard: {
    height: 56,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  methodCardActive: { backgroundColor: Colors.lime, borderColor: Colors.lime },
  methodLabel: { color: Colors.text, fontSize: 12.5, fontWeight: "900" },  termsRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  check: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.borderHi,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkActive: { backgroundColor: Colors.lime, borderColor: Colors.lime },
  termsText: { flex: 1, color: Colors.textMid, fontSize: 11.5, fontWeight: "600", lineHeight: 17 },
  // Stripe Connect onboarding
  stripeBox: {
    padding: 18,
    borderRadius: Radius.md,
    backgroundColor: "rgba(99,91,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(99,91,255,0.28)",
    gap: 14,
  },
  stripeIconRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  stripeBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#635BFF",
    alignItems: "center",
    justifyContent: "center",
  },
  stripeTitle: { color: Colors.text, fontSize: 16, fontWeight: "900", letterSpacing: -0.3 },
  stripeSub: { color: Colors.textMid, fontSize: 12.5, fontWeight: "600", lineHeight: 18, marginTop: 5 },
  stripePerks: { gap: 4, paddingLeft: 4 },
  perkLine: { color: Colors.textMid, fontSize: 12, fontWeight: "600", lineHeight: 18 },
  // Verified
  verifiedBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: Radius.md,
    backgroundColor: "rgba(61,220,151,0.1)",
    borderWidth: 1,
    borderColor: "rgba(61,220,151,0.3)",
  },
  verifiedTitle: { color: Colors.text, fontSize: 14, fontWeight: "900" },
  verifiedBody: { color: Colors.textMid, fontSize: 11.5, fontWeight: "600", lineHeight: 17, marginTop: 3 },
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
