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

  // Show all Brian Leconte accounts (the real auth users)
  const { rows: brians } = await client.query(
    "select id, name, handle, email, avatar_url, is_creator, kyc_status, onboarded, identity, categories, sub_price, location, bio, wallet_balance, created_at from profiles where id like 'usr_%' order by created_at desc"
  );
  console.log(`Auth users (${brians.length}):`);
  for (const p of brians) {
    console.log(`  id: ${p.id}`);
    console.log(`  name: ${p.name}`);
    console.log(`  handle: ${p.handle}`);
    console.log(`  email: ${p.email}`);
    console.log(`  avatar: ${p.avatar_url}`);
    console.log(`  is_creator: ${p.is_creator} | kyc: ${p.kyc_status} | onboarded: ${p.onboarded}`);
    console.log(`  identity: ${p.identity} | cats: ${JSON.stringify(p.categories)} | price: ${p.sub_price}`);
    console.log(`  location: ${p.location} | bio: ${p.bio} | wallet: ${p.wallet_balance}`);
    console.log(`  created: ${p.created_at}`);
    console.log("");
  }

  // Check profiles table columns
  const { rows: cols } = await client.query(`
    select column_name, data_type, is_nullable, column_default
    from information_schema.columns
    where table_schema='public' and table_name='profiles'
    order by ordinal_position
  `);
  console.log("\nProfiles columns:");
  for (const c of cols) {
    console.log(`  ${c.column_name} | ${c.data_type} | nullable=${c.is_nullable} | default=${c.column_default}`);
  }

  await client.release();
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
