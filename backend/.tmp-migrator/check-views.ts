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

  // 1. Check if creator_stats view exists
  const { rows: viewExists } = await client.query(`
    select viewname from pg_views where schemaname='public' and viewname='creator_stats'
  `);
  console.log("creator_stats view exists:", viewExists.length > 0);

  // 2. Check all views
  const { rows: allViews } = await client.query(`
    select viewname from pg_views where schemaname='public' order by viewname
  `);
  console.log("\n--- All public views ---");
  for (const v of allViews) console.log(`  ${v.viewname}`);

  // 3. Check what the migration 018_views.sql defines for creator_stats
  // Let me just read it from the file and apply it

  client.release();
  await pool.end();
}
main().catch((e) => { console.error("Fatal:", e.message); process.exit(1); });
