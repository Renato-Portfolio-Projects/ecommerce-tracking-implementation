export async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizePhone(phone: string): string | undefined {
  const typed = phone.trim();
  if (!typed.startsWith('+')) return undefined;
  const digits = typed.replace(/\D/g, '');
  return digits === '' ? undefined : digits;
}

export interface ContactToHash {
  email?: string;
  phone?: string;
}

export interface HashedUserData {
  sha256_email_address?: string;
  sha256_phone_number?: string;
}

export async function hashedUserData(contact: ContactToHash): Promise<HashedUserData> {
  const data: HashedUserData = {};
  const email = normalizeEmail(contact.email ?? '');
  if (email !== '') data.sha256_email_address = await sha256Hex(email);
  const phone = normalizePhone(contact.phone ?? '');
  if (phone !== undefined) data.sha256_phone_number = await sha256Hex(phone);
  return data;
}
