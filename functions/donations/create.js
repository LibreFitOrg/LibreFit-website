import html from '../../templates/status.html';
import { getDb, donations } from "../_db.js";

export async function onRequestPost({ request, env }) {
  const { XMR_ADDRESS, SOL_ADDRESS } = env;

  // Get the data from the form
  const formData = await request.formData();
  const useXmr = formData.get('use-xmr');

  const siteURL = new URL(request.url);
  const webhookKey = crypto.randomUUID(); // Used for webhook validation
  const webhookUrl = `${siteURL.origin}/webhook-donation?key=${webhookKey}`;

  
  const trocadorUrl = new URL('https://trocador.app/anonpay/');

  // Fro official docs: https://trocador.app/anonpaydocumentation
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
  trocadorUrl.searchParams.set('remove_direct_pay', 'True'); // Transaction of same coin (without swap) cannot be tracked
  trocadorUrl.searchParams.set('name', 'LibreFit');
  trocadorUrl.searchParams.set('description', 'Thank you for your support!');
  trocadorUrl.searchParams.set('webhook', webhookUrl);


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

  const tradeId = data.ID;
  const redirectUrl = data.url;

  if (!tradeId || !redirectUrl) {
      console.error("Invalid response from Trocador:", data);
      return new Response('Failed to process donation request. Invalid response from processor.', { status: 500 });
  }

  const id = crypto.randomUUID();

  // Initialize DB
  const db = getDb(env);

  const username = formData.get('username');

  await db.insert(donations)
    .values({
      id: id,
      username: username,
      trade_id: tradeId,
      status: 'anonpaynew', // The initial status from Trocador
      webhook_key: webhookKey,
      code: ''
    })

  const urlDonationDesc = `
    You will be automatically redirected to donation <a href="${redirectUrl}">page</a> in 60 seconds.
  `


  const statusHtml = html
      .replace('{{STATUS_TITLE}}', `🚀 Created`)
      .replace('{{STATUS_DESCRIPTION}}', `The donation has been created. Save IMMEDIATELY the ID below to request supporter code once donation is completed.`)
      .replace('{{SUPPORTER_CODE}}', `When donation transaction is completed, your supporter code will be available here.`)
      .replace('{{ID}}', `${id}`)
      .replace('{{URL_DESC}}', `${urlDonationDesc}`)
      .replace('{{REDIRECT_SNIPPET}}', `"60;url=${redirectUrl}"`);

  
  return new Response(statusHtml, {headers: {'Content-Type': 'text/html',},});
}