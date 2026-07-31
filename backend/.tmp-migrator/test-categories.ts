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

  // Test with proper text[] array
  console.log("--- Test 1: update with text[] ---");
  try {
    const { rows } = await client.query(`
      update profiles set
        is_creator = true,
        identity = 'Test Identity',
        categories = ARRAY['trading','fitness']::text[],
        sub_price = 12.99,
        onboarded = true,
        updated_at = now()
      where id = 'usr_5tjn4m2iakyd3v19zb0xy81d'
      returning id, categories
    `);
    console.log("  OK:", rows[0]);
  } catch (err: any) {
    console.log("  FAILED:", err.message);
  }

  // Test with JSON array (what supabase-js sends)
  console.log("\n--- Test 2: update with jsonb array ---");
  try {
    const { rows } = await client.query(`
      update profiles set
        categories = '["trading","fitness"]'
      where id = 'usr_5tjn4m2iakyd3v19zb0xy81d'
      returning id, categories
    `);
    console.log("  OK:", rows[0]);
  } catch (err: any) {
    console.log("  FAILED:", err.message);
  }

  client.release();
  await pool.end();
}
main().catch((e) => { console.error("Fatal:", e.message); process.exit(1); });
