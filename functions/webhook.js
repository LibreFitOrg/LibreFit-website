export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const { DONATION_DB, WEBHOOK_TOKEN } = env;

    // Get the token from the URL
    const url = new URL(request.url);
    const receivedToken = url.searchParams.get('token');

    // Validate request
    if(WEBHOOK_TOKEN != receivedToken) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Trocador sends the data as JSON in the POST body
    const donationData = await request.json();
    const donationId = donationData.trade_id;

    if (!donationId) {
      console.log("Webhook received a request without an ID.");
      return new Response('ID missing', { status: 400 });
    }

    // Fetch id in KV database from donation id
    const id = await DONATION_DB.get(donationId);
    if(!id) {
      console.error(`Webhook received update for non-existent donation ID: ${id}`);
      return new Response('Donation ID does not exist', { status: 400 });
    }

    // Fetch the existing record from KV to preserve original data
    const existingRecordJSON = await DONATION_DB.get(id);
    if (!existingRecordJSON) {
      console.error(`Webhook received update for non-existent ID: ${donationId}`);
      return new Response('ID does not exist', { status: 400 });
    }
    
    const existingRecord = JSON.parse(existingRecordJSON);

    const updatedRecord = {
      ...existingRecord, // Keep original data
      status: donationData.status, // Update the status
      updatedAt: new Date().toISOString(),
    };

    // Save the updated record back to KV
    await DONATION_DB.put(donationId, JSON.stringify(updatedRecord));

    // Acknowledge receipt
    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('Webhook Error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}