/**
 * edit-profile.tsx
 * ----------------
 * Profile editor:
 *  - Banner + avatar with REAL upload progress (XHR → Supabase Storage)
 *  - Remove avatar/banner behind a confirmation dialog (prevents accidents)
 *  - Display name, bio, location
 *  - External social links (X/Twitter, Instagram, TikTok, YouTube, website)
 *    persisted to profiles.social_links and shown on the public creator page
 */

import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import {
  AtSign,
  Camera,
  Check,
  Globe,
  ImageIcon,
  Instagram,
  Music2,
  Trash2,
  Youtube,
} from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Avatar, Button, PressableScale, ProgressBar, haptic } from "@/components/ui";
import Colors, { Radius, microLabel } from "@/constants/colors";
import { useProfile } from "@/hooks/useProfile";
import { uploadProfileImage, type ImageBucket } from "@/lib/storageUpload";
import type { SocialLinks } from "@/types";

type UploadTarget = "avatar" | "banner";

interface UploadState {
  target: UploadTarget;
  progress: number;
}

/** Cross-platform confirm — RN Alert buttons don't render on web. */
function confirmDestructive(title: string, message: string, confirmLabel: string, onConfirm: () => void): void {
  if (Platform.OS === "web") {
    // eslint-disable-next-line no-alert
    const ok = typeof window !== "undefined" && window.confirm(`${title}\n\n${message}`);
    if (ok) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: "Cancel", style: "cancel" },
    { text: confirmLabel, style: "destructive", onPress: onConfirm },
  ]);
}

export default function EditProfileScreen() {
  const router = useRouter();
  const { account, updateProfile, isUpdating } = useProfile();

  const [name, setName] = useState<string>("");
  const [bio, setBio] = useState<string>("");
  const [location, setLocation] = useState<string>("");
  const [twitter, setTwitter] = useState<string>("");
  const [instagram, setInstagram] = useState<string>("");
  const [tiktok, setTiktok] = useState<string>("");
  const [youtube, setYoutube] = useState<string>("");
  const [website, setWebsite] = useState<string>("");

  const [upload, setUpload] = useState<UploadState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState<boolean>(false);
  const hydrated = useRef<boolean>(false);

  // Hydrate the form once from the server row.
  useEffect(() => {
    if (!account || hydrated.current) return;
    hydrated.current = true;
    setName(account.name ?? "");
    setBio(account.bio ?? "");
    setLocation(account.location ?? "");
    const links = account.socialLinks ?? {};
    setTwitter(links.twitter ?? "");
    setInstagram(links.instagram ?? "");
    setTiktok(links.tiktok ?? "");
    setYoutube(links.youtube ?? "");
    setWebsite(links.website ?? "");
  }, [account]);

  /** Pick an image, push it to Storage with live % , persist the URL. */
  const pickAndUpload = useCallback(
    async (target: UploadTarget): Promise<void> => {
      if (!account) return;
      setError(null);
      try {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          quality: 0.85,
          allowsEditing: true,
          aspect: target === "avatar" ? [1, 1] : [16, 9],
        });
        if (result.canceled || !result.assets[0]?.uri) return;
        const asset = result.assets[0];

        setUpload({ target, progress: 0 });
        haptic("medium");

        const bucket: ImageBucket = target === "avatar" ? "avatars" : "covers";
        const { publicUrl } = await uploadProfileImage({
          uri: asset.uri,
          bucket,
          userId: account.id,
          mimeType: asset.mimeType ?? undefined,
          onProgress: (fraction) => setUpload({ target, progress: fraction }),
        });

        // Persist immediately so the new image survives even without "Save".
        await updateProfile(target === "avatar" ? { avatarUrl: publicUrl } : { coverUrl: publicUrl });
        haptic("success");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Upload failed.";
        setError(msg);
        haptic("heavy");
      } finally {
        setUpload(null);
      }
    },
    [account, updateProfile],
  );

  /** Confirmation-gated removal of the avatar or banner. */
  const removeImage = useCallback(
    (target: UploadTarget): void => {
      confirmDestructive(
        target === "avatar" ? "Remove profile photo?" : "Remove banner image?",
        target === "avatar"
          ? "Your profile will show the default placeholder until you upload a new photo."
          : "Your profile header will fall back to the default look until you upload a new banner.",
        "Remove",
        () => {
          void (async () => {
            setError(null);
            try {
              await updateProfile(target === "avatar" ? { avatarUrl: null } : { coverUrl: null });
              haptic("success");
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not remove the image.");
            }
          })();
        },
      );
    },
    [updateProfile],
  );

  const save = useCallback(async (): Promise<void> => {
    setError(null);
    const clean = (v: string): string | undefined => {
      const t = v.trim().replace(/^@/, "");
      return t.length > 0 ? t : undefined;
    };
    const site = website.trim();
    const links: SocialLinks = {
      twitter: clean(twitter),
      instagram: clean(instagram),
      tiktok: clean(tiktok),
      youtube: clean(youtube),
      website: site.length > 0 ? (site.startsWith("http") ? site : `https://${site}`) : undefined,
    };
    try {
      await updateProfile({
        name: name.trim().length > 0 ? name.trim() : null,
        bio: bio.trim().length > 0 ? bio.trim() : null,
        location: location.trim().length > 0 ? location.trim() : null,
        socialLinks: links,
      });
      haptic("success");
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your profile.");
      haptic("heavy");
    }
  }, [name, bio, location, twitter, instagram, tiktok, youtube, website, updateProfile]);

  if (!account) {
    return (
      <View style={[styles.screen, { alignItems: "center", justifyContent: "center" }]}>
        <Text style={styles.loadingText}>Loading your profile…</Text>
      </View>
    );
  }

  const avatarUploading = upload?.target === "avatar";
  const bannerUploading = upload?.target === "banner";

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
      keyboardShouldPersistTaps="handled"
    >
      {/* ---- Banner ---- */}
      <Text style={styles.label}>Banner</Text>
      <View style={styles.bannerWrap}>
        {account.coverUrl ? (
          <Image source={{ uri: account.coverUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <View style={styles.bannerEmpty}>
            <ImageIcon size={22} color={Colors.textDim} />
            <Text style={styles.bannerEmptyText}>No banner yet — 16:9 works best</Text>
          </View>
        )}
        {bannerUploading ? (
          <View style={styles.uploadScrim}>
            <Text style={styles.uploadPct}>{Math.round((upload?.progress ?? 0) * 100)}%</Text>
            <View style={{ width: "70%" }}>
              <ProgressBar progress={upload?.progress ?? 0} color={Colors.cyan} />
            </View>
            <Text style={styles.uploadHint}>Uploading banner…</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.imageActions}>
        <PressableScale onPress={() => void pickAndUpload("banner")} scaleTo={0.96} disabled={!!upload}>
          <View style={styles.actionBtn}>
            <ImageIcon size={14} color={Colors.ink} />
            <Text style={styles.actionText}>{account.coverUrl ? "Change banner" : "Upload banner"}</Text>
          </View>
        </PressableScale>
        {account.coverUrl ? (
          <PressableScale onPress={() => removeImage("banner")} scaleTo={0.96} disabled={!!upload}>
            <View style={styles.removeBtn}>
              <Trash2 size={14} color={Colors.danger} />
              <Text style={styles.removeText}>Remove</Text>
            </View>
          </PressableScale>
        ) : null}
      </View>

      {/* ---- Avatar ---- */}
      <Text style={styles.label}>Profile photo</Text>
      <View style={styles.avatarRow}>
        <View>
          <Avatar uri={account.avatarUrl ?? ""} size={84} ring />
          {avatarUploading ? (
            <View style={styles.avatarScrim}>
              <Text style={styles.avatarPct}>{Math.round((upload?.progress ?? 0) * 100)}%</Text>
            </View>
          ) : null}
        </View>
        <View style={{ flex: 1, gap: 9 }}>
          {avatarUploading ? (
            <ProgressBar progress={upload?.progress ?? 0} />
          ) : (
            <Text style={styles.avatarHint}>Square photo, at least 400×400. Fans see it everywhere.</Text>
          )}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <PressableScale onPress={() => void pickAndUpload("avatar")} scaleTo={0.96} disabled={!!upload}>
              <View style={styles.actionBtn}>
                <Camera size={14} color={Colors.ink} />
                <Text style={styles.actionText}>{account.avatarUrl ? "Change" : "Upload"}</Text>
              </View>
            </PressableScale>
            {account.avatarUrl ? (
              <PressableScale onPress={() => removeImage("avatar")} scaleTo={0.96} disabled={!!upload}>
                <View style={styles.removeBtn}>
                  <Trash2 size={14} color={Colors.danger} />
                  <Text style={styles.removeText}>Remove</Text>
                </View>
              </PressableScale>
            ) : null}
          </View>
        </View>
      </View>

      {/* ---- Identity ---- */}
      <Text style={styles.label}>Display name</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Your name"
        placeholderTextColor={Colors.textDim}
        style={styles.input}
        maxLength={50}
      />

      <Text style={styles.label}>Bio</Text>
      <TextInput
        value={bio}
        onChangeText={setBio}
        placeholder="What life do fans step into when they watch you?"
        placeholderTextColor={Colors.textDim}
        style={[styles.input, styles.multiline]}
        multiline
        maxLength={220}
      />

      <Text style={styles.label}>Location</Text>
      <TextInput
        value={location}
        onChangeText={setLocation}
        placeholder="Miami, FL"
        placeholderTextColor={Colors.textDim}
        style={styles.input}
        maxLength={60}
      />

      {/* ---- Social links ---- */}
      <Text style={styles.sectionTitle}>Social links</Text>
      <Text style={styles.sectionSub}>
        Shown on your public profile so fans can find you everywhere.
      </Text>

      <SocialField
        icon={<AtSign size={16} color={Colors.cyan} />}
        label="X / Twitter"
        value={twitter}
        onChange={setTwitter}
        placeholder="yourhandle"
      />
      <SocialField
        icon={<Instagram size={16} color={Colors.magenta} />}
        label="Instagram"
        value={instagram}
        onChange={setInstagram}
        placeholder="yourhandle"
      />
      <SocialField
        icon={<Music2 size={16} color={Colors.text} />}
        label="TikTok"
        value={tiktok}
        onChange={setTiktok}
        placeholder="yourhandle"
      />
      <SocialField
        icon={<Youtube size={16} color={Colors.danger} />}
        label="YouTube"
        value={youtube}
        onChange={setYoutube}
        placeholder="channel handle"
      />
      <SocialField
        icon={<Globe size={16} color={Colors.lime} />}
        label="Website"
        value={website}
        onChange={setWebsite}
        placeholder="yoursite.com"
        autoCapitalize="none"
      />

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <Button
        label={isUpdating ? "Saving…" : savedFlash ? "Saved" : "Save changes"}
        icon={savedFlash ? <Check size={16} color={Colors.ink} /> : undefined}
        disabled={isUpdating || !!upload}
        onPress={() => void save()}
        style={{ marginTop: 26 }}
      />
      <Button label="Done" variant="ghost" onPress={() => router.back()} style={{ marginTop: 10 }} />
    </ScrollView>
  );
}

function SocialField({
  icon,
  label,
  value,
  onChange,
  placeholder,
  autoCapitalize = "none",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoCapitalize?: "none" | "sentences";
}) {
  return (
    <View style={styles.socialRow}>
      <View style={styles.socialIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.socialLabel}>{label}</Text>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={Colors.textDim}
          style={styles.socialInput}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          maxLength={120}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  loadingText: { color: Colors.textMid, fontSize: 14, fontWeight: "700" },
  label: { ...microLabel, color: Colors.textDim, marginTop: 22, marginBottom: 9 },
  bannerWrap: {
    height: 150,
    borderRadius: Radius.md,
    overflow: "hidden",
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bannerEmpty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  bannerEmptyText: { color: Colors.textDim, fontSize: 11.5, fontWeight: "600" },
  uploadScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(8,8,10,0.72)",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  uploadPct: { color: Colors.text, fontSize: 22, fontWeight: "900", letterSpacing: -0.6 },
  uploadHint: { color: Colors.textDim, fontSize: 11, fontWeight: "700" },
  imageActions: { flexDirection: "row", gap: 8, marginTop: 10 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.lime,
    paddingHorizontal: 14,
    height: 38,
    borderRadius: Radius.pill,
  },
  actionText: { color: Colors.ink, fontSize: 12.5, fontWeight: "900" },
  removeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    height: 38,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: "rgba(255,77,77,0.35)",
    backgroundColor: "rgba(255,77,77,0.08)",
  },
  removeText: { color: Colors.danger, fontSize: 12.5, fontWeight: "800" },
  avatarRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  avatarScrim: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 48,
    backgroundColor: "rgba(8,8,10,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarPct: { color: Colors.text, fontSize: 15, fontWeight: "900" },
  avatarHint: { color: Colors.textDim, fontSize: 11.5, fontWeight: "600", lineHeight: 16 },
  input: {
    minHeight: 52,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    color: Colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  multiline: { height: 96, paddingTop: 14, textAlignVertical: "top" },
  sectionTitle: {
    color: Colors.text,
    fontSize: 19,
    fontWeight: "900",
    letterSpacing: -0.5,
    marginTop: 32,
  },
  sectionSub: { color: Colors.textDim, fontSize: 12, fontWeight: "600", marginTop: 5, marginBottom: 6 },
  socialRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 10,
  },
  socialIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.surfaceHi,
    alignItems: "center",
    justifyContent: "center",
  },
  socialLabel: { ...microLabel, color: Colors.textDim, fontSize: 9 },
  socialInput: { color: Colors.text, fontSize: 14.5, fontWeight: "700", paddingVertical: 4, padding: 0 },
  errorBanner: {
    marginTop: 18,
    padding: 14,
    borderRadius: Radius.md,
    backgroundColor: "rgba(255,59,48,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,59,48,0.3)",
  },
  errorText: { color: Colors.danger, fontSize: 13, fontWeight: "700" },
});
