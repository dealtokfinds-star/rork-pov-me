import { createAdminClient, corsHeaders, json, requireAuth, AuthError } from "../_shared/auth.ts";

/**
 * POST /gdpr-export
 *
 * Exports all data associated with the authenticated user (GDPR Article 15
 * data portability). Returns a JSON bundle with profile, subscriptions,
 * transactions, tips, unlocks, saves, likes, dm_threads, dm_messages,
 * push_tokens, events, and reports filed by the user.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const user = await requireAuth(req);
    const admin = createAdminClient();
    const uid = user.userId;

    const [
      profile,
      subscriptions,
      transactions,
      tips,
      unlocks,
      saves,
      likes,
      dmThreads,
      dmMessages,
      pushTokens,
      events,
      reports,
      episodes,
    ] = await Promise.all([
      admin.from("profiles").select("*").eq("id", uid).maybeSingle(),
      admin.from("subscriptions").select("*").or(`fan_id.eq.${uid},creator_id.eq.${uid}`),
      admin.from("transactions").select("*").eq("user_id", uid),
      admin.from("tips").select("*").or(`fan_id.eq.${uid},creator_id.eq.${uid}`),
      admin.from("unlocks").select("*").eq("fan_id", uid),
      admin.from("saves").select("*").eq("user_id", uid),
      admin.from("likes").select("*").eq("user_id", uid),
      admin.from("dm_threads").select("*").or(`creator_id.eq.${uid},fan_id.eq.${uid}`),
      admin.from("dm_messages").select("*").eq("sender_id", uid),
      admin.from("push_tokens").select("token, platform, created_at, last_seen_at").eq("user_id", uid),
      admin.from("events").select("*").eq("user_id", uid).limit(1000),
      admin.from("reports").select("*").eq("reporter_id", uid),
      admin.from("episodes").select("*").eq("creator_id", uid),
    ]);

    const bundle = {
      exported_at: new Date().toISOString(),
      user_id: uid,
      profile: profile.data,
      subscriptions: subscriptions.data,
      transactions: transactions.data,
      tips: tips.data,
      unlocks: unlocks.data,
      saves: saves.data,
      likes: likes.data,
      dm_threads: dmThreads.data,
      dm_messages_sent: dmMessages.data,
      push_tokens: pushTokens.data,
      events: events.data,
      reports: reports.data,
      episodes_created: episodes.data,
    };

    return json(bundle);
  } catch (err) {
    if (err instanceof AuthError) return json({ error: err.message }, 401);
    console.error("[gdpr-export] error", err);
    return json({ error: "Internal error" }, 500);
  }
});
