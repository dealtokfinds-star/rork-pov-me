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

  // 1. PostgREST settings
  const { rows: settings } = await client.query(`
    select name, setting, source from pg_settings where name like 'pgrst%'
  `);
  console.log(`--- PostgREST settings (${settings.length}) ---`);
  for (const s of settings) console.log(`  ${s.name}: ${s.setting} (${s.source})`);

  // 2. Check for pre-request function
  const { rows: preReq } = await client.query(`
    select n.nspname, p.proname, pg_get_functiondef(p.oid) as def
    from pg_proc p
    join pg_namespace n on p.pronamespace = n.oid
    where p.proname = 'pgrst_pre_request' or p.proname = 'pre_request'
  `);
  console.log(`\n--- pre_request functions (${preReq.length}) ---`);
  for (const f of preReq) {
    console.log(`  ${f.nspname}.${f.proname}`);
    console.log(String(f.def));
  }

  // 3. Check ALL functions that call auth.uid (one at a time to avoid array_agg)
  const { rows: allFuncs } = await client.query(`
    select n.nspname as schema, p.proname as name, p.oid
    from pg_proc p
    join pg_namespace n on p.pronamespace = n.oid
    where n.nspname not in ('pg_catalog','information_schema')
    order by n.nspname, p.proname
  `);
  console.log(`\n--- Checking ${allFuncs.length} functions for auth.uid() calls ---`);
  let found = 0;
  for (const f of allFuncs) {
    try {
      const { rows } = await client.query(`select pg_get_functiondef(${f.oid}) as def`);
      const def = String(rows[0]?.def ?? "");
      if (def.includes("auth.uid")) {
        console.log(`  ⚠️ ${f.schema}.${f.name} calls auth.uid()`);
        const lines = def.split('\n').filter(l => l.includes('auth.uid'));
        for (const l of lines) console.log(`    ${l.trim()}`);
        found++;
      }
    } catch {}
  }
  console.log(`Total functions calling auth.uid(): ${found}`);

  // 4. Check for any ALTER DATABASE or config settings
  const { rows: dbSettings } = await client.query(`
    select setconfig from pg_db_role_setting rs
    join pg_database d on rs.setdatabase = d.oid
    where d.datname = current_database()
  `);
  console.log(`\n--- DB-level settings ---`);
  for (const s of dbSettings) console.log(`  ${s.setconfig}`);

  client.release();
  await pool.end();
}
main().catch((e) => { console.error("Fatal:", e.message); process.exit(1); });
