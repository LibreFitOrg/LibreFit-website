import { eq } from "drizzle-orm";
import { getDb, donations } from "./_db.js";
import { signString } from './_supporter-code-sign.js';

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const { PRIVATE_KEY } = env;

    if(!PRIVATE_KEY) {
      return new Response("Server configuration error: PRIVATE_KEY is not set.", { status: 500 })
    }

    const privateKeyB64 = PRIVATE_KEY;



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

    // Initialize DB
    const db = getDb(env);

    // Fetch id in database from donation id
    const donation = await db.query.donations.findFirst({
      where: eq(donations.trade_id, tradeId)
    })

    if(!donation) {
      console.error(`Webhook received update for non-existent donation: ${tradeId}`);
      return new Response('ID does not exist', { status: 400 });
    }

    // Validate request
    if(donation.webhook_key != receivedKey) {
      return new Response("Unauthorized", { status: 401 });
    }

    let code = donation.code

    if(donationData.status == 'finished') {
      code = await signString(donation.id, privateKeyB64);
    }

    // Save the updated record back to DB
    await db.update(donations)
      .set({ 
        status: donationData.status,
        code: code
      })
      .where(eq(donations.id, donation.id))

    // Acknowledge receipt
    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('Webhook Error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}