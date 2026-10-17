import { NextResponse } from 'next/server';
import { requireUser, withRouteErrors } from '@/lib/apiRoute';
import { bellServices } from '@/lib/calendars/bellServices';
import { disconnectAccount } from '@/lib/calendars/disconnect';
import { ApiError } from '@/lib/errors';

interface AccountRouteContext {
  params: Promise<{ accountId: string }>;
}

export const DELETE = withRouteErrors(
  async (_request: Request, { params }: AccountRouteContext) => {
    const { user } = await requireUser();
    const { accountId } = await params;
    const services = bellServices();
    const account = await services.repo.accountForUser(user.id, accountId);
    if (!account) throw new ApiError('Unknown account', 404);
    await disconnectAccount(services, account);
    return NextResponse.json({ disconnected: true });
  },
);
