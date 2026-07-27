import { FileText } from "lucide-react-native";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { SectionHeader } from "@/components/ui";
import Colors, { Radius } from "@/constants/colors";

const SECTIONS = [
  {
    title: "1. Acceptance of terms",
    body: "By creating a POVMe account, you agree to these Terms of Use and our Content Guidelines. If you don't agree, don't use the platform. POVMe is operated as a service for creators to share first-person lifestyle content with their subscribers.",
  },
  {
    title: "2. Eligibility & age",
    body: "You must be at least 18 years old to use POVMe. Creators must complete government ID and liveness verification (Stripe Identity) before publishing content or receiving payouts. All individuals appearing in content must be 18 or older and must have documented consent on file.",
  },
  {
    title: "3. Accounts",
    body: "You are responsible for keeping your account credentials secure and for all activity under your account. One person, one account. Impersonation, shared accounts, and bot accounts are prohibited.",
  },
  {
    title: "4. Content & ownership",
    body: "Creators retain ownership of their content. By publishing on POVMe, you grant POVMe a license to host, display, transcode, and deliver your content to subscribers, and to use excerpts for promotional purposes. You may remove your content at any time.",
  },
  {
    title: "5. Content rules",
    body: "All content must comply with our Content Guidelines. Prohibited content includes: anyone under 18, non-consensual filming, real violence, illegal acts, financial fraud, and impersonation. Violations result in content removal, account suspension, and withheld payouts.",
  },
  {
    title: "6. Payments & fees",
    body: "POVMe charges a 20% platform fee on all transactions. Creators receive 80% of all subscription, PPV, and tip revenue. Payouts are processed weekly via Stripe Connect to the creator's linked bank account. PPV unlocks are non-refundable once the content has been viewed. Subscription renewals can be canceled at any time and remain active until the end of the billing period.",
  },
  {
    title: "7. Subscriptions",
    body: "Subscriptions auto-renew monthly until canceled. You can cancel from your subscriptions page at any time. Refunds for partial billing periods are not provided, but you retain access until your current period ends.",
  },
  {
    title: "8. Prohibited conduct",
    body: "You may not: harass or threaten other users, upload content you don't own, attempt to circumvent payment systems, scrape or redistribute content, use POVMe to sell illegal goods or services, or interfere with the platform's operation.",
  },
  {
    title: "9. Termination",
    body: "POVMe may suspend or terminate accounts that violate these terms. Creators may delete their account and data at any time from Settings (GDPR right to erasure). Financial records are retained for tax compliance as required by law.",
  },
  {
    title: "10. Disclaimers & liability",
    body: "POVMe is provided 'as is.' We are not liable for content posted by creators, financial losses from trading/betting content, or service interruptions. Creators are solely responsible for their content and its accuracy. Educational financial content must include risk disclaimers.",
  },
  {
    title: "11. Changes to terms",
    body: "We may update these terms with 30 days' notice. Continued use after changes constitutes acceptance. Material changes will be communicated via email and in-app notification.",
  },
  {
    title: "12. Contact",
    body: "Questions about these terms? Email legal@povme.app. DMCA takedown requests: dmca@povme.app. Press: press@povme.app.",
  },
];

export default function TermsScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <FileText size={22} color={Colors.ink} />
        </View>
        <Text style={styles.heroTitle}>Terms of Use</Text>
        <Text style={styles.heroBody}>
          Last updated July 2026. These terms govern your use of POVMe.
        </Text>
      </View>

      {SECTIONS.map((s) => (
        <View key={s.title} style={styles.section}>
          <SectionHeader kicker="" title={s.title} />
          <Text style={styles.body}>{s.body}</Text>
        </View>
      ))}

      <Text style={styles.legal}>
        POVMe · 20% platform fee · Creators keep 80% · Stripe-powered payments · Stripe Identity KYC
      </Text>
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
  legal: {
    color: Colors.textDim,
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 17,
    paddingHorizontal: 20,
    marginTop: 20,
    textAlign: "center",
  },
});
