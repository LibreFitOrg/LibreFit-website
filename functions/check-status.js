import html from '../status.html';


export async function onRequestGet(context) {
  try {
    const { request, env } = context;
    const { DONATION_DB, PRIVATE_KEY } = env;

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
      return new Response("No ID does not follow UUID v4 format. Please go back and enter an ID with valid format.", { status: 400 });
    }
    
    let title = '🔍 Status not found';
    let description = `No donation found with this ID`;
    let urlPaymentPage = ``;
    let trade_id = ``;
    let code = 'Not available';

    const recordJSON = await DONATION_DB.get(id);

    // If the record is not in the database, it's an invalid ID.
    if (recordJSON){
      const record = JSON.parse(recordJSON);
    
      const status = getStatus(record.status);
      title = status.title
      description = status.description
      trade_id = record.id
      code = 'When donation transaction is completed, your supporter code will be available here.';
      urlPaymentPage = `
        Go to donation <a href="https://trocador.app/anonpay/checkout/${trade_id}">page</a>
      `

      if (record.status === 'finished') {

        // Private Key (PKCS#8 format from Kotlin)
        // Sample: MEECAQAwEwYHKoZIzj0CAQYIKoZIzj0DAQcEJzAlAgEBBCD0I8Xc6wJHNxCIxMTVdBe/bHIUgiB1sPjj2lm5+EnLdQ==
        const privateKeyB64 = PRIVATE_KEY;

        const signature = await signString(id, privateKeyB64);
        code = `${id}.${signature}`
        urlPaymentPage = `` // Leave blank if donation is completed
      }
    }

    const statusHtml = html
      .replace('{{STATUS_TITLE}}', `${title}`)
      .replace('{{STATUS_DESCRIPTION}}', `${description}`)
      .replace('{{DONATION_ID}}', `${id}`)
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


/**
 * Signs a string using ECDSA P-256 and returns a URL-Safe Base64 DER signature
 * compatible with Java/Kotlin 'SHA256withECDSA'.
 */
async function signString(text, privateKeyBase64) {
  // Import the Private Key
  const binaryKey = str2ab(atob(privateKeyBase64));
  
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    {
      name: "ECDSA",
      namedCurve: "P-256", 
    },
    false,
    ["sign"]
  );

  // Sign the data (Result is 64 bytes: 32 bytes R + 32 bytes S)
  const encoder = new TextEncoder();
  const rawSignature = await crypto.subtle.sign(
    {
      name: "ECDSA",
      hash: { name: "SHA-256" },
    },
    cryptoKey,
    encoder.encode(text)
  );

  // Convert Raw (P1363) to DER (ASN.1) for Java compatibility
  const derSignature = rawToDer(new Uint8Array(rawSignature));

  // Encode to URL-Safe Base64 without padding
  return base64UrlEncode(derSignature);
}

// --- Helpers ---

// Convert Raw ECDSA signature to ASN.1 DER format
function rawToDer(signature) {
  // P-256 produces 64 byte signatures (32 R, 32 S)
  const r = signature.slice(0, 32);
  const s = signature.slice(32);

  // Helper to format Integer for DER (add 0x00 padding if MSB is 1)
  const toDerInt = (num) => {
    if (num[0] & 0x80) { // If high bit is set, prepend 0x00
      const padded = new Uint8Array(num.length + 1);
      padded.set(num, 1);
      return padded;
    }
    // If the first byte is 0x00 and the second is NOT > 0x80, we could trim, 
    // but usually raw signatures don't contain leading zeros unless the number is actually small.
    // However, we should remove leading zeros if the length > 1 and byte is 0 to remain strict DER
    let start = 0;
    while (start < num.length - 1 && num[start] === 0 && !((num[start+1] & 0x80))) {
        start++;
    }
    return num.slice(start);
  };

  const derR = toDerInt(r);
  const derS = toDerInt(s);

  // Total length: 2 bytes (tag+len) + R len + 2 bytes (tag+len) + S len
  const totalLen = derR.length + derS.length + 4;
  
  const der = new Uint8Array(totalLen + 2); // +2 for Sequence tag and total length
  let offset = 0;

  der[offset++] = 0x30; // ASN.1 SEQUENCE
  der[offset++] = totalLen;
  
  der[offset++] = 0x02; // ASN.1 INTEGER (R)
  der[offset++] = derR.length;
  der.set(derR, offset);
  offset += derR.length;

  der[offset++] = 0x02; // ASN.1 INTEGER (S)
  der[offset++] = derS.length;
  der.set(derS, offset);

  return der;
}

// Utility: String to ArrayBuffer
function str2ab(str) {
  const buf = new ArrayBuffer(str.length);
  const bufView = new Uint8Array(buf);
  for (let i = 0, strLen = str.length; i < strLen; i++) {
    bufView[i] = str.charCodeAt(i);
  }
  return buf;
}

// Utility: ArrayBuffer to Base64 URL-Safe no-padding
function base64UrlEncode(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}