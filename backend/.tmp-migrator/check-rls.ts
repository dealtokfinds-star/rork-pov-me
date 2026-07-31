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

  // Check auth.uid() definition
  const { rows: uidDef } = await client.query(`
    select pg_get_functiondef(oid) as def
    from pg_proc
    where proname = 'uid' and pronamespace = 'auth'::regnamespace
  `);
  console.log("--- auth.uid() definition ---");
  for (const r of uidDef) console.log(r.def);

  // Check if there's a public.user_id() function
  const { rows: userIdDef } = await client.query(`
    select pg_get_functiondef(oid) as def
    from pg_proc
    where proname = 'user_id' and pronamespace = 'public'::regnamespace
  `);
  console.log("\n--- public.user_id() definition ---");
  for (const r of userIdDef) console.log(r.def);

  // Check all RLS policies that reference auth.uid()
  const { rows: policies } = await client.query(`
    select tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
    and (qual::text like '%auth.uid%' or with_check::text like '%auth.uid%')
    order by tablename, policyname
  `);
  console.log(`\n--- RLS policies using auth.uid() (${policies.length}) ---`);
  for (const p of policies) {
    console.log(`  ${p.tablename}.${p.policyname}`);
    if (p.qual) console.log(`    USING: ${p.qual}`);
    if (p.with_check) console.log(`    CHECK: ${p.with_check}`);
  }

  // Count total policies
  const { rows: total } = await client.query(`
    select count(*) as cnt from pg_policies where schemaname='public'
  `);
  console.log(`\nTotal public policies: ${total[0].cnt}`);

  client.release();
  await pool.end();
}
main().catch((e) => { console.error("Fatal:", e.message); process.exit(1); });
