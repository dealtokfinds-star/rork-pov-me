import { requireAuth, createAdminClient, AuthError, corsHeaders, json } from "../_shared/auth.ts";
import { sendEmailInternal } from "../send-email/index.ts";

/**
 * POST /submit-kyc
 * Body: {
 *   documents: {
 *     front: { data: string, contentType: string },  // data = base64 (no data: prefix)
 *     back:  { data: string, contentType: string },
 *     selfie:{ data: string, contentType: string },
 *   }
 * }
 *
 * Creator submits their KYC documents. The client sends base64-encoded image
 * bytes; this function uploads them to the `kyc-documents` storage bucket
 * using the service-role admin client (bypassing client-side RLS and CORS
 * entirely — the bucket is private and only the service role + the owning
 * user's RLS policy can write). Auto-approves immediately: `kyc_status` is
 * set to `verified` on submit so the creator can go live without waiting for
 * admin review. The admin review queue still receives the submission
 * notification (for spot-checks / audits), but it no longer gates activation.
 *
 * Documents are stored under `kyc-documents/{userId}/{front|back|selfie}.{ext}`.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const user = await requireAuth(req);
    const body = await req.json().catch(() => ({})) as {
      documents?: {
        front?: { data?: string; contentType?: string };
        back?: { data?: string; contentType?: string };
        selfie?: { data?: string; contentType?: string };
      };
    };

    const docs = body.documents;
    if (!docs?.front?.data || !docs.back?.data || !docs.selfie?.data) {
      return json(
        { error: "Front, back, and selfie images (as base64) are all required" },
        400,
      );
    }

    const admin = createAdminClient();
    const now = new Date().toISOString();

    // Upload each document to storage using the service-role client.
    // Service role bypasses RLS, so no storage policy is needed for the
    // server-side write. The bucket is private.
    const paths: Record<string, string> = {};
    const kinds: Array<"front" | "back" | "selfie"> = ["front", "back", "selfie"];
    for (const kind of kinds) {
      const doc = docs[kind]!;
      const contentType = doc.contentType ?? "image/jpeg";
      const ext = contentType === "image/png" ? "png" : "jpg";
      const path = `${user.userId}/${kind}.${ext}`;
      // Decode base64 to binary.
      const binary = atob(doc.data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

      const { error: upErr } = await admin.storage
        .from("kyc-documents")
        .upload(path, bytes, {
          contentType,
          upsert: true,
        });
      if (upErr) {
        console.error(`[submit-kyc] upload ${kind} error:`, upErr.message);
        return json({ error: `Failed to upload ${kind} document` }, 500);
      }
      paths[kind] = path;
    }

    // Auto-approve: set kyc_status to 'verified' immediately.
    const { error } = await admin.from("profiles").update({
      kyc_status: "verified",
      kyc_documents: paths,
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
