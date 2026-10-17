import { UnhealthyCalendarsNotice } from '@/components/agenda/UnhealthyCalendarsNotice';
import { loadAgendaRows, recordAgendaVisit } from '@/lib/agenda/read';
import { agendaWindow } from '@/lib/agenda/window';
import {
  countUnhealthyCalendars,
  unhealthyMessage,
} from '@/lib/calendars/view';
import { requireBellUser } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { AgendaClient } from './AgendaClient';

const AgendaPage = async () => {
  const user = await requireBellUser();
  const supabase = await createClient();
  const now = new Date();
  const [unhealthyCount, visit, rows] = await Promise.all([
    countUnhealthyCalendars(supabase),
    recordAgendaVisit(supabase, user.id, now),
    loadAgendaRows(supabase, user.id, agendaWindow(now, user.time_zone).query),
  ]);
  const unhealthy = unhealthyMessage(unhealthyCount);
  return (
    <>
      {unhealthy && <UnhealthyCalendarsNotice message={unhealthy} />}
      <AgendaClient
        userId={user.id}
        timeZone={user.time_zone}
        baselineAt={visit.baseline_at}
        initialNow={now.toISOString()}
        initialRows={rows}
      />
    </>
  );
};

export default AgendaPage;
