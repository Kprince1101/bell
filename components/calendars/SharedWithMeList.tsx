import { ColorDot } from '@/components/ui/ColorDot';
import type { SharedWithMeModel } from '@/hooks/useCalendarSharing';

interface SharedWithMeListProps {
  calendars: SharedWithMeModel[];
}

export const SharedWithMeList = ({ calendars }: SharedWithMeListProps) => (
  <div className="space-y-2">
    <h3 className="text-sm font-semibold">Shared with you</h3>
    <ul className="space-y-1 text-sm">
      {calendars.map((calendar) => (
        <li
          key={calendar.calendarId}
          className="flex items-center justify-between gap-3"
        >
          <span className="flex items-center gap-2">
            <ColorDot color={calendar.color} />
            {calendar.label}
          </span>
          <button
            type="button"
            onClick={calendar.onRemove}
            disabled={calendar.disabled}
            className="text-danger hover:underline disabled:opacity-50"
          >
            {calendar.removeLabel}
          </button>
        </li>
      ))}
    </ul>
  </div>
);
