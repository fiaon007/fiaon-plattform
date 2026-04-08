import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import pkg from 'pg';
import * as schema from "../shared/schema";

const { Pool } = pkg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

const connectionString = process.env.DATABASE_URL;

export const client = postgres(connectionString, {
  max: 1,
  ssl: 'require',
  transform: {
    // Global Date→ISO serialization: prevents postgres-js from crashing
    // with "Received an instance of Date" in Buffer.byteLength calls.
    // Function form handles both incoming & outgoing values (see postgres-js docs).
    value: (v: any) => v instanceof Date ? v.toISOString() : v,
  },
});

// Export pool for session store (connect-pg-simple requires pg Pool)
export const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

export const db = drizzle(client, { schema });
