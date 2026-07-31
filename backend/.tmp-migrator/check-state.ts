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

  // 1. Check remaining RLS policies
  console.log("=== Current RLS policies ===");
  const { rows: policies } = await client.query(
    "select tablename, policyname from pg_policies where schemaname='public' order by tablename, policyname"
  );
  console.log(`Total policies: ${policies.length}`);
  for (const p of policies) console.log(`  ${p.tablename}: ${p.policyname}`);

  // 2. Check FK constraints
  console.log("\n=== Current FK constraints ===");
  const { rows: fks } = await client.query(
    `select tc.table_name, kcu.column_name, tc.constraint_name
     from information_schema.table_constraints tc
     join information_schema.key_column_usage kcu on tc.constraint_name = kcu.constraint_name
     where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema='public'
     order by tc.table_name, kcu.column_name`
  );
  console.log(`Total FKs: ${fks.length}`);
  for (const f of fks) console.log(`  ${f.table_name}.${f.column_name}: ${f.constraint_name}`);

  // 3. Check views
  console.log("\n=== Current views ===");
  const { rows: views } = await client.query(
    "select viewname from pg_views where schemaname='public' order by viewname"
  );
  console.log(`Views: ${views.length}`);
  for (const v of views) console.log(`  ${v.viewname}`);

  // 4. Check bump_dm_thread
  console.log("\n=== bump_dm_thread ===");
  const { rows: rpc } = await client.query(
    "select routine_name, data_type from information_schema.routines where routine_schema='public' and routine_name='bump_dm_thread'"
  );
  for (const r of rpc) console.log(`  ${r.routine_name} -> ${r.data_type}`);
  if (rpc.length === 0) console.log("  (not found)");

  // 5. Check all user-id column types
  console.log("\n=== User-id column types ===");
  const { rows: cols } = await client.query(
    `select table_name, column_name, data_type from information_schema.columns 
     where table_schema='public' 
     and column_name in ('id','creator_id','fan_id','user_id','sender_id','reporter_id','target_user_id','assigned_admin_id','processed_by','reviewer_id','admin_id','kyc_reviewed_by')
     and table_name in ('profiles','episodes','live_streams','subscriptions','transactions','tips','unlocks','chat_messages','dm_threads','dm_messages','events','reports','payouts','payout_requests','push_tokens','email_log','verification_docs','audit_logs')
     order by table_name, column_name`
  );
  let allText = true;
  for (const c of cols) {
    const ok = c.data_type === "text";
    if (!ok) allText = false;
    console.log(`  ${c.table_name}.${c.column_name}: ${c.data_type} ${ok ? "✓" : "✗"}`);
  }
  console.log(`\nAll user-id columns are text: ${allText ? "YES ✓" : "NO ✗"}`);

  client.release();
  await pool.end();
}
main().catch((e) => { console.error("Fatal:", e.message); process.exit(1); });
