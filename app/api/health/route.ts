import { NextResponse } from 'next/server';
import { requireOwner, withRouteErrors } from '@/lib/apiRoute';
import { loadHealthPanel } from '@/lib/health/panel';
import { createAdminClient } from '@/lib/supabase/admin';

export const GET = withRouteErrors(async () => {
  const { user } = await requireOwner();
  return NextResponse.json(
    await loadHealthPanel(
      createAdminClient(),
      user.id,
      process.env,
      new Date(),
    ),
  );
});
