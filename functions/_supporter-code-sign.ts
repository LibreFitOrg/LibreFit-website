/**
 * Signs a string using ECDSA P-256 and returns a URL-Safe Base64 DER signature
 * compatible with Java/Kotlin 'SHA256withECDSA'.
 */
export async function signString(text: string, privateKeyBase64: string): Promise<string> {
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
function rawToDer(signature: Uint8Array): Uint8Array {
  // P-256 produces 64 byte signatures (32 R, 32 S)
  const r = signature.slice(0, 32);
  const s = signature.slice(32);

  // Helper to format Integer for DER (add 0x00 padding if MSB is 1)
  const toDerInt = (num: Uint8Array): Uint8Array => {
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
function str2ab(str: string): ArrayBuffer {
  const buf = new ArrayBuffer(str.length);
  const bufView = new Uint8Array(buf);
  for (let i = 0, strLen = str.length; i < strLen; i++) {
    bufView[i] = str.charCodeAt(i);
  }
  return buf;
}

// Utility: ArrayBuffer to Base64 URL-Safe no-padding
function base64UrlEncode(buffer: ArrayBuffer | Uint8Array): string {
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