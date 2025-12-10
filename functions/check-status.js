import html from '../status.html';
import { signString } from './_supporter-code-sign.js';
import { getDb, donations } from "./_db.js";
import { eq } from 'drizzle-orm';


export async function onRequestGet(context) {
  try {
    const { request, env } = context;
    const { DONATION_DB, PRIVATE_KEY } = env;

    // Initialize DB
    const db = getDb(env);

    if(!PRIVATE_KEY) {
      return new Response("Server configuration error: PRIVATE_KEY is not set.", { status: 500 })
    }

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

    const record = await db.select()
          .from(donations)
          .where(eq(donations.id, id));

    // If the record is not in the database, it's an invalid ID.
    if (record){   
      const status = getStatus(record.status);
      title = status.title
      description = status.description
      trade_id = record.trade_id
      urlPaymentPage = `
        Go to donation <a href="https://trocador.app/anonpay/checkout/${trade_id}">page</a>
      `

      if (record.status === 'finished') {

        // Private Key (PKCS#8 format from Kotlin)
        // Sample: MEECAQAwEwYHKoZIzj0CAQYIKoZIzj0DAQcEJzAlAgEBBCD0I8Xc6wJHNxCIxMTVdBe/bHIUgiB1sPjj2lm5+EnLdQ==
        const privateKeyB64 = PRIVATE_KEY;

        const signature = await signString(id, privateKeyB64);
        code = `${id}.${signature}`
      }
      
      const waitingKeywords = ["anonpaynew", "waiting", "confirming", "sending", "paid_partially"];
      if(waitingKeywords.includes(record.status)) {
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

    
    return new Response(statusHtml, {
      headers: { "Content-Type": "text/html" },
    });
  } catch (error) {
    console.error("Status function error:", error);
    return new Response("An unexpected error occurred while checking the status.", { status: 500 });
  }
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


