import {
  decryptToken,
  encryptToken,
  readTokenKey,
} from '@/lib/crypto/tokenCipher';
import {
  getLinksConfig,
  getPushoverConfig,
  getSlackConfig,
  getTwilioConfig,
} from '@/lib/notify/config';
import { createNotifyLinks } from '@/lib/notify/links';
import { createPushoverGateway } from '@/lib/notify/pushover';
import { createNotifyRepo } from '@/lib/notify/repo';
import type { NotifyServices } from '@/lib/notify/services';
import { createSlackGateway } from '@/lib/notify/slack';
import { createTwilioGateway } from '@/lib/notify/twilio';
import { createAdminClient } from '@/lib/supabase/admin';

export const notifyServices = (): NotifyServices => ({
  repo: createNotifyRepo(createAdminClient()),
  slack: createSlackGateway(() => getSlackConfig()),
  pushover: createPushoverGateway(() => getPushoverConfig()),
  twilio: createTwilioGateway(() => getTwilioConfig()),
  links: createNotifyLinks(() => getLinksConfig()),
  encrypt: (plain) => encryptToken(plain, readTokenKey()),
  decrypt: (sealed) => decryptToken(sealed, readTokenKey()),
  now: () => new Date(),
  log: console.info,
});
