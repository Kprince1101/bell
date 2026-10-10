import type { NotifyServices } from '@/lib/notify/services';
import type { SignedTwilioRequest, TwimlReply } from '@/lib/notify/webhooks';
import { WEBHOOK_STATUS } from '@/lib/notify/webhooks';

export const readForm = async (
  request: Request,
): Promise<Record<string, string>> =>
  Object.fromEntries(new URLSearchParams(await request.text()));

export const readTwilioRequest = async (
  services: NotifyServices,
  request: Request,
): Promise<SignedTwilioRequest> => {
  const url = new URL(request.url);
  return {
    url: services.links.publicUrl(`${url.pathname}${url.search}`),
    params: await readForm(request),
    signature: request.headers.get('x-twilio-signature'),
  };
};

export const twimlHttpResponse = (reply: TwimlReply): Response =>
  new Response(reply.twiml, {
    status: WEBHOOK_STATUS[reply.outcome],
    headers: { 'Content-Type': 'text/xml; charset=utf-8' },
  });
