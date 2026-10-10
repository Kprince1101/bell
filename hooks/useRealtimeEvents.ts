import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export const REALTIME_SUBSCRIBED = 'SUBSCRIBED';

export const useRealtimeEvents = (userId: string, onChange: () => void) => {
  const [isLive, setIsLive] = useState(false);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const client = createClient();
    const channel = client
      .channel(`agenda:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'bell',
          table: 'events',
          filter: `user_id=eq.${userId}`,
        },
        () => onChangeRef.current(),
      )
      .subscribe((status) => setIsLive(status === REALTIME_SUBSCRIBED));
    return () => {
      setIsLive(false);
      void client.removeChannel(channel);
    };
  }, [userId]);

  return { isLive };
};
