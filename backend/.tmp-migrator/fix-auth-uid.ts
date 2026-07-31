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

  // 1. Test: does the episodes query fail as anon with a usr_... JWT?
  console.log("--- Test 1: episodes query as anon with usr_... JWT ---");
  try {
    await client.query(`set role anon`);
    await client.query(`set request.jwt.claim.sub = 'usr_5tjn4m2iakyd3v19zb0xy81d'`);
    await client.query(`set request.jwt.claims = '{"sub":"usr_5tjn4m2iakyd3v19zb0xy81d","role":"authenticated","email":"test@test.com"}'`);
    
    const { rows } = await client.query(`select id, creator_id, title from episodes order by posted_at desc limit 5`);
    console.log("  episodes query OK:", rows.length, "rows");
  } catch (err: any) {
    console.log("  episodes query FAILED:", err.message);
  }

  // 2. Test: transactions query as anon with usr_... JWT  
  console.log("\n--- Test 2: transactions query as anon with usr_... JWT ---");
  try {
    const { rows } = await client.query(`select id, kind, amount from transactions where user_id = 'usr_5tjn4m2iakyd3v19zb0xy81d' limit 5`);
    console.log("  transactions query OK:", rows.length, "rows");
  } catch (err: any) {
    console.log("  transactions query FAILED:", err.message);
  }

  // 3. Try dropping auth.uid()
  console.log("\n--- Test 3: drop auth.uid() ---");
  try {
    await client.query(`reset role`); // need superuser to drop
    await client.query(`drop function if exists auth.uid()`);
    console.log("  drop OK — recreating as tolerant");
    await client.query(`
      create function auth.uid()
      returns uuid
      language sql
      stable
      as $$
        select
          case
            when current_setting('request.jwt.claim.sub', true) ~
                 '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              then current_setting('request.jwt.claim.sub', true)::uuid
            when (current_setting('request.jwt.claims', true)::jsonb ->> 'sub') ~
                 '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              then (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::uuid
            else null
          end
      $$;
    `);
    console.log("  recreate OK");
  } catch (err: any) {
    console.log("  FAILED:", err.message);
  }

  // 4. Verify the new function
  console.log("\n--- Test 4: verify auth.uid() ---");
  try {
    await client.query(`set request.jwt.claim.sub = 'usr_5tjn4m2iakyd3v19zb0xy81d'`);
    const { rows } = await client.query(`select auth.uid() as uid`);
    console.log("  auth.uid() with usr_...:", rows[0]?.uid, "(should be null)");
  } catch (err: any) {
    console.log("  FAILED:", err.message);
  }

  try {
    await client.query(`set request.jwt.claim.sub = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'`);
    const { rows } = await client.query(`select auth.uid() as uid`);
    console.log("  auth.uid() with valid UUID:", rows[0]?.uid, "(should be the UUID)");
  } catch (err: any) {
    console.log("  FAILED:", err.message);
  }

  // 5. Now test episodes query again as anon
  console.log("\n--- Test 5: episodes query as anon after fix ---");
  try {
    await client.query(`set role anon`);
    await client.query(`set request.jwt.claim.sub = 'usr_5tjn4m2iakyd3v19zb0xy81d'`);
    const { rows } = await client.query(`select id, creator_id, title from episodes order by posted_at desc limit 5`);
    console.log("  episodes query OK:", rows.length, "rows");
  } catch (err: any) {
    console.log("  episodes query FAILED:", err.message);
  }

  // Reset
  try { await client.query(`reset role`); } catch {}
  try { await client.query(`reset request.jwt.claim.sub`); } catch {}
  try { await client.query(`reset request.jwt.claims`); } catch {}

  client.release();
  await pool.end();
}
main().catch((e) => { console.error("Fatal:", e.message); process.exit(1); });
