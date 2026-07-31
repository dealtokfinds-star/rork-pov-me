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
  
  // Check profiles table structure
  console.log("=== profiles columns ===");
  const { rows: profilesCols } = await client.query(
    "select column_name, data_type, is_nullable, column_default from information_schema.columns where table_schema='public' and table_name='profiles' order by ordinal_position"
  );
  for (const c of profilesCols) {
    console.log(`  ${c.column_name}: ${c.data_type} (nullable=${c.is_nullable}, default=${c.column_default || 'none'})`);
  }

  // Check if profiles references auth.users
  console.log("\n=== profiles FK constraints ===");
  const { rows: profilesFK } = await client.query(
    "select tc.constraint_name, kcu.column_name, ccu.table_name as foreign_table, ccu.column_name as foreign_column from information_schema.table_constraints tc join information_schema.key_column_usage kcu on tc.constraint_name = kcu.constraint_name join information_schema.constraint_column_usage ccu on tc.constraint_name = ccu.constraint_name where tc.table_name='profiles' and tc.constraint_type='FOREIGN KEY'"
  );
  for (const f of profilesFK) {
    console.log(`  ${f.column_name} -> ${f.foreign_table}.${f.foreign_column}`);
  }

  // Check categories columns
  console.log("\n=== categories columns ===");
  const { rows: catCols } = await client.query(
    "select column_name, data_type from information_schema.columns where table_schema='public' and table_name='categories' order by ordinal_position"
  );
  for (const c of catCols) console.log(`  ${c.column_name}: ${c.data_type}`);

  // Check existing views
  console.log("\n=== existing views ===");
  const { rows: views } = await client.query(
    "select viewname from pg_views where schemaname='public' order by viewname"
  );
  for (const v of views) console.log(`  ${v.viewname}`);

  // Check existing functions
  console.log("\n=== existing functions ===");
  const { rows: funcs } = await client.query(
    "select routine_name, data_type as return_type from information_schema.routines where routine_schema='public' and routine_type='FUNCTION' order by routine_name"
  );
  for (const f of funcs) console.log(`  ${f.routine_name} -> ${f.return_type}`);

  // Check existing triggers on profiles
  console.log("\n=== triggers on profiles ===");
  const { rows: triggers } = await client.query(
    "select trigger_name, event_manipulation, action_timing from information_schema.triggers where event_object_schema='public' and event_object_table='profiles'"
  );
  for (const t of triggers) console.log(`  ${t.trigger_name} ${t.action_timing} ${t.event_manipulation}`);

  // Check if audit_logs exists
  console.log("\n=== audit_logs exists? ===");
  const { rows: al } = await client.query(
    "select exists(select 1 from pg_tables where schemaname='public' and tablename='audit_logs') as exists"
  );
  console.log(`  audit_logs table: ${al[0].exists}`);

  // Check RLS enabled tables
  console.log("\n=== RLS enabled tables ===");
  const { rows: rls } = await client.query(
    "select tablename, rowsecurity from pg_tables where schemaname='public' and rowsecurity=true order by tablename"
  );
  for (const r of rls) console.log(`  ${r.tablename}: RLS=${r.rowsecurity}`);

  client.release();
  await pool.end();
}
main().catch(e => { console.error("Fatal:", e.message); process.exit(1); });
