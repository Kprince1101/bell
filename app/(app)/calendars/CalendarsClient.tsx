'use client';

import { CalendarChoicesForm } from '@/components/calendars/CalendarChoicesForm';
import { CalendarsHeader } from '@/components/calendars/CalendarsHeader';
import { NoAccounts } from '@/components/calendars/NoAccounts';
import { Message } from '@/components/ui/Message';
import { useCalendarsClient } from '@/hooks/useCalendarsClient';
import type { CalendarsClientProps } from '@/types/calendar';

export const CalendarsClient = (props: CalendarsClientProps) => {
  const view = useCalendarsClient(props);

  return (
    <div className="space-y-8">
      <CalendarsHeader connectHref={view.connectHref} />
      {view.showNotice && <Message tone="notice" text={view.notice} />}
      {view.showError && <Message tone="error" text={view.error} />}
      {view.hasNoAccounts && <NoAccounts />}
      {view.hasAccounts && (
        <CalendarChoicesForm
          accounts={view.accountCards}
          selection={view.selection}
          disconnect={view.disconnect}
        />
      )}
    </div>
  );
};
