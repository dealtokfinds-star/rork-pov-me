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

  // profiles.id type
  const { rows: [profileId] } = await client.query(
    "select data_type, udt_name from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='id'"
  );
  console.log("profiles.id type:", profileId?.data_type, profileId?.udt_name);

  // All profiles
  const { rows: profiles } = await client.query(
    "select id, name, handle, is_creator, kyc_status, onboarded, identity, categories, sub_price from profiles order by created_at desc limit 20"
  );
  console.log(`\nProfiles (${profiles.length}):`);
  for (const p of profiles) {
    console.log(`  ${p.id} | ${p.name} | @${p.handle} | creator=${p.is_creator} | kyc=${p.kyc_status} | onboarded=${p.onboarded} | identity=${p.identity} | cats=${JSON.stringify(p.categories)} | price=${p.sub_price}`);
  }

  // RLS policies on profiles
  const { rows: policies } = await client.query(`
    select policyname, cmd, qual, with_check
    from pg_policies where schemaname='public' and tablename='profiles'
  `);
  console.log(`\nRLS policies on profiles (${policies.length}):`);
  for (const p of policies) {
    console.log(`  ${p.policyname} | ${p.cmd} | qual=${p.qual} | with_check=${p.with_check}`);
  }

  await client.release();
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
