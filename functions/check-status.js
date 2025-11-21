import html from '../status.html';


export async function onRequestGet(context) {
  try {
    const { request, env } = context;
    const { DONATION_DB } = env;

    const url = new URL(request.url);
    const id = url.searchParams.get('id');


    if (!id) {
      return new Response("No ID provided. Please go back and enter an ID.", { status: 400 });
    }

    const recordJSON = await DONATION_DB.get(id);
    
    let status = 'anonpaynew'
    let title = '🔍 Status not found';
    let description = `No donation found with this ID`;
    let urlPaymentPage = ``;
    let redirectSnippet = ``;

    // If the record is not in the database, it's an invalid ID.
    if (recordJSON){
      const record = JSON.parse(recordJSON);
    
      const status = getStatus(record.status);
      title = status.title
      description = status.description
      urlPaymentPage = `
        Go to donation <a href="https://trocador.app/en/anonpay/checkout/${record.id}">page</a>
      `
    }

    let code = 'When donation transaction is completed, your supporter code will be available here.';

    if (title === 'Finished') {
      code = `Your supported code is: ${1234}` // TODO: implement logic to sign code with pgp key.
    }

    const statusHtml = html
      .replace('{{STATUS_TITLE}}', `${title}`)
      .replace('{{STATUS_DESCRIPTION}}', `${description}`)
      .replace('{{DONATION_ID}}', `${id}`)
      .replace('{{SUPPORTER_CODE}}', `${code}`)
      .replace('{{URL_DESC}}', `${urlPaymentPage}`)
      .replace('{{REDIRECT_SNIPPET}}', ``); // No redirect here (only when creating donation (check craete-donation.js))

    
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