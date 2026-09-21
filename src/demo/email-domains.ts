// This folder holds what exists only for the demo. A real store deletes it. Nothing in src/engine or
// src/store depends on it.

/**
 * Reserved for examples, so they can never belong to anyone and never receive mail. The demo people
 * use example.com. The server passes these to the email domain check as exempt domains, so that they
 * are accepted without any mail check and the demo works. Every other domain has to pass the real
 * checks.
 */
export const DEMO_EMAIL_DOMAINS = ['example.com', 'example.org', 'example.net'];
