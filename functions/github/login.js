export async function onRequest({ env }) {
  const redirectUri = `https://github.com/login/oauth/authorize?client_id=${env.GITHUB_CLIENT_ID}`;
  return Response.redirect(redirectUri, 302);
}