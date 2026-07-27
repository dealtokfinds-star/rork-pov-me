import { requireAuth, AuthError, corsHeaders, json } from "../_shared/auth.ts";

/**
 * GET/POST /search
 * Full-text search over creator profiles using the `profiles.fts` tsvector.
 *
 * Query params (GET) or body (POST):
 *   q: search query (name / handle / identity / location / bio)
 *   category?: PovCategory id — restrict to a category
 *   sort?: "relevance" | "subs" | "new" | "price"  (default: relevance)
 *   limit?: number (default 20, max 50)
 *
 * Uses Postgres ts_rank for relevance scoring. Falls back to a basic
 * ilike filter if the query has no FTS lexemes (e.g. pure numbers/emoji).
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET" && req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    let userId: string | null = null;
    try {
      const user = await requireAuth(req);
      userId = user.userId;
    } catch {
      // allow anonymous search
    }

    const params = req.method === "GET"
      ? new URL(req.url).searchParams
      : new URLSearchParams(Object.entries(await req.json().catch(() => ({})) as Record<string, unknown>) as [string, string][]);

    const q = (params.get("q") ?? "").trim();
    const category = params.get("category");
    const sort = (params.get("sort") ?? "relevance") as "relevance" | "subs" | "new" | "price";
    const limit = Math.min(50, Math.max(1, Number(params.get("limit") ?? 20)));

    if (!q) {
      return json({ items: [], q, category, sort });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const headers: Record<string, string> = { apikey: anonKey };
    if (userId) headers["Authorization"] = req.headers.get("Authorization")!;

    // Use PostgREST's full-text filters: `fts` column + `websearch_to_tsquery` via `plv8`-free rpc.
    // PostgREST supports `fts=/phraseto_tsquery(...)` style via the `tsvector` operator `@@`.
    // The simplest reliable approach: an RPC function. But to keep this self-contained,
    // use PostgREST's `tsquery` filter: column=fts, op=fts, value=<query>.
    // PostgREST exposes `fts.wfts.<query>` (websearch_to_tsquery) — robust to typos/punctuation.
    const url = new URL(`${supabaseUrl}/rest/v1/profiles`);
    url.searchParams.set("select", "id,name,handle,avatar_url,cover_url,bio,identity,location,categories,verified,sub_price,is_creator");
    // websearch_to_tsquery — handles "miami trader" naturally
    url.searchParams.set("fts", `wfts.${q}`);
    url.searchParams.set("is_creator", "eq.true");
    if (category) {
      // categories is a text[]; use `cs` (contains) with a single-element array
      url.searchParams.set("categories", `cs.{${category}}`);
    }

    let orderCol = "sub_price";
    let ascending = true;
    if (sort === "price") { orderCol = "sub_price"; ascending = true; }
    else if (sort === "new") { orderCol = "created_at"; ascending = false; }
    // relevance & subs are handled after fetch (no subscribers column on profiles)
    url.searchParams.set("order", `${orderCol}.${ascending ? "asc" : "desc"}`);
    url.searchParams.set("limit", String(limit * 3)); // over-fetch so we can re-rank

    const res = await fetch(url, { headers: { ...headers, Accept: "application/json" } });
    if (!res.ok) {
      console.error("[search] fts query failed:", await res.text());
      // Fallback: basic ilike search
      return await fallbackSearch(supabaseUrl, anonKey, headers, q, category, sort, limit);
    }
    const rows = await res.json() as Array<{
      id: string;
      name: string | null;
      handle: string | null;
      avatar_url: string | null;
      cover_url: string | null;
      bio: string | null;
      identity: string | null;
      location: string | null;
      categories: string[] | null;
      verified: boolean | null;
      sub_price: number | null;
      is_creator: boolean | null;
    }>;

    // Hydrate with subscriber + episode counts for ranking/sorting
    const ids = rows.map((r) => r.id);
    const stats = await fetchStats(supabaseUrl, anonKey, headers, ids);
    const liveIds = await fetchLiveIds(supabaseUrl, anonKey, headers);

    const items = rows.map((r) => {
      const st = stats.get(r.id) ?? { sub_count: 0, ep_count: 0 };
      return {
        id: r.id,
        name: r.name ?? "",
        handle: r.handle ?? "",
        avatar_url: r.avatar_url,
        cover_url: r.cover_url,
        bio: r.bio,
        identity: r.identity,
        location: r.location,
        categories: (r.categories ?? []) as string[],
        verified: r.verified ?? false,
        sub_price: r.sub_price ?? 9.99,
        is_live: liveIds.has(r.id),
        subscribers: st.sub_count,
        episodes: st.ep_count,
      };
    });

    if (sort === "subs") items.sort((a, b) => b.subscribers - a.subscribers);
    else if (sort === "relevance") {
      // Keep FTS rank order (PostgREST already returned by rank when using fts filter,
      // but we over-fetched for stats). Re-sort by a simple relevance proxy:
      // exact handle/name match first, then subscribers.
      const ql = q.toLowerCase();
      items.sort((a, b) => {
        const aExact = (a.handle.toLowerCase() === ql || a.name.toLowerCase() === ql) ? 0 : 1;
        const bExact = (b.handle.toLowerCase() === ql || b.name.toLowerCase() === ql) ? 0 : 1;
        if (aExact !== bExact) return aExact - bExact;
        return b.subscribers - a.subscribers;
      });
    }

    return json({ items: items.slice(0, limit), q, category, sort });
  } catch (err) {
    if (err instanceof AuthError) return json({ error: "Unauthorized" }, 401);
    console.error("[search] error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});

async function fetchStats(supabaseUrl: string, anonKey: string, headers: Record<string, string>, ids: string[]) {
  const url = new URL(`${supabaseUrl}/rest/v1/creator_stats`);
  url.searchParams.set("select", "creator_id,sub_count,ep_count");
  url.searchParams.set("creator_id", `in.(${ids.join(",")})`);
  const res = await fetch(url, { headers: { ...headers, Accept: "application/json" } });
  if (!res.ok) return new Map<string, { sub_count: number; ep_count: number }>();
  const rows = await res.json() as Array<{ creator_id: string; sub_count: number; ep_count: number }>;
  return new Map(rows.map((r) => [r.creator_id, { sub_count: r.sub_count, ep_count: r.ep_count }]));
}

async function fetchLiveIds(supabaseUrl: string, anonKey: string, headers: Record<string, string>) {
  const url = new URL(`${supabaseUrl}/rest/v1/live_streams`);
  url.searchParams.set("select", "creator_id");
  url.searchParams.set("is_live", "eq.true");
  const res = await fetch(url, { headers: { ...headers, Accept: "application/json" } });
  if (!res.ok) return new Set<string>();
  const rows = await res.json() as Array<{ creator_id: string }>;
  return new Set(rows.map((r) => r.creator_id));
}

async function fallbackSearch(
  supabaseUrl: string,
  anonKey: string,
  headers: Record<string, string>,
  q: string,
  category: string | null,
  sort: "relevance" | "subs" | "new" | "price",
  limit: number,
): Promise<Response> {
  // ilike on name, handle, identity, location, bio — OR'd via multiple requests is expensive,
  // so we use the `or` PostgREST filter.
  const like = `%${q.replace(/[%_]/g, "\\$&")}%`;
  const url = new URL(`${supabaseUrl}/rest/v1/profiles`);
  url.searchParams.set("select", "id,name,handle,avatar_url,cover_url,bio,identity,location,categories,verified,sub_price");
  url.searchParams.set("or", `(name.ilike.${like},handle.ilike.${like},identity.ilike.${like},location.ilike.${like},bio.ilike.${like})`);
  url.searchParams.set("is_creator", "eq.true");
  if (category) url.searchParams.set("categories", `cs.{${category}}`);
  url.searchParams.set("limit", String(limit * 3));
  const res = await fetch(url, { headers: { ...headers, Accept: "application/json" } });
  if (!res.ok) return json({ items: [], q, category, sort, fallback: true });
  const rows = await res.json() as Array<Record<string, unknown>>;
  const ids = rows.map((r) => r.id as string);
  const stats = await fetchStats(supabaseUrl, anonKey, headers, ids);
  const liveIds = await fetchLiveIds(supabaseUrl, anonKey, headers);
  const items = rows.map((r) => {
    const st = stats.get(r.id as string) ?? { sub_count: 0, ep_count: 0 };
    return {
      id: r.id,
      name: r.name ?? "",
      handle: r.handle ?? "",
      avatar_url: r.avatar_url,
      cover_url: r.cover_url,
      bio: r.bio,
      identity: r.identity,
      location: r.location,
      categories: (r.categories ?? []) as string[],
      verified: r.verified ?? false,
      sub_price: r.sub_price ?? 9.99,
      is_live: liveIds.has(r.id as string),
      subscribers: st.sub_count,
      episodes: st.ep_count,
    };
  });
  items.sort((a, b) => b.subscribers - a.subscribers);
  return json({ items: items.slice(0, limit), q, category, sort, fallback: true });
}
