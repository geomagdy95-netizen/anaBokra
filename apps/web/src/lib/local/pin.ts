/** Parent PIN (consent-texts §1.3): stored only as a salted PBKDF2 hash, on the device. */
export interface PinHash {
  salt: string;
  hash: string;
  iterations: number;
}

const hex = (b: ArrayBuffer | Uint8Array) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
const fromHex = (h: string) => new Uint8Array(h.match(/../g)!.map((x) => parseInt(x, 16)));

async function derive(pin: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<string> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, base, 256));
}

export const isValidPin = (pin: string) => /^\d{4,6}$/.test(pin);

export async function hashPin(pin: string, iterations = 150_000): Promise<PinHash> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { salt: hex(salt), hash: await derive(pin, salt, iterations), iterations };
}

export async function verifyPin(pin: string, stored: PinHash): Promise<boolean> {
  const h = await derive(pin, fromHex(stored.salt), stored.iterations);
  // Compare in constant time over the hex strings.
  let diff = h.length ^ stored.hash.length;
  for (let i = 0; i < Math.min(h.length, stored.hash.length); i++) diff |= h.charCodeAt(i) ^ stored.hash.charCodeAt(i);
  return diff === 0;
}
