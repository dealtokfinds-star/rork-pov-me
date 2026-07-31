import Colors from "@/constants/colors";
import type {
  Category,
  Gift,
  PovCategory,
} from "@/types";

/**
 * Static reference data and UI utilities.
 *
 * This file holds genuinely static app data only:
 *  - CATEGORIES (the fixed POV lifestyle taxonomy)
 *  - GIFTS (the fixed tip-gift catalog)
 *  - CHAT_COLORS (username color palette for live chat)
 *  - Formatting utilities (formatCount / formatMoney / formatDuration)
 *
 * All creator, episode, stream, wallet, and chat data comes from Supabase.
 */

export const CATEGORIES: Category[] = [
  { id: "trader", label: "Trader", tagline: "Charts, scalps, PnL", emoji: "📈", accent: Colors.lime },
  { id: "bettor", label: "Bettor", tagline: "Models & live sweats", emoji: "🎲", accent: Colors.gold },
  { id: "founder", label: "Founder", tagline: "Pitch days & builds", emoji: "🚀", accent: Colors.cyan },
  { id: "luxury", label: "Luxury", tagline: "Supercars, yachts", emoji: "🏎️", accent: Colors.gold },
  { id: "nightlife", label: "Nightlife", tagline: "Tables & afterhours", emoji: "🌃", accent: Colors.magenta },
  { id: "travel", label: "Travel", tagline: "Cities, nomad life", emoji: "🌍", accent: Colors.cyan },
  { id: "athlete", label: "Athlete", tagline: "Training & fight night", emoji: "🥊", accent: Colors.magenta },
  { id: "global", label: "Global", tagline: "Be someone elsewhere", emoji: "🛰️", accent: Colors.lime },
];

export const GIFTS: Gift[] = [
  { id: "g1", name: "Chest Cam", emoji: "🎥", price: 1.99 },
  { id: "g2", name: "Energy", emoji: "⚡️", price: 4.99 },
  { id: "g3", name: "Ice", emoji: "🧊", price: 9.99 },
  { id: "g4", name: "Keys", emoji: "🔑", price: 24.99 },
  { id: "g5", name: "Jet", emoji: "✈️", price: 49.99 },
  { id: "g6", name: "Crown", emoji: "👑", price: 99.99 },
];

export const CHAT_COLORS = [
  Colors.lime,
  Colors.cyan,
  Colors.magenta,
  Colors.gold,
  "#9F8BFF",
  "#7DFFB2",
];

export function categoryById(id: PovCategory): Category {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0];
}

export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatCount(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return `${n}`;
}

export function formatMoney(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
