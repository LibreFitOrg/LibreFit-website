import errorTemplate from '../templates/error.html';
import { getDb, errorLogs } from "./_db.js";
import type { Env } from "./types.js";

export const onRequest: PagesFunction<Env> = async ({ request, env, next }) => {
  try {
    // Run the actual request
    return await next();
  } catch (error) {
    // Generate a Request ID for unexcepted errors tracking
    const requestId = crypto.randomUUID();

    const err = error as { message?: string; stack?: string };
    console.error(`Error [${requestId}]:`, error);

    // Log to database in safe wrapper
    try {
      // Initialize DB
      const db = getDb(env);

      await db.insert(errorLogs).values(
        {
          id: requestId,
          method: request.method,
          url: request.url,
          message: err.message || "Unknown Error",
          stack: err.stack || "No stack trace",
        }
      ).onConflictDoUpdate(
        {
          target: errorLogs.id,
          set: {
            method: request.method,
            url: request.url,
            message: err.message || "Unknown Error",
            stack: err.stack || "No stack trace",
          }
        }
      );
    } catch (dbError) {
      // If the DB itself is down, just log to console so it doesn't crash hard
      console.error("Failed to log to db:", dbError);
    }

    const errorHtml = errorTemplate.replace('{{ERROR_ID}}', requestId);

    return new Response(errorHtml, {
      status: 500,
      headers: { "Content-Type": "text/html" }
    });
  }
};