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
  // Check user_id() function definition
  const { rows: fns } = await client.query(`
    select routine_name, routine_type, data_type, security_type
    from information_schema.routines
    where routine_schema = 'public' and routine_name in ('user_id','auth_uid_text','uid_text')
  `);
  console.log("Functions:", JSON.stringify(fns, null, 2));

  // Get function source from pg_proc
  const { rows: procRows } = await client.query(`
    select p.proname, pg_get_functiondef(p.oid) as definition
    from pg_proc p
    join pg_namespace n on p.pronamespace = n.oid
    where n.nspname = 'public' and p.proname in ('user_id','auth_uid_text','uid_text')
  `);
  for (const r of procRows) {
    console.log(`\n--- ${r.proname} ---`);
    console.log(r.definition);
  }

  // All public functions
  const { rows: allFns } = await client.query(`
    select routine_name, data_type, routine_type
    from information_schema.routines
    where routine_schema = 'public'
    order by routine_name
  `);
  console.log("\nAll public functions:");
  for (const f of allFns) console.log(`  ${f.routine_name} | returns ${f.data_type} | ${f.routine_type}`);

  await client.release();
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
