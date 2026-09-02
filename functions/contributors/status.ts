import html from '../../templates/status.html';
import { getDb, contributors } from "../_db.js";
import { eq } from "drizzle-orm";
import type { Env } from "../types.js";

interface GitHubTokenResponse {
  access_token?: string;
  error?: string;
}

interface GitHubUserResponse {
  login: string;
  id: number;
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET } = env;

  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  // HTML for response
  let page: string;

  if (!code) {
    page = html
        .replace('{{STATUS_TITLE}}', `GitHub Login Error`)
        .replace('{{STATUS_DESCRIPTION}}', `You have to login to GitHub from donate page in order to see this page correctly. If you did it and this error persists, contact us.`)
        .replace('{{ID}}', `Unknown`)
        .replace('{{SUPPORTER_CODE}}', `Not available`)
        .replace('{{URL_DESC}}', ``)
        .replace('{{REDIRECT_SNIPPET}}', ``);
    return new Response( page, { headers: { "Content-Type": "text/html" } });
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
  const tokenData: GitHubTokenResponse = await tokenResp.json();



  if (tokenData.error) {
    page = html
        .replace('{{STATUS_TITLE}}', `GitHub OAuth Error`)
        .replace('{{STATUS_DESCRIPTION}}', `There was an error during OAuth with GitHub, try to restart the login. If error persists, contact us.`)
        .replace('{{ID}}', `Unknown`)
        .replace('{{SUPPORTER_CODE}}', `Not available`)
        .replace('{{URL_DESC}}', ``)
        .replace('{{REDIRECT_SNIPPET}}', ``);
    return new Response( page, { headers: { "Content-Type": "text/html" } });
  }

  // Identify User
  const userResp = await fetch("https://api.github.com/user", {
    headers: { "Authorization": `Bearer ${tokenData.access_token}`, "User-Agent": "Pages" }
  });
  const userData: GitHubUserResponse = await userResp.json();
  const username = userData.login;
  const githubId = userData.id;

  // Initialize DB
  const db = getDb(env);

  // Fetch user
  const records = await db.select()
    .from(contributors)
    .where(eq(contributors.githubId, githubId));

  // Check if user exits, then show code
  if (records.length != 0) {
    const record = records[0];
    const supporterCode = `${record.code}`;

    page = html
        .replace('{{STATUS_TITLE}}', `Successful login`)
        .replace('{{STATUS_DESCRIPTION}}', `Thank you for your contribution ${username}! Your supporter code is down below: just copy and paste it inside the app.`)
        .replace('{{ID}}', `GitHub ID: ${githubId}`)
        .replace('{{SUPPORTER_CODE}}', `${supporterCode}`)
        .replace('{{URL_DESC}}', ``)
        .replace('{{REDIRECT_SNIPPET}}', ``);
  } else {
    page = html
        .replace('{{STATUS_TITLE}}', `Successful login but...`)
        .replace('{{STATUS_DESCRIPTION}}', `Hi ${username}! It looks like you haven't merged any pull request yet. If you think this is an error, contact us.`)
        .replace('{{ID}}', `GitHub ID: ${githubId}`)
        .replace('{{SUPPORTER_CODE}}', `Not available`)
        .replace('{{URL_DESC}}', ``)
        .replace('{{REDIRECT_SNIPPET}}', ``);
  }

  url.searchParams.delete("code");
  return new Response( page, { headers: { "Content-Type": "text/html" } });
};