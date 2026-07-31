import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema.js';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

// Railway's internal Postgres URL doesn't need SSL; external connections
// (e.g. connecting from your laptop) do. This handles both.
const isInternal = process.env.DATABASE_URL.includes('railway.internal');

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isInternal ? false : { rejectUnauthorized: false },
});

export const db = drizzle(pool, { schema });
