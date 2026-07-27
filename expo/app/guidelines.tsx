import { AlertTriangle, Check, FileText, Shield, X } from "lucide-react-native";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { SectionHeader } from "@/components/ui";
import Colors, { Radius, microLabel } from "@/constants/colors";

const ALLOWED = [
  "First-person lifestyle content you filmed yourself",
  "Work, training, travel, nightlife and daily-life chapters",
  "Adult content in age-gated categories, with verified consent from everyone on camera",
  "Educational trading, betting and business POVs with clear risk disclaimers",
  "Blurred or excluded faces of bystanders who did not consent",
];

const BANNED = [
  "Anyone under 18, or content that sexualises minors in any way",
  "Non-consensual filming, revenge content, hidden cameras in private spaces",
  "Real violence, self-harm, or animal cruelty",
  "Illegal acts, weapons or drug sales, financial fraud or guaranteed-return promises",
  "Impersonating another creator or reposting someone else's footage",
];

const POLICIES = [
  { title: "Age & identity verification", body: "Every creator completes government ID and liveness checks before publishing or receiving a payout. Anyone appearing repeatedly on camera must be documented as 18+." },
  { title: "Consent records", body: "For POV content featuring other people, creators keep signed consent on file. povme may request it during a review." },
  { title: "Review & appeals", body: "Flagged content is reviewed by a human within 24 hours. Creators receive a reason and can appeal once. Repeat violations end in permanent removal and withheld payouts." },
  { title: "Financial content", body: "Trading and betting POVs must show real results and carry a risk disclaimer. No selling signals, no guaranteed returns, no unlicensed advice." },
  { title: "Payments & chargebacks", body: "All transactions are processed with 3-D Secure. Fraudulent chargebacks may result in account restriction. PPV unlocks are non-refundable once watched." },
];

export default function GuidelinesScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Shield size={22} color={Colors.ink} />
        </View>
        <Text style={styles.heroTitle}>Real lives, filmed responsibly.</Text>
        <Text style={styles.heroBody}>
          povme is an 18+ platform for first-person lifestyle content. These rules keep creators
          payable, fans safe, and the brand something serious companies will work with.
        </Text>
      </View>

      <SectionHeader kicker="Allowed" title="What you can post" />
      <View style={styles.card}>
        {ALLOWED.map((item) => (
          <View key={item} style={styles.row}>
            <View style={[styles.bullet, { backgroundColor: "rgba(61,220,151,0.15)" }]}>
              <Check size={12} color={Colors.success} />
            </View>
            <Text style={styles.rowText}>{item}</Text>
          </View>
        ))}
      </View>

      <SectionHeader kicker="Zero tolerance" title="Instant removal" />
      <View style={[styles.card, { borderColor: "rgba(255,77,77,0.25)" }]}>
        {BANNED.map((item) => (
          <View key={item} style={styles.row}>
            <View style={[styles.bullet, { backgroundColor: "rgba(255,77,77,0.15)" }]}>
              <X size={12} color={Colors.danger} />
            </View>
            <Text style={styles.rowText}>{item}</Text>
          </View>
        ))}
      </View>

      <SectionHeader kicker="The details" title="Policies" />
      <View style={{ paddingHorizontal: 18, gap: 10 }}>
        {POLICIES.map((p) => (
          <View key={p.title} style={styles.policy}>
            <View style={styles.rowGap8}>
              <FileText size={14} color={Colors.lime} />
              <Text style={styles.policyTitle}>{p.title}</Text>
            </View>
            <Text style={styles.policyBody}>{p.body}</Text>
          </View>
        ))}
      </View>

      <View style={styles.warn}>
        <AlertTriangle size={15} color={Colors.gold} />
        <Text style={styles.warnText}>
          See something wrong? Report it from any episode, profile, or live chat. Reports are
          anonymous and reviewed within 24 hours.
        </Text>
      </View>

      <Text style={styles.legal}>
        povme · Terms of Use · Privacy Policy · Acceptable Content Policy · DMCA · 2257 compliance
        statement. Platform fee 20%. Creators keep 80% of all revenue.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  hero: { paddingHorizontal: 20, paddingTop: 10, gap: 12 },
  heroIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.lime,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: { color: Colors.text, fontSize: 26, fontWeight: "900", letterSpacing: -1, lineHeight: 31 },
  heroBody: { color: Colors.textMid, fontSize: 14, fontWeight: "500", lineHeight: 21 },
  card: {
    marginHorizontal: 18,
    padding: 16,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  row: { flexDirection: "row", gap: 11, alignItems: "flex-start" },
  bullet: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  rowText: { flex: 1, color: Colors.textMid, fontSize: 13, fontWeight: "600", lineHeight: 19 },
  policy: {
    padding: 15,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  rowGap8: { flexDirection: "row", alignItems: "center", gap: 8 },
  policyTitle: { color: Colors.text, fontSize: 14, fontWeight: "800" },
  policyBody: { color: Colors.textDim, fontSize: 12.5, fontWeight: "600", lineHeight: 19 },
  warn: {
    flexDirection: "row",
    gap: 10,
    margin: 18,
    padding: 15,
    borderRadius: Radius.md,
    backgroundColor: "rgba(255,182,39,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,182,39,0.22)",
  },
  warnText: { flex: 1, color: Colors.text, fontSize: 12.5, fontWeight: "600", lineHeight: 19 },
  legal: {
    color: Colors.textDim,
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 17,
    paddingHorizontal: 20,
    marginTop: 6,
  },
  microRef: { ...microLabel },
});
