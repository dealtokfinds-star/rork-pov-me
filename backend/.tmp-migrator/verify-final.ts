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
  console.log("Connected\n");

  // Check if active_streams exists
  const { rows: check } = await client.query(
    "select viewname from pg_views where schemaname='public' and viewname='active_streams'"
  );
  console.log(`active_streams exists: ${check.length > 0}`);

  if (check.length === 0) {
    console.log("Recreating active_streams view...");
    try {
      await client.query(`
        create or replace view public.active_streams as
        select
          id, creator_id, title, thumb_url, category, access, ppv_price,
          viewers, max_viewers, is_live, started_at, ended_at,
          health_status, peak_bitrate_kbps, dropped_frames_pct,
          hls_playback_url, mux_playback_id,
          replay_enabled, replay_episode_id,
          slow_mode, sub_only_chat, latency_mode, stream_source,
          is_co_stream, primary_stream_id, co_host_ids
        from public.live_streams
        where is_live = true
      `);
      console.log("active_streams recreated OK");
    } catch (err: any) {
      console.log(`FAILED: ${err.message}`);
    }
  }

  // Check user_id() function
  console.log("\n--- user_id() function ---");
  const { rows: uid } = await client.query(
    "select routine_name, data_type from information_schema.routines where routine_schema='public' and routine_name='user_id'"
  );
  for (const r of uid) console.log(`  ${r.routine_name} -> ${r.data_type}`);

  // Final view count
  const { rows: views } = await client.query(
    "select viewname from pg_views where schemaname='public' order by viewname"
  );
  console.log(`\nViews: ${views.length}`);
  for (const v of views) console.log(`  ${v.viewname}`);

  // Quick test: try inserting a profile with a string ID
  console.log("\n--- Test: insert profile with string ID ---");
  try {
    await client.query(`
      insert into public.profiles (id, email, name) 
      values ('usr_test_string_id_123', 'test@test.com', 'Test User')
      on conflict (id) do nothing
    `);
    console.log("  Insert OK ✓");

    // Clean up
    await client.query("delete from public.profiles where id = 'usr_test_string_id_123'");
    console.log("  Cleanup OK ✓");
  } catch (err: any) {
    console.log(`  FAILED: ${err.message.split("\n")[0]}`);
  }

  client.release();
  await pool.end();
  console.log("\n✓ Done!");
}
main().catch((e) => { console.error("Fatal:", e.message); process.exit(1); });
