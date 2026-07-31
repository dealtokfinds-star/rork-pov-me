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

/** Split SQL into individual statements, respecting $$ dollar-quoting. */
function splitSql(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let inDollarQuote = false;
  let dollarTag = "";

  const lines = sql.split("\n");
  for (const line of lines) {
    // Track dollar-quoting
    const dollarMatches = line.match(/\$[a-zA-Z0-9_]*\$/g);
    if (dollarMatches) {
      for (const tag of dollarMatches) {
        if (!inDollarQuote) {
          inDollarQuote = true;
          dollarTag = tag;
        } else if (tag === dollarTag) {
          inDollarQuote = false;
          dollarTag = "";
        }
      }
    }

    current += line + "\n";

    // Split on semicolon if not inside dollar quotes
    if (!inDollarQuote && line.trim().endsWith(";")) {
      const trimmed = current.trim();
      if (trimmed.length > 0 && !trimmed.startsWith("--")) {
        statements.push(trimmed);
      }
      current = "";
    }
  }
  if (current.trim().length > 0) {
    statements.push(current.trim());
  }
  return statements;
}

async function main() {
  const client = await pool.connect();
  console.log("Connected to Supabase (us-east-2)\n");

  const migrationPath = "/home/user/rork-app/backend/migrations/021_uuid_to_text.sql";
  const sql = readFileSync(migrationPath, "utf-8");
  const statements = splitSql(sql);
  console.log(`Split into ${statements.length} statements\n`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const preview = stmt.replace(/\s+/g, " ").slice(0, 80);
    process.stdout.write(`  [${i + 1}/${statements.length}] ${preview}... `);
    try {
      await client.query(stmt);
      console.log("OK");
      success++;
    } catch (err: any) {
      const msg = err.message.split("\n")[0];
      console.log(`FAIL: ${msg}`);
      failed++;
      // If it's a critical ALTER TABLE failure, stop
      if (stmt.includes("alter table") && stmt.includes("type text")) {
        console.log("\n  ⛔ Critical ALTER TABLE failed — stopping.");
        break;
      }
    }
  }

  console.log(`\n${success} succeeded, ${failed} failed`);

  // Verify
  console.log("\n--- Verifying profiles.id type ---");
  const { rows: profileCol } = await client.query(
    "select column_name, data_type from information_schema.columns where table_schema='public' and table_name='profiles' and column_name = 'id'"
  );
  for (const c of profileCol) console.log(`  profiles.${c.column_name}: ${c.data_type}`);

  console.log("\n--- Verifying user-id columns ---");
  const { rows: userCols } = await client.query(
    `select table_name, column_name, data_type from information_schema.columns 
     where table_schema='public' and column_name in ('creator_id','fan_id','user_id','sender_id','reporter_id','assigned_admin_id','admin_id')
     and table_name in ('episodes','live_streams','subscriptions','transactions','tips','unlocks','chat_messages','dm_threads','dm_messages','events','reports','payouts','payout_requests','push_tokens','email_log','verification_docs','audit_logs')
     order by table_name, column_name`
  );
  let allText = true;
  for (const c of userCols) {
    const ok = c.data_type === "text";
    if (!ok) allText = false;
    console.log(`  ${c.table_name}.${c.column_name}: ${c.data_type} ${ok ? "✓" : "✗"}`);
  }
  console.log(`\nAll user-id columns are text: ${allText ? "YES ✓" : "NO ✗"}`);

  client.release();
  await pool.end();
  console.log("\n✓ Done!");
}
main().catch((e) => { console.error("Fatal:", e.message); process.exit(1); });
