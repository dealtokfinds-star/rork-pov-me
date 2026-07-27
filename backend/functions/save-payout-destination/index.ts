import { requireAuth, createAdminClient, AuthError, corsHeaders, json } from "../_shared/auth.ts";

/**
 * POST /save-payout-destination
 * Saves the creator's payout destination. Replaces the legacy manual-handle
 * flow with a richer model that supports:
 *   - usdc:      USDC stablecoin wallet (Ethereum/Polygon/Base/Solana)
 *   - bank:      US bank ACH (account + routing, we store last4 only)
 *   - paypal/venmo/cashapp/zelle:  P2P handles (legacy, still supported)
 *
 * Body:
 *   {
 *     kind: "usdc" | "bank" | "paypal" | "venmo" | "cashapp" | "zelle",
 *     address?: string,        // crypto wallet address (usdc) OR full bank account # (bank)
 *     network?: string,        // "ethereum"|"polygon"|"base"|"solana" (usdc) OR "ach" (bank)
 *     handle?: string,         // P2P handle (paypal/venmo/cashapp/zelle)
 *     label?: string,          // user-facing nickname, e.g. "My USDC wallet"
 *   }
 *
 * Returns: { ok: true, destination: { kind, summary, label } }
 *
 * Security notes:
 *   - Bank account numbers are never returned to the client after save.
 *     We store the full account # in payout_address (server-side only) and
 *     expose payout_account_last4 for display.
 *   - Crypto addresses are stored as-is and may be redisplayed (they're public).
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const user = await requireAuth(req);
    const body = await req.json().catch(() => ({})) as {
      kind?: string;
      address?: string;
      network?: string;
      handle?: string;
      label?: string;
    };

    const kind = (body.kind ?? "").toLowerCase().trim();
    const VALID_KINDS = ["usdc", "bank", "paypal", "venmo", "cashapp", "zelle"];
    if (!VALID_KINDS.includes(kind)) {
      return json({ error: `kind must be one of: ${VALID_KINDS.join(", ")}` }, 400);
    }

    const now = new Date().toISOString();
    const admin = createAdminClient();

    // ---- Validate per-kind inputs and build the update payload ----
    const update: Record<string, string | null> = {
      updated_at: now,
      stripe_account_status: "manual",
      stripe_payouts_enabled: true,
      payout_label: (body.label ?? "").trim().slice(0, 40) || null,
    };

    if (kind === "usdc") {
      const address = (body.address ?? "").trim();
      const network = (body.network ?? "").toLowerCase().trim();
      const VALID_NETS = ["ethereum", "polygon", "base", "solana"];
      if (!VALID_NETS.includes(network)) {
        return json({ error: `network must be one of: ${VALID_NETS.join(", ")}` }, 400);
      }
      if (address.length < 32 || address.length > 64) {
        return json({ error: "Enter a valid wallet address (32–64 chars)" }, 400);
      }
      update.payout_method = "usdc";
      update.payout_handle = null;
      update.payout_address = address;
      update.payout_network = network;
      update.payout_account_last4 = address.slice(-6);
    } else if (kind === "bank") {
      const account = (body.address ?? "").replace(/\s|-/g, "");
      const network = "ach";
      if (!/^\d{6,17}$/.test(account)) {
        return json({ error: "Enter a valid US bank account number (6–17 digits)" }, 400);
      }
      update.payout_method = "bank";
      update.payout_handle = null;
      update.payout_address = account;
      update.payout_network = network;
      update.payout_account_last4 = account.slice(-4);
    } else {
      // P2P handles (paypal/venmo/cashapp/zelle)
      const handle = (body.handle ?? "").trim();
      if (handle.length < 3) {
        return json({ error: "Payout handle is too short" }, 400);
      }
      if (handle.length > 120) {
        return json({ error: "Payout handle is too long" }, 400);
      }
      update.payout_method = kind;
      update.payout_handle = handle;
      update.payout_address = null;
      update.payout_network = null;
      update.payout_account_last4 = null;
    }

    const { error } = await admin.from("profiles").update(update).eq("id", user.userId);
    if (error) {
      console.error("[save-payout-destination] error:", error.message);
      return json({ error: "Could not save payout destination" }, 500);
    }

    // Build a display summary the client can show without re-fetching
    let summary = "";
    if (kind === "usdc") {
      summary = `USDC · ${(body.network ?? "").toUpperCase()} · …${update.payout_account_last4}`;
    } else if (kind === "bank") {
      summary = `Bank · ACH · ••${update.payout_account_last4}`;
    } else {
      summary = `${kind} · ${(body.handle ?? "").trim()}`;
    }

    return json({
      ok: true,
      destination: {
        kind,
        summary,
        label: update.payout_label,
      },
    });
  } catch (err) {
    if (err instanceof AuthError) return json({ error: "Unauthorized" }, 401);
    console.error("[save-payout-destination] error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
