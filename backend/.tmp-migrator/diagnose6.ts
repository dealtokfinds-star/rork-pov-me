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

  // 1. ALL functions in supabase_functions schema
  const { rows: sfFuncs } = await client.query(`
    select proname from pg_proc p
    join pg_namespace n on p.pronamespace = n.oid
    where n.nspname = 'supabase_functions'
    order by proname
  `);
  console.log(`--- supabase_functions functions (${sfFuncs.length}) ---`);
  for (const f of sfFuncs) console.log(`  ${f.proname}`);

  // 2. Check for pgrst_pre_request or similar
  const { rows: preReq } = await client.query(`
    select n.nspname, p.proname, pg_get_functiondef(p.oid) as def
    from pg_proc p
    join pg_namespace n on p.pronamespace = n.oid
    where p.proname like '%pre_request%' or p.proname like '%prerequest%' or p.proname like '%pre-request%'
  `);
  console.log(`\n--- pre_request functions (${preReq.length}) ---`);
  for (const f of preReq) {
    console.log(`  ${f.nspname}.${f.proname}`);
    console.log(String(f.def).slice(0, 500));
  }

  // 3. All functions calling auth.uid() (fix the array_agg issue)
  const { rows: uidCallers } = await client.query(`
    select n.nspname as schema, p.proname as name
    from pg_proc p
    join pg_namespace n on p.pronamespace = n.oid
    where n.nspname not in ('pg_catalog','information_schema')
    and pg_get_functiondef(p.oid) like '%auth.uid%'
    order by n.nspname, p.proname
  `);
  console.log(`\n--- ALL functions calling auth.uid() (${uidCallers.length}) ---`);
  for (const f of uidCallers) console.log(`  ${f.schema}.${f.name}`);

  // 4. PostgREST config
  const { rows: pgrst } = await client.query(`
    select name, setting, source from pg_settings 
    where name like 'pgrst%' or name like 'postgrest%'
  `);
  console.log(`\n--- PostgREST settings (${pgrst.length}) ---`);
  for (const s of pgrst) console.log(`  ${s.name}: ${s.setting} (${s.source})`);

  // 5. Check supabase_functions schema for the webhook pre-request
  for (const fn of sfFuncs) {
    const { rows } = await client.query(`
      select pg_get_functiondef(p.oid) as def
      from pg_proc p
      join pg_namespace n on p.pronamespace = n.oid
      where n.nspname = 'supabase_functions' and p.proname = '${fn.proname}'
    `);
    if (rows.length > 0) {
      const def = String(rows[0].def);
      if (def.includes('auth.uid')) {
        console.log(`\n⚠️ supabase_functions.${fn.proname} calls auth.uid()!`);
        console.log(def.slice(0, 500));
      }
    }
  }

  // 6. Check the supabase_functions pre-request hook
  const { rows: hookDef } = await client.query(`
    select pg_get_functiondef(p.oid) as def
    from pg_proc p
    join pg_namespace n on p.pronamespace = n.oid
    where n.nspname = 'supabase_functions' and p.proname = 'before_request'
  `);
  if (hookDef.length > 0) {
    console.log(`\n--- supabase_functions.before_request ---`);
    console.log(String(hookDef[0].def).slice(0, 800));
  }

  client.release();
  await pool.end();
}
main().catch((e) => { console.error("Fatal:", e.message); process.exit(1); });
