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
  attachments?: { content: string; filename: string }[];
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
 * POST /api/contact
 * Handles a contact form submission and sends it via Resend.
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const { TURNSTILE_SECRET_KEY, CONTACT_EMAIL, SUBDOMAIN, RESEND_API_KEY } = env;

  const successPath = '/contact-result/contact-success.html';
  const failPath = '/contact-result/contact-fail.html';
  const invalidDataPath = '/contact-result/contact-invalid-data.html';

  const successRedirectURL = new URL(successPath, request.url);
  const failRedirectURL = new URL(failPath, request.url);
  const invalidDataRedirectURL = new URL(invalidDataPath, request.url);


  const formData = await request.formData();

  const encryptedMessage = formData.get('encrypted-message') as string | null;
  const turnstileToken = formData.get('cf-turnstile-response');
  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';

  // Verify Turnstile token
  const outcome = await verifyTurnstile(turnstileToken, ip, TURNSTILE_SECRET_KEY);

  if (!outcome.success) {
    return Response.redirect(failRedirectURL.toString(), 302);
  }


  const email = formData.get('email') as string | null;
  const subject = formData.get('subject') as string | null;

  if (!email || !encryptedMessage || !subject) {
    return Response.redirect(invalidDataRedirectURL.toString(), 302);
  }


  // Prepare email
  const fromAddress = `Contact Form <form@${SUBDOMAIN}>`;
  const toAddress = `${CONTACT_EMAIL}`;

  const emailPayload: ResendEmailPayload = {
    from: fromAddress,
    to: [toAddress],
    subject: subject,
    reply_to: [email],
    text: encryptedMessage,
  };


  const attachment = formData.get('pgp-key');

  // Attach key if valid
  if (attachment) {
    if (typeof attachment === 'string' || attachment.size === 0) {
      return Response.redirect(invalidDataRedirectURL.toString(), 302);
    }

    const userKeyText = await attachment.text();

    let userKey;
    try {
      userKey = await openpgp.readKey({ armoredKey: userKeyText });
    } catch (error) {
      console.error('OpenPGP parsing error:', error);
      return Response.redirect(invalidDataRedirectURL.toString(), 302);
    }

    if (!userKey) {
      return Response.redirect(invalidDataRedirectURL.toString(), 302);
    }

    if (userKey.isPrivate()) {
      return Response.redirect(invalidDataRedirectURL.toString(), 302);
    }

    // Read the file as a raw binary buffer
    const buffer = await attachment.arrayBuffer();

    // Convert the buffer to a Base64 string
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64String = btoa(binary)

    // Append the key
    emailPayload.attachments = [
      {
        content: base64String,
        filename: attachment.name,
      },
    ]
  }

  // Send email
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify(emailPayload),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Resend API failed: ${JSON.stringify(error)}`);
  }


  return Response.redirect(successRedirectURL.toString(), 303);
};