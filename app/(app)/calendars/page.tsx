import { loadSharingView } from '@/lib/calendars/sharing';
import {
  loadCalendarsView,
  resolveCalendarMessages,
} from '@/lib/calendars/view';
import type { CalendarsSearchParams } from '@/lib/calendars/view';
import { requireBellUser } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { CalendarsClient } from './CalendarsClient';

interface CalendarsPageProps {
  searchParams: Promise<CalendarsSearchParams>;
}

const CalendarsPage = async ({ searchParams }: CalendarsPageProps) => {
  const user = await requireBellUser();
  const supabase = await createClient();
  const [accounts, sharing] = await Promise.all([
    loadCalendarsView(supabase, user.time_zone),
    loadSharingView(supabase, user.id),
  ]);
  const { error, notice } = resolveCalendarMessages(await searchParams);
  return (
    <CalendarsClient
      accounts={accounts}
      sharing={sharing}
      error={error}
      notice={notice}
    />
  );
};

export default CalendarsPage;
