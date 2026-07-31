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

  // Check profiles.id column type
  const { rows: cols } = await client.query(`
    select column_name, data_type, udt_name
    from information_schema.columns
    where table_schema='public' and table_name='profiles'
    order by ordinal_position
  `);
  console.log("--- profiles columns ---");
  for (const c of cols) console.log(`  ${c.column_name}: ${c.data_type} (${c.udt_name})`);

  // Check all user-id FK columns
  const { rows: fks } = await client.query(`
    select tc.table_name, kcu.column_name, ccu.table_name as ref_table, ccu.column_name as ref_col
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu on tc.constraint_name = kcu.constraint_name
    join information_schema.constraint_column_usage ccu on tc.constraint_name = ccu.constraint_name
    where tc.constraint_type='FOREIGN KEY' and ccu.table_name='profiles'
  `);
  console.log("\n--- FKs referencing profiles ---");
  for (const f of fks) console.log(`  ${f.table_name}.${f.column_name} -> ${f.ref_table}.${f.ref_col}`);

  client.release();
  await pool.end();
}
main().catch((e) => { console.error("Fatal:", e.message); process.exit(1); });
