import { useEffect, useState } from 'react';
import { CLOCK_TICK_MS } from '@/lib/constants';

export const useNow = (initialNow: string, tickMs: number = CLOCK_TICK_MS) => {
  const [now, setNow] = useState(() => new Date(initialNow));

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), tickMs);
    return () => clearInterval(timer);
  }, [tickMs]);

  return now;
};
