export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const { DONATION_ADDRESS, DONATION_DB } = env;
    
    if (!DONATION_ADDRESS) {
      return new Response("Server is not configured for donations.", { status: 500 });
    }

    // Get the donation amount from the form
    const formData = await request.formData();
    const amountUSD = parseFloat(formData.get('amount_usd'));

    
    if (isNaN(amountUSD) || amountUSD <= 0) {
      return new Response("Invalid donation amount provided.", { status: 400 });
    }
    const siteURL = new URL(request.url);
    const webhookUrl = `${siteURL.origin}/webhook`;

    
    const trocadorUrl = new URL('https://trocador.app/anonpay/');
    
    trocadorUrl.searchParams.set('ticker_to', 'xmr');
    trocadorUrl.searchParams.set('network_to', 'Mainnet');
    trocadorUrl.searchParams.set('address', DONATION_ADDRESS);
    trocadorUrl.searchParams.set('fiat_equiv', 'USD');
    trocadorUrl.searchParams.set('amount', amountUSD.toFixed(2));
    trocadorUrl.searchParams.set('donation', 'True');
    trocadorUrl.searchParams.set('direct', 'False');
    trocadorUrl.searchParams.set('name', 'TestDonation'); // Optional: Customize the name
    trocadorUrl.searchParams.set('description', 'Thank you for your support!'); // Optional
    trocadorUrl.searchParams.set('webhook', webhookUrl);  
    // From official docs: if you provide an URL on this parameter, every time the status of the transaction changes,  you will receive
    // on this URL a POST request sending you the transaction data; this avoids having to call so many times our server to check the transaction status (Optional); 


    const apiResponse = await fetch(trocadorUrl.toString());

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      console.error("Trocador API Error:", errorText);
      return new Response(`Error communicating with payment processor: ${apiResponse.statusText}`, { status: 502 });
    }

    const data = await apiResponse.json();
    const donationId = data.ID;
    const redirectUrl = data.url;

    if (!donationId || !redirectUrl) {
        console.error("Invalid response from Trocador:", data);
        return new Response('Failed to process donation request. Invalid response from processor.', { status: 500 });
    }

    const initialRecord = {
      id: donationId,
      status: 'anonpaynew', // The initial status from Trocador
      amountUSD: amountUSD,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // The key is the donation ID, the value is the JSON object.
    await DONATION_DB.put(donationId, JSON.stringify(initialRecord));

    // A HTML response page with the Donation ID and a meta-refresh tag for redirection
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
                <p>Please save it immediately in order to request the your code.</p>
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