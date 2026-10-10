import { HealthBadge } from '@/components/calendars/HealthBadge';
import { HealthDetails } from '@/components/calendars/HealthDetails';
import type { CalendarRowModel } from '@/hooks/useCalendarsClient';

interface CalendarChoiceRowProps {
  calendar: CalendarRowModel;
}

export const CalendarChoiceRow = ({ calendar }: CalendarChoiceRowProps) => (
  <li className="flex flex-wrap items-center gap-3 border-t border-border pt-3 first:border-t-0 first:pt-0">
    <input
      type="checkbox"
      checked={calendar.choice.active}
      onChange={calendar.onToggle}
      aria-label={`Include ${calendar.googleCalendarId}`}
      className="h-4 w-4 accent-accent"
    />
    <input
      type="color"
      value={calendar.choice.color}
      onChange={calendar.onColorChange}
      aria-label={`Color for ${calendar.googleCalendarId}`}
      className="h-8 w-10 rounded border border-border bg-background"
    />
    <input
      value={calendar.choice.label}
      onChange={calendar.onLabelChange}
      aria-label={`Label for ${calendar.googleCalendarId}`}
      className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-1.5"
    />
    {calendar.showPause && (
      <label className="flex items-center gap-1.5 text-sm text-text-muted">
        <input
          type="checkbox"
          checked={calendar.choice.paused}
          onChange={calendar.onPauseToggle}
          aria-label={`Pause ${calendar.googleCalendarId}`}
          className="h-4 w-4 accent-accent"
        />
        Pause
      </label>
    )}
    <HealthBadge health={calendar.health} />
    <HealthDetails details={calendar.details} />
  </li>
);
