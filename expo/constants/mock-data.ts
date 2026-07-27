import Colors from "@/constants/colors";
import type {
  Category,
  ChatMessage,
  Gift,
  PovCategory,
} from "@/types";

/**
 * Static reference data and UI utilities.
 *
 * NOTE: This file used to ship hardcoded mock creators, episodes, streams,
 * studio episodes, and DM threads. Those have been removed — every screen
 * now reads real data from Supabase via the hooks in `lib/data.ts`.
 *
 * What remains is genuinely static app data:
 *  - CATEGORIES (the fixed POV lifestyle taxonomy)
 *  - GIFTS (the fixed tip-gift catalog)
 *  - Chat simulation helpers (used by the live chat overlay)
 *  - Formatting utilities (formatCount / formatMoney / formatDuration)
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

const CHAT_NAMES = [
  "zaydraws",
  "kilo_9",
  "mari.fps",
  "tapedelay",
  "nine_lives",
  "oscarr",
  "vibecheck",
  "hexed",
  "lunaa",
  "grindset_ty",
  "porschekid",
  "bankrolljay",
];

const CHAT_LINES = [
  "this angle is insane",
  "bro the hands are shaking 😭",
  "how much are you risking rn",
  "watching from Lagos 🇳🇬",
  "chest rig audio is so clean",
  "I feel like I'm in the car",
  "day 14 of asking for a gym chapter",
  "explain the entry pls",
  "the ambience >>>",
  "third stream I've caught today",
  "this is better than tv fr",
  "sub renewed, worth every cent",
  "put the cam lower next time",
  "mans is built different",
];

export const CHAT_COLORS = [
  Colors.lime,
  Colors.cyan,
  Colors.magenta,
  Colors.gold,
  "#9F8BFF",
  "#7DFFB2",
];

let chatSeed = 1;

/** Generates a pseudo-random chat message for the simulated live chat. */
export function randomChat(): ChatMessage {
  chatSeed += 1;
  const roll = (chatSeed * 37) % 100;
  const name = CHAT_NAMES[(chatSeed * 7) % CHAT_NAMES.length];
  const color = CHAT_COLORS[(chatSeed * 3) % CHAT_COLORS.length];
  if (roll > 88) {
    const amount = [2, 5, 10, 20, 50][(chatSeed * 5) % 5];
    return {
      id: `m${chatSeed}`,
      user: name,
      color,
      text: "keep going 🔥",
      kind: "tip",
      amount,
      badge: "top",
    };
  }
  if (roll > 82) {
    return {
      id: `m${chatSeed}`,
      user: name,
      color,
      text: "joined the POV",
      kind: "join",
    };
  }
  return {
    id: `m${chatSeed}`,
    user: name,
    color,
    text: CHAT_LINES[(chatSeed * 11) % CHAT_LINES.length],
    kind: "chat",
    badge: roll > 55 ? "sub" : undefined,
  };
}

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
