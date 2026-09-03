import { getDb, translators } from "../_db.js";
import { signString } from '../_supporter-code-sign.js';
import type { Env } from "../types.js";

/**
 * Outbound webhook receiver for Hosted Weblate's Webhook add-on
 * (weblate.webhook.webhook). Weblate signs deliveries following the
 * Standard Webhooks specification:
 *   https://github.com/standard-webhooks/standard-webhooks
 *
 * Signed content: "{webhook-id}.{webhook-timestamp}.{rawBody}"
 * Signature:      "v1," + base64(HMAC-SHA256(base64-decoded secret, content))
 * Headers:        webhook-id, webhook-timestamp, webhook-signature
 */

/** Change actions that represent a creditable translation contribution. */
const CREDITABLE_ACTIONS = new Set([
  "New translation",
  "Translation changed",
  "Translation approved",
  "Suggestion added",
  "Suggestion accepted",
  "Comment added",
]);

/** Replay window in seconds (Standard Webhooks recommendation: 5 minutes). */
const TOLERANCE_SECONDS = 300;

interface WeblateWebhookPayload {
  action?: string;
  author?: string;
  user?: string;
}

/**
 * Constant-time comparison of two strings (lengths may differ; differing
 * lengths never match, exactly like the official implementations).
 */
function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) {
    diff |= aBytes[i] ^ bBytes[i];
  }
  return diff === 0;
}

/**
 * Verify the Standard Webhooks signature headers over the raw body bytes.
 */
async function verifyStandardWebhook(
  rawBody: string,
  headers: Headers,
  secret: string
): Promise<boolean> {
  const msgId = headers.get("webhook-id");
  const msgTimestamp = headers.get("webhook-timestamp");
  const msgSignature = headers.get("webhook-signature");

  if (!msgId || !msgTimestamp || !msgSignature) return false;

  // Replay protection: reject timestamps outside the tolerance window,
  // in both directions (too old AND too new).
  const timestamp = Number.parseFloat(msgTimestamp);
  if (!Number.isFinite(timestamp)) return false;
  const now = Date.now() / 1000;
  if (Math.abs(now - timestamp) > TOLERANCE_SECONDS) return false;

  // Strip the optional whsec_ prefix, then base64-decode the secret.
  const cleanSecret = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  const keyBytes = Uint8Array.from(atob(cleanSecret), (c) => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signedContent = new TextEncoder().encode(`${msgId}.${msgTimestamp}.${rawBody}`);
  const mac = await crypto.subtle.sign("HMAC", key, signedContent);
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));

  // The signature header is a space-delimited list to support secret rotation.
  return msgSignature
    .split(" ")
    .map((s) => s.trim())
    .some((s) => s.startsWith("v1,") && timingSafeEqual(s.slice("v1,".length), expected));
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const { WEBLATE_WEBHOOK_SECRET, PRIVATE_KEY } = env;

  // Signature verification MUST run over the exact bytes received: read the
  // raw body once and reuse the string for both verification and parsing.
  const rawBody = await request.text();

  const isValid = await verifyStandardWebhook(rawBody, request.headers, WEBLATE_WEBHOOK_SECRET);
  if (!isValid) return new Response("Invalid Signature", { status: 401 });

  let payload: WeblateWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    // Well-signed but malformed: acknowledge so Weblate doesn't retry forever.
    return new Response("OK");
  }

  // Only credit actions that represent an actual contribution; ack the rest.
  if (!payload.action || !CREDITABLE_ACTIONS.has(payload.action)) {
    return new Response("OK");
  }

  // `author` is the credited translator; `user` is who triggered the event.
  const username = payload.author ?? payload.user;
  if (!username || username === "anonymous") {
    return new Response("OK");
  }

  const signature = await signString(username, PRIVATE_KEY);
  const code = `${username}.${signature}`;

  const db = getDb(env);

  await db.insert(translators)
    .values({
      weblateUsername: username,
      code: code,
    })
    .onConflictDoUpdate({
      target: translators.weblateUsername,
      set: {
        code: code,
        lastContributionTimestamp: new Date(),
      },
    });

  return new Response("OK");
};
