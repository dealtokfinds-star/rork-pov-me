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

  // All RLS policies across ALL tables that reference auth.uid()
  const { rows: policies } = await client.query(`
    select tablename, policyname, cmd, qual, with_check
    from pg_policies
    where schemaname='public'
      and (qual::text like '%auth.uid%' or with_check::text like '%auth.uid%')
    order by tablename, policyname
  `);
  console.log(`--- RLS policies using auth.uid() (${policies.length}) ---`);
  for (const p of policies) {
    console.log(`  ${p.tablename}.${p.policyname} [${p.cmd}]`);
    console.log(`    USING:  ${p.qual ?? "NULL"}`);
    console.log(`    CHECK:  ${p.with_check ?? "NULL"}`);
  }

  // Also check for ::uuid casts in any policy
  const { rows: uuidPolicies } = await client.query(`
    select tablename, policyname, cmd, qual, with_check
    from pg_policies
    where schemaname='public'
      and (qual::text like '%::uuid%' or with_check::text like '%::uuid%')
    order by tablename, policyname
  `);
  console.log(`\n--- RLS policies with ::uuid cast (${uuidPolicies.length}) ---`);
  for (const p of uuidPolicies) {
    console.log(`  ${p.tablename}.${p.policyname} [${p.cmd}]`);
    console.log(`    USING:  ${p.qual ?? "NULL"}`);
    console.log(`    CHECK:  ${p.with_check ?? "NULL"}`);
  }

  // Check all policies on episodes and transactions specifically
  for (const table of ["episodes", "transactions", "live_streams", "chat_messages", "subscriptions", "unlocks", "tips", "saves", "likes"]) {
    const { rows: tablePolicies } = await client.query(`
      select policyname, cmd, qual, with_check
      from pg_policies
      where schemaname='public' and tablename='${table}'
      order by policyname
    `);
    console.log(`\n--- ${table} policies (${tablePolicies.length}) ---`);
    for (const p of tablePolicies) {
      console.log(`  ${p.policyname} [${p.cmd}]`);
      console.log(`    USING:  ${p.qual ?? "NULL"}`);
      console.log(`    CHECK:  ${p.with_check ?? "NULL"}`);
    }
  }

  client.release();
  await pool.end();
}
main().catch((e) => { console.error("Fatal:", e.message); process.exit(1); });
