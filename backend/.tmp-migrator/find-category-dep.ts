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

  // 1. Find views that depend on profiles.categories
  const { rows: depViews } = await client.query(`
    select distinct v.viewname, v.definition
    from pg_views v
    join pg_depend d on d.refobjid = (select oid from pg_class where relname='profiles' and relnamespace=(select oid from pg_namespace where nspname='public'))
    where v.schemaname = 'public'
  `);
  console.log(`--- Views depending on profiles (${depViews.length}) ---`);
  for (const v of depViews) {
    const def = String(v.definition);
    const usesCategories = def.includes('categories');
    console.log(`  ${v.viewname} ${usesCategories ? "⚠️ uses categories" : ""}`);
    if (usesCategories) {
      console.log(`    ${def.slice(0, 300)}`);
    }
  }

  // 2. Find the exact dependency
  const { rows: deps } = await client.query(`
    select 
      dep.refobjname as table,
      att.attname as column,
      cl.relname as dependent_object,
      cl.relkind
    from pg_depend dep
    join pg_attribute att on att.attrelid = dep.refobjid and att.attnum = dep.refobjsubid
    join pg_class cl on cl.oid = dep.objid
    where dep.refobjname = 'profiles' and att.attname = 'categories'
  `);
  console.log(`\n--- Objects depending on profiles.categories (${deps.length}) ---`);
  for (const d of deps) {
    console.log(`  ${d.dependent_object} (kind: ${d.relkind}) via ${d.table}.${d.column}`);
  }

  // 3. Show all views with their full definitions
  const { rows: allViews } = await client.query(`
    select viewname, definition from pg_views where schemaname='public' order by viewname
  `);
  console.log(`\n--- All public views (${allViews.length}) ---`);
  for (const v of allViews) {
    const def = String(v.definition);
    if (def.includes('categories')) {
      console.log(`\n  ⚠️ ${v.viewname}:`);
      console.log(`    ${def}`);
    }
  }

  client.release();
  await pool.end();
}
main().catch((e) => { console.error("Fatal:", e.message); process.exit(1); });
