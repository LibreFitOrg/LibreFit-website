/**
 * Typed environment bindings for all Pages Functions.
 *
 * Secret values are configured in the Cloudflare dashboard (or `.dev.vars`
 * locally); see each function for which bindings it consumes.
 */
export interface Env {
  /** Hyperdrive binding: pooled PostgreSQL connection (production). */
  HYPERDRIVE?: Hyperdrive;
  /** Direct PostgreSQL connection string, used when Hyperdrive is not bound. */
  DATABASE_URL?: string;

  // --- Contact form (functions/contact.ts) ---
  TURNSTILE_SECRET_KEY: string;
  CONTACT_EMAIL: string;
  SUBDOMAIN: string;
  RESEND_API_KEY: string;

  // --- Donations (functions/donations/*) ---
  XMR_ADDRESS: string;
  SOL_ADDRESS: string;
  /** Base64-encoded PKCS#8 ECDSA P-256 private key used to sign supporter codes. */
  PRIVATE_KEY: string;

  // --- Contributors (functions/contributors/*) ---
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  GITHUB_WEBHOOK_SECRET: string;
  GITHUB_TOKEN: string;
}