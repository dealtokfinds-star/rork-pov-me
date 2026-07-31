import { Pool } from "pg";

const pool = new Pool({
  host: "aws-0-us-east-2.pooler.supabase.com",
  port: 6543,
  user: "postgres.ukiriolnxozcofphltza",
  password: "1JS9fYrJpsWHpqSd",
  database: "postgres",
  ssl: { rejectUnauthorized: false, servername: "ukiriolnxozcofphltza.pooler.supabase.com" },
  connectionTimeoutMillis: 15000,
  max: 3,
});

async function main() {
  const client = await pool.connect();
  console.log("Connected\n");

  // 1. Check auth.uid() owner
  const { rows: ownerInfo } = await client.query(`
    select p.proname, pg_get_userbyid(p.proowner) as owner, n.nspname
    from pg_proc p
    join pg_namespace n on p.pronamespace = n.oid
    where n.nspname = 'auth' and p.proname = 'uid'
  `);
  console.log("--- auth.uid() owner ---");
  for (const r of ownerInfo) console.log(`  ${r.nspname}.${r.proname} owner: ${r.owner}`);

  // 2. Check current user and superuser status
  const { rows: me } = await client.query(`select current_user, current_setting('role') as role, (select rolsuper from pg_roles where rolname=current_user) as is_super`);
  console.log("\n--- Current user ---");
  for (const r of me) console.log(`  user: ${r.current_user}, role: ${r.role}, super: ${r.is_super}`);

  // 3. Try to change owner and then recreate
  console.log("\n--- Attempting to alter auth.uid() ---");
  try {
    await client.query(`alter function auth.uid() owner to postgres`);
    console.log("  alter owner OK");
  } catch (err: any) {
    console.log("  alter owner FAILED:", err.message);
  }

  // 4. Try to drop and recreate
  try {
    await client.query(`drop function auth.uid()`);
    console.log("  drop OK");
  } catch (err: any) {
    console.log("  drop FAILED:", err.message);
  }

  // 5. Try to create or replace
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
            when coalesce(
                   nullif(current_setting('request.jwt.claims', true), ''),
                   '{}'
                 )::jsonb ->> 'sub' ~
                 '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              then (coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb ->> 'sub')::uuid
            else null
          end
      $$;
    `);
    console.log("  create or replace OK");
  } catch (err: any) {
    console.log("  create or replace FAILED:", err.message);
  }

  // 6. Verify
  try {
    await client.query(`set request.jwt.claim.sub = 'usr_5tjn4m2iakyd3v19zb0xy81d'`);
    const { rows } = await client.query(`select auth.uid() as uid`);
    console.log("  auth.uid() with usr_...:", rows[0]?.uid, "(should be null)");
  } catch (err: any) {
    console.log("  verify FAILED:", err.message);
  }

  try {
    await client.query(`set request.jwt.claim.sub = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'`);
    const { rows } = await client.query(`select auth.uid() as uid`);
    console.log("  auth.uid() with valid UUID:", rows[0]?.uid);
  } catch (err: any) {
    console.log("  verify UUID FAILED:", err.message);
  }

  // Reset
  try { await client.query(`reset request.jwt.claim.sub`); } catch {}

  client.release();
  await pool.end();
}
main().catch((e) => { console.error("Fatal:", e.message); process.exit(1); });
