import { useState } from 'react';
import { useRequest } from '@/hooks/useRequest';
import { acknowledgeEvent } from '@/lib/notificationsApi';
import type { RingingEventView } from '@/types/notifications';

export interface RingingEventModel extends RingingEventView {
  isAcknowledged: boolean;
  showAcknowledge: boolean;
  showJoin: boolean;
  acknowledgeLabel: string;
  canAcknowledge: boolean;
  onAcknowledge: () => Promise<void>;
}

const resolveAcknowledgeLabel = (isSending: boolean): string => {
  if (isSending) return 'Acknowledging...';
  return 'Acknowledge';
};

export const useRingingEvents = (ringing: RingingEventView[]) => {
  const request = useRequest();
  const [acknowledged, setAcknowledged] = useState<string[]>([]);

  const handleAcknowledge = (eventId: string) => async () => {
    const saved = await request.run(`ack:${eventId}`, () =>
      acknowledgeEvent(eventId),
    );
    if (saved) setAcknowledged((current) => [...current, eventId]);
  };

  const rows: RingingEventModel[] = ringing.map((event) => {
    const isAcknowledged = acknowledged.includes(event.eventId);
    return {
      ...event,
      isAcknowledged,
      showAcknowledge: !isAcknowledged,
      showJoin: Boolean(event.joinUrl),
      acknowledgeLabel: resolveAcknowledgeLabel(
        request.isPending(`ack:${event.eventId}`),
      ),
      canAcknowledge: !request.isBusy,
      onAcknowledge: handleAcknowledge(event.eventId),
    };
  });

  return {
    rows,
    hasRinging: ringing.length > 0,
    error: request.error,
    showError: request.showError,
  };
};

export type RingingEventsModel = ReturnType<typeof useRingingEvents>;
