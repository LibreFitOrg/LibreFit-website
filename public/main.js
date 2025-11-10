import * as openpgp from 'openpgp'


let form = null;
let messageTextarea = null;
let submitButton = null;

let originalButtonText = null;

// The path to public key file.
const pgpKeyPath = '/assets/pgp_key.asc';

async function encryptContactForm(event) {
    // Prevent the default form submission
    event.preventDefault();

    submitButton.disabled = true;
    submitButton.textContent = 'Encrypting...';

    try {
        const response = await fetch(pgpKeyPath);
        if (!response.ok) {
            throw new Error(`Network error: Could not fetch PGP key from ${pgpKeyPath}`);
        }
        const publicKeyArmored = await response.text();
        const plaintextMessage = messageTextarea.value;
        
        // Encrypt the message
        const publicKey = await openpgp.readKey({ armoredKey: publicKeyArmored });

        const encryptedMessage = await openpgp.encrypt({
            message: await openpgp.createMessage({ text: plaintextMessage }),
            encryptionKeys: publicKey,
        });

        // Create a new hidden input for the encrypted data
        const hiddenInput = document.createElement('input');
        hiddenInput.type = 'hidden';
        hiddenInput.name = 'encrypted_message';
        hiddenInput.value = encryptedMessage;
        form.appendChild(hiddenInput);

        // (Security) Clear the original message so plaintext is not sent
        messageTextarea.value = '';
        messageTextarea.removeAttribute('name');

        // Submit the form with the encrypted data
        form.submit();

    } catch (error) {
        console.error('Encryption failed:', error);
        // Restore form if anything goes wrong (network or encryption)
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
        alert('An error occurred during encryption. Please check your connection and try again.');
    }
}

window.addEventListener('DOMContentLoaded', () => 
    {
        form = document.getElementById('contact-form');
        messageTextarea = messageTextarea = document.getElementById('message');
        submitButton = form.querySelector('button[type="submit"]');
        originalButtonText = submitButton.textContent

        form.addEventListener('sumbit', encryptContactForm)
    }
)

window.addEventListener('pageshow', function(event) 
    {
    // The event.persisted property is true if the page is being restored from bfcache.
        if (event.persisted) {
            // Re-enable the button and restore its original text
            submitButton.disabled = false;
            submitButton.textContent = originalButtonText;

            // This is the most reliable way to clear all user-entered data
            // from the form, including the email and message fields.
            form.reset();
        }
    }
);