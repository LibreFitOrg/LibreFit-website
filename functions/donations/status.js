import html from '../../templates/status.html';
import { getDb, donations } from "../_db.js";
import { eq } from "drizzle-orm";


export async function onRequestGet({ request, env } ) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');


  if (!id) {
    return new Response("No ID provided. Please go back and enter an ID.", { status: 400 });
  }

  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if(!regex.test(id)) {
    return new Response("ID does not follow UUID v4 format. Please go back and enter an ID with valid format.", { status: 400 });
  }
  
  let title = '🔍 Status not found';
  let description = `No donation found with this ID`;
  let urlPaymentPage = ``;
  let trade_id = ``;
  let code = 'Not available';

  // Initialize DB
  const db = getDb(env);

  const records = await db.select()
        .from(donations)
        .where(eq(donations.id, id));    

  // If there isn't any record in database, then the ID is invalid
  if (records.length != 0){
    const donation = records[0];   
    const status = getStatus(donation.status);
    title = status.title
    description = status.description
    trade_id = donation.trade_id
    urlPaymentPage = `
      Go to donation <a href="https://trocador.app/anonpay/checkout/${trade_id}">page</a>
    `

    if (donation.code !== "") {
      code = donation.code
    }
    
    const waitingKeywords = ["anonpaynew", "waiting", "confirming", "sending", "paid_partially"];
    if(waitingKeywords.includes(donation.status)) {
      code = 'When donation transaction is completed, your supporter code will be available here.';
    }
  }

  const statusHtml = html
    .replace('{{STATUS_TITLE}}', `${title}`)
    .replace('{{STATUS_DESCRIPTION}}', `${description}`)
    .replace('{{ID}}', `${id}`)
    .replace('{{SUPPORTER_CODE}}', `${code}`)
    .replace('{{URL_DESC}}', `${urlPaymentPage}`)
    .replace('{{REDIRECT_SNIPPET}}', ``); // No redirect here (only when creating donation (see create-donation.js))

  
  return new Response(statusHtml, { headers: { "Content-Type": "text/html" } });
}

function getStatus(status) {
  const statuses = {
    'anonpaynew': { title: '🚀 Created', description: 'The donation has been created. Please proceed to the payment page to select a coin and get a deposit address.' },
    'waiting': { title: '⌛ Waiting for deposit', description: 'Processor is waiting for you to send your cryptocurrency to the provided address.' },
    'confirming': { title: '🚧 Confirming deposit', description: 'Your deposit has been detected on the network and is awaiting confirmation. This can take a few minutes.' },
    'sending': { title: '📫 Sending', description: 'Your deposit is confirmed. The exchange is now processing the trade and sending the final coins.' },
    'finished': { title: '🎉 Finished', description: 'The donation is complete! The funds have been sent. Thank you for your support!' },
    'paid_partially': { title: '⚠️ Partial deposit', description: 'The amount received was lower then expected.' },
    'expired': { title: '❗ Expired', description: 'The time limit to make a deposit has passed. Please start a new donation if you still wish to contribute.' },
    'failed': { title: '❌ Failed', description: 'There was a problem with the exchange. Please contact Trocador support.' },
    'halted': { title: '🛑 Halted', description: 'The transaction has been halted due to an issue. Please contact Trocador support.' },
    'refunded': { title: '🛟 Refunded', description: 'The exchange has processed a refund for your deposit.' },
  };
  return statuses[status] || { title: '❓ Unknown Status', description: 'An unknown status was received. Please contact support.' };
}


