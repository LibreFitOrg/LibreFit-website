import html from '../../status.html';

export async function onRequest({ request, env }) {
  const code = new URL(request.url).searchParams.get("code");
  if (!code) return new Response("Missing code", { status: 400 });

  // Exchange Code for Token
  const tokenResp = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code
    })
  });
  const tokenData = await tokenResp.json();

  if (tokenData.error) return new Response("GitHub OAuth Error", { status: 400 });

  // Identify User
  const userResp = await fetch("https://api.github.com/user", {
    headers: { "Authorization": `Bearer ${tokenData.access_token}`, "User-Agent": "Pages" }
  });
  const userData = await userResp.json();
  const username = userData.login;

  // Check KV for reward (which is a random UUID)
  const userCode = await env.DONATIONS_KV.get(`${username}`);
  let supporterCode; //TODO:
  
  // HTML Template for response
  let page;
  
  if (!userCode) {
    page = html
        .replace('{{STATUS_TITLE}}', `Nothing to show`)
        .replace('{{STATUS_DESCRIPTION}}', `It looks like you didn't have merged any pull request. If you think this is an error, contact us.`)
        .replace('{{SUPPORTER_ID}}', `${username}`)
        .replace('{{SUPPORTER_CODE}}', `Not available`)
        .replace('{{URL_DESC}}', ``)
        .replace('{{REDIRECT_SNIPPET}}', ``);
  } else {
    page = html
        .replace('{{STATUS_TITLE}}', `Thank you for your contribution!`)
        .replace('{{STATUS_DESCRIPTION}}', `TODO`)
        .replace('{{SUPPORTER_ID}}', `${username}`)
        .replace('{{SUPPORTER_CODE}}', `TODO`)
        .replace('{{URL_DESC}}', ``)
        .replace('{{REDIRECT_SNIPPET}}', ``);
  }

  
  return new Response(page, { headers: { "Content-Type": "text/html" } });
}