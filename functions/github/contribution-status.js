import { eq, and, gt } from 'drizzle-orm';
import { getDb, contributors } from "../_db.js";
import html from '../../status.html';

export async function onRequest(context) {
  const { request } = context;

  // Get cookie
  const cookieHeader = request.headers.get("Cookie") || "";
  const sessionId = cookieHeader.split(';').find(c => c.trim().startsWith('session_id='))?.split('=')[1];

  if (!sessionId) return new Response(null, { status: 302, headers: { Location: "/github/login" } });

  // Initialize DB
  const db = getDb(env);

  // Lookup
  const result = await db.select()
    .from(contributors)
    .where(and(
      eq(contributors.sessionId, sessionId),
      gt(contributors.expiresAt, new Date()) // Check if not expired
    ));

  if (result.length === 0) {
    return new Response(null, { status: 302, headers: { Location: "/github/login" } });
  }

  const currentUser = result[0];

  // Check if user exits, then show code
  if (!currentUser) {
    page = html
        .replace('{{STATUS_TITLE}}', `Successful login`)
        .replace('{{STATUS_DESCRIPTION}}', `Thank you for your contribution! Your supporter code is down below: just copy and paste it inside the app.`)
        .replace('{{ID}}', `${currentUser.username}`)
        .replace('{{SUPPORTER_CODE}}', `${currentUser.code}`)
        .replace('{{URL_DESC}}', ``)
        .replace('{{REDIRECT_SNIPPET}}', ``);
  } else {
    page = html
        .replace('{{STATUS_TITLE}}', `Successful login but...`)
        .replace('{{STATUS_DESCRIPTION}}', `It looks like you haven't merged any pull request yet. If you think this is an error, contact us.`)
        .replace('{{ID}}', `${currentUser.username}`)
        .replace('{{SUPPORTER_CODE}}', `Not available`)
        .replace('{{URL_DESC}}', ``)
        .replace('{{REDIRECT_SNIPPET}}', ``);
  }

  
  return new Response( page, { headers: { "Content-Type": "text/html" } });
}