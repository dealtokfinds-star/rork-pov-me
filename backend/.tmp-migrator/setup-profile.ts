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

  // The main user account
  const userId = "usr_5tjn4m2iakyd3v19zb0xy81d";

  // Check current state
  const { rows: [current] } = await client.query(
    "select id, name, handle, email, is_creator, kyc_status, onboarded, identity, categories, sub_price, location, bio from profiles where id = $1",
    [userId]
  );
  console.log("Before:", JSON.stringify(current, null, 2));

  // Set up a proper creator profile
  const { rows: [updated] } = await client.query(
    `update profiles set
       name = 'Brian Leconte',
       handle = 'brianleconte',
       identity = 'Entrepreneur & trader',
       categories = $1::jsonb,
       interests = $1::jsonb,
       sub_price = 12.99,
       is_creator = true,
       onboarded = true,
       kyc_status = 'verified',
       verified = true,
       bio = 'Building in public. POV from the inside.',
       location = 'Miami, FL',
       updated_at = now()
     where id = $2
     returning id, name, handle, identity, categories, sub_price, is_creator, kyc_status, onboarded, bio, location`,
    [JSON.stringify(["founder", "trader", "global"]), userId]
  );

  console.log("\nAfter:", JSON.stringify(updated, null, 2));

  // Also fix the other accounts to have unique handles (avoid unique constraint issues)
  const others = [
    { id: "usr_klvep6izmquzchkdmqz0w7zq", handle: "brian_apple" },
    { id: "usr_7j3jetwc1mt2m632ird1bq3a", handle: "brian_deals" },
    { id: "usr_34m07lde22soudlvde4m7h9d", handle: "brian_ocho" },
  ];

  for (const o of others) {
    await client.query(
      `update profiles set handle = $1, updated_at = now() where id = $2 and handle is null`,
      [o.handle, o.id]
    );
  }
  console.log("\nFixed handles on other accounts");

  // Verify all profiles now have handles
  const { rows: allUsr } = await client.query(
    "select id, name, handle, is_creator, kyc_status, onboarded from profiles where id like 'usr_%' order by created_at desc"
  );
  console.log("\nAll auth users:");
  for (const p of allUsr) {
    console.log(`  ${p.id} | ${p.name} | @${p.handle} | creator=${p.is_creator} | kyc=${p.kyc_status}`);
  }

  await client.release();
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
