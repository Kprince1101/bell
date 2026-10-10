import { ChannelSection } from '@/components/notifications/ChannelSection';
import { Message } from '@/components/ui/Message';
import type { QuietCalendarsModel } from '@/hooks/useQuietCalendars';

interface QuietCalendarsProps {
  quiet: QuietCalendarsModel;
}

export const QuietCalendars = ({ quiet }: QuietCalendarsProps) => (
  <ChannelSection
    title="Quiet calendars"
    description="Meetings on a quiet calendar never ring. All-day events never ring either."
  >
    {quiet.hasNoCalendars && (
      <p className="text-sm text-text-muted">
        Include a calendar on the Calendars page first.
      </p>
    )}
    <ul className="space-y-2">
      {quiet.rows.map((calendar) => (
        <li key={calendar.id}>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={calendar.quiet}
              disabled={calendar.disabled}
              onChange={calendar.onToggle}
              aria-label={`Quiet ${calendar.label}`}
              className="h-4 w-4 accent-accent"
            />
            <span
              aria-hidden="true"
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: calendar.color }}
            />
            <span>{calendar.label}</span>
          </label>
        </li>
      ))}
    </ul>
    {quiet.showError && <Message tone="error" text={quiet.error} />}
  </ChannelSection>
);
