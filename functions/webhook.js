export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const { DONATION_DB } = env;

    // Trocador sends the data as JSON in the POST body
    const donationData = await request.json();
    const donationId = donationData.id;

    if (!donationId) {
      console.log("Webhook received a request without a donation ID.");
      return new Response('ID missing', { status: 400 });
    }

    // Fetch the existing record from KV to preserve original data
    const existingRecordJSON = await DONATION_DB.get(donationId);
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