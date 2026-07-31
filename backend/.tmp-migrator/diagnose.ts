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

  // 1. All RLS policies on profiles
  const { rows: profilePolicies } = await client.query(`
    select policyname, cmd, qual, with_check
    from pg_policies
    where schemaname='public' and tablename='profiles'
    order by policyname
  `);
  console.log(`--- profiles RLS policies (${profilePolicies.length}) ---`);
  for (const p of profilePolicies) {
    console.log(`  ${p.policyname} [${p.cmd}]`);
    console.log(`    USING:  ${p.qual ?? "NULL"}`);
    console.log(`    CHECK:  ${p.with_check ?? "NULL"}`);
  }

  // 2. Triggers on profiles
  const { rows: triggers } = await client.query(`
    select trigger_name, event_manipulation, action_statement, action_timing
    from information_schema.triggers
    where event_object_schema='public' and event_object_table='profiles'
  `);
  console.log(`\n--- profiles triggers (${triggers.length}) ---`);
  for (const t of triggers) {
    console.log(`  ${t.action_timing} ${t.event_manipulation}: ${t.trigger_name}`);
    console.log(`    ${t.action_statement}`);
  }

  // 3. Functions that might cast to uuid
  const { rows: funcs } = await client.query(`
    select routine_name, routine_type, routine_definition
    from information_schema.routines
    where routine_schema='public' and routine_definition like '%uuid%'
    order by routine_name
  `);
  console.log(`\n--- Functions referencing 'uuid' (${funcs.length}) ---`);
  for (const f of funcs) {
    console.log(`  ${f.routine_name} (${f.routine_type})`);
    const def = String(f.routine_definition).slice(0, 200);
    console.log(`    ${def}`);
  }

  // 4. Check if auth.uid() function exists and what it returns
  const { rows: authFunc } = await client.query(`
    select routine_name, data_type, routine_definition
    from information_schema.routines
    where routine_schema='auth' and routine_name='uid'
  `);
  console.log(`\n--- auth.uid() function ---`);
  for (const f of authFunc) {
    console.log(`  returns: ${f.data_type}`);
    console.log(`  def: ${String(f.routine_definition).slice(0, 300)}`);
  }

  // 5. Check the user_id() helper function if it exists
  const { rows: userIdFunc } = await client.query(`
    select routine_name, data_type, routine_definition
    from information_schema.routines
    where routine_schema='public' and routine_name='user_id'
  `);
  console.log(`\n--- public.user_id() function ---`);
  for (const f of userIdFunc) {
    console.log(`  returns: ${f.data_type}`);
    console.log(`  def: ${String(f.routine_definition).slice(0, 300)}`);
  }

  // 6. Try a direct query to reproduce the error
  console.log("\n--- Reproducing the error ---");
  try {
    const { rows } = await client.query(`
      select id, is_creator, identity from profiles where id = 'usr_5tjn4m2iakyd3v19zb0xy81d'
    `);
    console.log("Direct query OK:", rows.length, "rows");
    for (const r of rows) console.log("  ", r);
  } catch (err: any) {
    console.log("Direct query FAILED:", err.message);
  }

  // 7. Try an UPDATE to reproduce
  console.log("\n--- Reproducing UPDATE ---");
  try {
    const { rows } = await client.query(`
      update profiles set updated_at = now() where id = 'usr_5tjn4m2iakyd3v19zb0xy81d' returning id
    `);
    console.log("UPDATE OK:", rows.length, "rows");
  } catch (err: any) {
    console.log("UPDATE FAILED:", err.message);
  }

  // 8. Check if RLS is enabled and what role the client uses
  const { rows: rlsStatus } = await client.query(`
    select relname, relrowsecurity
    from pg_class
    where relname='profiles' and relnamespace=(select oid from pg_namespace where nspname='public')
  `);
  console.log(`\n--- RLS enabled on profiles ---`);
  for (const r of rlsStatus) console.log(`  RLS: ${r.relrowsecurity}`);

  client.release();
  await pool.end();
}
main().catch((e) => { console.error("Fatal:", e.message); process.exit(1); });
