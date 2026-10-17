import { googleIdTokenClaims } from '@/lib/google/schemas';
import type { GoogleIdTokenClaims } from '@/lib/google/schemas';

export const readIdTokenClaims = (
  idToken: string | undefined,
): GoogleIdTokenClaims => {
  const payload = idToken?.split('.')[1];
  if (!payload) throw new Error('Google did not return an identity token');
  const raw: unknown = JSON.parse(
    Buffer.from(payload, 'base64url').toString('utf8'),
  );
  const parsed = googleIdTokenClaims.safeParse(raw);
  if (!parsed.success) throw new Error('Google identity token is incomplete');
  return { sub: parsed.data.sub, email: parsed.data.email.toLowerCase() };
};
