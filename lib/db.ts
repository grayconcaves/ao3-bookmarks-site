import { Pool } from "pg";

// Reuse the pool across hot reloads / invocations to avoid exhausting
// connections in a serverless environment. Keep `max` low — Vercel spins
// up many concurrent function instances, each with its own pool.
declare global {
  // eslint-disable-next-line no-var
  var _pgPool: Pool | undefined;
}

export const pool =
  global._pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 1,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });

if (process.env.NODE_ENV !== "production") {
  global._pgPool = pool;
}
