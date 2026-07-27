import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import type { PovCategory } from "@/types";

/**
 * Account model — the signed-in user's row in `profiles`.
 *
 * The row is the canonical account record: id, role flags (is_creator,
 * is_admin), handle, display name, avatar, bio, identity, location,
 * categories/interests, KYC + Stripe Connect state, wallet balance, etc.
 *
 * RLS ensures a user can only SELECT/UPDATE their own row; reads of other
 * profiles are allowed for public creator pages (see profiles_select_public).
 */

export interface Account {
  id: string;
  email: string | null;
  name: string | null;
  handle: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  bio: string | null;
  identity: string | null;
  location: string | null;
  categories: PovCategory[] | null;
  interests: PovCategory[] | null;
  isCreator: boolean;
  isAdmin: boolean;
  onboarded: boolean;
  verified: boolean;
  subPrice: number | null;
  walletBalance: number;
  totalSpent: number;
  // KYC + Stripe Connect state (managed by edge functions; read-only here)
  kycStatus: string;
  kycVerifiedAt: string | null;
  stripeAccountId: string | null;
  stripeAccountStatus: string;
  stripePayoutsEnabled: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

type ProfileRow = {
  id: string;
  email: string | null;
  name: string | null;
  handle: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
  identity: string | null;
  location: string | null;
  categories: string[] | null;
  interests: string[] | null;
  is_creator: boolean | null;
  is_admin: boolean | null;
  onboarded: boolean | null;
  verified: boolean | null;
  sub_price: number | null;
  wallet_balance: number | null;
  total_spent: number | null;
  kyc_status: string | null;
  kyc_verified_at: string | null;
  stripe_account_id: string | null;
  stripe_account_status: string | null;
  stripe_payouts_enabled: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

function mapAccount(row: ProfileRow): Account {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    handle: row.handle,
    avatarUrl: row.avatar_url,
    coverUrl: row.cover_url,
    bio: row.bio,
    identity: row.identity,
    location: row.location,
    categories: (row.categories ?? []) as PovCategory[],
    interests: (row.interests ?? []) as PovCategory[],
    isCreator: row.is_creator ?? false,
    isAdmin: row.is_admin ?? false,
    onboarded: row.onboarded ?? false,
    verified: row.verified ?? false,
    subPrice: row.sub_price,
    walletBalance: Number(row.wallet_balance ?? 0),
    totalSpent: Number(row.total_spent ?? 0),
    kycStatus: row.kyc_status ?? "unverified",
    kycVerifiedAt: row.kyc_verified_at,
    stripeAccountId: row.stripe_account_id,
    stripeAccountStatus: row.stripe_account_status ?? "none",
    stripePayoutsEnabled: row.stripe_payouts_enabled ?? false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const PROFILE_SELECT =
  "id, email, name, handle, avatar_url, cover_url, bio, identity, location, categories, interests, is_creator, is_admin, onboarded, verified, sub_price, wallet_balance, total_spent, kyc_status, kyc_verified_at, stripe_account_id, stripe_account_status, stripe_payouts_enabled, created_at, updated_at";

async function fetchAccount(userId: string): Promise<Account | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("[povme] fetchAccount:", error.message);
    throw error;
  }
  if (!data) return null;
  return mapAccount(data as ProfileRow);
}

/** Live account row for the signed-in user. `null` while loading or if no row exists yet. */
export function useProfile() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const query = useQuery<Account | null>({
    queryKey: ["profile", "me", userId],
    queryFn: () => (userId ? fetchAccount(userId) : Promise.resolve(null)),
    enabled: !!userId,
    staleTime: 30_000,
  });

  const updateMutation = useMutation({
    mutationFn: async (input: Partial<AccountUpdateInput>): Promise<Account> => {
      if (!userId) throw new Error("Not signed in");
      const row: Record<string, unknown> = {};
      if (input.name !== undefined) row.name = input.name;
      if (input.handle !== undefined) row.handle = input.handle?.toLowerCase().replace(/\s+/g, "") || null;
      if (input.avatarUrl !== undefined) row.avatar_url = input.avatarUrl;
      if (input.coverUrl !== undefined) row.cover_url = input.coverUrl;
      if (input.bio !== undefined) row.bio = input.bio;
      if (input.identity !== undefined) row.identity = input.identity;
      if (input.location !== undefined) row.location = input.location;
      if (input.categories !== undefined) row.categories = input.categories;
      if (input.interests !== undefined) row.interests = input.interests;
      if (input.isCreator !== undefined) row.is_creator = input.isCreator;
      if (input.onboarded !== undefined) row.onboarded = input.onboarded;
      if (input.subPrice !== undefined) row.sub_price = input.subPrice;
      row.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from("profiles")
        .update(row)
        .eq("id", userId)
        .select(PROFILE_SELECT)
        .maybeSingle();

      if (error) {
        console.error("[povme] updateProfile:", error.message);
        throw error;
      }
      if (!data) throw new Error("Profile not found");
      return mapAccount(data as ProfileRow);
    },
    onSuccess: (account) => {
      queryClient.setQueryData(["profile", "me", userId], account);
      queryClient.invalidateQueries({ queryKey: ["creator", account.id] });
    },
  });

  return {
    account: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    updateProfile: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
  };
}

export interface AccountUpdateInput {
  name: string | null;
  handle: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  bio: string | null;
  identity: string | null;
  location: string | null;
  categories: PovCategory[];
  interests: PovCategory[];
  isCreator: boolean;
  onboarded: boolean;
  subPrice: number;
}

/** Convenience: only the fields safe for the user to edit from settings. */
export type EditableProfileFields = Pick<
  AccountUpdateInput,
  "name" | "handle" | "bio" | "avatarUrl" | "coverUrl" | "location"
>;

/** Convenience: only the fields set during fan onboarding. */
export type OnboardingProfileFields = Pick<
  AccountUpdateInput,
  "name" | "handle" | "interests" | "onboarded"
>;
