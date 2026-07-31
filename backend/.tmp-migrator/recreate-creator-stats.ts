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

  // Recreate creator_stats view from the migration definition
  console.log("--- Recreating creator_stats view ---");
  try {
    await client.query(`
      create or replace view public.creator_stats as
      select
        p.id as creator_id,
        p.is_creator,
        p.verified,
        p.categories,
        p.sub_price,
        coalesce(ep.ep_count, 0) as ep_count,
        coalesce(ep.ep_views, 0) as ep_views,
        coalesce(ep.ep_likes, 0) as ep_likes,
        coalesce(ep.ep_tips, 0) as ep_tips,
        coalesce(s.sub_count, 0) as sub_count
      from public.profiles p
      left join (
        select creator_id,
          count(*) as ep_count,
          coalesce(sum(views), 0) as ep_views,
          coalesce(sum(likes), 0) as ep_likes,
          coalesce(sum(tips), 0) as ep_tips
        from public.episodes
        where status = 'published'
        group by creator_id
      ) ep on ep.creator_id = p.id
      left join (
        select creator_id, count(*) as sub_count
        from public.subscriptions
        where active = true
        group by creator_id
      ) s on s.creator_id = p.id
      where p.is_creator = true;
    `);
    console.log("  ✓ creator_stats view recreated");
  } catch (err: any) {
    console.log("  ✗ FAILED:", err.message);
  }

  // Verify it's queryable
  try {
    const { rows } = await client.query(`select * from creator_stats limit 1`);
    console.log("  ✓ view queryable, columns:", rows[0] ? Object.keys(rows[0]).join(", ") : "no rows");
  } catch (err: any) {
    console.log("  ✗ query FAILED:", err.message);
  }

  // Final verification: all views
  const { rows: allViews } = await client.query(`
    select viewname from pg_views where schemaname='public' order by viewname
  `);
  console.log("\n--- All public views ---");
  for (const v of allViews) console.log(`  ${v.viewname}`);

  // Final test: the exact publishCreatorProfile update
  console.log("\n--- Final publishCreatorProfile test ---");
  try {
    const { rows } = await client.query(`
      update profiles set
        is_creator = true,
        identity = 'Test',
        categories = '["trading"]'::jsonb,
        sub_price = 12.99,
        onboarded = true,
        updated_at = now()
      where id = 'usr_5tjn4m2iakyd3v19zb0xy81d'
      returning id, categories
    `);
    console.log("  ✓ UPDATE OK:", rows[0]);
  } catch (err: any) {
    console.log("  ✗ FAILED:", err.message);
  }

  // Restore
  try {
    await client.query(`
      update profiles set identity = 'Ggg g', categories = '["bettor"]'::jsonb, sub_price = 29.99
      where id = 'usr_5tjn4m2iakyd3v19zb0xy81d'
    `);
  } catch {}

  client.release();
  await pool.end();
}
main().catch((e) => { console.error("Fatal:", e.message); process.exit(1); });
