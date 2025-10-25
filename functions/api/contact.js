import * as openpgp from 'openpgp';

async function verifyTurnstile(token, ip, secretKey) {
    let formData = new FormData();
    formData.append('secret', secretKey);
    formData.append('response', token);
    formData.append('remoteip', ip);

    try {
        const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            body: formData
        });

        const result= await response.json();
        return result;
    } catch (error) {
        console.error('Turnstile validation error:', error);
        return { success: false, 'error-codes': ['internal-error'] };
    }
}

/**
 * POST /api/contact
 * Handles a contact form submission, PGP-encrypts the content, and sends it via Resend.
 */
export async function onRequestPost(context) {
    const successPath = '/results/contact-success.html';
    const failPath = '/results/contact-fail.html';
    const invalidDataPath = '/results/contact-invalid-data.html';

    const successRedirectURL = new URL(successPath, context.request.url);
    const failRedirectURL = new URL(failPath, context.request.url);
    const invalidDataRedirectURL = new URL(invalidDataPath, context.request.url);

    try {

        const formData = await context.request.formData();
        const { email, message, subject } = Object.fromEntries(formData);
        const turnstileToken = formData.get('cf-turnstile-response')
        const ip = context.request.headers.get('CF-Connecting-IP') || context.request.headers.get('X-Forwarded-For') || 'unknown';

        // Honeypot for basic spam filtering
        if (subject) {
            console.error('Subject was submitted so the request is likely made by a bot.')
            return Response.redirect(successRedirectURL, 303);
        }

        // --- Verify Turnstile token ---
        const turnstileKey = context.env.TURNSTILE_SECRET_KEY
        if (!turnstileKey) {
            throw new Error("Server configuration error: TURNSTILE_SECRET_KEY is not set.");
        }
        const outcome = await verifyTurnstile(turnstileToken, ip, turnstileKey);

        if (!outcome.success) {
            return new Response("CAPTCHA verification failed.", { status: 403 });
        }

        const MAX_LENGTH = 1000;

        if (!email || !message || message.length > MAX_LENGTH) {
            return Response.redirect(invalidDataRedirectURL, 302);
        }

        // --- PGP Encryption ---
        const publicKeyArmored = context.env.PGP_PUBLIC_KEY;
        if (!publicKeyArmored) {
            throw new Error("Server configuration error: PGP_PUBLIC_KEY is not set.");
        }
        
        const publicKey = await openpgp.readKey({ armoredKey: publicKeyArmored });

        const encryptedMessage = await openpgp.encrypt({
            message: await openpgp.createMessage({ text: message }),
            encryptionKeys: publicKey,
        });

        const contactEmail = context.env.CONTACT_EMAIL
        if(!contactEmail) {
            throw new Error("Server configuration error: CONTACT_EMAIL is not set.");
        }

        const subdomain = context.env.SUBDOMAIN
        if(!contactEmail) {
            throw new Error("Server configuration error: SUBDOMAIN is not set.");
        }

        // --- Prepare and Send Email ---
        const fromAddress = `Contact Form <form@${context.env.SUBDOMAIN}>`;
        const toAddress = `${context.env.CONTACT_EMAIL}`;
        
        const emailPayload = {
            from: fromAddress,
            to: [toAddress],
            subject: `Contact Form Submission`,
            reply_to: [email],
            text: encryptedMessage,
        };


        const resendApiKey = context.env.RESEND_API_KEY
        if(!resendApiKey) {
            throw new Error("Server configuration error: RESEND_API_KEY is not set.");
        }
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${resendApiKey}`,
            },
            body: JSON.stringify(emailPayload),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Resend API failed: ${JSON.stringify(error)}`);
        }


        return Response.redirect(successRedirectURL, 303);

    } catch (error) {
        console.error('Error processing form submission:', error);
        return Response.redirect(failRedirectURL, 302);
    }
}