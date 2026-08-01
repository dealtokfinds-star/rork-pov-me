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

  // Recent live_streams rows — did provisioning ever succeed?
  const { rows: streams } = await client.query(`
    select id, creator_id, title, is_live, health_status, stream_source,
           mux_live_stream_id is not null as has_mux,
           rtmp_stream_key is not null as has_key,
           started_at, ended_at
    from live_streams
    order by started_at desc nulls last
    limit 12
  `);
  console.log(`--- live_streams (${streams.length} recent) ---`);
  for (const s of streams) {
    console.log(
      `  ${String(s.started_at).slice(0, 24)} | live=${s.is_live} | ${s.health_status} | src=${s.stream_source} | mux=${s.has_mux} key=${s.has_key} | ${String(s.title).slice(0, 34)} | creator=${String(s.creator_id).slice(0, 18)}`,
    );
  }

  // RLS policies on live_streams (INSERT/UPDATE paths used by go-live)
  const { rows: policies } = await client.query(`
    select policyname, cmd, qual, with_check
    from pg_policies
    where schemaname='public' and tablename='live_streams'
    order by policyname
  `);
  console.log(`\n--- live_streams RLS (${policies.length}) ---`);
  for (const p of policies) {
    console.log(`  [${p.cmd}] ${p.policyname}`);
    if (p.qual) console.log(`    USING: ${String(p.qual).slice(0, 130)}`);
    if (p.with_check) console.log(`    CHECK: ${String(p.with_check).slice(0, 130)}`);
  }

  client.release();
  await pool.end();
}
main().catch((e) => {
  console.error("Fatal:", e.message);
  process.exit(1);
});
