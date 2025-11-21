import html from '../status.html';

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const { XMR_ADDRESS, SOL_ADDRESS, DONATION_DB, WEBHOOK_TOKEN } = env;

    if(!WEBHOOK_TOKEN) {
      return new Error("Server configuration error: WEBHOOK_TOKEN is not set.")
    }

    if(!XMR_ADDRESS) {
      return new Error("Server configuration error: XMR_ADDRESS is not set.")
    }

    if(!SOL_ADDRESS) {
      return new Error("Server configuration error: SOL_ADDRESS is not set.")
    }

    // Get the data from the form
    const formData = await request.formData();
    const useXmr = formData.get('use-xmr')

    const siteURL = new URL(request.url);
    const webhookUrl = `${siteURL.origin}/webhook?token=${WEBHOOK_TOKEN}`;

    
    const trocadorUrl = new URL('https://trocador.app/anonpay/');

    // Fro official docs: https://trocador.app/en/anonpaydocumentation
    if (useXmr !== null) {
      trocadorUrl.searchParams.set('ticker_to', 'sol');
      trocadorUrl.searchParams.set('network_to', 'Mainnet');
      trocadorUrl.searchParams.set('address', SOL_ADDRESS);
      trocadorUrl.searchParams.set('ticker_from', 'xmr')
      trocadorUrl.searchParams.set('network_from', 'Mainnet');
    } else {
      trocadorUrl.searchParams.set('ticker_to', 'xmr');
      trocadorUrl.searchParams.set('network_to', 'Mainnet');
      trocadorUrl.searchParams.set('address', XMR_ADDRESS);
    }
    trocadorUrl.searchParams.set('simple_mode', 'True');
    trocadorUrl.searchParams.set('bgcolor', 'True');
    trocadorUrl.searchParams.set('donation', 'True');
    trocadorUrl.searchParams.set('direct', 'False'); // Enable tracking of donation status
    trocadorUrl.searchParams.set('remove_direct_pay', 'True'); // Otherwise the transaction cannot be tracked
    trocadorUrl.searchParams.set('name', 'TestDonation'); // TODO: change
    trocadorUrl.searchParams.set('description', 'Thank you for your support!');
    trocadorUrl.searchParams.set('webhook', webhookUrl);  
    // From official docs: if you provide an URL on this parameter, every time the status of the transaction changes,  you will receive
    // on this URL a POST request sending you the transaction data; this avoids having to call so many times our server to check the transaction status (Optional); 


    const apiResponse = await fetch(trocadorUrl.toString());

    const responseText = await apiResponse.text();
    let data;

    try {
      data = JSON.parse(responseText);
    } catch (error) {
      // If it was another parsing error or an unknown text response.
      console.error("Failed to parse Trocador response. Body was:", responseText);
      return new Response("Received an unreadable response from the payment processor.", { status: 502 });
    }

    const donationId = data.ID;
    const redirectUrl = data.url;

    if (!donationId || !redirectUrl) {
        console.error("Invalid response from Trocador:", data);
        return new Response('Failed to process donation request. Invalid response from processor.', { status: 500 });
    }

    const initialRecord = {
      id: donationId,
      status: 'anonpaynew', // The initial status from Trocador
    };

    const id = crypto.randomUUID()

    // The key is the UUID, the value is the JSON object.
    await DONATION_DB.put(id, JSON.stringify(initialRecord));

    // Used by webhook to get back the id in kv database
    await DONATION_DB.put(donationId, id);

    const urlPaymentPage = `
      You will be automatically redirected to donation <a href="https://trocador.app/anonpay/${donationId}">page</a> in 30 seconds.
    `

    // A HTML response page with the Donation ID and a meta-refresh tag for redirection
    // TODO: load from root folder (here and status.js)
    const statusHtml = html
        .replace('{{STATUS_TITLE}}', `🚀 Created`)
        .replace('{{STATUS_DESCRIPTION}}', `The donation has been created. Please proceed to the donation page to select a coin and get a deposit address.`)
        .replace('{{SUPPORTER_CODE}}', `When donation transaction is completed, your supporter code will be available here.`)
        .replace('{{DONATION_ID}}', `Save IMMEDIATELY this ID to request supporter code: ${id}`)
        .replace('{{URL_DESC}}', `${urlPaymentPage}`)
        .replace('{{REDIRECT_SNIPPET}}', `"20;url=${redirectUrl}"`);

    
    return new Response(statusHtml, {
      headers: {
        'Content-Type': 'text/html',
      },
    });

  } catch (error) {
    console.error("Donation function error:", error);
    return new Response("An unexpected error occurred.", { status: 500 });
  }
}