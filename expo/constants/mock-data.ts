/**
 * @deprecated This module is a thin re-export shim. All formatters and
 * constants now live in `@/lib/format`. Mock data arrays (CREATORS,
 * EPISODES, STREAMS, STUDIO_EPISODES, DM_THREADS) have been removed —
 * screens must source content from the real Supabase data layer
 * (`@/lib/data`, `@/hooks/useCreatorMap`, `@/hooks/useProfile`).
 *
 * Import from `@/lib/format` directly in new code.
 */
export {
  CATEGORIES,
  GIFTS,
  CHAT_COLORS,
  categoryById,
  formatCount,
  formatDuration,
  formatMoney,
  randomChat,
} from "@/lib/format";
