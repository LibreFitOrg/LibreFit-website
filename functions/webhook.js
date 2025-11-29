export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const { DONATION_DB } = env;

    // Get key from the URL
    const url = new URL(request.url);
    const receivedKey = url.searchParams.get('key');

    // Trocador sends the data as JSON in the POST body
    const donationData = await request.json();
    const donationId = donationData.trade_id;

    if (!donationId) {
      console.log("Webhook received a request without an ID.");
      return new Response('Trade ID missing', { status: 400 });
    }

    // Fetch id in KV database from donation id
    const id = await DONATION_DB.get(donationId);
    if(!id) {
      console.error(`Webhook received update for non-existent donation ID: ${id}`);
      return new Response('ID does not exist', { status: 400 });
    }

    // Fetch the existing record from KV to preserve original data
    const existingRecordJSON = await DONATION_DB.get(id);
    if (!existingRecordJSON) {
      console.error(`Webhook received update for non-existent ID: ${donationId}`);
      return new Response('ID does not exist', { status: 400 });
    }
    
    const existingRecord = JSON.parse(existingRecordJSON);
    const webhookKey = existingRecord.webhookKey

    // Validate request
    if(webhookKey != receivedKey) {
      return new Response("Unauthorized", { status: 401 });
    }

    const updatedRecord = {
      ...existingRecord, // Keep original data
      status: donationData.status, // Update the status
    };

    // Save the updated record back to KV
    await DONATION_DB.put(id, JSON.stringify(updatedRecord));

    // Acknowledge receipt
    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('Webhook Error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}