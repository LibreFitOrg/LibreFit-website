import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { pgTable, text, uuid } from "drizzle-orm/pg-core";

// Donations schema
export const donations = pgTable("user_preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  trade_id: text("trade_id"),
  status: text("status"),
  webhook_key: text("webhook_key"),
  code: text("code")
});

// Connection Helper
export function getDb(env) {
  const client = postgres(env.HYPERDRIVE.connectionString);
  return drizzle(client);
}