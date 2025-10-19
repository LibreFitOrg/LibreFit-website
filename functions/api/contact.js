import * as openpgp from 'openpgp';

/**
 * POST /api/contact
 * Handles a contact form submission, PGP-encrypts the content, and sends it via Resend.
 * This version does not require a name and uses environment variables for configuration.
 */
export async function onRequestPost(context) {
    try {
        const formData = await context.request.formData();
        const { email, message, subject } = Object.fromEntries(formData);

        // Honeypot for basic spam filtering
        if (subject) {
            return Response.redirect(`${new URL(context.request.url).origin}/contact-success.html`, 302);
        }

        const plaintextMessage = `
A new message was submitted via contact form.

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
        const fromAddress = `Contact Form <noreply@${context.env.SUBDOMAIN}>`;
        const toAddress = `${context.env.CONTACT_EMAIL}`;
        
        const emailPayload = {
            from: fromAddress,
            to: [toAddress],
            subject: `New Contact Form Submission`,
            reply_to: email,
            html: `<pre>${encryptedMessage}</pre>`, // The body is the encrypted PGP block
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