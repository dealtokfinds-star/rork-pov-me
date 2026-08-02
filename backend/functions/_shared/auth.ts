import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export interface AuthUser {
  userId: string;
  email?: string;
  name?: string;
}

/**
 * Verify the Supabase Auth JWT from the Authorization header by asking
 * Supabase's GoTrue service to resolve the user. Returns the user's id
 * (UUID string), email, and display name on success.
 */
export async function requireAuth(req: Request): Promise<AuthUser> {
  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) throw new Error("Missing token");

    const client = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
      },
    );

    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) {
      throw new Error(error?.message ?? "Authentication failed");
    }

    return {
      userId: user.id,
      email: user.email ?? undefined,
      name:
        (user.user_metadata?.full_name as string | undefined) ??
        (user.user_metadata?.name as string | undefined),
    };
  } catch (err) {
    if (err instanceof AuthError) throw err;
    throw new AuthError(
      err instanceof Error ? err.message : "Authentication failed",
    );
  }
}

/** Supabase client scoped to the user's JWT — RLS applies. */
export function createUserClient(req: Request) {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization")! } },
  });
}

/** Service-role Supabase client — bypasses RLS. Use only when RLS is insufficient. */
export function createAdminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
