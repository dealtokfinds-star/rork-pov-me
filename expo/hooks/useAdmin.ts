import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";
import { callEdge } from "@/lib/edge";

/**
 * Admin & moderation — for is_admin users only.
 *
 * - Loads the reports queue (open/assigned/resolved)
 * - Loads the platform revenue dashboard (aggregated transactions)
 * - Loads all creators + their KYC/payout status for moderation
 * - adminAction() calls the admin-actions edge function (suspend, reinstate,
 *   hold payout, resolve report, delete episode/stream, set admin)
 */

export interface ReportRow {
  id: string;
  reporter_id: string;
  target_type: string;
  target_id: string;
  target_user_id: string | null;
  reason: string;
  details: string | null;
  status: string;
  assigned_admin_id: string | null;
  resolution: string | null;
  resolved_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface AdminCreatorRow {
  id: string;
  name: string | null;
  handle: string | null;
  avatar_url: string | null;
  is_creator: boolean | null;
  kyc_status: string | null;
  stripe_payouts_enabled: boolean | null;
  stripe_account_status: string | null;
  lifetime_earnings: number | null;
  payout_balance: number | null;
  payout_method: string | null;
  payout_handle: string | null;
  legal_name: string | null;
  created_at: string | null;
}

export interface VerificationDocRow {
  id: string;
  user_id: string;
  storage_path: string;
  doc_type: string;
  status: string;
  review_note: string | null;
  uploaded_at: string | null;
  reviewed_at: string | null;
  name: string | null;
  handle: string | null;
  legal_name: string | null;
}

export interface PayoutRequestRow {
  id: string;
  creator_id: string;
  amount: number;
  status: string;
  /** Stripe payout method (e.g. "standard"). */
  method: string | null;
  /** Stripe payout id (po_...). */
  stripe_payout_id: string | null;
  /** Reason if Stripe marked the payout failed. */
  failure_reason: string | null;
  requested_at: string | null;
  processed_at: string | null;
  name: string | null;
  handle: string | null;
}

export interface PlatformRevenueRow {
  day: string;
  kind: string;
  tx_count: number;
  gross: number;
  platform_cut: number;
  creator_cut: number;
}

export function useAdmin() {
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [creators, setCreators] = useState<AdminCreatorRow[]>([]);
  const [revenue, setRevenue] = useState<PlatformRevenueRow[]>([]);
  const [verifications, setVerifications] = useState<VerificationDocRow[]>([]);
  const [payoutRequests, setPayoutRequests] = useState<PayoutRequestRow[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [reportsRes, creatorsRes, revenueRes, verifRes, payoutRes] = await Promise.all([
        supabase.from("reports").select("*").order("created_at", { ascending: false }).limit(100),
        supabase
          .from("profiles")
          .select("id, name, handle, avatar_url, is_creator, kyc_status, stripe_payouts_enabled, stripe_account_status, lifetime_earnings, payout_balance, payout_method, payout_handle, legal_name, created_at")
          .eq("is_creator", true)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase.from("platform_revenue").select("*").order("day", { ascending: false }).limit(30),
        supabase
          .from("verification_docs")
          .select("id, user_id, storage_path, doc_type, status, review_note, uploaded_at, reviewed_at, name:profiles!verification_docs_user_id_fkey(name), handle:profiles!verification_docs_user_id_fkey(handle), legal_name:profiles!verification_docs_user_id_fkey(legal_name)")
          .order("uploaded_at", { ascending: false })
          .limit(50),
        supabase
          .from("payouts")
          .select("id, creator_id, amount, status, method, stripe_payout_id, failure_reason, requested_at, processed_at, name:profiles!payouts_creator_id_fkey(name), handle:profiles!payouts_creator_id_fkey(handle)")
          .order("requested_at", { ascending: false })
          .limit(50),
      ]);

      if (reportsRes.data) setReports(reportsRes.data as ReportRow[]);
      if (creatorsRes.data) setCreators(creatorsRes.data as AdminCreatorRow[]);
      if (revenueRes.data) setRevenue(revenueRes.data as PlatformRevenueRow[]);
      if (verifRes.data) setVerifications((verifRes.data as unknown[]).map((r) => flattenJoin(r, ["name", "handle", "legal_name"])) as unknown as VerificationDocRow[]);
      if (payoutRes.data) setPayoutRequests((payoutRes.data as unknown[]).map((r) => flattenJoin(r, ["name", "handle"])) as unknown as PayoutRequestRow[]);
    } catch (err) {
      console.error("[povme] useAdmin load failed", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const adminAction = useCallback(
    async (action: string, payload: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> => {
      try {
        await callEdge("admin-actions", { action, ...payload });
        // Refresh data after a successful action
        void loadAll();
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Action failed" };
      }
    },
    [loadAll],
  );

  /** File a report (available to all users, not just admins). */
  const fileReport = useCallback(
    async (input: {
      targetType: string;
      targetId: string;
      targetUserId?: string;
      reason: string;
      details?: string;
    }): Promise<{ ok: boolean; error?: string }> => {
      try {
        const { error } = await supabase.from("reports").insert({
          target_type: input.targetType,
          target_id: input.targetId,
          target_user_id: input.targetUserId ?? null,
          reason: input.reason,
          details: input.details ?? null,
        });
        if (error) throw error;
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Failed to report" };
      }
    },
    [],
  );

  return {
    reports,
    creators,
    revenue,
    verifications,
    payoutRequests,
    isLoading,
    refetch: loadAll,
    adminAction,
    fileReport,
  };
}

/** Flatten a PostgREST join payload: { name: { name: "X" } } → { name: "X" }. */
function flattenJoin(row: unknown, fields: string[]): Record<string, unknown> {
  const r = row as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(r)) {
    if (fields.includes(k) && r[k] && typeof r[k] === "object") {
      const inner = r[k] as Record<string, unknown>;
      // Take the first non-null scalar
      const val = inner.name ?? inner.handle ?? inner.legal_name ?? Object.values(inner)[0] ?? null;
      out[k] = val;
    } else {
      out[k] = r[k];
    }
  }
  return out;
}
