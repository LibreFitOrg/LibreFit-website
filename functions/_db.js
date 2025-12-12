import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { pgTable, text, uuid, integer, timestamp } from "drizzle-orm/pg-core";

// Donations schema
export const donations = pgTable("donations", 
  {
    id: uuid("id").primaryKey().defaultRandom(),
    trade_id: text("trade_id"),
    status: text("status"),
    webhook_key: text("webhook_key"),
    code: text("code")
  }
);

export const contributors = pgTable("contributors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    githubId: integer('github_id').unique().notNull(), 
    username: text("username"),
    code: text("code"),
    sessionId: text("session_id").unique(),
    expiresAt: timestamp('expires_at')
  }
);

// Connection Helper
export function getDb(env) {
  const client = postgres(env.HYPERDRIVE.connectionString);
  return drizzle(client);
}