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
  created_at: string | null;
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
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [reportsRes, creatorsRes, revenueRes] = await Promise.all([
        supabase.from("reports").select("*").order("created_at", { ascending: false }).limit(100),
        supabase
          .from("profiles")
          .select("id, name, handle, avatar_url, is_creator, kyc_status, stripe_payouts_enabled, stripe_account_status, lifetime_earnings, payout_balance, created_at")
          .eq("is_creator", true)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase.from("platform_revenue").select("*").order("day", { ascending: false }).limit(30),
      ]);

      if (reportsRes.data) setReports(reportsRes.data as ReportRow[]);
      if (creatorsRes.data) setCreators(creatorsRes.data as AdminCreatorRow[]);
      if (revenueRes.data) setRevenue(revenueRes.data as PlatformRevenueRow[]);
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
    isLoading,
    refetch: loadAll,
    adminAction,
    fileReport,
  };
}
