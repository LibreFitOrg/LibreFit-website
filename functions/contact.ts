import * as openpgp from 'openpgp';
import type { Env } from './types.js';

interface TurnstileResult {
  success: boolean;
  'error-codes'?: string[];
}

interface ResendEmailPayload {
  from: string;
  to: string[];
  subject: string;
  reply_to: string[];
  text: string;
  attachments?: { content: string; filename: string; content_type?: string }[];
}

/** Limits that keep a submission well inside Resend's 40 MB total email cap. */
const LIMITS = {
  /** Max size (bytes) accepted for an uploaded PGP key file. */
  maxKeyBytes: 1024 * 1024, // 1 MB
  /** Max accepted length of the encrypted-message field (armored PGP text). */
  maxEncryptedMessageLength: 256 * 1024, // 256 KB
  /** Max accepted length of the subject field. */
  maxSubjectLength: 200,
  /** RFC 5321 max length for an email address. */
  maxEmailLength: 254,
} as const;

/**
 * Strips CR/LF and control characters from user-controlled strings so they
 * can never act as header/content delimiters (email/header injection
 * hardening), and caps their length.
 */
function sanitizeSingleLine(value: string, maxLength: number): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\r\n\u0000-\u001f\u007f]/g, ' ').slice(0, maxLength);
}

/** Basic server-side sanity check for the reply-to address. */
function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) && value.length <= LIMITS.maxEmailLength;
}

/**
 * Converts a Uint8Array to a Base64 string without building an intermediate
 * JS string one character at a time (chunked, allocation-friendlier, and
 * constant memory per chunk on the Workers runtime).
 */
function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

async function verifyTurnstile(
  token: File | string | null,
  ip: string,
  secretKey: string
): Promise<TurnstileResult> {
  let formData = new FormData();
  formData.append('secret', secretKey);
  formData.append('response', token as string);
  formData.append('remoteip', ip);

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData
    });

    const result: TurnstileResult = await response.json();
    return result;
  } catch (error) {
    console.error('Turnstile validation error:', error);
    return { success: false, 'error-codes': ['internal-error'] };
  }
}

/**
 * Sends the email via the Resend REST API, following Resend's official
 * error-code policy: 429/5xx are retried with exponential backoff; 400/401/
 * 403/422 are permanent failures that must not be retried.
 */
async function sendViaResend(
  payload: ResendEmailPayload,
  apiKey: string
): Promise<boolean> {
  const MAX_ATTEMPTS = 3;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let response: Response;
    try {
      response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          // Recommended by Resend to make retries safe against duplicates.
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      // Network-level failure: worth retrying.
      console.error(`Resend request failed (attempt ${attempt}/${MAX_ATTEMPTS}):`, error);
      if (attempt === MAX_ATTEMPTS) return false;
      await new Promise((r) => setTimeout(r, 2 ** attempt * 500));
      continue;
    }

    if (response.ok) {
      return true;
    }

    let errorBody: unknown = null;
    try {
      errorBody = await response.json();
    } catch {
      // 5xx responses may return a non-JSON body; keep the status only.
    }
    console.error(
      `Resend API error ${response.status} (attempt ${attempt}/${MAX_ATTEMPTS}):`,
      JSON.stringify(errorBody)
    );

    // Only retry rate limits (429) and server errors (5xx), per Resend docs.
    if (response.status === 429 || response.status >= 500) {
      if (attempt === MAX_ATTEMPTS) return false;
      await new Promise((r) => setTimeout(r, 2 ** attempt * 500));
      continue;
    }

    // 400/401/403/422 etc.: client-side problem, retrying cannot help.
    return false;
  }

  return false;
}

/**
 * POST /api/contact
 * Handles a contact form submission and sends it via Resend.
 *
 * The message body arrives already encrypted client-side with the site's PGP
 * public key (see src/scripts/main.ts); this function never sees plaintext.
 * The sender may optionally attach their own PGP public key so the team can
 * reply encrypted; the key is validated and relayed as an email attachment.
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const { TURNSTILE_SECRET_KEY, CONTACT_EMAIL, SUBDOMAIN, RESEND_API_KEY } = env;

  const successPath = '/contact-result/contact-success.html';
  const failPath = '/contact-result/contact-fail.html';
  const invalidDataPath = '/contact-result/contact-invalid-data.html';

  const successRedirectURL = new URL(successPath, request.url);
  const failRedirectURL = new URL(failPath, request.url);
  const invalidDataRedirectURL = new URL(invalidDataPath, request.url);

  // Redirect all POST failures to a GET page (303 See Other).
  const redirectTo = (url: URL) => Response.redirect(url.toString(), 303);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (error) {
    console.error('Malformed multipart body:', error);
    return redirectTo(invalidDataRedirectURL);
  }

  const encryptedMessage = formData.get('encrypted-message') as string | null;
  const turnstileToken = formData.get('cf-turnstile-response');
  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';

  // Verify Turnstile token
  const outcome = await verifyTurnstile(turnstileToken, ip, TURNSTILE_SECRET_KEY);

  if (!outcome.success) {
    return redirectTo(failRedirectURL);
  }

  const email = formData.get('email') as string | null;
  const subject = formData.get('subject') as string | null;

  if (!email || !encryptedMessage || !subject) {
    return redirectTo(invalidDataRedirectURL);
  }

  // Server-side validation: client-side `pattern`/`maxlength` are advisory
  // only. Strip CR/LF/control chars (header-injection hardening) and cap
  // lengths.
  const replyTo = sanitizeSingleLine(email.trim(), LIMITS.maxEmailLength);
  const safeSubject = sanitizeSingleLine(subject.trim(), LIMITS.maxSubjectLength);

  if (!isValidEmail(replyTo) || !safeSubject) {
    return redirectTo(invalidDataRedirectURL);
  }

  if (encryptedMessage.length > LIMITS.maxEncryptedMessageLength) {
    return redirectTo(invalidDataRedirectURL);
  }

  // Prepare email
  const fromAddress = `Contact Form <form@${SUBDOMAIN}>`;
  const toAddress = `${CONTACT_EMAIL}`;

  const emailPayload: ResendEmailPayload = {
    from: fromAddress,
    to: [toAddress],
    subject: safeSubject,
    reply_to: [replyTo],
    text: encryptedMessage,
  };

  const attachment = formData.get('pgp-key');

  // Attach key if valid
  if (attachment && typeof attachment !== 'string' && attachment.size > 0) {
    if (attachment.size > LIMITS.maxKeyBytes) {
      return redirectTo(invalidDataRedirectURL);
    }

    const userKeyText = await attachment.text();

    let userKey: openpgp.Key;
    try {
      userKey = await openpgp.readKey({ armoredKey: userKeyText });
    } catch (error) {
      console.error('OpenPGP parsing error:', error);
      return redirectTo(invalidDataRedirectURL);
    }

    // Never accept private key material: it must stay with its owner.
    if (userKey.isPrivate()) {
      return redirectTo(invalidDataRedirectURL);
    }

    // Reject keys that cannot actually be used to encrypt a reply
    // (expired, revoked, or without an encryption-capable subkey).
    try {
      await userKey.getEncryptionKey();
    } catch (error) {
      console.error('OpenPGP key not usable for encryption:', error);
      return redirectTo(invalidDataRedirectURL);
    }

    // Read the file as a raw binary buffer
    const buffer = await attachment.arrayBuffer();

    // Convert the buffer to a Base64 string
    const base64String = toBase64(new Uint8Array(buffer));

    // Append the key. Sanitize the filename: it is user-controlled and is
    // re-used as a MIME header value by the mail pipeline.
    const safeFilename =
      sanitizeSingleLine(attachment.name.replace(/[\\/]/g, ''), 128).trim() || 'public-key.asc';

    emailPayload.attachments = [
      {
        content: base64String,
        filename: safeFilename,
        content_type: 'application/pgp-keys',
      },
    ];
  }

  // Send email
  const sent = await sendViaResend(emailPayload, RESEND_API_KEY);

  if (!sent) {
    return redirectTo(failRedirectURL);
  }

  return redirectTo(successRedirectURL);
};