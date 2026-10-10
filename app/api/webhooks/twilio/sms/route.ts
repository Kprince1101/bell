import { withRouteErrors } from '@/lib/apiRoute';
import { getTwilioConfig } from '@/lib/notify/config';
import { notifyServices } from '@/lib/notify/notifyServices';
import { readTwilioRequest, twimlHttpResponse } from '@/lib/notify/requests';
import { handleTwilioSms } from '@/lib/notify/webhooks';

export const POST = withRouteErrors(async (request: Request) => {
  const services = notifyServices();
  return twimlHttpResponse(
    await handleTwilioSms(
      services,
      getTwilioConfig().authToken,
      await readTwilioRequest(services, request),
    ),
  );
});
