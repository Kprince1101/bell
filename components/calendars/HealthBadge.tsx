import type { CalendarHealth, CalendarHealthTone } from '@/types/calendar';

const TONE_CLASSES: Record<CalendarHealthTone, string> = {
  healthy: 'text-text-muted',
  unhealthy: 'font-semibold text-danger',
  off: 'text-text-muted opacity-60',
};

interface HealthBadgeProps {
  health: CalendarHealth;
}

export const HealthBadge = ({ health }: HealthBadgeProps) => (
  <p role="status" className={`w-full text-xs ${TONE_CLASSES[health.tone]}`}>
    {health.text}
  </p>
);
