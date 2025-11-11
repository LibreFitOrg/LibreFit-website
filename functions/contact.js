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
 * Handles a contact form submission and sends it via Resend.
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
        
        const encryptedMessage = formData.get('encrypted-message');
        const turnstileToken = formData.get('cf-turnstile-response');
        const ip = context.request.headers.get('CF-Connecting-IP') || context.request.headers.get('X-Forwarded-For') || 'unknown';

        // Verify Turnstile token
        const turnstileKey = context.env.TURNSTILE_SECRET_KEY;
        if (!turnstileKey) {
            throw new Error("Server configuration error: TURNSTILE_SECRET_KEY is not set.");
        }

        const outcome = await verifyTurnstile(turnstileToken, ip, turnstileKey);

        if (!outcome.success) {
            return Response.redirect(failRedirectURL, 302);
        }



        const email = formData.get('email');

        if (!email || !encryptedMessage) {
            return Response.redirect(invalidDataRedirectURL, 302);
        }   


        // Prepare email
        const contactEmail = context.env.CONTACT_EMAIL
        if(!contactEmail) {
            throw new Error("Server configuration error: CONTACT_EMAIL is not set.");
        }

        const subdomain = context.env.SUBDOMAIN
        if(!contactEmail) {
            throw new Error("Server configuration error: SUBDOMAIN is not set.");
        }

        
        const fromAddress = `Contact Form <form@${subdomain}>`;
        const toAddress = `${contactEmail}`;
        
        const emailPayload = {
            from: fromAddress,
            to: [toAddress],
            subject: `New message from ${email}`,
            reply_to: [email],
            text: encryptedMessage,
        };
        

        const attachment = formData.get('pgp-key');

        // Attach key if valid
        if (attachment) {
            if(typeof attachment === 'string' || attachment.size === 0) {
                return Response.redirect(invalidDataRedirectURL, 302);
            }

            const userKeyText = await attachment.text();
        
            let userKey;
            try {
                userKey = await openpgp.readKey({ armoredKey: userKeyText });
            } catch (error) {
                console.error('OpenPGP parsing error:', error);
                return Response.redirect(invalidDataRedirectURL, 302);
            }

            if (!userKey) {
                return Response.redirect(invalidDataRedirectURL, 302);
            }

            if (userKey.isPrivate()) {
                return Response.redirect(invalidDataRedirectURL, 302);
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