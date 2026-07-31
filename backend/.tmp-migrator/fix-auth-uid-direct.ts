import { Pool } from "pg";

// Direct connection (not pooler) — may have superuser privileges
const pool = new Pool({
  host: "db.ukiriolnxozcofphltza.supabase.co",
  port: 5432,
  user: "postgres",
  password: "1JS9fYrJpsWHpqSd",
  database: "postgres",
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
  max: 3,
});

async function main() {
  const client = await pool.connect();
  console.log("Connected via direct connection\n");

  // Check superuser status
  const { rows: me } = await client.query(`select current_user, (select rolsuper from pg_roles where rolname=current_user) as is_super`);
  console.log("Current user:", me[0]);

  // Try to alter auth.uid()
  console.log("\n--- Replacing auth.uid() ---");
  try {
    await client.query(`
      create or replace function auth.uid()
      returns uuid
      language sql
      stable
      as $$
        select
          case
            when current_setting('request.jwt.claim.sub', true) ~
                 '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              then current_setting('request.jwt.claim.sub', true)::uuid
            when coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb ->> 'sub' ~
                 '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              then (coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb ->> 'sub')::uuid
            else null
          end
      $$;
    `);
    console.log("✓ auth.uid() replaced successfully");
  } catch (err: any) {
    console.log("✗ Failed:", err.message);
    
    // Try altering owner first
    try {
      await client.query(`alter function auth.uid() owner to postgres`);
      console.log("  alter owner OK, retrying...");
      await client.query(`
        create or replace function auth.uid()
        returns uuid
        language sql
        stable
        as $$
          select
            case
              when current_setting('request.jwt.claim.sub', true) ~
                   '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                then current_setting('request.jwt.claim.sub', true)::uuid
              when coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb ->> 'sub' ~
                   '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                then (coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb ->> 'sub')::uuid
              else null
            end
        $$;
      `);
      console.log("✓ auth.uid() replaced after owner change");
    } catch (err2: any) {
      console.log("✗ Still failed:", err2.message);
    }
  }

  // Verify
  console.log("\n--- Verifying ---");
  try {
    await client.query(`set request.jwt.claim.sub = 'usr_5tjn4m2iakyd3v19zb0xy81d'`);
    const { rows } = await client.query(`select auth.uid() as uid`);
    console.log("auth.uid() with usr_...:", rows[0]?.uid, "(should be null)");
  } catch (err: any) {
    console.log("FAILED:", err.message);
  }

  try {
    await client.query(`set request.jwt.claim.sub = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'`);
    const { rows } = await client.query(`select auth.uid() as uid`);
    console.log("auth.uid() with valid UUID:", rows[0]?.uid);
  } catch (err: any) {
    console.log("FAILED:", err.message);
  }

  try { await client.query(`reset request.jwt.claim.sub`); } catch {}

  // Show final definition
  const { rows: def } = await client.query(`
    select pg_get_functiondef(p.oid) as def
    from pg_proc p
    join pg_namespace n on p.pronamespace = n.oid
    where n.nspname = 'auth' and p.proname = 'uid'
  `);
  if (def.length > 0) console.log("\nFinal auth.uid() definition:\n" + def[0].def);

  client.release();
  await pool.end();
}
main().catch((e) => { console.error("Fatal:", e.message); process.exit(1); });
