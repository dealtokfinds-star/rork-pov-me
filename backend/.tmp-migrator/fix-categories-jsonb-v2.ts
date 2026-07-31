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

  // 1. Drop defaults, alter type, set new defaults
  for (const col of ["categories", "interests"]) {
    console.log(`--- Converting profiles.${col} text[] -> jsonb ---`);
    try {
      await client.query(`alter table public.profiles alter column ${col} drop default`);
      console.log(`  ✓ dropped default`);
      await client.query(`alter table public.profiles alter column ${col} type jsonb using to_jsonb(${col})`);
      console.log(`  ✓ converted to jsonb`);
      await client.query(`alter table public.profiles alter column ${col} set default '[]'::jsonb`);
      console.log(`  ✓ set new jsonb default`);
    } catch (err: any) {
      console.log(`  ✗ FAILED:`, err.message);
    }
  }

  // 2. Verify column types
  const { rows: cols } = await client.query(`
    select column_name, data_type, udt_name, column_default
    from information_schema.columns
    where table_schema='public' and table_name='profiles'
      and column_name in ('categories','interests')
  `);
  console.log("\n--- Verified column types ---");
  for (const c of cols) console.log(`  ${c.column_name}: ${c.data_type} (${c.udt_name}) default=${c.column_default}`);

  // 3. Test the exact update that publishCreatorProfile does (with jsonb cast)
  console.log("\n--- Testing publishCreatorProfile update (jsonb) ---");
  try {
    const { rows } = await client.query(`
      update profiles set
        is_creator = true,
        identity = 'Test Identity',
        categories = '["trading","fitness"]'::jsonb,
        sub_price = 12.99,
        onboarded = true,
        location = null,
        bio = null,
        updated_at = now()
      where id = 'usr_5tjn4m2iakyd3v19zb0xy81d'
      returning id, is_creator, identity, categories, sub_price, onboarded
    `);
    console.log("  ✓ UPDATE OK:", rows[0]);
  } catch (err: any) {
    console.log("  ✗ UPDATE FAILED:", err.message);
  }

  // 4. Restore original values
  try {
    await client.query(`
      update profiles set identity = 'Ggg g', categories = '["bettor"]'::jsonb, sub_price = 29.99
      where id = 'usr_5tjn4m2iakyd3v19zb0xy81d'
    `);
    console.log("  ✓ restored original values");
  } catch (err: any) {
    console.log("  restore FAILED:", err.message);
  }

  client.release();
  await pool.end();
}
main().catch((e) => { console.error("Fatal:", e.message); process.exit(1); });
