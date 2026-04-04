import { eq } from "drizzle-orm";
import { getDb, donations } from "../_db.js";
import { signString } from '../_supporter-code-sign.js';
import * as openpgp from 'openpgp';

export async function onRequestPost({ request, env }) {
  const { PRIVATE_KEY, CONTACT_EMAIL, SUBDOMAIN, RESEND_API_KEY } = env;

  // Get key from the URL
  const url = new URL(request.url);
  const receivedKey = url.searchParams.get('key');

  // Trocador sends the data as JSON in the POST body
  const donationData = await request.json();
  const tradeId = donationData.trade_id;

  if (!tradeId) {
    console.log("Webhook received a request without an ID.");
    return new Response('Trade ID missing', { status: 400 });
  }

  const coin = donationData.coin_to;

  if (!coin) {
    console.log("Webhook received a request without a coin.");
    return new Response('Coin missing', { status: 400 });
  }

  const amount = donationData.amount_to;

  if (!amount) {
    console.log("Webhook received a request without an amount.");
    return new Response('Amount missing', { status: 400 });
  }

  // Initialize DB
  const db = getDb(env);

  // Fetch id in database from donation id
  const records = await db.select()
      .from(donations)
      .where(eq(donations.trade_id, tradeId));

  if(records.length == 0) {
    console.error(`Webhook received update for non-existent donation: ${tradeId}`);
    return new Response('ID does not exist', { status: 400 });
  }

  const donation = records[0];

  // Validate request
  if(donation.webhook_key != receivedKey) {
    return new Response("Unauthorized", { status: 401 });
  }

  let code = donation.code

  if(donationData.status == 'finished') {
    //--------- Create and sign code ------------------

    // Private Key (PKCS#8 format from Kotlin)
    // Sample: MEECAQAwEwYHKoZIzj0CAQYIKoZIzj0DAQcEJzAlAgEBBCD0I8Xc6wJHNxCIxMTVdBe/bHIUgiB1sPjj2lm5+EnLdQ==
    const privateKeyB64 = PRIVATE_KEY;

    const signature = await signString(donation.id, privateKeyB64);
    code = `${donation.id}.${signature}`;

    //---------------- Send alert ---------------------
    // Prepare email
    const fromAddress = `Donation alert <donation@${SUBDOMAIN}>`;
    const toAddress = `${CONTACT_EMAIL}`;

    // Prepare encryption
    const pgpKeyPath = '/pgp_key.asc';  

    const keyResponse = await fetch(`${url.origin}${pgpKeyPath}`);
    if (!keyResponse.ok) {
        throw new Error(`Network error: Could not fetch PGP key from ${pgpKeyPath}`);
    }
    const publicKeyArmored = await keyResponse.text();

    const isAnonymous = !donation.username;
    const baseMessage = `${donation.username || "Anonymous"} has donated ${amount} of ${coin} successfully!`;
    const plaintextMessage = isAnonymous 
      ? baseMessage 
      : `${baseMessage} Add it in donators section of README.md and app's about.`;
    
    // Encrypt the message
    const publicKey = await openpgp.readKey({ armoredKey: publicKeyArmored });

    const encryptedMessage = await openpgp.encrypt({
        message: await openpgp.createMessage({ text: plaintextMessage }),
        encryptionKeys: publicKey,
    });
    
    const emailPayload = {
      from: fromAddress,
      to: [toAddress],
      subject: `${donation.username || "Anonymous"} completed a donation`,
      text: encryptedMessage,
    };


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
  }

  // Save the updated record back to DB
  await db.update(donations)
    .set({ 
      status: donationData.status,
      code: code,
      coin: coin,
      amount: amount,
      last_update_timestamp: new Date()
    })
    .where(eq(donations.id, donation.id))

  // Acknowledge receipt
  return new Response('OK', { status: 200 });
}