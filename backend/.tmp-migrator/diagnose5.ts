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

  // 1. ALL functions across ALL schemas that call auth.uid()
  const { rows: uidCallers } = await client.query(`
    select n.nspname as schema, p.proname as name
    from pg_proc p
    join pg_namespace n on p.pronamespace = n.oid
    where n.nspname not in ('pg_catalog','information_schema')
    and pg_get_functiondef(p.oid) like '%auth.uid%'
    order by n.nspname, p.proname
  `);
  console.log(`--- ALL functions calling auth.uid() (${uidCallers.length}) ---`);
  for (const f of uidCallers) console.log(`  ${f.schema}.${f.name}`);

  // 2. Check ALL schemas
  const { rows: schemas } = await client.query(`
    select nspname from pg_namespace where nspname not in ('pg_catalog','information_schema','pg_toast') order by nspname
  `);
  console.log(`\n--- All schemas ---`);
  for (const s of schemas) console.log(`  ${s.nspname}`);

  // 3. Check for supabase_functions schema and its functions
  const { rows: sfFuncs } = await client.query(`
    select p.proname, pg_get_functiondef(p.oid) as def
    from pg_proc p
    join pg_namespace n on p.pronamespace = n.oid
    where n.nspname in ('supabase_functions','graphql','pgapi','net','pgsodium','vault','repack')
  `);
  console.log(`\n--- supabase_functions/graphql/etc functions (${sfFuncs.length}) ---`);
  for (const f of sfFuncs) {
    console.log(`  ${f.proname}:`);
    const def = String(f.def);
    if (def.includes('auth.uid')) {
      console.log(`    ⚠️ CALLS auth.uid()!`);
      const lines = def.split('\n').filter(l => l.includes('auth.uid'));
      for (const l of lines) console.log(`    ${l.trim()}`);
    }
  }

  // 4. Check ALL triggers on episodes and transactions
  for (const table of ['episodes','transactions','profiles','live_streams']) {
    const { rows: triggers } = await client.query(`
      select trigger_name, event_manipulation, action_statement, action_timing
      from information_schema.triggers
      where event_object_schema='public' and event_object_table='${table}'
    `);
    console.log(`\n--- ${table} triggers (${triggers.length}) ---`);
    for (const t of triggers) {
      console.log(`  ${t.action_timing} ${t.event_manipulation}: ${t.trigger_name}`);
      console.log(`    ${t.action_statement}`);
    }
  }

  // 5. Check views for auth.uid() usage
  const { rows: views } = await client.query(`
    select viewname, definition
    from pg_views
    where schemaname='public'
  `);
  console.log(`\n--- Views (${views.length}) ---`);
  for (const v of views) {
    const def = String(v.definition);
    if (def.includes('auth.uid')) {
      console.log(`  ⚠️ ${v.viewname} uses auth.uid()!`);
      const lines = def.split('\n').filter(l => l.includes('auth.uid'));
      for (const l of lines) console.log(`    ${l.trim()}`);
    } else {
      console.log(`  ${v.viewname}`);
    }
  }

  // 6. Check PostgREST config via pg_settings
  const { rows: pgrstSettings } = await client.query(`
    select name, setting, source 
    from pg_settings 
    where name like 'pgrst%' or name like '%postgrest%'
  `);
  console.log(`\n--- PostgREST settings (${pgrstSettings.length}) ---`);
  for (const s of pgrstSettings) console.log(`  ${s.name}: ${s.setting} (${s.source})`);

  // 7. Check if there's a pre-request function config in the supabase_functions schema
  const { rows: hooksFuncs } = await client.query(`
    select p.proname, pg_get_functiondef(p.oid) as def
    from pg_proc p
    join pg_namespace n on p.pronamespace = n.oid
    where n.nspname = 'supabase_functions'
    and p.proname like '%request%' or p.proname like '%hook%' or p.proname like '%pre%'
  `);
  console.log(`\n--- supabase_functions hook functions (${hooksFuncs.length}) ---`);
  for (const f of hooksFuncs) {
    console.log(`  ${f.proname}:`);
    console.log(`    ${String(f.def).slice(0, 400)}`);
  }

  // 8. ALL functions in supabase_functions schema
  const { rows: allSfFuncs } = await client.query(`
    select p.proname
    from pg_proc p
    join pg_namespace n on p.pronamespace = n.oid
    where n.nspname = 'supabase_functions'
  `);
  console.log(`\n--- All supabase_functions functions (${allSfFuncs.length}) ---`);
  for (const f of allSfFuncs) console.log(`  ${f.proname}`);

  client.release();
  await pool.end();
}
main().catch((e) => { console.error("Fatal:", e.message); process.exit(1); });
