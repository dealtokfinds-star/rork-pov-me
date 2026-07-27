import { FileCheck } from "lucide-react-native";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { SectionHeader } from "@/components/ui";
import Colors from "@/constants/colors";

const SECTIONS = [
  {
    title: "18 U.S.C. § 2257 compliance",
    body: "All creators publishing content on POVMe are required to verify that all individuals appearing in their content are 18 years of age or older. POVMe maintains records of creator identity verification (via Stripe Identity) including government ID, date of birth, and liveness check results.",
  },
  {
    title: "Record-keeping requirements",
    body: "Creators are responsible for maintaining their own 2257 records for all content they publish, including: the legal name and date of birth of every individual appearing in the content, a copy of a government-issued ID for each individual, and the date of production. POVMe may request these records during a content review.",
  },
  {
    title: "Creator certification",
    body: "By publishing content on POVMe, the creator certifies that: all individuals depicted are 18 or older, they have obtained written consent from all individuals appearing, they maintain the required 2257 records, and the content was produced lawfully. False certification results in immediate account termination and withheld payouts.",
  },
  {
    title: "Verification process",
    body: "POVMe uses Stripe Identity for government ID verification and selfie liveness checks. Creators must complete verification before publishing any content or receiving payouts. Repeat individuals on camera may be subject to additional verification. Verification status is displayed on the creator's profile.",
  },
  {
    title: "Content review",
    body: "POVMe reviews flagged content within 24 hours. If a creator's 2257 records are requested and not provided within 7 days, the content is removed and payouts are held pending review. Appeals may be submitted once.",
  },
  {
    title: "Custodian of records",
    body: "POVMe Custodian of Records, 548 Market St, San Francisco, CA 94104. Records are available for inspection by the Attorney General or their designee pursuant to 18 U.S.C. § 2257 and 28 C.F.R. § 75.",
  },
];

export default function Compliance2257Screen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <FileCheck size={22} color={Colors.ink} />
        </View>
        <Text style={styles.heroTitle}>2257 Compliance</Text>
        <Text style={styles.heroBody}>
          Record-keeping and age verification requirements under 18 U.S.C. § 2257.
        </Text>
      </View>

      {SECTIONS.map((s) => (
        <View key={s.title} style={styles.section}>
          <SectionHeader kicker="" title={s.title} />
          <Text style={styles.body}>{s.body}</Text>
        </View>
      ))}

      <Text style={styles.legal}>
        Questions about 2257 compliance: compliance@povme.app
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
