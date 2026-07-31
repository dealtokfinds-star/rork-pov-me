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
  console.log("Connected — dropping auth.uid()-based policies and recreating with public.user_id()\n");

  // Drop ALL existing policies that use auth.uid(), then recreate with user_id()
  const policies = [
    // profiles
    { table: "profiles", name: "profiles_select_self",       type: "SELECT", using: "user_id() = id" },
    { table: "profiles", name: "profiles_insert_self",       type: "INSERT", check: "user_id() = id" },
    { table: "profiles", name: "profiles_update_self",       type: "UPDATE", using: "user_id() = id" },
    // episodes
    { table: "episodes", name: "episodes_select_public",     type: "SELECT", using: "status = 'published' or user_id() = creator_id" },
    { table: "episodes", name: "episodes_insert_creator",    type: "INSERT", check: "user_id() = creator_id" },
    { table: "episodes", name: "episodes_update_creator",    type: "UPDATE", using: "user_id() = creator_id" },
    { table: "episodes", name: "episodes_delete_creator",    type: "DELETE", using: "user_id() = creator_id" },
    // live_streams
    { table: "live_streams", name: "live_streams_select_public",  type: "SELECT", using: "true" },
    { table: "live_streams", name: "live_streams_insert_creator", type: "INSERT", check: "user_id() = creator_id" },
    { table: "live_streams", name: "live_streams_update_creator", type: "UPDATE", using: "user_id() = creator_id" },
    { table: "live_streams", name: "live_streams_delete_creator", type: "DELETE", using: "user_id() = creator_id" },
    // subscriptions
    { table: "subscriptions", name: "subs_select_fan",      type: "SELECT", using: "user_id() = fan_id or user_id() = creator_id" },
    { table: "subscriptions", name: "subs_insert_fan",      type: "INSERT", check: "user_id() = fan_id" },
    // transactions
    { table: "transactions", name: "tx_select_user",        type: "SELECT", using: "user_id() = user_id_col or user_id() = creator_id" },
    { table: "transactions", name: "tx_insert_user",        type: "INSERT", check: "user_id() = user_id_col" },
    // tips
    { table: "tips", name: "tips_select",                   type: "SELECT", using: "user_id() = fan_id or user_id() = creator_id" },
    { table: "tips", name: "tips_insert_fan",               type: "INSERT", check: "user_id() = fan_id" },
    // unlocks
    { table: "unlocks", name: "unlocks_select_fan",         type: "SELECT", using: "user_id() = fan_id or exists (select 1 from episodes e where e.id = unlocks.episode_id and e.creator_id = user_id())" },
    { table: "unlocks", name: "unlocks_insert_fan",         type: "INSERT", check: "user_id() = fan_id" },
    // chat_messages
    { table: "chat_messages", name: "chat_select_auth",     type: "SELECT", using: "auth.role() = 'authenticated'" },
    { table: "chat_messages", name: "chat_insert_auth",     type: "INSERT", check: "user_id() = user_id_col" },
    // dm_threads
    { table: "dm_threads", name: "dm_threads_select",       type: "SELECT", using: "user_id() = fan_id or user_id() = creator_id" },
    { table: "dm_threads", name: "dm_threads_insert",       type: "INSERT", check: "user_id() = fan_id or user_id() = creator_id" },
    // dm_messages
    { table: "dm_messages", name: "dm_messages_select",     type: "SELECT", using: "user_id() = sender_id or exists (select 1 from dm_threads t where t.id = dm_messages.thread_id and (t.fan_id = user_id() or t.creator_id = user_id()))" },
    { table: "dm_messages", name: "dm_messages_insert",     type: "INSERT", check: "user_id() = sender_id" },
    // events
    { table: "events", name: "events_select",               type: "SELECT", using: "user_id() = user_id_col or user_id() = creator_id" },
    { table: "events", name: "events_insert",               type: "INSERT", check: "user_id() = user_id_col" },
    // reports
    { table: "reports", name: "reports_insert",             type: "INSERT", check: "user_id() = reporter_id" },
    { table: "reports", name: "reports_select_reporter",    type: "SELECT", using: "user_id() = reporter_id" },
    { table: "reports", name: "reports_select_admin",       type: "SELECT", using: "exists (select 1 from profiles p where p.id = user_id() and p.is_admin = true)" },
    // payouts
    { table: "payouts", name: "payouts_select_creator",     type: "SELECT", using: "user_id() = creator_id" },
    // payout_requests
    { table: "payout_requests", name: "payout_requests_select_creator", type: "SELECT", using: "user_id() = creator_id" },
    { table: "payout_requests", name: "payout_requests_insert_creator", type: "INSERT", check: "user_id() = creator_id" },
    // push_tokens
    { table: "push_tokens", name: "push_tokens_select_self", type: "SELECT", using: "user_id() = user_id_col" },
    { table: "push_tokens", name: "push_tokens_insert_self", type: "INSERT", check: "user_id() = user_id_col" },
    { table: "push_tokens", name: "push_tokens_update_self", type: "UPDATE", using: "user_id() = user_id_col" },
    { table: "push_tokens", name: "push_tokens_delete_self", type: "DELETE", using: "user_id() = user_id_col" },
    // email_log
    { table: "email_log", name: "email_log_select_self",    type: "SELECT", using: "user_id() = user_id_col" },
    // verification_docs
    { table: "verification_docs", name: "verification_docs_select_self", type: "SELECT", using: "user_id() = user_id_col" },
    { table: "verification_docs", name: "verification_docs_insert_self", type: "INSERT", check: "user_id() = user_id_col" },
    // audit_logs
    { table: "audit_logs", name: "audit_logs_select_admin", type: "SELECT", using: "exists (select 1 from profiles p where p.id = user_id() and p.is_admin = true)" },
  ];

  // First, get the actual column names for transactions, events, chat_messages, push_tokens, email_log, verification_docs
  // that reference user_id (to avoid confusion with the user_id() function)
  const colMap: Record<string, string> = {
    "transactions.user_id": "user_id",
    "events.user_id": "user_id",
    "chat_messages.user_id": "user_id",
    "push_tokens.user_id": "user_id",
    "email_log.user_id": "user_id",
    "verification_docs.user_id": "user_id",
  };

  let dropped = 0, created = 0;
  const errors: string[] = [];

  for (const p of policies) {
    try {
      await client.query(`drop policy if exists "${p.name}" on public.${p.table}`);
      dropped++;
    } catch (e: any) {
      errors.push(`DROP ${p.table}.${p.name}: ${e.message}`);
    }
  }

  for (const p of policies) {
    // For tables where the column is literally "user_id", we need to qualify it
    // because user_id() is a function and user_id is a column — Postgres resolves
    // column first, so "user_id() = user_id" works (function has parens)
    let using = p.using ?? "";
    let check = p.check ?? "";

    // For transactions/events/chat/push/email/verification: column "user_id" conflicts with function name
    // Use table-qualified column names
    if (p.table === "transactions") {
      using = using.replace(/user_id\(\) = user_id_col/g, "user_id() = transactions.user_id");
      check = check.replace(/user_id\(\) = user_id_col/g, "user_id() = transactions.user_id");
    } else if (p.table === "events") {
      using = using.replace(/user_id\(\) = user_id_col/g, "user_id() = events.user_id");
      check = check.replace(/user_id\(\) = user_id_col/g, "user_id() = events.user_id");
    } else if (p.table === "chat_messages") {
      check = check.replace(/user_id\(\) = user_id_col/g, "user_id() = chat_messages.user_id");
    } else if (p.table === "push_tokens") {
      using = using.replace(/user_id\(\) = user_id_col/g, "user_id() = push_tokens.user_id");
      check = check.replace(/user_id\(\) = user_id_col/g, "user_id() = push_tokens.user_id");
    } else if (p.table === "email_log") {
      using = using.replace(/user_id\(\) = user_id_col/g, "user_id() = email_log.user_id");
    } else if (p.table === "verification_docs") {
      using = using.replace(/user_id\(\) = user_id_col/g, "user_id() = verification_docs.user_id");
      check = check.replace(/user_id\(\) = user_id_col/g, "user_id() = verification_docs.user_id");
    }

    try {
      let sql = `create policy "${p.name}" on public.${p.table} for ${p.type}`;
      if (p.type === "SELECT" && using) sql += ` using (${using})`;
      if (p.type === "INSERT" && check) sql += ` with check (${check})`;
      if (p.type === "UPDATE" && using) sql += ` using (${using})`;
      if (p.type === "DELETE" && using) sql += ` using (${using})`;
      await client.query(sql);
      created++;
    } catch (e: any) {
      errors.push(`CREATE ${p.table}.${p.name}: ${e.message}`);
    }
  }

  console.log(`Dropped: ${dropped}, Created: ${created}`);
  if (errors.length > 0) {
    console.log(`\nErrors (${errors.length}):`);
    for (const e of errors) console.log(`  ${e}`);
  }

  // Verify no more auth.uid() in policies
  const { rows: remaining } = await client.query(`
    select count(*) as cnt from pg_policies
    where schemaname='public'
    and (qual::text like '%auth.uid%' or with_check::text like '%auth.uid%')
  `);
  console.log(`\nPolicies still using auth.uid(): ${remaining[0].cnt}`);

  // Count total policies
  const { rows: total } = await client.query(`select count(*) as cnt from pg_policies where schemaname='public'`);
  console.log(`Total public policies: ${total[0].cnt}`);

  // Test: simulate a Rork Auth request with a usr_... sub
  console.log("\n--- Test: RLS with usr_... ID ---");
  try {
    await client.query(`set request.jwt.claim.sub = 'usr_test123abc'`);
    const { rows: testRows } = await client.query(`select user_id()`);
    console.log(`  user_id() returns: ${testRows[0].user_id}`);
    await client.query(`set request.jwt.claim.sub = ''`);
  } catch (e: any) {
    console.log(`  Test error: ${e.message}`);
  }

  client.release();
  await pool.end();
  console.log("\nDone!");
}
main().catch((e) => { console.error("Fatal:", e.message); process.exit(1); });
