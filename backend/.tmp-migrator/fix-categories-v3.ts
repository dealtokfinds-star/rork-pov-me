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

  // 1. Get the creator_stats view definition so we can recreate it
  const { rows: viewDef } = await client.query(`
    select definition from pg_views where schemaname='public' and viewname='creator_stats'
  `);
  const creatorStatsDef = viewDef[0]?.definition;
  console.log("--- creator_stats view definition ---");
  console.log(creatorStatsDef?.slice(0, 200));

  // 2. Drop the view, alter the column, recreate the view
  console.log("\n--- Dropping creator_stats view ---");
  try {
    await client.query(`drop view if exists public.creator_stats cascade`);
    console.log("  ✓ dropped");
  } catch (err: any) {
    console.log("  ✗ FAILED:", err.message);
  }

  // 3. Now alter categories to jsonb
  console.log("\n--- Converting profiles.categories text[] -> jsonb ---");
  try {
    await client.query(`alter table public.profiles alter column categories drop default`);
    await client.query(`alter table public.profiles alter column categories type jsonb using to_jsonb(categories)`);
    await client.query(`alter table public.profiles alter column categories set default '[]'::jsonb`);
    console.log("  ✓ categories converted to jsonb");
  } catch (err: any) {
    console.log("  ✗ FAILED:", err.message);
  }

  // 4. Recreate the creator_stats view (cast categories back to text[] for compatibility)
  console.log("\n--- Recreating creator_stats view ---");
  try {
    await client.query(creatorStatsDef);
    console.log("  ✓ recreated");
  } catch (err: any) {
    console.log("  ✗ FAILED:", err.message);
    // Try with explicit cast
    console.log("  Trying with cast...");
    try {
      // Replace p.categories with (p.categories::text[]) in the definition
      const fixedDef = creatorStatsDef.replace("p.categories,", "(p.categories::text[]) AS categories,");
      await client.query(fixedDef);
      console.log("  ✓ recreated with cast");
    } catch (err2: any) {
      console.log("  ✗ STILL FAILED:", err2.message);
    }
  }

  // 5. Verify column types
  const { rows: cols } = await client.query(`
    select column_name, data_type, udt_name, column_default
    from information_schema.columns
    where table_schema='public' and table_name='profiles'
      and column_name in ('categories','interests')
  `);
  console.log("\n--- Verified column types ---");
  for (const c of cols) console.log(`  ${c.column_name}: ${c.data_type} (${c.udt_name}) default=${c.column_default}`);

  // 6. Test the exact publishCreatorProfile update
  console.log("\n--- Testing publishCreatorProfile update ---");
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

  // 7. Restore original values
  try {
    await client.query(`
      update profiles set identity = 'Ggg g', categories = '["bettor"]'::jsonb, sub_price = 29.99
      where id = 'usr_5tjn4m2iakyd3v19zb0xy81d'
    `);
    console.log("  ✓ restored original values");
  } catch (err: any) {
    console.log("  restore FAILED:", err.message);
  }

  // 8. Check if the view is valid
  const { rows: viewCheck } = await client.query(`select * from creator_stats limit 1`);
  console.log("\n--- creator_stats view check ---");
  console.log("  ✓ view queryable, sample:", viewCheck[0] ? Object.keys(viewCheck[0]).join(",") : "no rows");

  client.release();
  await pool.end();
}
main().catch((e) => { console.error("Fatal:", e.message); process.exit(1); });
