import "server-only";

import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not configured");
}

export const sql = neon(databaseUrl);

export async function checkDatabaseConnection(): Promise<boolean> {
  const result = await sql`
    SELECT 1 AS ok
  `;

  return result[0]?.ok === 1;
}