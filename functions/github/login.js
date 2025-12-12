export async function onRequest({ env }) {
  const { GITHUB_CLIENT_ID } = env;

  if(!GITHUB_CLIENT_ID) {
    console.error("Configuration error: GITHUB_CLIENT_ID is not set.");
    return new Response("Server configuration error: GITHUB_CLIENT_ID is not set.", { status: 500 });
  }

  // Generate a random state string for security
  const state = crypto.randomUUID();


  const params = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    scope: 'read:user',
    state: state, // <--- Crucial for security
  });

  const githubUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;

  // Redirect to GitHub, but save the 'state' in a cookie first
  return new Response(null, {
    status: 302,
    headers: {
      "Location": githubUrl,
      // Save state in cookie for 10 minutes (HttpOnly)
      "Set-Cookie": `oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`
    }
  });
}