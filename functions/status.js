/**
 * It checks donation status from database.
 * Responds to GET requests at /status?id=<ID>
 */
export async function onRequestGet(context) {
  try {
    const { request, env } = context;
    const { DONATION_DB } = env;

    const url = new URL(request.url);
    const donationId = url.searchParams.get('id');


    if (!donationId) {
      return new Response("No Donation ID provided. Please go back and enter an ID.", { status: 400 });
    }

    const recordJSON = await DONATION_DB.get(donationId);

    // If the record is not in the database, it's an invalid ID.
    if (!recordJSON) {
      return generateHtmlResponse('Status Not Found', `... No donation found with ID: ${donationId} ...`);
    }

    const record = JSON.parse(recordJSON);
    
    // The rest of the function uses the data from 'record'
    const friendlyStatus = getFriendlyStatus(record.status);
    
    return generateHtmlResponse('Donation Status', `
        <p>Status for Donation ID:</p>
        <div class="id-box">${donationId}</div>
        <div class="status-box status-${record.status}">
          <strong>${friendlyStatus.title}</strong>
          <p>${friendlyStatus.description}</p>
        </div>
        <p><small>Last updated: ${new Date(record.updatedAt).toUTCString()}</small></p>
    `);
  } catch (error) {
    console.error("Status function error:", error);
    return new Response("An unexpected error occurred while checking the status.", { status: 500 });
  }
}

/**
 * Helper function to translate Trocador status codes into user-friendly text.
 */
function getFriendlyStatus(status) {
  const statuses = {
    'anonpaynew': { title: 'Created', description: 'The donation has been created. Please proceed to the payment page to select a coin and get a deposit address.' },
    'waiting': { title: 'Waiting for Deposit', description: 'We are waiting for you to send your cryptocurrency to the provided address.' },
    'confirming': { title: 'Confirming Deposit', description: 'Your deposit has been detected on the network and is awaiting confirmation. This can take a few minutes.' },
    'sending': { title: 'Sending to Recipient', description: 'Your deposit is confirmed. The exchange is now processing the trade and sending the final coins.' },
    'finished': { title: 'Finished', description: 'The donation is complete! The funds have been sent. Thank you for your support!' },
    'paid_partially': { title: 'Partially Paid', description: 'The donation was completed, but the amount received was lower then expected.' },
    'expired': { title: 'Expired', description: 'The time limit to make a deposit has passed. Please start a new donation if you still wish to contribute.' },
    'failed': { title: 'Failed', description: 'There was a problem with the exchange. Please contact Trocador support with your donation ID.' },
    'halted': { title: 'Halted', description: 'The transaction has been halted due to an issue. Please contact Trocador support with your donation ID.' },
    'refunded': { title: 'Refunded', description: 'The exchange has processed a refund for your deposit.' },
  };
  return statuses[status] || { title: 'Unknown Status', description: 'An unknown status was received. Please contact support.' };
}

/**
 * Helper function to generate a consistent HTML response page.
 */
function generateHtmlResponse(title, content) {
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <title>${title}</title>
          <style>
              body { font-family: sans-serif; max-width: 600px; margin: 4rem auto; text-align: center; }
              .card { padding: 2rem; border: 1px solid #ddd; border-radius: 8px; background: #f9f9f9; }
              .id-box { background: #eee; padding: 0.5rem 1rem; border-radius: 4px; font-family: monospace; display: inline-block; margin: 0.5rem 0; }
              .status-box { margin-top: 1.5rem; padding: 1rem; border-radius: 5px; border: 1px solid; }
              .status-box p { margin: 0.5rem 0 0 0; }
              /* Status colors */
              .status-finished, .status-paid_partially { border-color: #28a745; background-color: #e9f7ec; }
              .status-waiting, .status-confirming, .status-sending, .status-anonpaynew { border-color: #007bff; background-color: #e6f2ff; }
              .status-failed, .status-halted, .status-expired { border-color: #dc3545; background-color: #fbebee; }
              a { color: #007bff; }
          </style>
      </head>
      <body>
          <div class="card">
              <h1>${title}</h1>
              ${content}
              <p style="margin-top: 2rem;"><a href="/check">Check another ID</a> or <a href="/support">make a new donation</a>.</p>
          </div>
      </body>
      </html>
    `;
    return new Response(html, { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
}