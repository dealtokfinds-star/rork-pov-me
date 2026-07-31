import { Pool } from "pg";

const PROJECT_REF = "ukiriolnxozcofphltza";
const DB_PASSWORD = "1JS9fYrJpsWHpqSd";
const POOLER_HOST = "aws-0-us-east-2.pooler.supabase.com";

const pool = new Pool({
  host: POOLER_HOST,
  port: 6543,
  user: `postgres.${PROJECT_REF}`,
  password: DB_PASSWORD,
  database: "postgres",
  ssl: { rejectUnauthorized: false, servername: `${PROJECT_REF}.pooler.supabase.com` },
  connectionTimeoutMillis: 15000,
  max: 3,
});

async function main() {
  const client = await pool.connect();

  console.log("=== CATEGORIES ===");
  const { rows: cats } = await client.query("select id, label, emoji, accent, sort_order from categories order by sort_order");
  console.log(`Rows: ${cats.length}`);
  for (const c of cats) console.log(`  - ${c.label} ${c.emoji} (${c.accent}) sort=${c.sort_order}`);

  console.log("\n=== STORAGE BUCKETS ===");
  const { rows: buckets } = await client.query("select id, name, public from storage.buckets order by name");
  for (const b of buckets) console.log(`  - ${b.name} (public=${b.public})`);

  console.log("\n=== TABLE COUNTS ===");
  const tables = ["profiles","episodes","live_streams","subscriptions","transactions","tips","unlocks","chat_messages","dm_threads","dm_messages","events","reports","payouts","payout_requests","categories","audit_logs","verification_docs","push_tokens","email_log","likes","saves"];
  for (const t of tables) {
    try {
      const { rows } = await client.query(`select count(*) as c from public.${t}`);
      console.log(`  ${t}: ${rows[0].c}`);
    } catch (e: any) {
      console.log(`  ${t}: ERROR ${e.message.split("\n")[0]}`);
    }
  }

  console.log("\n=== RLS ENABLED TABLES ===");
  const { rows: rls } = await client.query(`
    select relname, relrowsecurity 
    from pg_class 
    where relnamespace = 'public'::regnamespace 
    and relkind = 'r' 
    order by relname
  `);
  for (const r of rls) console.log(`  ${r.relname}: RLS=${r.relrowsecurity ? "ON" : "OFF"}`);

  console.log("\n=== VIEWS ===");
  const { rows: views } = await client.query("select viewname from pg_views where schemaname='public' order by viewname");
  for (const v of views) console.log(`  - ${v.viewname}`);

  console.log("\n=== RPC FUNCTIONS ===");
  const { rows: rpcs } = await client.query(`
    select routine_name, routine_type 
    from information_schema.routines 
    where routine_schema='public' 
    order by routine_name
  `);
  for (const r of rpcs) console.log(`  - ${r.routine_name} (${r.routine_type})`);

  client.release();
  await pool.end();
}
main().catch((e) => { console.error("Fatal:", e.message); process.exit(1); });
