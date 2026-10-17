import { signValue, verifySignedValue } from '@/lib/crypto/tokenCipher';
import { PUSHOVER_CALLBACK_PATH, TWILIO_VOICE_PATH } from '@/lib/notify/config';
import type { LinksConfig } from '@/lib/notify/config';

export interface NotifyLinks {
  pushoverCallback: (notificationId: string) => string;
  voiceAction: (notificationId: string) => string;
  verifyPushover: (notificationId: string, signature: string) => boolean;
  publicUrl: (pathAndQuery: string) => string;
}

const pushoverSigned = (notificationId: string) => `pushover:${notificationId}`;

export const createNotifyLinks = (config: () => LinksConfig): NotifyLinks => {
  const link = (path: string, params: Record<string, string>) => {
    const url = new URL(path, config().appUrl);
    url.search = new URLSearchParams(params).toString();
    return url.toString();
  };

  return {
    pushoverCallback: (notificationId) =>
      link(PUSHOVER_CALLBACK_PATH, {
        n: notificationId,
        sig: signValue(pushoverSigned(notificationId), config().webhookSecret),
      }),
    voiceAction: (notificationId) =>
      link(TWILIO_VOICE_PATH, { n: notificationId }),
    verifyPushover: (notificationId, signature) =>
      verifySignedValue(
        pushoverSigned(notificationId),
        signature,
        config().webhookSecret,
      ),
    publicUrl: (pathAndQuery) =>
      new URL(pathAndQuery, config().appUrl).toString(),
  };
};
