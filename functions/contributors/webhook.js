import { verify } from "@octokit/webhooks-methods";
import { getDb, contributors } from "../_db.js";
import { signString } from '../_supporter-code-sign.js';
import { Octokit } from "@octokit/core";
import { paginateRest } from "@octokit/plugin-paginate-rest";


async function getPrContributors({ octokit, owner, repo, pull_number }) {
  const contributorMap = new Map();

  // Use the raw request path
  const iterator = octokit.paginate.iterator(
    "GET /repos/{owner}/{repo}/pulls/{pull_number}/commits",
    { owner, repo, pull_number, per_page: 100 }
  );

  for await (const { data: commits } of iterator) {
    for (const c of commits) {
      // Check author (who wrote the code)
      if (c.author?.id) {
        const name = c.commit?.author?.name || c.author.login;
        contributorMap.set(c.author.id, name); 
      }

      // Check committer (who applied the code)
      if (c.committer?.id && c.committer?.login !== "web-flow") {
        const name = c.commit?.committer?.name || c.committer.login;
        contributorMap.set(c.committer.id, name); 
      }
    }
  }

  return contributorMap;
}

export async function onRequestPost({ request, env }) {
  const { GITHUB_WEBHOOK_SECRET, PRIVATE_KEY, GITHUB_TOKEN } = env;

  const hubSignature = request.headers.get("x-hub-signature-256");
  const body = await request.text();

  // Security verification
  if (hubSignature) {
    const isValid = await verify(GITHUB_WEBHOOK_SECRET, body, hubSignature);
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
    // Get contributors
    const MinimalOctokit = Octokit.plugin(paginateRest);

    const octokit = new MinimalOctokit({ auth: GITHUB_TOKEN });

    const prContributors = await getPrContributors({
      octokit,
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      pull_number: payload.pull_request.number
    });

    // Initialize db
    const db = getDb(env);

    // Insert committers in db
    for (const [id, name] of prContributors) {
      const signature = await signString(name, PRIVATE_KEY);
      const code = `${name}.${signature}`;


      await db.insert(contributors)
        .values(
          {
            githubId: id,
            code: code
          }
        )
        .onConflictDoNothing();
    }
  }

  return new Response("OK");
}