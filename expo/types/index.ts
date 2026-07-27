export type AccessLevel = "free" | "subscribers" | "ppv";

export type PovCategory =
  | "trader"
  | "bettor"
  | "founder"
  | "luxury"
  | "nightlife"
  | "travel"
  | "athlete"
  | "global";

export interface Category {
  id: PovCategory;
  label: string;
  tagline: string;
  emoji: string;
  accent: string;
}

export interface Creator {
  id: string;
  handle: string;
  name: string;
  avatar: string;
  cover: string;
  bio: string;
  identity: string;
  location: string;
  categories: PovCategory[];
  subPrice: number;
  subscribers: number;
  episodes: number;
  verified: boolean;
  isLive: boolean;
  rating: number;
}

export interface Episode {
  id: string;
  creatorId: string;
  title: string;
  description: string;
  thumb: string;
  video: string;
  durationSec: number;
  access: AccessLevel;
  ppvPrice?: number;
  category: PovCategory;
  chapter: string;
  views: number;
  likes: number;
  tips: number;
  postedAt: string;
}

export type StreamAccess = "public" | "subscribers" | "ppv";

export interface LiveStream {
  id: string;
  creatorId: string;
  title: string;
  thumb: string;
  video: string;
  category: PovCategory;
  access: StreamAccess;
  ppvPrice?: number;
  viewers: number;
  startedMinutesAgo: number;
  replayEnabled: boolean;
}

export interface ChatMessage {
  id: string;
  user: string;
  color: string;
  text: string;
  badge?: "sub" | "top" | "mod";
  kind: "chat" | "tip" | "join" | "gift";
  amount?: number;
}

export interface Gift {
  id: string;
  name: string;
  emoji: string;
  price: number;
}

export interface Transaction {
  id: string;
  kind: "sub" | "tip" | "ppv" | "topup" | "payout" | "gift";
  label: string;
  amount: number;
  creatorId?: string;
  at: number;
}

export interface Subscription {
  creatorId: string;
  price: number;
  startedAt: number;
  renewsAt: number;
  active: boolean;
}

export interface DmThread {
  id: string;
  creatorId: string;
  messages: DmMessage[];
}

export interface DmMessage {
  id: string;
  fromMe: boolean;
  text: string;
  at: number;
  locked?: boolean;
  price?: number;
}

export interface StudioEpisode {
  id: string;
  title: string;
  thumb: string;
  access: AccessLevel;
  ppvPrice?: number;
  status: "published" | "scheduled" | "draft";
  views: number;
  earned: number;
  category: PovCategory;
  postedAt: string;
}
