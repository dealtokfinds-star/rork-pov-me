import { useRouter } from "expo-router";
import { X } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui";
import Colors from "@/constants/colors";

/**
 * Payment cancel deep-link landing.
 * Stripe redirects here if the user closes the checkout without paying.
 */
export default function PaymentCancelScreen() {
  const router = useRouter();
  return (
    <View style={styles.screen}>
      <View style={styles.icon}>
        <X size={30} color={Colors.text} />
      </View>
      <Text style={styles.title}>Payment cancelled</Text>
      <Text style={styles.body}>
        No charge was made. You can try again any time.
      </Text>
      <Button label="Back" variant="ghost" onPress={() => router.back()} style={{ marginTop: 28 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg, alignItems: "center", justifyContent: "center", padding: 30 },
  icon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: Colors.text, fontSize: 24, fontWeight: "900", letterSpacing: -1, marginTop: 20 },
  body: {
    color: Colors.textMid,
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 21,
    textAlign: "center",
    marginTop: 12,
  },
});
