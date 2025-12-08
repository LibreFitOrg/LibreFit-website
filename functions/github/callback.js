import html from '../../status.html';
import { signString } from '../_supporter-code-sign.js';

export async function onRequest({ request, env }) {
  const { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, PRIVATE_KEY, DONATION_DB } = env

  if(!GITHUB_CLIENT_ID) {
    console.error("GITHUB_CLIENT_ID not found")
    return new Error("Internal error")
  }

  if(!GITHUB_CLIENT_SECRET) {
    console.error("GITHUB_CLIENT_SECRET not found")
    return new Error("Internal error")
  }

  if(!PRIVATE_KEY) {
    console.error("PRIVATE_KEY not found")
    return new Error("Internal error")
  }


  const code = new URL(request.url).searchParams.get("code");
  if (!code) return new Response("Missing code", { status: 400 });

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

  // Check KV for UUID
  const userCode = await DONATION_DB.get(username);
  const codeSignature = await signString(userCode, PRIVATE_KEY);
  const supporterCode = `${userCode}.${codeSignature}`
  
  
  
  if (userCode) {
    page = html
        .replace('{{STATUS_TITLE}}', `Successful login`)
        .replace('{{STATUS_DESCRIPTION}}', `Thank you for your contribution! Your supporter code is down below: just copy and paste it inside the app.`)
        .replace('{{SUPPORTER_ID}}', `${username}`)
        .replace('{{SUPPORTER_CODE}}', `${supporterCode}`)
        .replace('{{URL_DESC}}', ``)
        .replace('{{REDIRECT_SNIPPET}}', ``);
  } else {
    page = html
        .replace('{{STATUS_TITLE}}', `Successful login but...`)
        .replace('{{STATUS_DESCRIPTION}}', `It looks like you haven't merged any pull request yet. If you think this is an error, contact us.`)
        .replace('{{SUPPORTER_ID}}', `${username}`)
        .replace('{{SUPPORTER_CODE}}', `Not available`)
        .replace('{{URL_DESC}}', ``)
        .replace('{{REDIRECT_SNIPPET}}', ``);
  }

  
  return new Response( page, { headers: { "Content-Type": "text/html" } });
}