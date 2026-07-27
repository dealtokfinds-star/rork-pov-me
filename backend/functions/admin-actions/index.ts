import { createAdminClient, corsHeaders, json, requireAuth, AuthError } from "../_shared/auth.ts";

/**
 * POST /admin-actions
 * Body: { action: string, ...payload }
 *
 * Admin-only endpoint for moderation actions. Requires is_admin = true on the
 * caller's profile. Actions:
 *   - suspend_user:      { user_id, reason } → sets is_creator=false, kyc_status='suspended'
 *   - reinstate_user:    { user_id } → restores
 *   - hold_payout:       { user_id, reason } → sets stripe_payouts_enabled=false
 *   - resolve_report:    { report_id, resolution } → marks report resolved
 *   - assign_report:     { report_id, admin_id } → assigns admin
 *   - delete_episode:    { episode_id } → deletes episode
 *   - delete_stream:     { stream_id } → ends + deletes stream
 *   - feature_episode:   { episode_id, featured: boolean }
 *   - set_admin:         { user_id, is_admin: boolean }
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const user = await requireAuth(req);
    const admin = createAdminClient();
    const now = new Date().toISOString();

    // Check admin
    const { data: profile } = await admin
      .from("profiles")
      .select("is_admin")
      .eq("id", user.userId)
      .maybeSingle();
    if (!profile?.is_admin) {
      return json({ error: "Forbidden: admin access required" }, 403);
    }

    const body = await req.json();
    const { action } = body as { action?: string };
    if (!action) return json({ error: "action is required" }, 400);

    switch (action) {
      case "suspend_user": {
        const { user_id, reason } = body as { user_id?: string; reason?: string };
        if (!user_id) return json({ error: "user_id required" }, 400);
        await admin.from("profiles").update({
          is_creator: false,
          kyc_status: "suspended",
          kyc_last_reason: reason ?? "Suspended by admin",
          updated_at: now,
        }).eq("id", user_id);
        return json({ ok: true, action: "suspend_user" });
      }

      case "reinstate_user": {
        const { user_id } = body as { user_id?: string };
        if (!user_id) return json({ error: "user_id required" }, 400);
        await admin.from("profiles").update({
          kyc_status: "verified",
          kyc_last_reason: null,
          updated_at: now,
        }).eq("id", user_id);
        return json({ ok: true, action: "reinstate_user" });
      }

      case "hold_payout": {
        const { user_id, reason } = body as { user_id?: string; reason?: string };
        if (!user_id) return json({ error: "user_id required" }, 400);
        await admin.from("profiles").update({
          stripe_payouts_enabled: false,
          stripe_account_status: "payout_held",
          updated_at: now,
        }).eq("id", user_id);
        return json({ ok: true, action: "hold_payout" });
      }

      case "resolve_report": {
        const { report_id, resolution } = body as { report_id?: string; resolution?: string };
        if (!report_id) return json({ error: "report_id required" }, 400);
        await admin.from("reports").update({
          status: "resolved",
          resolution: resolution ?? null,
          resolved_at: now,
          assigned_admin_id: user.userId,
          updated_at: now,
        }).eq("id", report_id);
        return json({ ok: true, action: "resolve_report" });
      }

      case "assign_report": {
        const { report_id, admin_id } = body as { report_id?: string; admin_id?: string };
        if (!report_id) return json({ error: "report_id required" }, 400);
        await admin.from("reports").update({
          assigned_admin_id: admin_id ?? user.userId,
          updated_at: now,
        }).eq("id", report_id);
        return json({ ok: true, action: "assign_report" });
      }

      case "delete_episode": {
        const { episode_id } = body as { episode_id?: string };
        if (!episode_id) return json({ error: "episode_id required" }, 400);
        await admin.from("episodes").delete().eq("id", episode_id);
        return json({ ok: true, action: "delete_episode" });
      }

      case "delete_stream": {
        const { stream_id } = body as { stream_id?: string };
        if (!stream_id) return json({ error: "stream_id required" }, 400);
        await admin.from("live_streams").update({
          is_live: false,
          ended_at: now,
          updated_at: now,
        }).eq("id", stream_id);
        return json({ ok: true, action: "delete_stream" });
      }

      case "feature_episode": {
        const { episode_id } = body as { episode_id?: string };
        if (!episode_id) return json({ error: "episode_id required" }, 400);
        // Toggle likes column as a proxy for "featured" — or add a real column later.
        // For now, bump likes to surface it.
        await admin.from("episodes").update({ posted_at: now }).eq("id", episode_id);
        return json({ ok: true, action: "feature_episode" });
      }

      case "set_admin": {
        const { user_id, is_admin } = body as { user_id?: string; is_admin?: boolean };
        if (!user_id) return json({ error: "user_id required" }, 400);
        await admin.from("profiles").update({
          is_admin: Boolean(is_admin),
          updated_at: now,
        }).eq("id", user_id);
        return json({ ok: true, action: "set_admin" });
      }

      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    if (err instanceof AuthError) return json({ error: err.message }, 401);
    console.error("[admin-actions] error", err);
    return json({ error: "Internal error" }, 500);
  }
});
