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
  // Check all constraints on profiles
  const { rows: constraints } = await client.query(`
    select con.conname, con.contype, pg_get_constraintdef(con.oid) as def
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = connamespace
    where nsp.nspname = 'public' and rel.relname = 'profiles'
    order by con.contype
  `);
  console.log("Constraints on profiles:");
  for (const c of constraints) {
    console.log(`  ${c.conname} | type=${c.contype} | ${c.def}`);
  }

  // Check indexes
  const { rows: indexes } = await client.query(`
    select indexname, indexdef from pg_indexes where schemaname='public' and tablename='profiles'
  `);
  console.log("\nIndexes:");
  for (const i of indexes) console.log(`  ${i.indexname}: ${i.indexdef}`);

  // Check the full column list with defaults
  const { rows: cols } = await client.query(`
    select column_name, data_type, is_nullable, column_default
    from information_schema.columns
    where table_schema='public' and table_name='profiles'
    order by ordinal_position
  `);
  console.log("\nAll columns:");
  for (const c of cols) {
    console.log(`  ${c.column_name} | ${c.data_type} | nullable=${c.is_nullable} | default=${c.column_default}`);
  }

  // Check triggers
  const { rows: triggers } = await client.query(`
    select trigger_name, event_manipulation, action_statement
    from information_schema.triggers
    where event_object_schema='public' and event_object_table='profiles'
  `);
  console.log("\nTriggers:");
  for (const t of triggers) console.log(`  ${t.trigger_name} | ${t.event_manipulation} | ${t.action_statement}`);

  await client.release();
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
