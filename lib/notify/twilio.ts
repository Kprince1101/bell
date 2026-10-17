import { createHmac } from 'node:crypto';
import { z } from 'zod';
import { safeEqual } from '@/lib/crypto/tokenCipher';
import type { TwilioConfig } from '@/lib/notify/config';
import {
  FORM_HEADERS,
  ProviderError,
  parseProvider,
  readJson,
} from '@/lib/notify/http';
import type { Fetch } from '@/lib/notify/http';
import type { TwilioGateway } from '@/types/notifications';

const API = 'https://api.twilio.com/2010-04-01/Accounts';
const GATHER_TIMEOUT_SECONDS = 10;

const twilioError = z.object({ message: z.string() });
const created = z.object({ sid: z.string() });

const XML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

export const escapeXml = (text: string): string =>
  text.replace(/[&<>"']/g, (char) => XML_ESCAPES[char] ?? char);

export const twimlResponse = (inner = ''): string =>
  `<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`;

export const twimlSay = (text: string): string =>
  `<Say>${escapeXml(text)}</Say>`;

export const twimlMessage = (text: string): string =>
  `<Message>${escapeXml(text)}</Message>`;

export const reminderCallTwiml = (spoken: string, actionUrl: string): string =>
  twimlResponse(
    `<Gather input="dtmf" numDigits="1" timeout="${GATHER_TIMEOUT_SECONDS}" method="POST" action="${escapeXml(actionUrl)}">${twimlSay(spoken)}${twimlSay(spoken)}</Gather>${twimlSay('Goodbye.')}`,
  );

export const twilioSignature = (
  authToken: string,
  url: string,
  params: Record<string, string>,
): string => {
  const payload = Object.keys(params)
    .sort()
    .reduce((text, key) => `${text}${key}${params[key]}`, url);
  return createHmac('sha1', authToken).update(payload).digest('base64');
};

export const verifyTwilioSignature = ({
  authToken,
  url,
  params,
  signature,
}: {
  authToken: string;
  url: string;
  params: Record<string, string>;
  signature: string | null;
}): boolean => {
  if (!signature) return false;
  return safeEqual(twilioSignature(authToken, url, params), signature);
};

export const createTwilioGateway = (
  config: () => TwilioConfig,
  fetchImpl: Fetch = fetch,
): TwilioGateway => {
  const create = async (resource: string, form: Record<string, string>) => {
    const { accountSid, authToken, fromNumber } = config();
    const response = await fetchImpl(
      `${API}/${encodeURIComponent(accountSid)}/${resource}.json`,
      {
        method: 'POST',
        headers: {
          ...FORM_HEADERS,
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        },
        body: new URLSearchParams({ From: fromNumber, ...form }),
      },
    );
    const body = await readJson(response);
    if (!response.ok) {
      const detail = twilioError.safeParse(body).data?.message;
      throw new ProviderError('Twilio', detail ?? `HTTP ${response.status}`);
    }
    return parseProvider('Twilio', created, body).sid;
  };

  return {
    sendSms: (to, body) => create('Messages', { To: to, Body: body }),
    call: (to, twiml) => create('Calls', { To: to, Twiml: twiml }),
  };
};
