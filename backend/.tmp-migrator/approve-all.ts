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

  // Show current state
  const { rows: before } = await client.query(
    "select id, name, handle, kyc_status, is_creator from profiles order by created_at"
  );
  console.log("--- Before ---");
  for (const p of before) {
    console.log(`  ${p.handle ?? p.name ?? p.id}: kyc=${p.kyc_status}, creator=${p.is_creator}`);
  }

  // Approve everyone: set kyc_status='verified', is_creator=true
  const now = new Date().toISOString();
  const { rowCount } = await client.query(
    `update profiles set
       kyc_status = 'verified',
       kyc_verified_at = $1,
       kyc_reviewed_at = $1,
       kyc_last_reason = null,
       is_creator = true,
       onboarded = true,
       updated_at = $1
     where kyc_status is distinct from 'verified' or is_creator is distinct from true`,
    [now]
  );
  console.log(`\nUpdated ${rowCount} rows.`);

  // Show after state
  const { rows: after } = await client.query(
    "select id, name, handle, kyc_status, is_creator from profiles order by created_at"
  );
  console.log("\n--- After ---");
  for (const p of after) {
    console.log(`  ${p.handle ?? p.name ?? p.id}: kyc=${p.kyc_status}, creator=${p.is_creator}`);
  }

  client.release();
  await pool.end();
}
main().catch((e) => { console.error("Fatal:", e.message); process.exit(1); });
