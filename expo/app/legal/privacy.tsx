import { Shield } from "lucide-react-native";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { SectionHeader } from "@/components/ui";
import Colors from "@/constants/colors";

const SECTIONS = [
  {
    title: "1. Data we collect",
    body: "Account data: name, email, profile photo, handle, bio. Verification data: government ID and selfie (processed by Stripe Identity, not stored by POVMe). Content: videos, thumbnails, chat messages, direct messages. Transaction data: payment amounts, Stripe customer/account IDs, payout history. Usage data: watch time, likes, views, device type, push token.",
  },
  {
    title: "2. How we use your data",
    body: "To provide the POVMe service: hosting and delivering content, processing payments, verifying identity, sending notifications, and improving recommendations. We do not sell your data to third parties. We use Stripe for payments, Mux for video delivery, and Resend for transactional email — each under their own privacy policies.",
  },
  {
    title: "3. Data sharing",
    body: "We share data with: Stripe (payment processing, KYC), Mux (video transcoding and CDN), Resend (transactional email), and cloud infrastructure providers (Supabase/Postgres). We may disclose data to law enforcement when legally required. Aggregate, anonymized analytics may be shared with partners.",
  },
  {
    title: "4. Your rights (GDPR / CCPA)",
    body: "You have the right to: access your data (export from Settings), rectify inaccurate data (edit profile), erase your account (delete from Settings — financial records retained for tax compliance), restrict processing, and data portability. EU/UK residents: contact privacy@povme.app to exercise these rights.",
  },
  {
    title: "5. Data retention",
    body: "Account data is retained until you delete your account. Content is retained until you remove it. Transaction and payout records are retained for 7 years for tax compliance (IRS/regulatory requirement). Deleted account data is anonymized in financial records. Push tokens are removed when you sign out.",
  },
  {
    title: "6. Security",
    body: "All data is encrypted in transit (TLS) and at rest. Row Level Security enforces per-user access control. Payment data never touches POVMe servers — Stripe handles card data under PCI-DSS. KYC documents are processed by Stripe Identity and not stored by POVMe.",
  },
  {
    title: "7. Cookies & tracking",
    body: "The POVMe app does not use advertising trackers. We use minimal analytics (in-app events) to improve the service. Web visitors: we use essential cookies only. No third-party advertising cookies.",
  },
  {
    title: "8. Children's privacy",
    body: "POVMe is strictly 18+. We do not knowingly collect data from anyone under 18. If we discover an account belonging to a minor, it is terminated immediately and all data deleted. Report underage accounts to safety@povme.app.",
  },
  {
    title: "9. International transfers",
    body: "Your data may be processed in the United States and other countries where our providers operate. We rely on Standard Contractual Clauses for EU/UK data transfers. By using POVMe, you consent to these transfers.",
  },
  {
    title: "10. Contact",
    body: "Privacy questions: privacy@povme.app. Data protection officer (EU): dpo@povme.app. Postal: POVMe Legal, Attn: Privacy, 548 Market St, San Francisco, CA 94104.",
  },
];

export default function PrivacyScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Shield size={22} color={Colors.ink} />
        </View>
        <Text style={styles.heroTitle}>Privacy Policy</Text>
        <Text style={styles.heroBody}>
          Last updated July 2026. How POVMe collects, uses, and protects your data.
        </Text>
      </View>

      {SECTIONS.map((s) => (
        <View key={s.title} style={styles.section}>
          <SectionHeader kicker="" title={s.title} />
          <Text style={styles.body}>{s.body}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  hero: { paddingHorizontal: 20, paddingTop: 10, gap: 12, marginBottom: 8 },
  heroIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.lime,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: { color: Colors.text, fontSize: 26, fontWeight: "900", letterSpacing: -1 },
  heroBody: { color: Colors.textMid, fontSize: 14, fontWeight: "500", lineHeight: 21 },
  section: { paddingHorizontal: 18, marginTop: 18, gap: 8 },
  body: { color: Colors.textDim, fontSize: 13, fontWeight: "600", lineHeight: 20 },
});
