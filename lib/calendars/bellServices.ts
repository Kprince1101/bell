import { createCalendarRepo } from '@/lib/calendars/repo';
import { createBellServices } from '@/lib/calendars/services';
import type { BellServices } from '@/lib/calendars/services';
import { createGoogleGateway } from '@/lib/google/api';
import { getGoogleConfig } from '@/lib/google/config';
import { createAdminClient } from '@/lib/supabase/admin';

export const bellServices = (): BellServices => {
  const config = () => getGoogleConfig();
  return createBellServices({
    google: createGoogleGateway(config),
    repo: createCalendarRepo(createAdminClient()),
    config,
  });
};
