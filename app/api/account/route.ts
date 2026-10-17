import { NextResponse } from 'next/server';
import { deleteAccount, updateTimeZone } from '@/lib/account';
import { parseBody, requireUser, withRouteErrors } from '@/lib/apiRoute';
import { deleteAccountBody, updateTimeZoneBody } from '@/lib/schemas/account';
import { createAdminClient } from '@/lib/supabase/admin';

export const PATCH = withRouteErrors(async (request: Request) => {
  const { supabase, user } = await requireUser();
  const { timeZone } = await parseBody(request, updateTimeZoneBody);
  const updated = await updateTimeZone(supabase, user.id, timeZone);
  return NextResponse.json({ timeZone: updated.time_zone });
});

export const DELETE = withRouteErrors(async (request: Request) => {
  const { supabase, user } = await requireUser();
  await parseBody(request, deleteAccountBody);
  await deleteAccount(supabase, createAdminClient(), user.id);
  return NextResponse.json({ deleted: true });
});
