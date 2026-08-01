import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Lock, Send } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Avatar, PressableScale, haptic } from "@/components/ui";
import Colors, { Radius, microLabel } from "@/constants/colors";
import { formatMoney } from "@/constants/mock-data";
import { useDmThread, type DmMessageRow } from "@/hooks/useDMs";
import { useProfile } from "@/hooks/useProfile";

export default function ThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { account } = useProfile();
  const { messages, thread, isLoading, sendMessage, markRead } = useDmThread(id ?? null);

  const [draft, setDraft] = useState<string>("");
  const [sending, setSending] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const myId = account?.id ?? "";
  const scrollRef = useRef<ScrollView>(null);

  // The recipient is the other party on the thread row — works even for
  // brand-new threads with zero messages.
  const recipientId = thread
    ? (thread.creator_id === myId ? thread.fan_id : thread.creator_id)
    : "";

  // Clear my unread count when the thread opens.
  useEffect(() => {
    if (thread && myId) {
      void markRead(thread, myId);
    }
  }, [thread, myId, markRead]);

  const send = async (): Promise<void> => {
    const text = draft.trim();
    if (text.length === 0) return;
    if (!recipientId) {
      setError("Could not identify the recipient for this conversation.");
      return;
    }
    setSending(true);
    setError(null);
    const result = await sendMessage(recipientId, text);
    if (result.ok) {
      setDraft("");
      haptic("light");
    } else {
      setError(result.error ?? "Failed to send");
    }
    setSending(false);
  };

  const unlock = (message: DmMessageRow): void => {
    // Paid DM unlocks settle through the creator checkout flow. Until the
    // dedicated unlock product ships, route support to the creator's tip page
    // and be explicit about the price rather than leaving a dead button.
    haptic("light");
    Alert.alert(
      "Paid message",
      `This message unlocks for ${formatMoney(message.price)}. Paid message checkout is coming soon — you can support the creator with a tip in the meantime.`,
      [
        { text: "Not now", style: "cancel" },
        { text: "Send a tip", onPress: () => router.push(`/tip/${recipientId}`) },
      ],
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.screen, { alignItems: "center", justifyContent: "center" }]}>
        <Stack.Screen options={{ title: "Loading…" }} />
        <ActivityIndicator color={Colors.lime} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: "Direct message" }} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.length === 0 ? (
            <Text style={styles.empty}>No messages yet — say hi 👋</Text>
          ) : null}

          {messages.map((m) => {
            const fromMe = m.sender_id === myId;
            const locked = m.is_paid && !m.unlocked_by_recipient && !fromMe;
            if (locked) {
              return (
                <View key={m.id} style={styles.lockedBubble}>
                  <View style={styles.lockRow}>
                    <Lock size={13} color={Colors.cyan} />
                    <Text style={styles.lockLabel}>PAID MESSAGE</Text>
                  </View>
                  <Text style={styles.lockText}>{m.text ?? "Unlock to read"}</Text>
                  <PressableScale onPress={() => unlock(m)} scaleTo={0.96}>
                    <View style={styles.unlockBtn}>
                      <Text style={styles.unlockText}>Unlock for {formatMoney(m.price)}</Text>
                    </View>
                  </PressableScale>
                </View>
              );
            }
            return (
              <View key={m.id} style={[styles.bubble, fromMe ? styles.mine : styles.theirs]}>
                <Text style={[styles.bubbleText, fromMe && { color: Colors.ink }]}>{m.text ?? ""}</Text>
                <Text style={[styles.bubbleTime, fromMe && { color: "rgba(8,8,10,0.5)" }]}>
                  {m.created_at ? new Date(m.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : ""}
                </Text>
              </View>
            );
          })}

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>

        <View style={styles.inputRow}>
          <View style={styles.inputBox}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Send a message…"
              placeholderTextColor={Colors.textDim}
              style={styles.input}
              onSubmitEditing={send}
              returnKeyType="send"
              editable={!sending}
            />
            <PressableScale onPress={send} scaleTo={0.85}>
              <View style={styles.sendBtn}>
                {sending ? <ActivityIndicator size="small" color={Colors.ink} /> : <Send size={15} color={Colors.ink} />}
              </View>
            </PressableScale>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  empty: { color: Colors.textMid, fontSize: 14, fontWeight: "600", padding: 24, textAlign: "center" },
  bubble: { maxWidth: "82%", padding: 13, borderRadius: 18, gap: 5 },
  mine: { alignSelf: "flex-end", backgroundColor: Colors.lime, borderBottomRightRadius: 6 },
  theirs: {
    alignSelf: "flex-start",
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderBottomLeftRadius: 6,
  },
  bubbleText: { color: Colors.text, fontSize: 14, fontWeight: "600", lineHeight: 20 },
  bubbleTime: { color: Colors.textDim, fontSize: 10, fontWeight: "700" },
  lockedBubble: {
    alignSelf: "flex-start",
    maxWidth: "88%",
    padding: 14,
    borderRadius: 18,
    borderBottomLeftRadius: 6,
    backgroundColor: "rgba(53,231,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(53,231,255,0.25)",
    gap: 9,
  },
  lockRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  lockLabel: { ...microLabel, color: Colors.cyan },
  lockText: { color: Colors.text, fontSize: 14, fontWeight: "700", lineHeight: 20 },
  unlockBtn: {
    height: 40,
    borderRadius: Radius.pill,
    backgroundColor: Colors.cyan,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  unlockText: { color: Colors.ink, fontSize: 13.5, fontWeight: "900" },
  error: { color: Colors.danger, fontSize: 12.5, fontWeight: "700" },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    backgroundColor: Colors.bg,
  },
  inputBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 48,
    paddingLeft: 16,
    paddingRight: 7,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  input: { flex: 1, color: Colors.text, fontSize: 14.5, fontWeight: "600" },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.lime,
    alignItems: "center",
    justifyContent: "center",
  },
});
