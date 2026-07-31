import { Pool } from "pg";
import { readFileSync } from "fs";

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
  console.log("Connected to Supabase (us-east-2)\n");

  // 1. Apply the uuid→text migration
  const migrationPath = "/home/user/rork-app/backend/migrations/021_uuid_to_text.sql";
  const sql = readFileSync(migrationPath, "utf-8");
  process.stdout.write("  Applying 021_uuid_to_text.sql... ");
  try {
    await client.query("begin");
    await client.query(sql);
    await client.query("commit");
    console.log("OK");
  } catch (err: any) {
    await client.query("rollback");
    console.log(`FAILED: ${err.message.split("\n")[0]}`);
    client.release();
    await pool.end();
    process.exit(1);
  }

  // 2. Recreate views (from 018_views.sql)
  const viewsPath = "/home/user/rork-app/backend/migrations/018_views.sql";
  const viewsSql = readFileSync(viewsPath, "utf-8");
  process.stdout.write("  Recreating views (018_views.sql)... ");
  try {
    await client.query("begin");
    await client.query(viewsSql);
    await client.query("commit");
    console.log("OK");
  } catch (err: any) {
    await client.query("rollback");
    console.log(`FAILED: ${err.message.split("\n")[0]}`);
  }

  // 3. Reapply RLS policies (020_rls.sql) — the policies are idempotent
  const rlsPath = "/home/user/rork-app/backend/migrations/020_rls.sql";
  const rlsSql = readFileSync(rlsPath, "utf-8");
  process.stdout.write("  Reapplying RLS policies (020_rls.sql)... ");
  try {
    await client.query("begin");
    await client.query(rlsSql);
    await client.query("commit");
    console.log("OK");
  } catch (err: any) {
    await client.query("rollback");
    console.log(`FAILED: ${err.message.split("\n")[0]}`);
  }

  // 4. Verify column types
  console.log("\n--- Verifying profiles.id type ---");
  const { rows: profileCol } = await client.query(
    "select column_name, data_type from information_schema.columns where table_schema='public' and table_name='profiles' and column_name in ('id','kyc_reviewed_by') order by column_name"
  );
  for (const c of profileCol) console.log(`  profiles.${c.column_name}: ${c.data_type}`);

  console.log("\n--- Verifying FK columns are text ---");
  const { rows: userCols } = await client.query(
    `select table_name, column_name, data_type from information_schema.columns 
     where table_schema='public' and column_name in ('creator_id','fan_id','user_id','sender_id','reporter_id','target_user_id','assigned_admin_id','processed_by','reviewer_id','admin_id')
     order by table_name, column_name`
  );
  for (const c of userCols) console.log(`  ${c.table_name}.${c.column_name}: ${c.data_type}`);

  console.log("\n--- Verifying views exist ---");
  const { rows: views } = await client.query(
    "select viewname from pg_views where schemaname='public' order by viewname"
  );
  for (const v of views) console.log(`  ${v.viewname}`);

  console.log("\n--- Verifying bump_dm_thread signature ---");
  const { rows: rpc } = await client.query(
    "select routine_name, data_type from information_schema.routines where routine_schema='public' and routine_name='bump_dm_thread'"
  );
  for (const r of rpc) console.log(`  ${r.routine_name} -> ${r.data_type}`);

  client.release();
  await pool.end();
  console.log("\n✓ Migration complete!");
}
main().catch((e) => { console.error("Fatal:", e.message); process.exit(1); });
