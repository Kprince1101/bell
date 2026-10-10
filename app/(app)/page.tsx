import { EmptyAgenda } from '@/components/agenda/EmptyAgenda';
import { requireBellUser } from '@/lib/session';

const AgendaPage = async () => {
  const user = await requireBellUser();
  return <EmptyAgenda timeZone={user.time_zone} />;
};

export default AgendaPage;
