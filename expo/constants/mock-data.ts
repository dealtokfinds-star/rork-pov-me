import Colors from "@/constants/colors";
import type {
  Category,
  ChatMessage,
  Creator,
  DmThread,
  Episode,
  Gift,
  LiveStream,
  PovCategory,
  StudioEpisode,
} from "@/types";

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

const IMG = (id: string, w = 900) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

const V = (name: string) =>
  `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/${name}.mp4`;

export const CREATORS: Creator[] = [
  {
    id: "c1",
    handle: "milesscalps",
    name: "Miles Renner",
    avatar: IMG("photo-1500648767791-00dcc994a43e", 300),
    cover: IMG("photo-1611974789855-9c2a0a7236a3"),
    bio: "Futures scalper in Miami. 4:00am chart prep, live entries, real PnL. You sit in my chair.",
    identity: "Prop futures trader",
    location: "Miami, FL",
    categories: ["trader", "founder"],
    subPrice: 14.99,
    subscribers: 18420,
    episodes: 214,
    verified: true,
    isLive: true,
    rating: 4.9,
  },
  {
    id: "c2",
    handle: "nocturna",
    name: "Yuki Ando",
    avatar: IMG("photo-1494790108377-be9c29b29330", 300),
    cover: IMG("photo-1514933651103-005eec06c04b"),
    bio: "Tokyo nightlife from the inside. Door, booth, back rooms, 5am ramen. Strictly first-person.",
    identity: "Club promoter",
    location: "Tokyo, JP",
    categories: ["nightlife", "travel"],
    subPrice: 19.99,
    subscribers: 42980,
    episodes: 168,
    verified: true,
    isLive: true,
    rating: 4.8,
  },
  {
    id: "c3",
    handle: "sharpdesk",
    name: "Andre Beaumont",
    avatar: IMG("photo-1507003211169-0a1dd7228f2d", 300),
    cover: IMG("photo-1567427017947-545c5f8d16ad"),
    bio: "Pro sports bettor. Model building, line shopping, and the sweat. 6-figure tickets on camera.",
    identity: "Pro bettor",
    location: "Las Vegas, NV",
    categories: ["bettor", "trader"],
    subPrice: 24.99,
    subscribers: 9310,
    episodes: 97,
    verified: true,
    isLive: false,
    rating: 4.7,
  },
  {
    id: "c4",
    handle: "velvetgarage",
    name: "Sofia Marchetti",
    avatar: IMG("photo-1524504388940-b1c1722653e1", 300),
    cover: IMG("photo-1503376780353-7e6692767b70"),
    bio: "Supercar collector. Cockpit POV, canyon runs, auction floors. Hands on the wheel are yours.",
    identity: "Collector & driver",
    location: "Monaco",
    categories: ["luxury", "travel"],
    subPrice: 29.99,
    subscribers: 61240,
    episodes: 143,
    verified: true,
    isLive: true,
    rating: 5.0,
  },
  {
    id: "c5",
    handle: "buildinpublic",
    name: "Deshawn Poole",
    avatar: IMG("photo-1519085360753-af0119f7cbe7", 300),
    cover: IMG("photo-1522071820081-009f0129c71c"),
    bio: "Seed-stage founder. Sales calls, investor rooms, 2am deploys. Raw startup grind POV.",
    identity: "Founder / CEO",
    location: "Austin, TX",
    categories: ["founder"],
    subPrice: 9.99,
    subscribers: 12760,
    episodes: 189,
    verified: true,
    isLive: false,
    rating: 4.8,
  },
  {
    id: "c6",
    handle: "ringside",
    name: "Kofi Mensah",
    avatar: IMG("photo-1531891437562-4301cf35b7e4", 300),
    cover: IMG("photo-1544367567-0f2fcb009e0b"),
    bio: "Pro middleweight. Camp, weigh-in, walkout, and the first bell — strapped to my chest.",
    identity: "Pro fighter",
    location: "London, UK",
    categories: ["athlete"],
    subPrice: 12.99,
    subscribers: 27400,
    episodes: 76,
    verified: true,
    isLive: false,
    rating: 4.9,
  },
  {
    id: "c7",
    handle: "portauprince",
    name: "Naïka Étienne",
    avatar: IMG("photo-1534528741775-53994a69daeb", 300),
    cover: IMG("photo-1502920917128-1aa500764cbd"),
    bio: "Daily life in Port-au-Prince. Markets, moto rides, family kitchens. Real, unfiltered, human.",
    identity: "Documentarian",
    location: "Port-au-Prince, HT",
    categories: ["global", "travel"],
    subPrice: 4.99,
    subscribers: 8140,
    episodes: 121,
    verified: false,
    isLive: false,
    rating: 4.9,
  },
  {
    id: "c8",
    handle: "roamerrr",
    name: "Elias Vogt",
    avatar: IMG("photo-1492562080023-ab3db95bfbce", 300),
    cover: IMG("photo-1533105079780-92b9be482077"),
    bio: "36 countries on one chest rig. Night trains, street food, border crossings.",
    identity: "Nomad",
    location: "Lisbon, PT",
    categories: ["travel", "global"],
    subPrice: 7.99,
    subscribers: 33150,
    episodes: 231,
    verified: true,
    isLive: false,
    rating: 4.6,
  },
];

export const EPISODES: Episode[] = [
  {
    id: "e1",
    creatorId: "c1",
    title: "4:00 AM: you wake up as a Miami futures trader",
    description:
      "Alarm, cold plunge, pre-market levels on the whiteboard, then 42 minutes of live NQ scalping. Full PnL reveal at the end. No cuts.",
    thumb: IMG("photo-1611974789855-9c2a0a7236a3"),
    video: V("ForBiggerBlazes"),
    durationSec: 2820,
    access: "subscribers",
    category: "trader",
    chapter: "Work",
    views: 84200,
    likes: 12400,
    tips: 3120,
    postedAt: "3h",
  },
  {
    id: "e2",
    creatorId: "c4",
    title: "Cockpit POV: night run through Monaco tunnels",
    description:
      "Straight-piped V12, 11pm, empty streets. You are behind the wheel — mirrors, gauges, downshifts, all of it.",
    thumb: IMG("photo-1503376780353-7e6692767b70"),
    video: V("WeAreGoingOnBullrun"),
    durationSec: 1140,
    access: "ppv",
    ppvPrice: 11.99,
    category: "luxury",
    chapter: "Night out",
    views: 231000,
    likes: 41200,
    tips: 18900,
    postedAt: "6h",
  },
  {
    id: "e3",
    creatorId: "c2",
    title: "Door to booth: Shibuya on a Saturday",
    description:
      "Guest list chaos, DJ handoff, table service, and the 5am walk to ramen. Wear my eyes for a night.",
    thumb: IMG("photo-1514933651103-005eec06c04b"),
    video: V("ForBiggerEscapes"),
    durationSec: 3300,
    access: "subscribers",
    category: "nightlife",
    chapter: "Night out",
    views: 154000,
    likes: 28800,
    tips: 9400,
    postedAt: "9h",
  },
  {
    id: "e4",
    creatorId: "c5",
    title: "Pitch day: three VCs, one term sheet",
    description:
      "Back-to-back partner meetings, the hallway debrief, and the call that changed the quarter.",
    thumb: IMG("photo-1522071820081-009f0129c71c"),
    video: V("ForBiggerMeltdowns"),
    durationSec: 2400,
    access: "free",
    category: "founder",
    chapter: "Work",
    views: 62300,
    likes: 8100,
    tips: 1240,
    postedAt: "12h",
  },
  {
    id: "e5",
    creatorId: "c3",
    title: "Sunday sweat: $40k across seven games",
    description:
      "Model outputs at 9am, line shopping, then eight hours of pure sweat. Every ticket on screen.",
    thumb: IMG("photo-1567427017947-545c5f8d16ad"),
    video: V("ForBiggerJoyrides"),
    durationSec: 4500,
    access: "ppv",
    ppvPrice: 14.99,
    category: "bettor",
    chapter: "Work",
    views: 44100,
    likes: 6900,
    tips: 7300,
    postedAt: "1d",
  },
  {
    id: "e6",
    creatorId: "c6",
    title: "Walkout: the 90 seconds before the first bell",
    description:
      "Wraps, pads, tunnel, crowd. Chest cam stays on through round one. The loudest POV on povme.",
    thumb: IMG("photo-1544367567-0f2fcb009e0b"),
    video: V("ForBiggerFun"),
    durationSec: 960,
    access: "ppv",
    ppvPrice: 9.99,
    category: "athlete",
    chapter: "Fight night",
    views: 388000,
    likes: 71000,
    tips: 26500,
    postedAt: "1d",
  },
  {
    id: "e7",
    creatorId: "c7",
    title: "Market morning in Port-au-Prince",
    description:
      "Moto through traffic, buying plantain and pikliz, then breakfast with my grandmother. Subtitled.",
    thumb: IMG("photo-1502920917128-1aa500764cbd"),
    video: V("ElephantsDream"),
    durationSec: 1680,
    access: "free",
    category: "global",
    chapter: "Morning",
    views: 29400,
    likes: 5200,
    tips: 2100,
    postedAt: "2d",
  },
  {
    id: "e8",
    creatorId: "c8",
    title: "Night train, Lisbon → Madrid, no sleep",
    description:
      "Boarding at 22:40, dining car, corridor conversations, and sunrise over Extremadura.",
    thumb: IMG("photo-1533105079780-92b9be482077"),
    video: V("Sintel"),
    durationSec: 2100,
    access: "subscribers",
    category: "travel",
    chapter: "Travel day",
    views: 71200,
    likes: 9900,
    tips: 1800,
    postedAt: "2d",
  },
  {
    id: "e9",
    creatorId: "c1",
    title: "The stop-out that cost me $18,400",
    description:
      "Full transparency episode. Bad thesis, worse sizing, and the debrief I recorded 20 minutes later.",
    thumb: IMG("photo-1590283603385-17ffb3a7f29f"),
    video: V("VolkswagenGTIReview"),
    durationSec: 1500,
    access: "subscribers",
    category: "trader",
    chapter: "Debrief",
    views: 51300,
    likes: 11200,
    tips: 4400,
    postedAt: "3d",
  },
  {
    id: "e10",
    creatorId: "c2",
    title: "Chapter: gym at 3pm after a 6am close",
    description: "How I reset. Sauna, lifts, and the honest conversation about burnout.",
    thumb: IMG("photo-1534438327276-14e5300c3a48"),
    video: V("SubaruOutbackOnStreetAndDirt"),
    durationSec: 780,
    access: "free",
    category: "nightlife",
    chapter: "Gym",
    views: 38100,
    likes: 4400,
    tips: 620,
    postedAt: "4d",
  },
  {
    id: "e11",
    creatorId: "c4",
    title: "Auction floor: bidding on a 1994 supercar",
    description: "Paddle in hand, heart rate on screen. You feel the hammer drop from inside my chest.",
    thumb: IMG("photo-1552519507-da3b142c6e3d"),
    video: V("WhatCarCanYouGetForAGrand"),
    durationSec: 1980,
    access: "subscribers",
    category: "luxury",
    chapter: "Work",
    views: 96700,
    likes: 15400,
    tips: 8800,
    postedAt: "5d",
  },
  {
    id: "e12",
    creatorId: "c6",
    title: "Camp week 3: 6am roadwork in the rain",
    description: "Nobody films this part. 12km, hill sprints, and breakfast at 8:15.",
    thumb: IMG("photo-1552674605-db6ffd4facb5"),
    video: V("TearsOfSteel"),
    durationSec: 1320,
    access: "free",
    category: "athlete",
    chapter: "Training",
    views: 42900,
    likes: 7100,
    tips: 940,
    postedAt: "6d",
  },
];

export const STREAMS: LiveStream[] = [
  {
    id: "l1",
    creatorId: "c1",
    title: "LIVE: NY open, sizing up on NQ",
    thumb: IMG("photo-1590283603385-17ffb3a7f29f"),
    video: V("ForBiggerBlazes"),
    category: "trader",
    access: "public",
    viewers: 4820,
    startedMinutesAgo: 38,
    replayEnabled: true,
  },
  {
    id: "l2",
    creatorId: "c4",
    title: "Coast run — passenger seat is yours",
    thumb: IMG("photo-1492144534655-ae79c964c9d7"),
    video: V("WeAreGoingOnBullrun"),
    category: "luxury",
    access: "subscribers",
    viewers: 11240,
    startedMinutesAgo: 74,
    replayEnabled: true,
  },
  {
    id: "l3",
    creatorId: "c2",
    title: "Roppongi rooftop, 2AM Tokyo",
    thumb: IMG("photo-1519677100203-a0e668c92439"),
    video: V("ForBiggerEscapes"),
    category: "nightlife",
    access: "ppv",
    ppvPrice: 6.99,
    viewers: 20310,
    startedMinutesAgo: 21,
    replayEnabled: false,
  },
  {
    id: "l4",
    creatorId: "c8",
    title: "Border crossing into Morocco",
    thumb: IMG("photo-1539650116574-75c0c6d73f6e"),
    video: V("Sintel"),
    category: "travel",
    access: "public",
    viewers: 2140,
    startedMinutesAgo: 12,
    replayEnabled: true,
  },
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

export const STUDIO_EPISODES: StudioEpisode[] = [
  {
    id: "s1",
    title: "Morning routine: 5am to first coffee",
    thumb: IMG("photo-1495474472287-4d71bcdd2085", 500),
    access: "free",
    status: "published",
    views: 18400,
    earned: 122.4,
    category: "founder",
    postedAt: "2d",
  },
  {
    id: "s2",
    title: "Full day POV: desk to dinner",
    thumb: IMG("photo-1497366216548-37526070297c", 500),
    access: "subscribers",
    status: "published",
    views: 9120,
    earned: 1840.5,
    category: "founder",
    postedAt: "5d",
  },
  {
    id: "s3",
    title: "PPV: closing a $250k deal live",
    thumb: IMG("photo-1521737604893-d14cc237f11d", 500),
    access: "ppv",
    ppvPrice: 12.99,
    status: "published",
    views: 3410,
    earned: 4204.9,
    category: "founder",
    postedAt: "1w",
  },
  {
    id: "s4",
    title: "Weekend chapter: Miami boat day",
    thumb: IMG("photo-1544551763-46a013bb70d5", 500),
    access: "subscribers",
    status: "scheduled",
    views: 0,
    earned: 0,
    category: "luxury",
    postedAt: "Fri 18:00",
  },
  {
    id: "s5",
    title: "Untitled — gym chapter raw",
    thumb: IMG("photo-1534438327276-14e5300c3a48", 500),
    access: "subscribers",
    status: "draft",
    views: 0,
    earned: 0,
    category: "athlete",
    postedAt: "—",
  },
];

export const DM_THREADS: DmThread[] = [
  {
    id: "t1",
    creatorId: "c1",
    messages: [
      { id: "d1", fromMe: false, text: "welcome in 🙏 what POV do you want next week?", at: Date.now() - 86400000 },
      { id: "d2", fromMe: true, text: "the full 4am routine but unedited", at: Date.now() - 82000000 },
      { id: "d3", fromMe: false, text: "already filming it. dropping Thursday.", at: Date.now() - 8000000 },
      {
        id: "d4",
        fromMe: false,
        text: "Custom POV: your ticker on my screens for a full session",
        at: Date.now() - 400000,
        locked: true,
        price: 29.99,
      },
    ],
  },
  {
    id: "t2",
    creatorId: "c4",
    messages: [
      { id: "d5", fromMe: false, text: "garage tour drops tonight, you're on the early list", at: Date.now() - 3600000 },
      { id: "d6", fromMe: true, text: "which car?", at: Date.now() - 3000000 },
      { id: "d7", fromMe: false, text: "the yellow one 😈", at: Date.now() - 2400000 },
    ],
  },
  {
    id: "t3",
    creatorId: "c2",
    messages: [
      { id: "d8", fromMe: false, text: "tokyo stream in 2h. bring headphones.", at: Date.now() - 7200000 },
    ],
  },
];

export function creatorById(id: string): Creator | undefined {
  return CREATORS.find((c) => c.id === id);
}

export function episodeById(id: string): Episode | undefined {
  return EPISODES.find((e) => e.id === id);
}

export function streamById(id: string): LiveStream | undefined {
  return STREAMS.find((s) => s.id === id);
}

export function episodesByCreator(id: string): Episode[] {
  return EPISODES.filter((e) => e.creatorId === id);
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
