import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { integer, pgTable, text, timestamp, uuid, doublePrecision } from "drizzle-orm/pg-core";

export const donations = pgTable("donations", 
  {
    id: uuid("id").primaryKey().defaultRandom(),
    username: text("username"),
    trade_id: text("trade_id"),
    status: text("status"),
    webhook_key: text("webhook_key"),
    code: text("code"),
    coin: text("coin"),
    amount: doublePrecision("amount"),
    created_timestamp: timestamp("created_timestamp").defaultNow(),
    last_update_timestamp: timestamp("last_update_timestamp").defaultNow(),
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
  timestamp: timestamp("timestamp").defaultNow(),
});

// Connection Helper
export function getDb(env) {
  const client = postgres(env.HYPERDRIVE.connectionString);
  return drizzle(client);
}