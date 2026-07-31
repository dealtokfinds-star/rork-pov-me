import { Pool } from "pg";
import { readFileSync } from "fs";

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

  const sql = readFileSync("/home/user/rork-app/backend/migrations/023_auth_uid_tolerant.sql", "utf-8");
  console.log("Applying migration 023 (auth.uid tolerant)...");
  try {
    await client.query(sql);
    console.log("✓ Migration applied successfully");
  } catch (err: any) {
    console.log("✗ Failed:", err.message);
    client.release();
    await pool.end();
    process.exit(1);
  }

  // Verify: auth.uid() should now return NULL for non-UUID subs
  console.log("\n--- Verifying auth.uid() behavior ---");
  try {
    // Simulate a non-UUID sub
    await client.query("set local request.jwt.claim.sub = 'usr_5tjn4m2iakyd3v19zb0xy81d'");
    const { rows } = await client.query("select auth.uid() as uid");
    console.log("  auth.uid() with usr_... sub:", rows[0]?.uid, "(should be null)");
  } catch (err: any) {
    console.log("  FAILED:", err.message);
  }

  // Test with a valid UUID
  try {
    await client.query("set local request.jwt.claim.sub = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'");
    const { rows } = await client.query("select auth.uid() as uid");
    console.log("  auth.uid() with valid UUID sub:", rows[0]?.uid, "(should be the UUID)");
  } catch (err: any) {
    console.log("  FAILED:", err.message);
  }

  // Test user_id() still works
  try {
    await client.query("set local request.jwt.claim.sub = 'usr_5tjn4m2iakyd3v19zb0xy81d'");
    const { rows } = await client.query("select user_id() as uid");
    console.log("  user_id() with usr_... sub:", rows[0]?.uid, "(should be the string)");
  } catch (err: any) {
    console.log("  user_id() FAILED:", err.message);
  }

  client.release();
  await pool.end();
  console.log("\n✓ Done!");
}
main().catch((e) => { console.error("Fatal:", e.message); process.exit(1); });
