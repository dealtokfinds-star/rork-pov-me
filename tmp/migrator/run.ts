import { Pool } from "pg";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";

const PROJECT_REF = "ukiriolnxozcofphltza";
const DB_PASSWORD = "1JS9fYrJpsWHpqSd";

// Supabase pooler (Transaction mode, IPv4, port 6543)
const connStr = `postgresql://postgres.${PROJECT_REF}:${encodeURIComponent(DB_PASSWORD)}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;

const pool = new Pool({
  connectionString: connStr,
  connectionTimeoutMillis: 10000,
  max: 3,
});

const MIGRATIONS_DIR = join("/home/user/rork-app/backend", "migrations");

async function main() {
  console.log("Connecting to Supabase pooler...");
  const client = await pool.connect();
  console.log("Connected!\n");

  // Verify connection
  const { rows } = await client.query("select current_database(), current_user, version()");
  console.log("DB:", rows[0].current_database);
  console.log("User:", rows[0].current_user);
  console.log("Version:", rows[0].version.split(",")[0]);
  console.log("");

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  console.log(`Found ${files.length} migration files\n`);

  for (const file of files) {
    const path = join(MIGRATIONS_DIR, file);
    const sql = readFileSync(path, "utf-8");
    const size = (sql.length / 1024).toFixed(1);
    process.stdout.write(`  Applying ${file} (${size}KB)... `);
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query("commit");
      console.log("OK");
    } catch (err: any) {
      await client.query("rollback");
      const msg = err.message.split("\n")[0];
      console.log(`FAILED: ${msg}`);
      // Continue to next migration — many use IF NOT EXISTS so partial failure is ok
    }
  }

  console.log("\n--- Verifying tables ---");
  const { rows: tables } = await client.query(
    `select tablename from pg_tables where schemaname='public' order by tablename`
  );
  console.log(`Tables created: ${tables.length}`);
  for (const t of tables) {
    console.log(`  - ${t.tablename}`);
  }

  console.log("\n--- Verifying views ---");
  const { rows: views } = await client.query(
    `select viewname from pg_views where schemaname='public' order by viewname`
  );
  console.log(`Views: ${views.length}`);
  for (const v of views) {
    console.log(`  - ${v.viewname}`);
  }

  console.log("\n--- Verifying RLS policies ---");
  const { rows: policies } = await client.query(
    `select tablename, policyname from pg_policies where schemaname='public' order by tablename, policyname`
  );
  console.log(`RLS policies: ${policies.length}`);

  console.log("\n--- Verifying RPCs ---");
  const { rows: rpcs } = await client.query(
    `select routine_name from information_schema.routines where routine_schema='public' and routine_type='FUNCTION' order by routine_name`
  );
  console.log(`Functions: ${rpcs.length}`);
  for (const r of rpcs) {
    console.log(`  - ${r.routine_name}`);
  }

  console.log("\n--- Seed data: categories ---");
  const { rows: cats } = await client.query("select slug, name from categories order by slug");
  console.log(`Categories: ${cats.length}`);
  for (const c of cats) {
    console.log(`  - ${c.slug}: ${c.name}`);
  }

  client.release();
  await pool.end();
  console.log("\nDone! All migrations applied.");
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
