// The random part of a finished picture's address: 22 letters and digits (about 130 bits), so the link cannot be guessed and the QR code is the only way to it.
const ALPHABET = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function photoToken(random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  let out = '';
  const bytes = random(44);
  for (let i = 0; i < bytes.length && out.length < 22; i++) if (bytes[i] < 232) out += ALPHABET[bytes[i] % ALPHABET.length]; // (232 = 4 × 58: no letter is likelier than another)
  return out.length === 22 ? out : photoToken(random);
}

export const TOKEN = /^[a-zA-Z0-9]{22}$/;
