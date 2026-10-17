import { withRouteErrors } from '@/lib/apiRoute';
import { getSlackConfig } from '@/lib/notify/config';
import { notifyServices } from '@/lib/notify/notifyServices';
import { WEBHOOK_STATUS, handleSlackInteraction } from '@/lib/notify/webhooks';

export const POST = withRouteErrors(async (request: Request) => {
  const outcome = await handleSlackInteraction(
    notifyServices(),
    getSlackConfig().signingSecret,
    {
      body: await request.text(),
      timestamp: request.headers.get('x-slack-request-timestamp'),
      signature: request.headers.get('x-slack-signature'),
    },
  );
  return new Response(null, { status: WEBHOOK_STATUS[outcome] });
});
