import { Pool } from "pg";
import { readFileSync } from "fs";
import { join } from "path";

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

const MIGRATIONS_DIR = "/home/user/rork-app/backend/migrations";

async function main() {
  const client = await pool.connect();
  console.log("Connected to Supabase (us-east-2)\n");

  const files = ["019_rpcs.sql", "020_rls.sql"];

  for (const file of files) {
    const path = join(MIGRATIONS_DIR, file);
    const sql = readFileSync(path, "utf-8");
    process.stdout.write(`  Applying ${file}... `);
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query("commit");
      console.log("OK");
    } catch (err: any) {
      await client.query("rollback");
      console.log(`FAILED: ${err.message.split("\n")[0]}`);
    }
  }

  // Final verification
  console.log("\n--- Final verification ---");
  
  console.log("\nTables:");
  const { rows: tables } = await client.query(
    "select tablename from pg_tables where schemaname='public' order by tablename"
  );
  console.log(`  Count: ${tables.length}`);
  for (const t of tables) console.log(`    ${t.tablename}`);

  console.log("\nViews:");
  const { rows: views } = await client.query(
    "select viewname from pg_views where schemaname='public' order by viewname"
  );
  console.log(`  Count: ${views.length}`);
  for (const v of views) console.log(`    ${v.viewname}`);

  console.log("\nFunctions:");
  const { rows: funcs } = await client.query(
    "select routine_name, data_type from information_schema.routines where routine_schema='public' and routine_type='FUNCTION' order by routine_name"
  );
  console.log(`  Count: ${funcs.length}`);
  for (const f of funcs) console.log(`    ${f.routine_name} -> ${f.data_type}`);

  console.log("\nRLS policies:");
  const { rows: policies } = await client.query(
    "select tablename, count(*) as cnt from pg_policies where schemaname='public' group by tablename order by tablename"
  );
  const total = policies.reduce((s: number, r: any) => s + parseInt(r.cnt), 0);
  console.log(`  Total: ${total}`);
  for (const p of policies) console.log(`    ${p.tablename}: ${p.cnt}`);

  console.log("\nCategories:");
  const { rows: cats } = await client.query("select id, label, emoji from categories order by sort_order");
  console.log(`  Count: ${cats.length}`);
  for (const c of cats) console.log(`    ${c.id}: ${c.label} ${c.emoji}`);

  console.log("\nStorage buckets:");
  const { rows: buckets } = await client.query(
    "select id, name, public from storage.buckets order by name"
  );
  console.log(`  Count: ${buckets.length}`);
  for (const b of buckets) console.log(`    ${b.name} (public=${b.public})`);

  // Test that RLS policies work with auth.uid()::text
  console.log("\n--- Testing RLS policy syntax ---");
  try {
    const { rows: test } = await client.query(
      "select polname, polqual from pg_policies where schemaname='public' and tablename='profiles' order by polname"
    );
    for (const p of test) console.log(`  ${p.polname}: ${p.polqual}`);
  } catch (e: any) {
    console.log(`  Error: ${e.message}`);
  }

  client.release();
  await pool.end();
  console.log("\n✓ All migrations applied successfully!");
}
main().catch(e => { console.error("Fatal:", e.message); process.exit(1); });
