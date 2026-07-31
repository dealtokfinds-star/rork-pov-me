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
  const { rows: cols } = await client.query(
    "select column_name from information_schema.columns where table_name='categories' and table_schema='public' order by ordinal_position"
  );
  console.log("Columns:", cols.map((c: any) => c.column_name).join(", "));

  const { rows: cats } = await client.query("select * from categories order by name limit 20");
  console.log(`Rows: ${cats.length}`);
  for (const c of cats) console.log("  -", JSON.stringify(c));

  console.log("\n=== STORAGE BUCKETS ===");
  const { rows: buckets } = await client.query(
    "select id, name, public from storage.buckets order by name"
  );
  for (const b of buckets) console.log(`  - ${b.name} (public=${b.public})`);

  console.log("\n=== TABLE COUNTS ===");
  const tables = ["profiles","episodes","live_streams","subscriptions","transactions","tips","unlocks","chat_messages","dm_threads","events","reports","payouts","categories","audit_logs","verification_docs","push_tokens","email_log"];
  for (const t of tables) {
    try {
      const { rows } = await client.query(`select count(*) as c from public.${t}`);
      console.log(`  ${t}: ${rows[0].c}`);
    } catch (e: any) {
      console.log(`  ${t}: ERROR ${e.message}`);
    }
  }

  client.release();
  await pool.end();
}
main().catch((e) => { console.error(e.message); process.exit(1); });
