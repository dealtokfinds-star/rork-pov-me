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

  // 1. profiles table columns with types and constraints
  const { rows: cols } = await client.query(`
    select column_name, data_type, udt_name, is_nullable, column_default, character_maximum_length
    from information_schema.columns
    where table_schema='public' and table_name='profiles'
    order by ordinal_position
  `);
  console.log("--- profiles columns ---");
  for (const c of cols) console.log(`  ${c.column_name}: ${c.data_type} (${c.udt_name}) nullable=${c.is_nullable} default=${c.column_default ?? "none"}`);

  // 2. Check constraints on profiles
  const { rows: constraints } = await client.query(`
    select con.conname, con.contype, pg_get_constraintdef(con.oid) as def
    from pg_constraint con
    join pg_class rel on con.conrelid = rel.oid
    join pg_namespace n on rel.relnamespace = n.oid
    where n.nspname='public' and rel.relname='profiles'
  `);
  console.log(`\n--- profiles constraints (${constraints.length}) ---`);
  for (const c of constraints) console.log(`  ${c.conname} [${c.contype}]: ${c.def}`);

  // 3. Trigger functions
  const { rows: triggers } = await client.query(`
    select trigger_name, event_manipulation, action_statement, action_timing
    from information_schema.triggers
    where event_object_schema='public' and event_object_table='profiles'
  `);
  console.log(`\n--- profiles triggers (${triggers.length}) ---`);
  for (const t of triggers) console.log(`  ${t.action_timing} ${t.event_manipulation}: ${t.trigger_name} → ${t.action_statement}`);

  // 4. Get the profiles_fts_update function definition
  const { rows: ftsFunc } = await client.query(`
    select pg_get_functiondef(p.oid) as def
    from pg_proc p
    join pg_namespace n on p.pronamespace = n.oid
    where n.nspname='public' and p.proname='profiles_fts_update'
  `);
  console.log(`\n--- profiles_fts_update function ---`);
  for (const f of ftsFunc) console.log(f.def);

  // 5. Try the exact update that publishCreatorProfile does
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
    console.log("  UPDATE OK:", rows[0]);
  } catch (err: any) {
    console.log("  UPDATE FAILED:", err.message);
  }

  // 6. Check the current profile state
  const { rows: profile } = await client.query(`
    select id, is_creator, identity, categories, sub_price, onboarded, kyc_status, payout_method
    from profiles where id = 'usr_5tjn4m2iakyd3v19zb0xy81d'
  `);
  console.log("\n--- Current profile ---");
  for (const p of profile) console.log("  ", p);

  client.release();
  await pool.end();
}
main().catch((e) => { console.error("Fatal:", e.message); process.exit(1); });
