import html from '../../status.html';
import { getDb, contributors } from "../_db.js";
import { signString } from '../_supporter-code-sign.js';

export async function onRequest({ request, env }) {
  const { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, PRIVATE_KEY } = env;

  if(!GITHUB_CLIENT_ID) {
    console.error("Configuration error: GITHUB_CLIENT_ID is not set.");
    return new Response("Server configuration error: GITHUB_CLIENT_ID is not set.", { status: 500 });
  }

  if(!GITHUB_CLIENT_SECRET) {
    console.error("Configuration error: GITHUB_CLIENT_SECRET is not set.");
    return new Response("Server configuration error: GITHUB_CLIENT_SECRET is not set.", { status: 500 });
  }

  if(!PRIVATE_KEY) {
    console.error("Configuration error: PRIVATE_KEY is not set.");
    return new Response("Server configuration error: PRIVATE_KEY is not set.", { status: 500 });
  }

  // Validate State (CSRF Protection)
  const code = new URL(request.url).searchParams.get("code");
  if (!code) return new Response("Missing code", { status: 400 });


  const receivedState = new URL(request.url).searchParams.get("state");
  if (!receivedState) return new Response("Missing state", { status: 400 });
  
  // Extract state from cookie
  const cookieHeader = request.headers.get("Cookie") || "";
  const storedState = cookieHeader.split(';').find(c => c.trim().startsWith('oauth_state='))?.split('=')[1];

  if (!receivedState || receivedState !== storedState) {
    return new Response("Security Error: State mismatch", { status: 403 });
  }
  

  // Exchange Code for Token
  const tokenResp = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code
    })
  });
  const tokenData = await tokenResp.json();

  // HTML for response
  let page;

  if (tokenData.error) {
    page = html
        .replace('{{STATUS_TITLE}}', `GitHub OAuth Error`)
        .replace('{{STATUS_DESCRIPTION}}', `There was an error during OAuth with GitHub, try to restart the login. If error persist, contact us.`)
        .replace('{{SUPPORTER_ID}}', `Unknown`)
        .replace('{{SUPPORTER_CODE}}', `Not available`)
        .replace('{{URL_DESC}}', ``)
        .replace('{{REDIRECT_SNIPPET}}', ``);
    return new Response( page, { headers: { "Content-Type": "text/html" } });
  }

  // Identify User
  const userResp = await fetch("https://api.github.com/user", {
    headers: { "Authorization": `Bearer ${tokenData.access_token}`, "User-Agent": "Pages" }
  });
  const userData = await userResp.json();
  const username = userData.login;

  // Initialize DB
  const db = getDb(env);

  // Generate new Session ID
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 Days

  // Generate code
  const signature = await signString(username, PRIVATE_KEY);
  const userCode = `${username}.${signature}`;

  // Query to handle everything
  await db.insert(contributors)
    .values({
      githubId: userData.id,
      username: username,
      code:userCode,
      sessionId: sessionId,
      expiresAt: expiresAt
    })
    .onConflictDoUpdate({
      target: contributors.githubId, // If this ID exists...
      set: { 
        // Update these fields instead of inserting
        username: username,
        code:userCode,
        sessionId: sessionId,
        expiresAt: expiresAt
      }
    });

  // Set Cookie and Redirect
  const headers = new Headers();
  headers.append("Set-Cookie", `session_id=${sessionId}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`);
  headers.append("Location", "/github/contribution-status");

  return new Response(null, { status: 302, headers });
}