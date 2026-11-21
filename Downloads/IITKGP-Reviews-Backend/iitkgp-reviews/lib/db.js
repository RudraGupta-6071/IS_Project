import pg from 'pg';

const { Pool } = pg;
let pool;

export function query(sql, values = []) {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  pool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
  return pool.query(sql, values);
}
