export async function onRequest({ env }) {
  const { GITHUB_CLIENT_ID } = env;

  const redirectUri = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}`;
  return Response.redirect(redirectUri, 302);
}