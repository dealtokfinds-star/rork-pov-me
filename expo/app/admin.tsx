import { Image } from "expo-image";
import { AlertTriangle, BadgeCheck, Check, Eye, Flag, Pencil, Plus, Shield, Trash2, UserX, X } from "lucide-react-native";
import React, { useState } from "react";
import { Modal, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar, Chip, PressableScale, SectionHeader, StatTile, Tag, haptic } from "@/components/ui";
import Colors, { Radius, microLabel } from "@/constants/colors";
import { formatMoney } from "@/constants/mock-data";
import { useAdminCategories, useCategories, type CategoryInput } from "@/hooks/useDiscovery";
import { useProfile } from "@/hooks/useProfile";
import { useAdmin, type ReportRow, type AdminCreatorRow } from "@/hooks/useAdmin";

type Tab = "queue" | "creators" | "payments" | "categories";

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>("queue");
  const { reports, creators, revenue, isLoading: adminLoading, adminAction } = useAdmin();
  const { account } = useProfile();
  const [resolved, setResolved] = useState<string[]>([]);
  const [approved, setApproved] = useState<string[]>([]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
      <View style={[styles.hero, { paddingTop: insets.top + 8 }]}>
        <View style={styles.heroIcon}>
          <Shield size={20} color={Colors.ink} />
        </View>
        <Text style={styles.heroTitle}>Trust & safety</Text>
        <Text style={styles.heroBody}>
          Human review inside 24 hours. Every action is logged, appealable once, and visible to
          the creator with a reason.
        </Text>
      </View>

      <View style={styles.statRow}>
        <StatTile label="Open reports" value={`${reports.filter((r) => r.status === "open").length}`} sub="avg 4h to close" accent={Colors.magenta} />
        <StatTile label="Pending creators" value={`${creators.filter((c) => c.kyc_status === "pending" || c.kyc_status === "unverified").length}`} sub="KYC submitted" accent={Colors.cyan} />
      </View>
      <View style={styles.statRow}>
        <StatTile label="Auto-flags" value="128" sub="last 7 days" accent={Colors.gold} />
        <StatTile label="Held payouts" value={formatMoney(2140)} sub="2 accounts" accent={Colors.danger} />
      </View>

      <View style={styles.tabRow}>
        <Chip label="Review queue" active={tab === "queue"} onPress={() => setTab("queue")} />
        <Chip label="Applications" active={tab === "creators"} onPress={() => setTab("creators")} />
        <Chip label="Categories" active={tab === "categories"} onPress={() => setTab("categories")} />
        <Chip label="Payments" active={tab === "payments"} onPress={() => setTab("payments")} />
      </View>

      {tab === "queue" ? (
        <View style={{ paddingHorizontal: 18, gap: 10, marginTop: 18 }}>
          {adminLoading ? (
            <Text style={styles.cardMeta}>Loading reports…</Text>
          ) : reports.length === 0 ? (
            <Text style={styles.cardMeta}>No reports in the queue. 🎉</Text>
          ) : (
            reports.map((r: ReportRow) => {
              const done = resolved.includes(r.id) || r.status === "resolved";
              const severity = r.reason.toLowerCase().includes("minor") || r.reason.toLowerCase().includes("spam") ? "low" : r.reason.toLowerCase().includes("illegal") || r.reason.toLowerCase().includes("minor") ? "high" : "medium";
              return (
                <View key={r.id} style={[styles.card, done && { opacity: 0.55 }]}>
                  <View style={styles.cardHead}>
                    <View style={[styles.thumb, { backgroundColor: Colors.surfaceHi, alignItems: "center", justifyContent: "center" }]}>
                      <Flag size={22} color={Colors.textDim} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.rowGap6}>
                        <Tag
                          label={severity.toUpperCase()}
                          color={severity === "high" ? "#fff" : Colors.ink}
                          bg={severity === "high" ? Colors.danger : severity === "medium" ? Colors.gold : Colors.surfaceTop}
                        />
                        <View style={styles.rowGap4}>
                          <Flag size={11} color={Colors.textDim} />
                          <Text style={styles.reporters}>{r.target_type}</Text>
                        </View>
                      </View>
                      <Text style={styles.cardTitle} numberOfLines={2}>
                        {r.reason}
                      </Text>
                      <Text style={styles.cardMeta}>
                        {r.details ?? "No additional details"} · {r.status}
                      </Text>
                    </View>
                  </View>
                  {done ? (
                    <View style={styles.doneRow}>
                      <Check size={13} color={Colors.success} />
                      <Text style={styles.doneText}>Resolved — creator notified</Text>
                    </View>
                  ) : (
                    <View style={styles.actionRow}>
                      <ActionBtn
                        icon={<Eye size={14} color={Colors.text} />}
                        label="Resolve"
                        onPress={async () => {
                          await adminAction("resolve_report", { report_id: r.id, resolution: "resolved by admin" });
                          setResolved((p) => [...p, r.id]);
                          haptic("success");
                        }}
                      />
                      <ActionBtn
                        icon={<X size={14} color={Colors.danger} />}
                        label="Suspend"
                        tint={Colors.danger}
                        onPress={async () => {
                          if (r.target_user_id) {
                            await adminAction("suspend_user", { user_id: r.target_user_id, reason: r.reason });
                          }
                          await adminAction("resolve_report", { report_id: r.id, resolution: "user suspended" });
                          setResolved((p) => [...p, r.id]);
                          haptic("heavy");
                        }}
                      />
                      <ActionBtn
                        icon={<UserX size={14} color={Colors.gold} />}
                        label="Hold payout"
                        tint={Colors.gold}
                        onPress={async () => {
                          if (r.target_user_id) {
                            await adminAction("hold_payout", { user_id: r.target_user_id, reason: r.reason });
                          }
                          await adminAction("resolve_report", { report_id: r.id, resolution: "payout held" });
                          setResolved((p) => [...p, r.id]);
                          haptic("heavy");
                        }}
                      />
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>
      ) : null}

      {tab === "creators" ? (
        <View style={{ paddingHorizontal: 18, gap: 10, marginTop: 18 }}>
          {adminLoading ? (
            <Text style={styles.cardMeta}>Loading creators…</Text>
          ) : creators.length === 0 ? (
            <Text style={styles.cardMeta}>No creators yet.</Text>
          ) : (
            creators.map((c: AdminCreatorRow) => {
              const ok = approved.includes(c.id) || c.kyc_status === "verified";
              return (
                <View key={c.id} style={styles.card}>
                  <View style={styles.cardHead}>
                    <Avatar uri={c.avatar_url ?? ""} size={44} />
                    <View style={{ flex: 1, marginLeft: 11 }}>
                      <Text style={styles.cardTitle}>{c.name ?? c.handle ?? "Unknown"}</Text>
                      <Text style={styles.cardMeta}>
                        KYC: {c.kyc_status ?? "none"} · Payouts: {c.stripe_payouts_enabled ? "enabled" : "held"}
                      </Text>
                    </View>
                    {ok ? <BadgeCheck size={19} color={Colors.success} /> : null}
                  </View>
                  <View style={styles.checkList}>
                    <CheckItem label={`KYC: ${c.kyc_status ?? "not started"}`} />
                    <CheckItem label={`Payouts: ${c.stripe_payouts_enabled ? "enabled" : "not enabled"}`} />
                    <CheckItem label={`Lifetime earnings: ${formatMoney(Number(c.lifetime_earnings ?? 0))}`} />
                    <CheckItem label={`Payout balance: ${formatMoney(Number(c.payout_balance ?? 0))}`} />
                  </View>
                  {!ok ? (
                    <View style={styles.actionRow}>
                      <ActionBtn
                        icon={<Check size={14} color={Colors.lime} />}
                        label="Reinstate"
                        tint={Colors.lime}
                        onPress={async () => {
                          await adminAction("reinstate_user", { user_id: c.id });
                          setApproved((p) => [...p, c.id]);
                          haptic("success");
                        }}
                      />
                      <ActionBtn
                        icon={<X size={14} color={Colors.danger} />}
                        label="Suspend"
                        tint={Colors.danger}
                        onPress={async () => {
                          await adminAction("suspend_user", { user_id: c.id, reason: "Admin action" });
                          haptic("heavy");
                        }}
                      />
                    </View>
                  ) : (
                    <View style={styles.doneRow}>
                      <Check size={13} color={Colors.success} />
                      <Text style={styles.doneText}>Verified & active</Text>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>
      ) : null}

      {tab === "payments" ? (
        <View style={{ paddingHorizontal: 18, marginTop: 18, gap: 10 }}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Platform revenue (last 30 days)</Text>
            <Text style={styles.bigValue}>{formatMoney(revenue.reduce((sum, r) => sum + Number(r.platform_cut), 0))}</Text>
            <Text style={styles.cardMeta}>
              20% of {formatMoney(revenue.reduce((sum, r) => sum + Number(r.gross), 0))} gross
            </Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Revenue breakdown</Text>
            {revenue.length === 0 ? (
              <Text style={styles.cardMeta}>No transactions yet.</Text>
            ) : (
              revenue.slice(0, 10).map((r) => (
                <View key={`${r.day}-${r.kind}`} style={styles.rowGap6}>
                  <Text style={styles.checkText}>{r.kind}: {formatMoney(Number(r.gross))} (platform: {formatMoney(Number(r.platform_cut))})</Text>
                </View>
              ))
            )}
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Global limits</Text>
            <Text style={styles.cardMeta}>
              Subscription range $4.99–$49.99 · PPV cap $99.99 · platform fee 20% · payouts weekly
            </Text>
          </View>
        </View>
      ) : null}

      {tab === "categories" ? <CategoryManager /> : null}
    </ScrollView>
  );
}

// ─── Category management ───────────────────────────────────────────────────

const EMPTY_CATEGORY: CategoryInput = {
  id: "",
  label: "",
  tagline: "",
  emoji: "",
  accent: "#ccff00",
  sort_order: 99,
  is_active: true,
};

function CategoryManager() {
  const { data: categories, isLoading } = useCategories();
  const admin = useAdminCategories();
  const [editing, setEditing] = useState<CategoryInput | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const startNew = () => setEditing({ ...EMPTY_CATEGORY, sort_order: (categories?.length ?? 0) + 1 });
  const startEdit = (c: NonNullable<typeof categories>[number]) =>
    setEditing({
      id: c.id,
      label: c.label,
      tagline: c.tagline,
      emoji: c.emoji,
      accent: c.accent,
      sort_order: (categories?.findIndex((row) => row.id === c.id) ?? 0) + 1,
      is_active: true,
    });

  const save = async () => {
    if (!editing) return;
    if (!editing.id.trim() || !editing.label.trim()) return;
    await admin.upsertCategory(editing);
    haptic("success");
    setEditing(null);
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    await admin.deleteCategory(confirmDelete);
    haptic("heavy");
    setConfirmDelete(null);
  };

  return (
    <View style={{ paddingHorizontal: 18, marginTop: 18, gap: 12 }}>
      <View style={styles.catHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>POV categories</Text>
          <Text style={styles.cardMeta}>
            Admin-curated lifestyle verticals shown across discovery & upload.
          </Text>
        </View>
        <PressableScale onPress={startNew} scaleTo={0.9} hapticStyle="medium">
          <View style={styles.addBtn}>
            <Plus size={16} color={Colors.ink} />
            <Text style={styles.addLabel}>New</Text>
          </View>
        </PressableScale>
      </View>

      {isLoading ? (
        <Text style={styles.cardMeta}>Loading categories…</Text>
      ) : (categories ?? []).length === 0 ? (
        <Text style={styles.cardMeta}>No categories yet. Create your first POV vertical.</Text>
      ) : (
        (categories ?? []).map((c, i) => (
          <View key={c.id} style={[styles.card, { borderColor: `${c.accent}33` }]}>
            <View style={styles.catRow}>
              <View style={[styles.catEmojiBox, { backgroundColor: `${c.accent}1a` }]}>
                <Text style={styles.catEmoji}>{c.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.rowGap6}>
                  <Text style={styles.cardTitle}>{c.label} POV</Text>
                  <Text style={styles.catId}>· {c.id}</Text>
                </View>
                <Text style={styles.cardMeta}>{c.tagline}</Text>
                <Text style={styles.catAccent}>
                  <View style={[styles.catDot, { backgroundColor: c.accent }]} />
                  {c.accent}
                </Text>
              </View>
              <View style={styles.catActions}>
                <PressableScale onPress={() => startEdit(c)} scaleTo={0.88}>
                  <View style={styles.iconBtn}>
                    <Pencil size={14} color={Colors.textMid} />
                  </View>
                </PressableScale>
                <PressableScale onPress={() => setConfirmDelete(c.id)} scaleTo={0.88} hapticStyle="heavy">
                  <View style={[styles.iconBtn, { borderColor: "rgba(255,85,85,0.25)" }]}>
                    <Trash2 size={14} color={Colors.danger} />
                  </View>
                </PressableScale>
              </View>
            </View>
          </View>
        ))
      )}

      {/* Edit / create modal */}
      <Modal visible={editing !== null} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        <View style={styles.modalWrap}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>
                {editing && categories?.some((c) => c.id === editing.id) ? "Edit category" : "New category"}
              </Text>
              <PressableScale onPress={() => setEditing(null)} scaleTo={0.88}>
                <View style={styles.modalClose}>
                  <X size={16} color={Colors.textMid} />
                </View>
              </PressableScale>
            </View>

            {editing ? (
              <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
                <Field label="ID (slug)" value={editing.id} onChange={(v) => setEditing({ ...editing, id: v.toLowerCase().replace(/[^a-z0-9]/g, "") })} placeholder="e.g. trader" locked={!!categories?.some((c) => c.id === editing.id)} />
                <Field label="Label" value={editing.label} onChange={(v) => setEditing({ ...editing, label: v })} placeholder="e.g. Trader" />
                <Field label="Tagline" value={editing.tagline} onChange={(v) => setEditing({ ...editing, tagline: v })} placeholder="e.g. Charts, scalps, PnL" />
                <Field label="Emoji" value={editing.emoji} onChange={(v) => setEditing({ ...editing, emoji: v })} placeholder="📈" />
                <Field label="Accent color" value={editing.accent} onChange={(v) => setEditing({ ...editing, accent: v })} placeholder="#ccff00" />
                <Field label="Sort order" value={String(editing.sort_order)} onChange={(v) => setEditing({ ...editing, sort_order: Number(v) || 0 })} placeholder="1" keyboardType="numeric" />

                <View style={styles.toggleRow}>
                  <Text style={styles.toggleLabel}>Active (visible to fans)</Text>
                  <Switch
                    value={editing.is_active}
                    onValueChange={(v) => setEditing({ ...editing, is_active: v })}
                    trackColor={{ false: Colors.surfaceHi, true: Colors.lime }}
                    thumbColor={editing.is_active ? Colors.ink : Colors.textDim}
                  />
                </View>

                <View style={styles.previewBox}>
                  <Text style={styles.previewKicker}>Preview</Text>
                  <View style={[styles.previewCard, { borderColor: `${editing.accent}33` }]}>
                    <Text style={styles.catEmoji}>{editing.emoji || "👁️"}</Text>
                    <Text style={styles.cardTitle}>{editing.label || "Untitled"} POV</Text>
                    <Text style={styles.cardMeta}>{editing.tagline || "Add a tagline"}</Text>
                  </View>
                </View>

                <View style={styles.modalActions}>
                  <PressableScale onPress={() => setEditing(null)} scaleTo={0.96} style={{ flex: 1 }}>
                    <View style={styles.cancelBtn}>
                      <Text style={styles.cancelText}>Cancel</Text>
                    </View>
                  </PressableScale>
                  <PressableScale
                    onPress={save}
                    scaleTo={0.96}
                    hapticStyle="success"
                    disabled={!editing.id.trim() || !editing.label.trim() || admin.isUpserting}
                    style={{ flex: 1 }}
                  >
                    <View style={styles.saveBtn}>
                      <Check size={14} color={Colors.ink} />
                      <Text style={styles.saveText}>{admin.isUpserting ? "Saving…" : "Save category"}</Text>
                    </View>
                  </PressableScale>
                </View>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* Delete confirm */}
      <Modal visible={confirmDelete !== null} transparent animationType="fade" onRequestClose={() => setConfirmDelete(null)}>
        <View style={styles.modalWrap}>
          <View style={styles.confirmSheet}>
            <View style={styles.confirmIcon}>
              <Trash2 size={20} color={Colors.danger} />
            </View>
            <Text style={styles.confirmTitle}>Delete this category?</Text>
            <Text style={styles.confirmBody}>
              Creators already tagged with this lifestyle keep their tag, but it will no longer appear
              as a filter or in discovery rails. This cannot be undone.
            </Text>
            <View style={styles.modalActions}>
              <PressableScale onPress={() => setConfirmDelete(null)} scaleTo={0.96} style={{ flex: 1 }}>
                <View style={styles.cancelBtn}>
                  <Text style={styles.cancelText}>Keep it</Text>
                </View>
              </PressableScale>
              <PressableScale onPress={doDelete} scaleTo={0.96} hapticStyle="heavy" style={{ flex: 1 }}>
                <View style={styles.deleteBtn}>
                  <Trash2 size={14} color="#fff" />
                  <Text style={styles.deleteText}>{admin.isDeleting ? "Deleting…" : "Delete"}</Text>
                </View>
              </PressableScale>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  locked,
  keyboardType = "default",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  locked?: boolean;
  keyboardType?: "default" | "numeric";
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={Colors.textDim}
        editable={!locked}
        keyboardType={keyboardType}
        style={[styles.fieldInput, locked && styles.fieldLocked]}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );
}

function ActionBtn({
  icon,
  label,
  onPress,
  tint = Colors.text,
}: {
  icon: React.ReactNode;
  label: string;
  onPress?: () => void;
  tint?: string;
}) {
  return (
    <PressableScale onPress={onPress} scaleTo={0.94} style={{ flex: 1 }}>
      <View style={styles.actionBtn}>
        {icon}
        <Text style={[styles.actionLabel, { color: tint }]}>{label}</Text>
      </View>
    </PressableScale>
  );
}

function CheckItem({ label }: { label: string }) {
  return (
    <View style={styles.rowGap6}>
      <Check size={12} color={Colors.success} />
      <Text style={styles.checkText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  hero: { paddingHorizontal: 18, paddingTop: 8, gap: 10, marginBottom: 18 },
  heroIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.cyan,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: { color: Colors.text, fontSize: 24, fontWeight: "900", letterSpacing: -0.9 },
  heroBody: { color: Colors.textMid, fontSize: 13.5, fontWeight: "500", lineHeight: 20 },
  statRow: { flexDirection: "row", gap: 10, paddingHorizontal: 18, marginBottom: 10 },
  tabRow: { flexDirection: "row", gap: 8, paddingHorizontal: 18, marginTop: 14 },
  card: {
    padding: 14,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  cardHead: { flexDirection: "row", gap: 12, alignItems: "center" },
  thumb: { width: 62, height: 62, borderRadius: 10, backgroundColor: Colors.surfaceHi },
  cardTitle: { color: Colors.text, fontSize: 14, fontWeight: "800", lineHeight: 18 },
  cardMeta: { color: Colors.textDim, fontSize: 11.5, fontWeight: "600", marginTop: 4, lineHeight: 17 },
  bigValue: { color: Colors.text, fontSize: 30, fontWeight: "900", letterSpacing: -1.2 },
  reporters: { color: Colors.textDim, fontSize: 10.5, fontWeight: "800" },
  rowGap4: { flexDirection: "row", alignItems: "center", gap: 4 },
  rowGap6: { flexDirection: "row", alignItems: "center", gap: 7 },
  actionRow: { flexDirection: "row", gap: 8 },
  actionBtn: {
    height: 40,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surfaceHi,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  actionLabel: { fontSize: 12.5, fontWeight: "800" },
  doneRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  doneText: { color: Colors.success, fontSize: 12, fontWeight: "800" },
  checkList: { gap: 7 },
  checkText: { color: Colors.textMid, fontSize: 12, fontWeight: "600" },
  microRef: { ...microLabel },

  // Category manager
  catHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    height: 38,
    borderRadius: Radius.pill,
    backgroundColor: Colors.lime,
  },
  addLabel: { color: Colors.ink, fontSize: 12.5, fontWeight: "900" },
  catRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  catEmojiBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  catEmoji: { fontSize: 20 },
  catId: { color: Colors.textDim, fontSize: 11, fontWeight: "700" },
  catAccent: { color: Colors.textMid, fontSize: 11, fontWeight: "700", marginTop: 5, flexDirection: "row", alignItems: "center", gap: 6 },
  catDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  catActions: { flexDirection: "row", gap: 8 },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.surfaceHi,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },

  // Modal
  modalWrap: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
    maxHeight: "88%",
  },
  modalHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle: { color: Colors.text, fontSize: 18, fontWeight: "900", letterSpacing: -0.5 },
  modalClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surfaceHi,
    alignItems: "center",
    justifyContent: "center",
  },
  field: { marginBottom: 12 },
  fieldLabel: { color: Colors.textMid, fontSize: 11, fontWeight: "800", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.6 },
  fieldInput: {
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    color: Colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  fieldLocked: { opacity: 0.5 },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    marginBottom: 8,
  },
  toggleLabel: { color: Colors.text, fontSize: 13.5, fontWeight: "700" },
  previewBox: {
    marginTop: 8,
    marginBottom: 16,
    gap: 8,
  },
  previewKicker: { color: Colors.textDim, fontSize: 10.5, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6 },
  previewCard: {
    padding: 14,
    borderRadius: Radius.md,
    backgroundColor: Colors.bg,
    borderWidth: 1,
    gap: 6,
  },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 8 },
  cancelBtn: {
    height: 46,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surfaceHi,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: { color: Colors.textMid, fontSize: 14, fontWeight: "800" },
  saveBtn: {
    height: 46,
    borderRadius: Radius.pill,
    backgroundColor: Colors.lime,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  saveText: { color: Colors.ink, fontSize: 14, fontWeight: "900" },

  // Confirm sheet
  confirmSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 36,
    alignItems: "center",
    gap: 12,
  },
  confirmIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(255,85,85,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmTitle: { color: Colors.text, fontSize: 17, fontWeight: "900" },
  confirmBody: { color: Colors.textMid, fontSize: 13, fontWeight: "500", textAlign: "center", lineHeight: 19 },
  deleteBtn: {
    height: 46,
    borderRadius: Radius.pill,
    backgroundColor: Colors.danger,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  deleteText: { color: "#fff", fontSize: 14, fontWeight: "900" },
});
