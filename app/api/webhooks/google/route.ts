import { withRouteErrors } from '@/lib/apiRoute';
import { bellServices } from '@/lib/calendars/bellServices';
import {
  PUSH_OUTCOME_STATUS,
  handlePushNotification,
  readPushNotification,
} from '@/lib/calendars/webhook';

export const POST = withRouteErrors(async (request: Request) => {
  const outcome = await handlePushNotification(
    bellServices(),
    readPushNotification(request.headers),
  );
  return new Response(null, { status: PUSH_OUTCOME_STATUS[outcome] });
});
