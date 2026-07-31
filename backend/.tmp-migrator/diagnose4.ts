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

  // 1. auth.role() definition
  const { rows: roleDef } = await client.query(`
    select pg_get_functiondef(p.oid) as def
    from pg_proc p
    join pg_namespace n on p.pronamespace = n.oid
    where n.nspname = 'auth' and p.proname = 'role'
  `);
  console.log("--- auth.role() ---");
  for (const r of roleDef) console.log(r.def);

  // 2. auth.email() definition
  const { rows: emailDef } = await client.query(`
    select pg_get_functiondef(p.oid) as def
    from pg_proc p
    join pg_namespace n on p.pronamespace = n.oid
    where n.nspname = 'auth' and p.proname = 'email'
  `);
  console.log("\n--- auth.email() ---");
  for (const r of emailDef) console.log(r.def);

  // 3. All functions in rest schema (pre-request hook)
  const { rows: restFuncs } = await client.query(`
    select p.proname, pg_get_functiondef(p.oid) as def
    from pg_proc p
    join pg_namespace n on p.pronamespace = n.oid
    where n.nspname = 'rest'
  `);
  console.log(`\n--- rest schema functions (${restFuncs.length}) ---`);
  for (const f of restFuncs) {
    console.log(`  ${f.proname}:`);
    console.log(String(f.def).slice(0, 500));
  }

  // 4. ALL policies that use auth.role()
  const { rows: rolePolicies } = await client.query(`
    select tablename, policyname, cmd, qual, with_check
    from pg_policies
    where schemaname='public'
      and (qual::text like '%auth.role%' or with_check::text like '%auth.role%')
  `);
  console.log(`\n--- Policies using auth.role() (${rolePolicies.length}) ---`);
  for (const p of rolePolicies) {
    console.log(`  ${p.tablename}.${p.policyname} [${p.cmd}]: ${p.qual ?? p.with_check}`);
  }

  // 5. Simulate the error: set JWT and try auth.uid()
  console.log("\n--- Simulating error ---");
  try {
    await client.query(`set request.jwt.claim.sub = 'usr_5tjn4m2iakyd3v19zb0xy81d'`);
    const { rows } = await client.query(`select auth.uid() as uid`);
    console.log("  auth.uid():", rows[0]);
  } catch (err: any) {
    console.log("  auth.uid() FAILED:", err.message);
  }

  try {
    const { rows } = await client.query(`select auth.role() as role`);
    console.log("  auth.role():", rows[0]);
  } catch (err: any) {
    console.log("  auth.role() FAILED:", err.message);
  }

  try { await client.query(`reset request.jwt.claim.sub`); } catch {}

  client.release();
  await pool.end();
}
main().catch((e) => { console.error("Fatal:", e.message); process.exit(1); });
