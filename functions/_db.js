import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const donations = pgTable("donations", 
  {
    id: uuid("id").primaryKey().defaultRandom(),
    username: text("username"),
    trade_id: text("trade_id"),
    status: text("status"),
    webhook_key: text("webhook_key"),
    code: text("code")
  }
);

export const contributors = pgTable("contributors",
  {
    githubId: integer("github_id").primaryKey(),
    code: text("code")
  }
);

export const errorLogs = pgTable("error_logs", {
  id: uuid("id").primaryKey(),
  method: text("method").notNull(), 
  url: text("url").notNull(),
  message: text("message").notNull(),
  stack: text("stack").notNull(),
  timestamp: timestamp("timestamp").notNull(),
});

// Connection Helper
export function getDb(env) {
  const client = postgres(env.HYPERDRIVE.connectionString);
  return drizzle(client);
}