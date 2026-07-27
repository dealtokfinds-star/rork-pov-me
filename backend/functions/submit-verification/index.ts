import { requireAuth, createAdminClient, AuthError, corsHeaders, json } from "../_shared/auth.ts";

/**
 * POST /submit-verification
 * Self-attestation + ID upload verification (replaces Stripe Identity).
 *
 * Body: {
 *   legal_name: string,
 *   date_of_birth: string (YYYY-MM-DD),
 *   storage_path: string,        // path in the `verification` bucket
 *   doc_type?: string,           // default 'government_id'
 * }
 *
 * Records the uploaded doc in verification_docs and flips kyc_status to 'pending'.
 * An admin reviews in the admin queue and sets verified/failed.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const user = await requireAuth(req);
    const body = await req.json().catch(() => ({})) as {
      legal_name?: string;
      date_of_birth?: string;
      storage_path?: string;
      doc_type?: string;
    };

    if (!body.legal_name?.trim()) return json({ error: "Legal name is required" }, 400);
    if (!body.date_of_birth) return json({ error: "Date of birth is required" }, 400);
    if (!body.storage_path?.trim()) return json({ error: "ID photo is required" }, 400);

    // 18+ check
    const dob = new Date(body.date_of_birth);
    if (isNaN(dob.getTime())) return json({ error: "Invalid date of birth" }, 400);
    const ageMs = Date.now() - dob.getTime();
    const ageYears = ageMs / (1000 * 60 * 60 * 24 * 365.25);
    if (ageYears < 18) return json({ error: "You must be 18 or older" }, 403);

    const admin = createAdminClient();
    const now = new Date().toISOString();

    // Upsert identity fields + mark KYC pending
    const { error: profileErr } = await admin.from("profiles").update({
      legal_name: body.legal_name.trim(),
      date_of_birth: body.date_of_birth,
      kyc_status: "pending",
      kyc_last_reason: null,
      agreed_to_terms_at: now,
      updated_at: now,
    }).eq("id", user.userId);
    if (profileErr) {
      console.error("[submit-verification] profile update:", profileErr.message);
      return json({ error: "Could not update profile" }, 500);
    }

    // Insert doc row
    const { error: docErr } = await admin.from("verification_docs").insert({
      user_id: user.userId,
      storage_path: body.storage_path.trim(),
      doc_type: body.doc_type ?? "government_id",
      status: "pending",
      uploaded_at: now,
    });
    if (docErr) {
      console.error("[submit-verification] doc insert:", docErr.message);
      return json({ error: "Could not record document" }, 500);
    }

    return json({ ok: true, status: "pending" });
  } catch (err) {
    if (err instanceof AuthError) return json({ error: "Unauthorized" }, 401);
    console.error("[submit-verification] error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
