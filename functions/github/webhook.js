import { verify } from '@octokit/webhooks-methods';
import { getDb, contributors } from "../_db.js";
import { signString } from '../_supporter-code-sign.js';

export async function onRequestPost({ request, env }) {
  const { GITHUB_CLIENT_SECRET, PRIVATE_KEY } = env;

  if(!PRIVATE_KEY) {
    console.error("Configuration error: PRIVATE_KEY is not set.");
    return new Response("Server configuration error: PRIVATE_KEY is not set.", { status: 500 });
  }

  if(!GITHUB_CLIENT_SECRET) {
    console.error("Configuration error: GITHUB_CLIENT_SECRET is not set.");
    return new Response("Server configuration error: GITHUB_CLIENT_SECRET is not set.", { status: 500 });
  }

  const signature = request.headers.get("x-hub-signature-256");
  const body = await request.text();

  // Security verification
  if (signature) {
    const isValid = await verify(GITHUB_WEBHOOK_SECRET, body, signature);
    if (!isValid) return new Response("Invalid Signature", { status: 401 });
  }

  const eventType = request.headers.get("x-github-event");
  if (eventType !== "pull_request") {
    // Return 200 immediately for non-PR events so GitHub doesn't mark it as failed
    return new Response("OK"); 
  }

  const payload = JSON.parse(body);

  // Filter: only closed and merged PRs
  if (payload.action === 'closed' && payload.pull_request.merged) {
    const user = payload.pull_request.user;
    const username = user.login;
    const githubId = user.id;

    // Sign username with private key to generate code
    const signature = await signString(username, PRIVATE_KEY);
    const code = `${username}.${signature}`;

    // Initialize db
    const db = getDb(env)

    // Insert username in db
    await db.insert(contributors)
      .values(
        {
          githudId: githubId,
          code: code
        }
      )
      .onConflictDoNothing();
  }

  return new Response("OK");
}