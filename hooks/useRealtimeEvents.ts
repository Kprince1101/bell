import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export const REALTIME_SUBSCRIBED = 'SUBSCRIBED';

const eventChanges = (filter: string) => ({
  event: '*' as const,
  schema: 'bell',
  table: 'events',
  filter,
});

export const sharedEventsFilter = (sharedKey: string): string =>
  `calendar_id=in.(${sharedKey})`;

export const useRealtimeEvents = (
  userId: string,
  sharedKey: string,
  onChange: () => void,
) => {
  const [isLive, setIsLive] = useState(false);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const client = createClient();
    const notify = () => onChangeRef.current();
    const channel = client
      .channel(`agenda:${userId}`)
      .on('postgres_changes', eventChanges(`user_id=eq.${userId}`), notify);
    if (sharedKey) {
      channel.on(
        'postgres_changes',
        eventChanges(sharedEventsFilter(sharedKey)),
        notify,
      );
    }
    channel.subscribe((status) => setIsLive(status === REALTIME_SUBSCRIBED));
    return () => {
      setIsLive(false);
      void client.removeChannel(channel);
    };
  }, [userId, sharedKey]);

  return { isLive };
};
