import { requireAuth, createAdminClient, AuthError, corsHeaders, json } from "../_shared/auth.ts";
import { sendEmailInternal } from "../send-email/index.ts";

/**
 * POST /submit-kyc
 * Body: { documents: { front: string, back: string, selfie: string } }
 *
 * Creator submits their KYC documents (already uploaded to the
 * kyc-documents storage bucket via the client). Auto-approves immediately —
 * `kyc_status` is set to `verified` on submit so the creator can go live
 * without waiting for admin review. The admin review queue still receives
 * the submission (for spot-checks / audits), but it no longer gates
 * activation.
 *
 * Documents are stored under `kyc-documents/{userId}/{front|back|selfie}.jpg`
 * — the client uploads them directly to Supabase Storage with RLS scoping
 * uploads to the user's own folder, then calls this endpoint with the paths.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const user = await requireAuth(req);
    const body = await req.json().catch(() => ({})) as {
      documents?: { front?: string; back?: string; selfie?: string };
    };

    if (!body.documents?.front || !body.documents?.back || !body.documents?.selfie) {
      return json({ error: "Front, back, and selfie images are all required" }, 400);
    }

    const { front, back, selfie } = body.documents;

    // Validate the paths belong to the user's folder (prevent path injection)
    const userPrefix = `${user.userId}/`;
    for (const path of [front, back, selfie]) {
      if (!path.startsWith(userPrefix)) {
        return json({ error: "Invalid document path" }, 400);
      }
    }

    const admin = createAdminClient();
    const now = new Date().toISOString();

    // Auto-approve: set kyc_status to 'verified' immediately so the creator
    // can go live without waiting for admin review. Admins still receive a
    // notification for spot-checks, but review no longer gates activation.
    const { error } = await admin.from("profiles").update({
      kyc_status: "verified",
      kyc_documents: { front, back, selfie },
      kyc_submitted_at: now,
      kyc_verified_at: now,
      kyc_reviewed_by: null, // null = system auto-approval
      kyc_reviewed_at: now,
      kyc_last_reason: null,
      updated_at: now,
    }).eq("id", user.userId);

    if (error) {
      console.error("[submit-kyc] update error:", error.message);
      return json({ error: "Failed to submit KYC" }, 500);
    }

    // Notify admins (best-effort, never blocks)
    try {
      const { data: admins } = await admin.from("profiles")
        .select("email")
        .eq("is_admin", true)
        .limit(20);
      const { data: submitter } = await admin.from("profiles")
        .select("name, handle, email")
        .eq("id", user.userId)
        .maybeSingle();

      const subject = "New creator application — review needed";
      const html = `<p>A new creator submitted their KYC documents.</p>
        <p><strong>${submitter?.name ?? submitter?.handle ?? "Unknown"}</strong> (@${submitter?.handle ?? "—"}, ${submitter?.email ?? "—"})</p>
        <p>Review the application in the admin panel → Applications tab.</p>`;

      for (const a of admins ?? []) {
        if (a.email) {
          await sendEmailInternal({
            to: a.email,
            subject,
            html,
            template: "admin_notice",
            user_id: user.userId,
          }).catch(() => {});
        }
      }
    } catch (err) {
      console.log("[submit-kyc] admin notify skipped", err);
    }

    return json({ ok: true, kyc_status: "verified" });
  } catch (err) {
    if (err instanceof AuthError) return json({ error: err.message }, 401);
    console.error("[submit-kyc] error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
