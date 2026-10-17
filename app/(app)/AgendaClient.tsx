'use client';

import { AgendaDay } from '@/components/agenda/AgendaDay';
import { AgendaHeader } from '@/components/agenda/AgendaHeader';
import { EmptyAgenda } from '@/components/agenda/EmptyAgenda';
import { NextEventCard } from '@/components/agenda/NextEventCard';
import { Message } from '@/components/ui/Message';
import { useAgendaClient } from '@/hooks/useAgendaClient';
import type { AgendaClientProps } from '@/types/agenda';

export const AgendaClient = (props: AgendaClientProps) => {
  const view = useAgendaClient(props);

  return (
    <div className="space-y-6">
      <AgendaHeader
        timeZone={view.timeZone}
        isLive={view.isLive}
        liveLabel={view.liveLabel}
      />
      {view.showRefreshFailed && (
        <Message tone="error" text={view.refreshFailedMessage} />
      )}
      <NextEventCard card={view.nextCard} countdown={view.countdown} />
      {view.isEmpty && <EmptyAgenda timeZone={view.timeZone} />}
      {view.showDays &&
        view.days.map((day) => <AgendaDay key={day.key} day={day} />)}
    </div>
  );
};
