import { NextResponse } from 'next/server';
import { parseBody, requireUser, withRouteErrors } from '@/lib/apiRoute';
import { setChannelActive } from '@/lib/notify/channels';
import { notifyServices } from '@/lib/notify/notifyServices';
import { channelToggleBody } from '@/lib/schemas/notifications';

export const PATCH = withRouteErrors(async (request: Request) => {
  const { user } = await requireUser();
  const { kind, active } = await parseBody(request, channelToggleBody);
  await setChannelActive(notifyServices(), user.id, kind, active);
  return NextResponse.json({ saved: true });
});
