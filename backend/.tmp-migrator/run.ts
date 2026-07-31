import { Pool } from "pg";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";

const PROJECT_REF = "ukiriolnxozcofphltza";
const DB_PASSWORD = "1JS9fYrJpsWHpqSd";
const POOLER_HOST = "aws-0-us-east-2.pooler.supabase.com";
const POOLER_PORT = 6543;

const pool = new Pool({
  host: POOLER_HOST,
  port: POOLER_PORT,
  user: `postgres.${PROJECT_REF}`,
  password: DB_PASSWORD,
  database: "postgres",
  ssl: { rejectUnauthorized: false, servername: `${PROJECT_REF}.pooler.supabase.com` },
  connectionTimeoutMillis: 15000,
  max: 3,
});

const MIGRATIONS_DIR = "/home/user/rork-app/backend/migrations";

async function main() {
  console.log("Connecting to Supabase pooler (us-east-2)...");
  const client = await pool.connect();
  console.log("Connected!\n");

  const { rows } = await client.query("select current_database(), current_user, version()");
  console.log("DB:", rows[0].current_database);
  console.log("User:", rows[0].current_user);
  console.log("Version:", rows[0].version.split(",")[0]);
  console.log("");

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f: string) => f.endsWith(".sql"))
    .sort();

  console.log(`Found ${files.length} SQL files\n`);

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
    }
  }

  console.log("\n--- Verifying tables ---");
  const { rows: tables } = await client.query(
    "select tablename from pg_tables where schemaname='public' order by tablename"
  );
  console.log(`Tables: ${tables.length}`);
  for (const t of tables) console.log(`  - ${t.tablename}`);

  console.log("\n--- Verifying views ---");
  const { rows: views } = await client.query(
    "select viewname from pg_views where schemaname='public' order by viewname"
  );
  console.log(`Views: ${views.length}`);
  for (const v of views) console.log(`  - ${v.viewname}`);

  console.log("\n--- Verifying RLS policies ---");
  const { rows: policies } = await client.query(
    "select tablename, count(*) as cnt from pg_policies where schemaname='public' group by tablename order by tablename"
  );
  const totalPolicies = policies.reduce((s: number, r: any) => s + parseInt(r.cnt), 0);
  console.log(`RLS policies: ${totalPolicies}`);
  for (const p of policies) console.log(`  - ${p.tablename}: ${p.cnt}`);

  console.log("\n--- Verifying RPCs ---");
  const { rows: rpcs } = await client.query(
    "select routine_name from information_schema.routines where routine_schema='public' and routine_type='FUNCTION' order by routine_name"
  );
  console.log(`Functions: ${rpcs.length}`);
  for (const r of rpcs) console.log(`  - ${r.routine_name}`);

  console.log("\n--- Seed data: categories ---");
  const { rows: cats } = await client.query("select slug, name from categories order by slug");
  console.log(`Categories: ${cats.length}`);
  for (const c of cats) console.log(`  - ${c.slug}: ${c.name}`);

  console.log("\n--- Storage buckets ---");
  const { rows: buckets } = await client.query(
    "select id, name, public from storage.buckets order by name"
  );
  console.log(`Buckets: ${buckets.length}`);
  for (const b of buckets) console.log(`  - ${b.name} (public=${b.public})`);

  client.release();
  await pool.end();
  console.log("\n✓ All migrations applied successfully!");
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
