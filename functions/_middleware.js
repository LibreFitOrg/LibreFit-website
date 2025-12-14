import { errorTemplate } from '../src/error.html';

export async function onRequest({ request, env, next }) {
  try {
    // Run the actual request
    return await next(); 
  } catch (error) {
    // Generate a Request ID for unexcepted errors tracking
    const requestId = crypto.randomUUID();

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
                message: error.message || "Unknown Error",
                stack: error.stack || "No stack trace",
                timestamp: new Date()
            }
        ).onConflictDoUpdate(
            {
                target: requestId,
                set: {
                    method: request.method,
                    url: request.url,
                    message: error.message || "Unknown Error",
                    stack: error.stack || "No stack trace",
                    timestamp: new Date()
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
}