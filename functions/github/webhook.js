import { verify } from '@octokit/webhooks-methods';

export async function onRequestPost({ request, env }) {
  const secret = env.GITHUB_WEBHOOK_SECRET;
  const signature = request.headers.get("x-hub-signature-256");
  const body = await request.text();

  const eventType = request.headers.get("x-github-event");
  if (eventType !== "pull_request") {
    // Return 200 immediately for non-PR events so GitHub doesn't mark it as failed
    return new Response("OK"); 
  }

  // Security verification
  if (secret && signature) {
    const isValid = await verify(secret, body, signature);
    if (!isValid) return new Response("Invalid Signature", { status: 401 });
  }

  const payload = JSON.parse(body);

  // Filter: only closed and merged PRs
  if (payload.action === 'closed' && payload.pull_request.merged) {
    const username = payload.pull_request.user.login;

    // Check if user already exists.
    const existingUser = await env.DONATIONS_KV.get(username);

    // Store only new users
    if (!existingUser) {
        await env.DONATIONS_KV.put(username, JSON.stringify({code: crypto.randomUUID()}));
    }
  }

  return new Response("OK");
}