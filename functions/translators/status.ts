import { getDb, translators } from "../_db.js";
import { renderStatusPage } from "../_status-page.js";
import { eq } from "drizzle-orm";
import type { Env } from "../types.js";

/**
 * Form handler for the Weblate translator flow (POST /translators/status).
 *
 * Hosted Weblate is not an OAuth2 provider, so — unlike the GitHub flow —
 * identity is confirmed by having the user paste a personal API token
 * (Account -> API key, "wlu_" prefix). The token is used for exactly one
 * call to GET /api/users/ (which returns the authenticated user's own
 * profile for non-admin tokens) and is then discarded: it is never logged
 * or persisted.
 *
 * Docs: https://docs.weblate.org/en/latest/api.html
 */

const WEBLATE_API_URL = "https://hosted.weblate.org/api/users/";

interface WeblateUserResponse {
  // Unprivileged tokens receive a DRF-paginated list of their own profile.
  results?: { username?: string }[];
  // Defensive fallback for object-shaped responses.
  username?: string;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  // Same-origin defense-in-depth: reject cross-site form posts early.
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).host !== new URL(request.url).host) {
        return new Response("Forbidden", { status: 403 });
      }
    } catch {
      return new Response("Forbidden", { status: 403 });
    }
  }

  const formData = await request.formData();
  const token = formData.get("token");

  // Shape check only; Weblate is the actual validator.
  if (typeof token !== "string" || token.length < 10 || token.length > 256) {
    return renderStatusPage({
      statusTitle: `Weblate Login Error`,
      statusDescription: `You have to paste your Weblate API key from the donate page in order to see this page correctly. If you did it and this error persists, contact us.`,
      id: `Unknown`,
      supporterCode: `Not available`,
    });
  }

  // Verify the token against Weblate: a valid personal token returns the
  // caller's own profile, whose `username` is therefore trustworthy.
  const userResp = await fetch(WEBLATE_API_URL, {
    headers: { "Authorization": `Token ${token}`, "Accept": "application/json" }
  });

  if (!userResp.ok) {
    return renderStatusPage({
      statusTitle: `Weblate Login Error`,
      statusDescription: `Weblate rejected your API key. Make sure you copied it from your profile page (Account -> API key) and try to login again. If the error persists, contact us.`,
      id: `Unknown`,
      supporterCode: `Not available`,
    });
  }

  const userData: WeblateUserResponse = await userResp.json();
  const username = userData.results?.[0]?.username ?? userData.username;

  if (!username) {
    return renderStatusPage({
      statusTitle: `Weblate Login Error`,
      statusDescription: `We could not determine your Weblate account from the API key. Try to generate a new one from your profile page and login again. If the error persists, contact us.`,
      id: `Unknown`,
      supporterCode: `Not available`,
    });
  }

  // Initialize DB
  const db = getDb(env);

  // Fetch user (usernames are case-sensitive: compare exactly as emitted)
  const records = await db.select()
    .from(translators)
    .where(eq(translators.weblateUsername, username));

  // Check if user exits, then show code
  if (records.length != 0) {
    const record = records[0];

    return renderStatusPage({
      statusTitle: `Successful login`,
      statusDescription: `Thank you for your contribution ${username}! Your supporter code is down below: just copy and paste it inside the app. You can now revoke the API key from your Weblate profile.`,
      id: `Weblate username: ${username}`,
      supporterCode: `${record.code}`,
    });
  }

  return renderStatusPage({
    statusTitle: `Successful login but...`,
    statusDescription: `Hi ${username}! It looks like you haven't translated anything on Weblate yet. If you think this is an error, contact us.`,
    id: `Weblate username: ${username}`,
    supporterCode: `Not available`,
  });
};

// Non-POST methods are not routed here (onRequestPost); serve a friendly
// error if someone browses to /translators/status directly.
export const onRequestGet: PagesFunction<Env> = async () => {
  return renderStatusPage({
    statusTitle: `Weblate Login Error`,
    statusDescription: `You have to login from the donate page in order to see this page correctly. If you did it and this error persists, contact us.`,
    id: `Unknown`,
    supporterCode: `Not available`,
  });
};