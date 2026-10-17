import { randomBytes } from 'node:crypto';
import {
  UnreadableTokenError,
  decryptToken,
  encryptToken,
  readTokenKey,
  safeEqual,
  signValue,
  verifySignedValue,
} from '@/lib/crypto/tokenCipher';

const KEY = randomBytes(32);

describe('encryptToken', () => {
  it('round-trips without the plain token appearing in the stored value', () => {
    const stored = encryptToken('1//refresh-token', KEY);

    expect(stored).not.toContain('refresh-token');
    expect(stored.startsWith('v1.')).toBe(true);
    expect(decryptToken(stored, KEY)).toBe('1//refresh-token');
  });

  it('uses a fresh IV every time', () => {
    expect(encryptToken('same', KEY)).not.toBe(encryptToken('same', KEY));
  });

  it('refuses a tampered value or the wrong key', () => {
    const [version, iv, tag, sealed] = encryptToken('secret', KEY).split('.');
    const flipped = Buffer.from(sealed, 'base64');
    flipped[0] ^= 1;

    expect(() =>
      decryptToken(
        [version, iv, tag, flipped.toString('base64')].join('.'),
        KEY,
      ),
    ).toThrow(UnreadableTokenError);
    expect(() =>
      decryptToken(encryptToken('secret', KEY), randomBytes(32)),
    ).toThrow(UnreadableTokenError);
    expect(() => decryptToken('plain-token', KEY)).toThrow(
      UnreadableTokenError,
    );
  });
});

describe('readTokenKey', () => {
  it('requires a 32-byte base64 key', () => {
    expect(readTokenKey({ BELL_TOKEN_KEY: KEY.toString('base64') })).toEqual(
      KEY,
    );
    expect(() => readTokenKey({ BELL_TOKEN_KEY: 'short' })).toThrow('32 bytes');
    expect(() => readTokenKey({})).toThrow('32 bytes');
  });
});

describe('signValue', () => {
  it('verifies only with the same value and secret', () => {
    const signature = signValue('channel-1', 'secret');

    expect(verifySignedValue('channel-1', signature, 'secret')).toBe(true);
    expect(verifySignedValue('channel-2', signature, 'secret')).toBe(false);
    expect(verifySignedValue('channel-1', signature, 'other')).toBe(false);
    expect(verifySignedValue('channel-1', '', 'secret')).toBe(false);
  });

  it('compares strings of different lengths safely', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });
});
