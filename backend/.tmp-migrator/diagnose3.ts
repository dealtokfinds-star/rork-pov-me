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

  // Check the exact auth.uid() definition
  const { rows: uidDef } = await client.query(`
    select pg_get_functiondef(p.oid) as def
    from pg_proc p
    join pg_namespace n on p.pronamespace = n.oid
    where n.nspname = 'auth' and p.proname = 'uid'
  `);
  console.log(`--- auth.uid() definition (${uidDef.length}) ---`);
  for (const u of uidDef) console.log(u.def);

  // Functions calling auth.uid() - fix the query
  const { rows: uidCallers } = await client.query(`
    select n.nspname as schema, p.proname as name, pg_get_functiondef(p.oid) as def
    from pg_proc p
    join pg_namespace n on p.pronamespace = n.oid
    where n.nspname not in ('pg_catalog','information_schema')
    and pg_get_functiondef(p.oid) like '%auth.uid%'
    order by n.nspname, p.proname
  `);
  console.log(`\n--- Functions calling auth.uid() (${uidCallers.length}) ---`);
  for (const f of uidCallers) {
    console.log(`  ${f.schema}.${f.name}`);
    const def = String(f.def);
    const lines = def.split('\n').filter((l: string) => l.includes('auth.uid'));
    for (const line of lines) console.log(`    ${line.trim()}`);
  }

  // Check rest schema
  const { rows: restFuncs } = await client.query(`
    select n.nspname as schema, p.proname as name, pg_get_functiondef(p.oid) as def
    from pg_proc p
    join pg_namespace n on p.pronamespace = n.oid
    where n.nspname = 'rest'
    order by p.proname
  `);
  console.log(`\n--- rest schema functions (${restFuncs.length}) ---`);
  for (const f of restFuncs) {
    console.log(`  ${f.schema}.${f.name}`);
    console.log(`    ${String(f.def).slice(0, 300)}`);
  }

  // Check extensions / PostgREST version
  const { rows: exts } = await client.query(`
    select extname, extversion from pg_extension order by extname
  `);
  console.log(`\n--- Extensions ---`);
  for (const e of exts) console.log(`  ${e.extname} ${e.extversion}`);

  // Try to reproduce with role anon
  console.log("\n--- Simulating PostgREST request as anon ---");
  try {
    await client.query(`set role anon`);
    await client.query(`set request.jwt.claim.sub = 'usr_5tjn4m2iakyd3v19zb0xy81d'`);
    await client.query(`set request.jwt.claims = '{"sub":"usr_5tjn4m2iakyd3v19zb0xy81d","email":"test@test.com"}'`);
    
    const { rows } = await client.query(`select auth.uid() as uid`);
    console.log("  auth.uid():", rows[0]);
  } catch (err: any) {
    console.log("  auth.uid() FAILED:", err.message);
  }

  try {
    const { rows } = await client.query(`select id, creator_id, title from episodes order by posted_at desc limit 5`);
    console.log("  episodes query OK:", rows.length, "rows");
  } catch (err: any) {
    console.log("  episodes query FAILED:", err.message);
  }

  try {
    const { rows } = await client.query(`select id, kind, amount from transactions where user_id = 'usr_5tjn4m2iakyd3v19zb0xy81d' limit 5`);
    console.log("  transactions query OK:", rows.length, "rows");
  } catch (err: any) {
    console.log("  transactions query FAILED:", err.message);
  }

  // Reset
  try { await client.query(`reset role`); } catch {}
  try { await client.query(`reset request.jwt.claim.sub`); } catch {}
  try { await client.query(`reset request.jwt.claims`); } catch {}

  client.release();
  await pool.end();
}
main().catch((e) => { console.error("Fatal:", e.message); process.exit(1); });
