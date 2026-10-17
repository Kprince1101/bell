import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

const CIPHER = 'aes-256-gcm';
const CIPHER_VERSION = 'v1';
const KEY_BYTES = 32;
const IV_BYTES = 12;

export const readTokenKey = (
  env: Record<string, string | undefined> = process.env,
): Buffer => {
  const key = Buffer.from(env.BELL_TOKEN_KEY ?? '', 'base64');
  if (key.length !== KEY_BYTES) {
    throw new Error('BELL_TOKEN_KEY must be 32 bytes, base64 encoded');
  }
  return key;
};

export const encryptToken = (plain: string, key: Buffer): string => {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(CIPHER, key, iv);
  const sealed = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [
    CIPHER_VERSION,
    iv.toString('base64'),
    cipher.getAuthTag().toString('base64'),
    sealed.toString('base64'),
  ].join('.');
};

export class UnreadableTokenError extends Error {
  constructor() {
    super('Unreadable stored token');
    this.name = 'UnreadableTokenError';
  }
}

export const decryptToken = (stored: string, key: Buffer): string => {
  const [version, iv, tag, sealed] = stored.split('.');
  if (version !== CIPHER_VERSION || !iv || !tag || !sealed) {
    throw new UnreadableTokenError();
  }
  try {
    const decipher = createDecipheriv(CIPHER, key, Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(sealed, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    throw new UnreadableTokenError();
  }
};

export const signValue = (value: string, secret: string): string =>
  createHmac('sha256', secret).update(value).digest('base64url');

export const safeEqual = (expected: string, given: string): boolean => {
  const left = Buffer.from(expected);
  const right = Buffer.from(given);
  return left.length === right.length && timingSafeEqual(left, right);
};

export const verifySignedValue = (
  value: string,
  signature: string,
  secret: string,
): boolean => safeEqual(signValue(value, secret), signature);

export const randomState = (): string => randomBytes(24).toString('base64url');
