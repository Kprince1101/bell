import { NextResponse } from 'next/server';
import { withRouteErrors } from '@/lib/apiRoute';
import { bellServices } from '@/lib/calendars/bellServices';
import { ApiError } from '@/lib/errors';
import { isAuthorizedTick, runTick } from '@/lib/tick';

const tick = withRouteErrors(async (request: Request) => {
  if (
    !isAuthorizedTick(
      request.headers.get('authorization'),
      process.env.CRON_SECRET,
    )
  ) {
    throw new ApiError('Unauthorized', 401);
  }
  return NextResponse.json(await runTick(bellServices()));
});

export const GET = tick;
export const POST = tick;
