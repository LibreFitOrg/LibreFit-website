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
    if (useXmr) {
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
    
    trocadorUrl.searchParams.set('bgcolor', 'True');
    trocadorUrl.searchParams.set('donation', 'True');
    trocadorUrl.searchParams.set('direct', 'False');
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // The key is the donation ID, the value is the JSON object.
    await DONATION_DB.put(donationId, JSON.stringify(initialRecord));

    // A HTML response page with the Donation ID and a meta-refresh tag for redirection
    // TODO: load from root folder (here and status.js)
    const htmlResponse = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>Processing Donation...</title>
            <meta http-equiv="refresh" content="20;url=${redirectUrl}">
            <style>
                body { font-family: sans-serif; max-width: 600px; margin: 4rem auto; text-align: center; }
                .card { padding: 2rem; border: 1px solid #ddd; border-radius: 8px; background: #f9f9f9; }
                .id-box { background: #eee; padding: 0.5rem 1rem; border-radius: 4px; font-family: monospace; display: inline-block; margin-top: 1rem; }
            </style>
        </head>
        <body>
            <div class="card">
                <h1>Thank You!</h1>
                <p>Your Donation ID:</p>
                <div class="id-box">${donationId}</div>
                <p>Please save it immediately in order to request your supporter code.</p>
                <p>You will be redirected to the payment page in 20 seconds. If you are not redirected, <a href="${redirectUrl}">click here</a>.</p>
            </div>
        </body>
        </html>
    `;

    
    return new Response(htmlResponse, {
      headers: {
        'Content-Type': 'text/html;charset=UTF-8',
      },
    });

  } catch (error) {
    console.error("Donation function error:", error);
    return new Response("An unexpected error occurred.", { status: 500 });
  }
}