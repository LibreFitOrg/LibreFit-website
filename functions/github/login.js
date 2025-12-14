export async function onRequest({ env }) {
  const { GITHUB_CLIENT_ID } = env;

  if(!GITHUB_CLIENT_ID) {
    console.error("Configuration error: GITHUB_CLIENT_ID is not set.");
    return new Response("Server configuration error: GITHUB_CLIENT_ID is not set.", { status: 500 });
  }

  const redirectUri = `https://github.com/login/oauth/authorize?client_id=${env.GITHUB_CLIENT_ID}`;
  return Response.redirect(redirectUri, 302);
}