import { NextResponse } from 'next/server';
import { parseBody, requireUser, withRouteErrors } from '@/lib/apiRoute';
import { testChannel } from '@/lib/notify/channels';
import { notifyServices } from '@/lib/notify/notifyServices';
import { channelTestBody } from '@/lib/schemas/notifications';

export const POST = withRouteErrors(async (request: Request) => {
  const { user } = await requireUser();
  const { kind } = await parseBody(request, channelTestBody);
  await testChannel(notifyServices(), user.id, kind);
  return NextResponse.json({ sent: true });
});
