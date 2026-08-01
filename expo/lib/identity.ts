import { supabase } from "@/lib/supabase";

/**
 * Identity utilities for onboarding: handle normalization, real-time
 * availability checks against `profiles.handle` (unique column), taken-handle
 * suggestions, and deterministic auto-generated avatars.
 */

export type HandleStatus = "idle" | "short" | "checking" | "available" | "taken" | "error";

/** Duotone gradient palettes for auto-generated avatars (POVMe brand colors). */
export interface AvatarPalette {
  from: string;
  to: string;
  fg: string;
  /** Flat hex (no #) used for the persisted PNG avatar URL. */
  flatBg: string;
  flatFg: string;
}

export const AVATAR_PALETTES: AvatarPalette[] = [
  { from: "#CCFF00", to: "#7FB800", fg: "#08080A", flatBg: "CCFF00", flatFg: "08080A" },
  { from: "#35E7FF", to: "#0086A8", fg: "#08080A", flatBg: "35E7FF", flatFg: "08080A" },
  { from: "#FF2D6F", to: "#8E0F3D", fg: "#FFFFFF", flatBg: "FF2D6F", flatFg: "FFFFFF" },
  { from: "#FFB627", to: "#B36F00", fg: "#08080A", flatBg: "FFB627", flatFg: "08080A" },
  { from: "#2C2C36", to: "#08080A", fg: "#CCFF00", flatBg: "24242D", flatFg: "CCFF00" },
  { from: "#1B1B22", to: "#0A0A0C", fg: "#35E7FF", flatBg: "1B1B22", flatFg: "35E7FF" },
];

/** Lowercase, strip spaces and anything outside a-z 0-9 _ . — max 24 chars. */
export function normalizeHandle(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9_.]/g, "")
    .slice(0, 24);
}

/** Two-letter initials for the auto-avatar. */
export function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "ME";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Maps a shuffle seed to either the user's real photo (index 0 when one
 * exists) or a palette index. Keeps AutoAvatar rendering and the persisted
 * URL in `finish()` perfectly in sync.
 */
export function avatarOptionForSeed(
  seed: number,
  hasPhoto: boolean,
): { usePhoto: boolean; paletteIndex: number } {
  const total = AVATAR_PALETTES.length + (hasPhoto ? 1 : 0);
  const idx = ((seed % total) + total) % total;
  if (hasPhoto && idx === 0) return { usePhoto: true, paletteIndex: 0 };
  return { usePhoto: false, paletteIndex: hasPhoto ? idx - 1 : idx };
}

/** Persistable PNG avatar URL matching the selected palette + initials. */
export function generatedAvatarUrl(name: string, paletteIndex: number): string {
  const n = AVATAR_PALETTES.length;
  const p = AVATAR_PALETTES[((paletteIndex % n) + n) % n];
  const label = name.trim().length > 0 ? name.trim() : "POV Me";
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(label)}&background=${p.flatBg}&color=${p.flatFg}&size=256&bold=true&length=2&format=png`;
}

/** True if another profile already claimed this handle. */
export async function isHandleTaken(handle: string, selfId?: string | null): Promise<boolean> {
  let query = supabase.from("profiles").select("id").eq("handle", handle).limit(1);
  if (selfId) query = query.neq("id", selfId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}

/** Candidate alternates in POVMe voice: miles_pov, miles.live, miles2026… */
export function handleCandidates(base: string): string[] {
  const year = new Date().getFullYear();
  const two = (): string => String(10 + Math.floor(Math.random() * 89));
  const raw = [`${base}_pov`, `${base}.live`, `${base}${year}`, `${base}_${two()}`, `${base}.${two()}`];
  return Array.from(new Set(raw.map((c) => c.slice(0, 24))));
}

/** Up to `count` candidates that are actually free (one batched query). */
export async function findFreeSuggestions(
  base: string,
  selfId?: string | null,
  count = 3,
): Promise<string[]> {
  const candidates = handleCandidates(base);
  let query = supabase.from("profiles").select("handle").in("handle", candidates);
  if (selfId) query = query.neq("id", selfId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const taken = new Set(((data ?? []) as { handle: string | null }[]).map((r) => r.handle));
  return candidates.filter((c) => !taken.has(c)).slice(0, count);
}

/**
 * Returns `desired` if free, otherwise the first free suggestion, otherwise a
 * random-suffixed fallback. Fails open (returns `desired`) on network errors —
 * the unique-violation retry in the caller is the last line of defense.
 */
export async function resolveFreeHandle(desired: string, selfId?: string | null): Promise<string> {
  try {
    if (!(await isHandleTaken(desired, selfId))) return desired;
    const free = await findFreeSuggestions(desired, selfId, 1);
    if (free.length > 0) return free[0];
    return `${desired.slice(0, 19)}_${1000 + Math.floor(Math.random() * 8999)}`;
  } catch {
    return desired;
  }
}
