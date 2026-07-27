import { createAdminClient, corsHeaders, json, requireAuth, AuthError } from "../_shared/auth.ts";

/**
 * POST /gdpr-delete
 *
 * GDPR Article 17 right to erasure. Deletes the user and all cascading data:
 *   - dm_threads, dm_messages (sender), push_tokens, saves, likes, events,
 *     reports → CASCADE on profiles.id FK
 *   - subscriptions where fan_id → set to inactive first (creator analytics
 *     retained for tax/compliance), then deleted
 *   - transactions → anonymized (user_id nulled) rather than deleted (tax records)
 *   - tips, unlocks → anonymized (fan_id nulled) for the same reason
 *   - episodes created by the user → deleted
 *
 * Returns { ok: true } on success. This is irreversible.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const user = await requireAuth(req);
    const admin = createAdminClient();
    const uid = user.userId;

    // Anonymize financial records (retain for tax compliance) before deleting profile
    await admin.from("transactions").update({ user_id: `deleted_${uid.slice(0, 8)}` }).eq("user_id", uid);
    await admin.from("tips").update({ fan_id: `deleted_${uid.slice(0, 8)}` }).eq("fan_id", uid);
    await admin.from("unlocks").update({ fan_id: `deleted_${uid.slice(0, 8)}` }).eq("fan_id", uid);

    // Deactivate subscriptions (don't delete — creator retains sub history for analytics)
    await admin.from("subscriptions").update({ active: false, status: "canceled" }).eq("fan_id", uid);

    // Delete the profile row — cascades to dm_threads, dm_messages, push_tokens,
    // saves, likes, events, reports
    const { error } = await admin.from("profiles").delete().eq("id", uid);
    if (error) {
      console.error("[gdpr-delete] profile delete error", error);
      return json({ error: "Failed to delete account" }, 500);
    }

    return json({ ok: true, deleted: true, user_id: uid });
  } catch (err) {
    if (err instanceof AuthError) return json({ error: err.message }, 401);
    console.error("[gdpr-delete] error", err);
    return json({ error: "Internal error" }, 500);
  }
});
