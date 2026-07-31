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
    if (!inDollarQuote && line.trim().endsWith(";")) {
      const trimmed = current.trim();
      if (trimmed.length > 0 && !trimmed.startsWith("--")) {
        statements.push(trimmed);
      }
      current = "";
    }
  }
  if (current.trim().length > 0) statements.push(current.trim());
  return statements;
}

async function main() {
  const client = await pool.connect();
  console.log("Connected to Supabase (us-east-2)\n");

  // ─── Step 1: Drop ALL existing RLS policies on all public tables ───
  console.log("=== Step 1: Drop ALL existing RLS policies ===");
  const { rows: allPolicies } = await client.query(
    "select tablename, policyname from pg_policies where schemaname='public'"
  );
  console.log(`Found ${allPolicies.length} policies to drop`);
  for (const p of allPolicies) {
    try {
      await client.query(`drop policy if exists "${p.policyname}" on public.${p.tablename}`);
    } catch (err: any) {
      console.log(`  Failed to drop ${p.tablename}.${p.policyname}: ${err.message.split("\n")[0]}`);
    }
  }
  console.log("All policies dropped\n");

  // ─── Step 2: Drop remaining stale FK constraints ───
  console.log("=== Step 2: Drop stale FK constraints ===");
  const { rows: allFks } = await client.query(
    `select tc.table_name, tc.constraint_name
     from information_schema.table_constraints tc
     where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema='public'`
  );
  for (const f of allFks) {
    try {
      await client.query(`alter table public.${f.table_name} drop constraint if exists "${f.constraint_name}"`);
    } catch (err: any) {
      console.log(`  Failed: ${err.message.split("\n")[0]}`);
    }
  }
  console.log("Stale FKs dropped\n");

  // ─── Step 3: Drop all views (will recreate) ───
  console.log("=== Step 3: Drop views ===");
  await client.query("drop view if exists public.active_streams cascade");
  await client.query("drop view if exists public.creator_stats cascade");
  await client.query("drop view if exists public.episode_performance cascade");
  await client.query("drop view if exists public.creator_revenue_daily cascade");
  await client.query("drop view if exists public.platform_revenue cascade");
  console.log("Views dropped\n");

  // ─── Step 4: Drop bump_dm_thread (will recreate with text param) ───
  console.log("=== Step 4: Drop bump_dm_thread ===");
  await client.query("drop function if exists public.bump_dm_thread(uuid, uuid)");
  await client.query("drop function if exists public.bump_dm_thread(text, uuid)");
  console.log("Done\n");

  // ─── Step 5: Recreate FK constraints ───
  console.log("=== Step 5: Recreate FK constraints ===");
  const fkStatements = [
    `alter table public.episodes add constraint episodes_creator_id_fkey foreign key (creator_id) references public.profiles(id) on delete cascade`,
    `alter table public.live_streams add constraint live_streams_creator_id_fkey foreign key (creator_id) references public.profiles(id) on delete cascade`,
    `alter table public.subscriptions add constraint subscriptions_fan_id_fkey foreign key (fan_id) references public.profiles(id) on delete cascade`,
    `alter table public.subscriptions add constraint subscriptions_creator_id_fkey foreign key (creator_id) references public.profiles(id) on delete cascade`,
    `alter table public.transactions add constraint transactions_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade`,
    `alter table public.transactions add constraint transactions_creator_id_fkey foreign key (creator_id) references public.profiles(id)`,
    `alter table public.tips add constraint tips_fan_id_fkey foreign key (fan_id) references public.profiles(id) on delete cascade`,
    `alter table public.tips add constraint tips_creator_id_fkey foreign key (creator_id) references public.profiles(id) on delete cascade`,
    `alter table public.unlocks add constraint unlocks_fan_id_fkey foreign key (fan_id) references public.profiles(id) on delete cascade`,
    `alter table public.chat_messages add constraint chat_messages_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade`,
    `alter table public.dm_threads add constraint dm_threads_creator_id_fkey foreign key (creator_id) references public.profiles(id) on delete cascade`,
    `alter table public.dm_threads add constraint dm_threads_fan_id_fkey foreign key (fan_id) references public.profiles(id) on delete cascade`,
    `alter table public.dm_messages add constraint dm_messages_sender_id_fkey foreign key (sender_id) references public.profiles(id) on delete cascade`,
    `alter table public.events add constraint events_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade`,
    `alter table public.events add constraint events_creator_id_fkey foreign key (creator_id) references public.profiles(id)`,
    `alter table public.reports add constraint reports_reporter_id_fkey foreign key (reporter_id) references public.profiles(id) on delete cascade`,
    `alter table public.reports add constraint reports_target_user_id_fkey foreign key (target_user_id) references public.profiles(id)`,
    `alter table public.reports add constraint reports_assigned_admin_id_fkey foreign key (assigned_admin_id) references public.profiles(id)`,
    `alter table public.payouts add constraint payouts_creator_id_fkey foreign key (creator_id) references public.profiles(id) on delete cascade`,
    `alter table public.payout_requests add constraint payout_requests_creator_id_fkey foreign key (creator_id) references public.profiles(id) on delete cascade`,
    `alter table public.payout_requests add constraint payout_requests_processed_by_fkey foreign key (processed_by) references public.profiles(id)`,
    `alter table public.push_tokens add constraint push_tokens_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade`,
    `alter table public.email_log add constraint email_log_user_id_fkey foreign key (user_id) references public.profiles(id) on delete set null`,
    `alter table public.verification_docs add constraint verification_docs_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade`,
    `alter table public.verification_docs add constraint verification_docs_reviewer_id_fkey foreign key (reviewer_id) references public.profiles(id)`,
    `alter table public.audit_logs add constraint audit_logs_admin_id_fkey foreign key (admin_id) references public.profiles(id) on delete cascade`,
  ];
  for (const stmt of fkStatements) {
    try {
      await client.query(stmt);
    } catch (err: any) {
      console.log(`  FK FAIL: ${err.message.split("\n")[0]}`);
    }
  }
  console.log(`FK constraints recreated (${fkStatements.length})\n`);

  // ─── Step 6: Recreate views + bump_dm_thread + RLS from 021 migration (statements after the ALTER section) ───
  console.log("=== Step 6: Apply views + RPCs + RLS from 021 migration ===");
  const migrationPath = "/home/user/rork-app/backend/migrations/021_uuid_to_text.sql";
  const fullSql = readFileSync(migrationPath, "utf-8");
  const allStatements = splitSql(fullSql);

  // Find the "Recreate bump_dm_thread" section and apply everything from there onward
  const recreateIdx = allStatements.findIndex((s) => s.includes("bump_dm_thread"));
  if (recreateIdx === -1) {
    console.log("ERROR: Could not find bump_dm_thread section in migration");
    client.release();
    await pool.end();
    process.exit(1);
  }
  const recreateStatements = allStatements.slice(recreateIdx);
  console.log(`Applying ${recreateStatements.length} statements (views + RPCs + RLS)\n`);

  let ok = 0;
  let fail = 0;
  for (const stmt of recreateStatements) {
    const preview = stmt.replace(/\s+/g, " ").slice(0, 70);
    try {
      await client.query(stmt);
      ok++;
    } catch (err: any) {
      console.log(`  FAIL: ${preview}... → ${err.message.split("\n")[0]}`);
      fail++;
    }
  }
  console.log(`${ok} succeeded, ${fail} failed\n`);

  // ─── Verify ───
  console.log("=== Verification ===");

  const { rows: policyCount } = await client.query(
    "select count(*) as cnt from pg_policies where schemaname='public'"
  );
  console.log(`RLS policies: ${policyCount[0].cnt}`);

  const { rows: fkCount } = await client.query(
    `select count(*) as cnt from information_schema.table_constraints tc
     where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema='public'`
  );
  console.log(`FK constraints: ${fkCount[0].cnt}`);

  const { rows: viewCount } = await client.query(
    "select viewname from pg_views where schemaname='public' order by viewname"
  );
  console.log(`Views: ${viewCount.length}`);
  for (const v of viewCount) console.log(`  ${v.viewname}`);

  const { rows: rpcCheck } = await client.query(
    "select routine_name, data_type from information_schema.routines where routine_schema='public' and routine_name='bump_dm_thread'"
  );
  console.log(`bump_dm_thread: ${rpcCheck.length > 0 ? rpcCheck[0].data_type : "NOT FOUND"}`);

  // Test a sample RLS policy to make sure it uses ::text
  const { rows: samplePolicy } = await client.query(
    "select tablename, policyname, qual from pg_policies where schemaname='public' and tablename='profiles' order by policyname"
  );
  console.log("\nSample profiles policies:");
  for (const p of samplePolicy) console.log(`  ${p.policyname}: ${p.qual}`);

  client.release();
  await pool.end();
  console.log("\n✓ Done!");
}
main().catch((e) => { console.error("Fatal:", e.message); process.exit(1); });
