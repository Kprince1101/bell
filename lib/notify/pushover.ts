import { z } from 'zod';
import type { PushoverConfig } from '@/lib/notify/config';
import {
  FORM_HEADERS,
  ProviderError,
  parseProvider,
  readJson,
} from '@/lib/notify/http';
import type { Fetch } from '@/lib/notify/http';
import type { PushoverGateway, PushoverMessage } from '@/types/notifications';

export const PUSHOVER_EMERGENCY_RETRY_SECONDS = 30;
export const PUSHOVER_EMERGENCY_EXPIRE_SECONDS = 600;
const PUSHOVER_EMERGENCY = 2;

const API = 'https://api.pushover.net/1';

const pushoverError = z.object({
  status: z.number(),
  errors: z.array(z.string()).optional(),
});

const sendResponse = z.object({
  status: z.literal(1),
  receipt: z.string().optional(),
});

const pushoverRequest = async (
  fetchImpl: Fetch,
  path: string,
  form: Record<string, string>,
): Promise<unknown> => {
  const response = await fetchImpl(`${API}/${path}`, {
    method: 'POST',
    headers: FORM_HEADERS,
    body: new URLSearchParams(form),
  });
  const body = await readJson(response);
  const failed = pushoverError.safeParse(body);
  if (!response.ok || (failed.success && failed.data.status !== 1)) {
    const detail = failed.data?.errors?.join('; ') ?? `HTTP ${response.status}`;
    throw new ProviderError('Pushover', detail);
  }
  return body;
};

export const pushoverForm = (
  appToken: string,
  message: PushoverMessage,
): Record<string, string> => {
  const form: Record<string, string> = {
    token: appToken,
    user: message.user,
    title: message.title,
    message: message.message,
    priority: String(message.priority),
  };
  if (message.url) {
    form.url = message.url;
    form.url_title = 'Join';
  }
  if (message.priority === PUSHOVER_EMERGENCY) {
    form.retry = String(PUSHOVER_EMERGENCY_RETRY_SECONDS);
    form.expire = String(PUSHOVER_EMERGENCY_EXPIRE_SECONDS);
  }
  if (message.priority === PUSHOVER_EMERGENCY && message.callback) {
    form.callback = message.callback;
  }
  return form;
};

export const createPushoverGateway = (
  config: () => PushoverConfig,
  fetchImpl: Fetch = fetch,
): PushoverGateway => ({
  send: async (message) => {
    const body = parseProvider(
      'Pushover',
      sendResponse,
      await pushoverRequest(
        fetchImpl,
        'messages.json',
        pushoverForm(config().appToken, message),
      ),
    );
    return { receipt: body.receipt ?? null };
  },

  cancelReceipt: async (receipt) => {
    await pushoverRequest(
      fetchImpl,
      `receipts/${encodeURIComponent(receipt)}/cancel.json`,
      { token: config().appToken },
    );
  },
});
