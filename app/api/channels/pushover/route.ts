import { NextResponse } from 'next/server';
import { parseBody, requireUser, withRouteErrors } from '@/lib/apiRoute';
import { savePushoverKey } from '@/lib/notify/channels';
import { notifyServices } from '@/lib/notify/notifyServices';
import { pushoverKeyBody } from '@/lib/schemas/notifications';

export const PUT = withRouteErrors(async (request: Request) => {
  const { user } = await requireUser();
  const { key } = await parseBody(request, pushoverKeyBody, { explain: true });
  await savePushoverKey(notifyServices(), user.id, key);
  return NextResponse.json({ saved: true });
});
