import { createAdminClient, corsHeaders, json, requireAuth, AuthError } from "../_shared/auth.ts";
import { sendEmailInternal } from "../send-email/index.ts";

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
 *   - approve_creator:   { user_id } → kyc_status='verified', is_creator=true, sends approval email
 *   - reject_creator:    { user_id, reason } → kyc_status='rejected', sends rejection email with resubmit instructions
 *   - fulfill_payout:    { payout_id } → marks a pending payout row as paid (admin-triggered weekly payout)
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

      case "approve_creator": {
        const { user_id } = body as { user_id?: string };
        if (!user_id) return json({ error: "user_id required" }, 400);
        await admin.from("profiles").update({
          kyc_status: "verified",
          kyc_verified_at: now,
          kyc_reviewed_by: user.userId,
          kyc_reviewed_at: now,
          kyc_last_reason: null,
          is_creator: true,
          updated_at: now,
        }).eq("id", user_id);
        // Best-effort approval email
        try {
          const { data: profile } = await admin.from("profiles").select("email, name, handle").eq("id", user_id).maybeSingle();
          if (profile?.email) {
            await sendEmailInternal({
              to: profile.email,
              subject: "You're approved — welcome to POVMe",
              html: `<p>Hi ${profile.name ?? profile.handle ?? "creator"},</p><p>Your identity was verified and your creator account is now active. You can publish your profile, upload POV episodes, and go live from your studio.</p><p>Payouts run weekly to your saved payout details.</p>`,
              template: "creator_notice",
              user_id,
            });
          }
        } catch (err) {
          console.log("[admin-actions] approve email skipped", err);
        }
        return json({ ok: true, action: "approve_creator" });
      }

      case "reject_creator": {
        const { user_id, reason } = body as { user_id?: string; reason?: string };
        if (!user_id) return json({ error: "user_id required" }, 400);
        const rejectReason = (reason ?? "Documents unclear").trim().slice(0, 500);
        await admin.from("profiles").update({
          kyc_status: "rejected",
          kyc_last_reason: rejectReason,
          kyc_reviewed_by: user.userId,
          kyc_reviewed_at: now,
          updated_at: now,
        }).eq("id", user_id);
        // Best-effort rejection email
        try {
          const { data: profile } = await admin.from("profiles").select("email, name, handle").eq("id", user_id).maybeSingle();
          if (profile?.email) {
            await sendEmailInternal({
              to: profile.email,
              subject: "Action needed — your creator application",
              html: `<p>Hi ${profile.name ?? profile.handle ?? "creator"},</p><p>Your creator application needs another look. Reason: <strong>${rejectReason}</strong>.</p><p>Please re-take your ID photos (clear, well-lit, no glare) and resubmit from the become-a-creator flow.</p>`,
              template: "creator_notice",
              user_id,
            });
          }
        } catch (err) {
          console.log("[admin-actions] reject email skipped", err);
        }
        return json({ ok: true, action: "reject_creator" });
      }

      case "fulfill_payout": {
        // Admin-triggered weekly payout: marks a pending payout row as paid
        // after the platform has sent the bank transfer / PayPal payment.
        const { payout_id } = body as { payout_id?: string };
        if (!payout_id) return json({ error: "payout_id required" }, 400);
        const { data: payout } = await admin.from("payouts").select("creator_id, amount").eq("id", payout_id).maybeSingle();
        if (!payout) return json({ error: "Payout not found" }, 404);
        await admin.from("payouts").update({
          status: "paid",
          processed_at: now,
        }).eq("id", payout_id);
        // Reduce pending_payout on profile
        await admin.from("profiles").update({
          pending_payout: 0,
          payout_balance: 0,
          last_payout_at: now,
          updated_at: now,
        }).eq("id", payout.creator_id);
        return json({ ok: true, action: "fulfill_payout" });
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
