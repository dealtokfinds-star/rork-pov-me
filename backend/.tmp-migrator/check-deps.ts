import { Pool } from "pg";

const pool = new Pool({
  host: "aws-0-us-east-2.pooler.supabase.com",
  port: 6543,
  user: "postgres.ukiriolnxozcofphltza",
  password: "1JS9fYrJpsWHpqSd",
  database: "postgres",
  ssl: { rejectUnauthorized: false, servername: "ukiriolnxozcofphltza.pooler.supabase.com" },
  connectionTimeoutMillis: 15000,
  max: 2,
});

async function main() {
  const client = await pool.connect();
  
  // Check user_id() current return type
  console.log("=== user_id() return type ===");
  const { rows: uid } = await client.query(
    "select routine_name, data_type from information_schema.routines where routine_schema='public' and routine_name='user_id'"
  );
  console.log(uid[0]);

  // Check what depends on user_id()
  console.log("\n=== Dependencies on user_id() ===");
  const { rows: deps } = await client.query(`
    select distinct 
      dep.objid::regclass as dependent_object,
      cl.relkind
    from pg_depend dep
    join pg_proc p on p.oid = dep.refobjid
    join pg_class cl on cl.oid = dep.objid
    where p.proname = 'user_id' and p.pronamespace = 'public'::regnamespace
  `);
  for (const d of deps) console.log(`  ${d.dependent_object} (${d.relkind})`);

  // Check auth.uid() return type
  console.log("\n=== auth.uid() return type ===");
  const { rows: authuid } = await client.query(`
    select pg_get_function_result(oid) as result_type, proname
    from pg_proc where proname = 'uid' and pronamespace = 'auth'::regnamespace
  `);
  for (const a of authuid) console.log(`  auth.uid() -> ${a.result_type}`);

  // Check all ID column types in key tables
  console.log("\n=== ID column types ===");
  const { rows: idcols } = await client.query(`
    select table_name, column_name, data_type, udt_name
    from information_schema.columns
    where table_schema='public' and column_name in ('id','creator_id','fan_id','user_id','admin_id','sender_id','reporter_id','stream_id','episode_id')
    order by table_name, column_name
  `);
  for (const c of idcols) console.log(`  ${c.table_name}.${c.column_name}: ${c.data_type} (${c.udt_name})`);

  // Check existing RLS policies that reference auth.uid()
  console.log("\n=== Existing policies using auth.uid() ===");
  const { rows: policies } = await client.query(`
    select tablename, policyname, qual, with_check
    from pg_policies where schemaname='public' and (qual like '%auth.uid%' or with_check like '%auth.uid%')
    order by tablename limit 10
  `);
  for (const p of policies) console.log(`  ${p.tablename}.${p.policyname}: ${p.qual || p.with_check}`);

  client.release();
  await pool.end();
}
main().catch(e => { console.error("Fatal:", e.message); process.exit(1); });
