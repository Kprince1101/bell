import { EmptyAgenda } from '@/components/agenda/EmptyAgenda';
import { UnhealthyCalendarsNotice } from '@/components/agenda/UnhealthyCalendarsNotice';
import {
  countUnhealthyCalendars,
  unhealthyMessage,
} from '@/lib/calendars/view';
import { requireBellUser } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';

const AgendaPage = async () => {
  const user = await requireBellUser();
  const unhealthy = unhealthyMessage(
    await countUnhealthyCalendars(await createClient()),
  );
  return (
    <>
      {unhealthy && <UnhealthyCalendarsNotice message={unhealthy} />}
      <EmptyAgenda timeZone={user.time_zone} />
    </>
  );
};

export default AgendaPage;
