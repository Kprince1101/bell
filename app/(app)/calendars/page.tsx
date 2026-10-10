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
  const accounts = await loadCalendarsView(
    await createClient(),
    user.time_zone,
  );
  const { error, notice } = resolveCalendarMessages(await searchParams);
  return <CalendarsClient accounts={accounts} error={error} notice={notice} />;
};

export default CalendarsPage;
