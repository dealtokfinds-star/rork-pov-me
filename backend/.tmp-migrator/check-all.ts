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

  // 1. profiles.id type
  const { rows: [profileId] } = await client.query(
    "select data_type, udt_name from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='id'"
  );
  console.log("profiles.id:", profileId?.data_type, profileId?.udt_name);

  // 2. ALL user-id-ish columns across all public tables
  const { rows: userCols } = await client.query(`
    select table_name, column_name, data_type, udt_name
    from information_schema.columns
    where table_schema='public'
      and (column_name in ('id','creator_id','fan_id','user_id','sender_id','reporter_id','assigned_admin_id','admin_id','recipient_id','viewer_id','author_id','owner_id','target_id','actor_id')
           or column_name like '%_id' and column_name not in ('episode_id','stream_id','message_id','thread_id','report_id','payout_id','transaction_id','subscription_id','doc_id','event_id','token_id','category_id'))
    order by table_name, column_name
  `);
  console.log("\n--- All user-id columns ---");
  let uuidCount = 0;
  for (const c of userCols) {
    const isUuid = c.data_type === "uuid" || c.udt_name === "uuid";
    if (isUuid) uuidCount++;
    console.log(`  ${c.table_name}.${c.column_name}: ${c.data_type} (${c.udt_name}) ${isUuid ? "❌ UUID" : "✓"}`);
  }
  console.log(`\nUUID columns remaining: ${uuidCount}`);

  // 3. Check FKs that still reference profiles.id
  const { rows: fks } = await client.query(`
    select tc.table_name, kcu.column_name
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu on tc.constraint_name = kcu.constraint_name
    join information_schema.constraint_column_usage ccu on tc.constraint_name = ccu.constraint_name
    where tc.constraint_type='FOREIGN KEY' and ccu.table_name='profiles'
  `);
  console.log("\n--- FKs referencing profiles ---");
  for (const f of fks) console.log(`  ${f.table_name}.${f.column_name}`);

  // 4. Check RLS policies that use auth.uid()
  const { rows: policies } = await client.query(`
    select tablename, policyname, qual, with_check
    from pg_policies
    where schemaname='public' and (qual::text like '%auth.uid%' or with_check::text like '%auth.uid%')
    order by tablename, policyname
  `);
  console.log(`\n--- RLS policies using auth.uid() (${policies.length}) ---`);
  for (const p of policies) {
    console.log(`  ${p.tablename}.${p.policyname}`);
    if (p.qual) console.log(`    USING: ${String(p.qual).slice(0,120)}`);
    if (p.with_check) console.log(`    CHECK: ${String(p.with_check).slice(0,120)}`);
  }

  client.release();
  await pool.end();
}
main().catch((e) => { console.error("Fatal:", e.message); process.exit(1); });
