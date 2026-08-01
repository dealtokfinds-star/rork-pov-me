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

  // 1. live_streams RLS policies (actual, post-022)
  const { rows: lsPolicies } = await client.query(`
    select policyname, cmd, qual, with_check
    from pg_policies where schemaname='public' and tablename='live_streams'
  `);
  console.log("--- live_streams policies ---");
  for (const p of lsPolicies) {
    console.log(`  ${p.policyname} [${p.cmd}]`);
    if (p.qual) console.log(`    USING: ${String(p.qual).slice(0, 140)}`);
    if (p.with_check) console.log(`    CHECK: ${String(p.with_check).slice(0, 140)}`);
  }

  // 2. profiles columns — check social_links exists?
  const { rows: profCols } = await client.query(`
    select column_name, data_type from information_schema.columns
    where table_schema='public' and table_name='profiles'
    order by ordinal_position
  `);
  console.log("\n--- profiles columns ---");
  console.log(profCols.map((c) => `${c.column_name}(${c.data_type})`).join(", "));

  // 3. storage buckets
  const { rows: buckets } = await client.query(`select id, name, public from storage.buckets order by name`);
  console.log("\n--- storage buckets ---");
  for (const b of buckets) console.log(`  ${b.name} public=${b.public}`);

  // 4. storage.objects policies
  const { rows: soPolicies } = await client.query(`
    select policyname, cmd, qual, with_check from pg_policies
    where schemaname='storage' and tablename='objects'
  `);
  console.log("\n--- storage.objects policies ---");
  for (const p of soPolicies) {
    console.log(`  ${p.policyname} [${p.cmd}]`);
    if (p.qual) console.log(`    USING: ${String(p.qual).slice(0, 160)}`);
    if (p.with_check) console.log(`    CHECK: ${String(p.with_check).slice(0, 160)}`);
  }

  // 5. realtime publication tables
  const { rows: pub } = await client.query(`
    select schemaname, tablename from pg_publication_tables where pubname='supabase_realtime' order by tablename
  `);
  console.log("\n--- supabase_realtime publication ---");
  console.log(pub.map((r) => r.tablename).join(", ") || "(empty)");

  // 6. current live_streams rows
  const { rows: streams } = await client.query(`
    select id, creator_id, title, is_live, health_status, stream_source, started_at, ended_at
    from live_streams order by started_at desc nulls last limit 8
  `);
  console.log("\n--- recent live_streams ---");
  for (const s of streams) {
    console.log(`  ${String(s.id).slice(0, 8)} live=${s.is_live} health=${s.health_status} src=${s.stream_source} "${String(s.title).slice(0, 30)}" started=${s.started_at} ended=${s.ended_at}`);
  }

  // 7. user_id() function exists?
  const { rows: fns } = await client.query(`
    select proname from pg_proc p join pg_namespace n on p.pronamespace=n.oid
    where n.nspname='public' and proname='user_id'
  `);
  console.log("\nuser_id() fn:", fns.length > 0 ? "exists" : "MISSING");

  client.release();
  await pool.end();
}
main().catch((e) => { console.error("Fatal:", e.message); process.exit(1); });
