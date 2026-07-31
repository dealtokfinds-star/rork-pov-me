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

  // Check for pre-request functions in rest schema
  const { rows: restFuncs } = await client.query(`
    select routine_name, routine_type, routine_definition
    from information_schema.routines
    where routine_schema='rest'
    order by routine_name
  `);
  console.log(`--- rest schema functions (${restFuncs.length}) ---`);
  for (const f of restFuncs) {
    console.log(`  ${f.routine_name} (${f.routine_type})`);
    console.log(`    ${String(f.routine_definition).slice(0, 500)}`);
  }

  // Check pg_catalog for any functions referencing auth.uid()
  const { rows: uidCallers } = await client.query(`
    select n.nspname as schema, p.proname as name, l.lanname as lang, pg_get_functiondef(p.oid) as def
    from pg_proc p
    join pg_namespace n on p.pronamespace = n.oid
    join pg_language l on p.prolang = l.oid
    where pg_get_functiondef(p.oid) like '%auth.uid%'
    and n.nspname not in ('pg_catalog')
    order by n.nspname, p.proname
  `);
  console.log(`\n--- Functions calling auth.uid() (${uidCallers.length}) ---`);
  for (const f of uidCallers) {
    console.log(`  ${f.schema}.${f.name} (${f.lang})`);
    const def = String(f.def);
    // Show only lines with auth.uid
    const lines = def.split('\n').filter((l: string) => l.includes('auth.uid') || l.includes('uuid'));
    for (const line of lines) console.log(`    ${line.trim()}`);
  }

  // Check PostgREST settings
  const { rows: settings } = await client.query(`
    select name, setting from pg_settings where name like '%pgrst%' or name like '%postgrest%' or name like '%jwt%'
  `);
  console.log(`\n--- PostgREST settings ---`);
  for (const s of settings) console.log(`  ${s.name}: ${s.setting}`);

  // Check the exact auth.uid() definition
  const { rows: uidDef } = await client.query(`
    select pg_get_functiondef(p.oid) as def
    from pg_proc p
    join pg_namespace n on p.pronamespace = n.oid
    where n.nspname = 'auth' and p.proname = 'uid'
  `);
  console.log(`\n--- auth.uid() definition ---`);
  for (const u of uidDef) console.log(u.def);

  // Try to reproduce with a simulated request
  console.log("\n--- Simulating PostgREST request ---");
  try {
    await client.query(`set role anon`);
    await client.query(`set request.jwt.claim.sub = 'usr_5tjn4m2iakyd3v19zb0xy81d'`);
    await client.query(`set request.jwt.claims = '{"sub":"usr_5tjn4m2iakyd3v19zb0xy81d","email":"test@test.com"}'`);
    
    // Try the exact query fetchEpisodes does
    const { rows } = await client.query(`
      select id, creator_id, title from episodes order by posted_at desc limit 5
    `);
    console.log("  episodes query OK:", rows.length, "rows");
  } catch (err: any) {
    console.log("  episodes query FAILED:", err.message);
  }

  try {
    // Try auth.uid()
    const { rows } = await client.query(`select auth.uid()`);
    console.log("  auth.uid():", rows[0]);
  } catch (err: any) {
    console.log("  auth.uid() FAILED:", err.message);
  }

  // Reset role
  try { await client.query(`reset role`); } catch {}
  try { await client.query(`reset request.jwt.claim.sub`); } catch {}
  try { await client.query(`reset request.jwt.claims`); } catch {}

  client.release();
  await pool.end();
}
main().catch((e) => { console.error("Fatal:", e.message); process.exit(1); });
