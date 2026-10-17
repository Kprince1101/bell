import { withRouteErrors } from '@/lib/apiRoute';
import { notifyServices } from '@/lib/notify/notifyServices';
import { readForm } from '@/lib/notify/requests';
import { WEBHOOK_STATUS, handlePushoverCallback } from '@/lib/notify/webhooks';

export const POST = withRouteErrors(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const outcome = await handlePushoverCallback(notifyServices(), {
    notificationId: searchParams.get('n'),
    signature: searchParams.get('sig'),
    form: await readForm(request),
  });
  return new Response(null, { status: WEBHOOK_STATUS[outcome] });
});
