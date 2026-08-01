import { readFileSync } from "fs";
import { Pool } from "pg";

const pool = new Pool({
  host: "aws-0-us-east-2.pooler.supabase.com",
  port: 6543,
  user: "postgres.ukiriolnxozcofphltza",
  password: "1JS9fYrJpsWHpqSd",
  database: "postgres",
  ssl: { rejectUnauthorized: false, servername: "ukiriolnxozcofphltza.pooler.supabase.com" },
  connectionTimeoutMillis: 15000,
  max: 1,
});

async function main() {
  const client = await pool.connect();
  console.log("Connected");

  const sql = readFileSync(new URL("../migrations/024_social_links.sql", import.meta.url), "utf8");
  await client.query(sql);
  console.log("024_social_links applied");

  const { rows } = await client.query(
    "select column_name, data_type from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='social_links'"
  );
  console.log("verify:", rows);

  client.release();
  await pool.end();
}
main().catch((e) => { console.error("Fatal:", e.message); process.exit(1); });
