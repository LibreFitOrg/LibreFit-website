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

        const result = await response.json();
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
    try {
        // Rate limiting by IP
        // const clientIP = context.request.headers.get('CF-Connecting-IP');
        // const limiter = context.env.RATE_LIMITER;

        // const { success } = await limiter.limit({ key: clientIP });

        // if (!success) {
        //    return new Response(
        //        'Too many requests from this IP. Please try again later.', {status: 429,}
        //    );
        // }


        const formData = await context.request.formData();
        const { email, message, subject, turnstileToken } = Object.fromEntries(formData);
        const ip = context.request.headers.get('CF-Connecting-IP');

        // Honeypot for basic spam filtering
        if (subject) {
            return Response.redirect(`${new URL(context.request.url).origin}/contact-success.html`, 302);
        }

        // --- Verify Turnstile token ---
        const secretKey = context.env.TURNSTILE_SECRET_KEY;
        const outcome = await verifyTurnstile(turnstileToken, ip, secretKey);

        if (!outcome.success) {
            console.error('Turnstile verification failed:', outcome['error-codes'] || 'Unknown error');
            return new Response('The CAPTCHA validation failed. Please try again.', { status: 403 }); // 403 Forbidden
        }

        if (!email || !message) {
            return new Response('Invalid form data.', { status: 400 });
        }

        const MAX_LENGTH = 1000;

        if (message.length > MAX_LENGTH) {
            console.error('Message is too long.');
            return new Response(`Error: Message cannot exceed ${MAX_LENGTH} characters.`, { status: 400 });
        }

        const plaintextMessage = `
Email: ${email}

Message:
${message}
        `;

        // --- PGP Encryption ---
        const publicKeyArmored = context.env.PGP_PUBLIC_KEY;
        if (!publicKeyArmored) {
            console.error('PGP_PUBLIC_KEY environment variable not set.');
            return new Response('Server configuration error.', { status: 500 });
        }
        
        const publicKey = await openpgp.readKey({ armoredKey: publicKeyArmored });

        const encryptedMessage = await openpgp.encrypt({
            message: await openpgp.createMessage({ text: plaintextMessage }),
            encryptionKeys: publicKey,
        });

        // --- Prepare and Send Email ---
        const fromAddress = `Contact Form <form@${context.env.SUBDOMAIN}>`;
        const toAddress = `${context.env.CONTACT_EMAIL}`;
        
        const emailPayload = {
            from: fromAddress,
            to: [toAddress],
            subject: `Contact Form Submission`,
            reply_to: [email],
            text: message,
        };

        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${context.env.RESEND_API_KEY}`,
            },
            body: JSON.stringify(emailPayload),
        });

        if (!response.ok) {
            const error = await response.json();
            console.error('Failed to send email:', error);
            return new Response('Error: Failed to send message.', { status: 500 });
        }

        return Response.redirect(`${new URL(context.request.url).origin}/contact-success.html`, 302);

    } catch (error) {
        console.error('Error processing form submission:', error);
        return new Response('An unexpected error occurred.', { status: 500 });
    }
}