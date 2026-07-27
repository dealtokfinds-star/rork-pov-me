import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";
import { callEdge } from "@/lib/edge";

/**
 * Admin & moderation — for is_admin users only.
 *
 * - Loads the reports queue (open/assigned/resolved)
 * - Loads the platform revenue dashboard (aggregated transactions)
 * - Loads all creators + their KYC/payout status for moderation
 * - Loads pending creator applications (kyc_status='pending') for review
 * - adminAction() calls the admin-actions edge function (suspend, reinstate,
 *   hold payout, resolve report, delete episode/stream, set admin,
 *   approve_creator, reject_creator, fulfill_payout)
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
  created_at: string | null;
}

export interface PendingApplicationRow {
  id: string;
  name: string | null;
  handle: string | null;
  email: string | null;
  avatar_url: string | null;
  identity: string | null;
  categories: string[] | null;
  sub_price: number | null;
  location: string | null;
  kyc_status: string | null;
  kyc_documents: { front: string; back: string; selfie: string } | null;
  kyc_submitted_at: string | null;
  kyc_last_reason: string | null;
  payout_method: string | null;
  payout_paypal_email: string | null;
  payout_bank_account_last4: string | null;
  payout_bank_country: string | null;
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
  const [applications, setApplications] = useState<PendingApplicationRow[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [reportsRes, creatorsRes, revenueRes, appsRes] = await Promise.all([
        supabase.from("reports").select("*").order("created_at", { ascending: false }).limit(100),
        supabase
          .from("profiles")
          .select("id, name, handle, avatar_url, is_creator, kyc_status, stripe_payouts_enabled, stripe_account_status, lifetime_earnings, payout_balance, created_at")
          .eq("is_creator", true)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase.from("platform_revenue").select("*").order("day", { ascending: false }).limit(30),
        supabase
          .from("profiles")
          .select("id, name, handle, email, avatar_url, identity, categories, sub_price, location, kyc_status, kyc_documents, kyc_submitted_at, kyc_last_reason, payout_method, payout_paypal_email, payout_bank_account_last4, payout_bank_country")
          .eq("kyc_status", "pending")
          .order("kyc_submitted_at", { ascending: false })
          .limit(50),
      ]);

      if (reportsRes.data) setReports(reportsRes.data as ReportRow[]);
      if (creatorsRes.data) setCreators(creatorsRes.data as AdminCreatorRow[]);
      if (revenueRes.data) setRevenue(revenueRes.data as PlatformRevenueRow[]);
      if (appsRes.data) setApplications(appsRes.data as PendingApplicationRow[]);
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

  /** Approve a creator's KYC application. */
  const approveCreator = useCallback(
    (userId: string): Promise<{ ok: boolean; error?: string }> =>
      adminAction("approve_creator", { user_id: userId }),
    [adminAction],
  );

  /** Reject a creator's KYC application with a reason. */
  const rejectCreator = useCallback(
    (userId: string, reason: string): Promise<{ ok: boolean; error?: string }> =>
      adminAction("reject_creator", { user_id: userId, reason }),
    [adminAction],
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
    applications,
    isLoading,
    refetch: loadAll,
    adminAction,
    approveCreator,
    rejectCreator,
    fileReport,
  };
}
