import { useRouter } from "expo-router";
import { Check } from "lucide-react-native";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui";
import Colors from "@/constants/colors";
import { useApp } from "@/providers/app-provider";

/**
 * Payment success deep-link landing.
 * Stripe redirects here after a successful checkout. The webhook has
 * already processed the payment server-side; we just refresh the wallet
 * and show a success state.
 */
export default function PaymentSuccessScreen() {
  const router = useRouter();
  const { refreshWallet } = useApp() as { refreshWallet?: () => void };

  useEffect(() => {
    // Refresh wallet balance from Supabase after a successful payment
    refreshWallet?.();
  }, [refreshWallet]);

  return (
    <View style={styles.screen}>
      <View style={styles.icon}>
        <Check size={32} color={Colors.ink} />
      </View>
      <Text style={styles.title}>Payment complete</Text>
      <Text style={styles.body}>
        Your payment was processed securely. Your wallet and activity have been updated.
      </Text>
      <Button label="Done" onPress={() => router.replace("/(tabs)")} style={{ marginTop: 28 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg, alignItems: "center", justifyContent: "center", padding: 30 },
  icon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.lime,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: Colors.text, fontSize: 26, fontWeight: "900", letterSpacing: -1, marginTop: 20 },
  body: {
    color: Colors.textMid,
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 21,
    textAlign: "center",
    marginTop: 12,
  },
});
