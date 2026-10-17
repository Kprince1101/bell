import { ColorDot } from '@/components/ui/ColorDot';
import type { ShareCalendarModel } from '@/hooks/useCalendarSharing';

interface ShareCalendarRowProps {
  calendar: ShareCalendarModel;
}

export const ShareCalendarRow = ({ calendar }: ShareCalendarRowProps) => (
  <li className="space-y-2 border-t border-border pt-3 first:border-t-0 first:pt-0">
    <div className="flex items-center gap-2 font-medium">
      <ColorDot color={calendar.color} />
      <span>{calendar.label}</span>
    </div>
    {calendar.hasRecipients && (
      <ul className="space-y-1 text-sm">
        {calendar.recipients.map((recipient) => (
          <li
            key={recipient.userId}
            className="flex items-center justify-between gap-3"
          >
            <span className="truncate text-text-muted">{recipient.email}</span>
            <button
              type="button"
              onClick={recipient.onRemove}
              disabled={recipient.disabled}
              className="text-danger hover:underline disabled:opacity-50"
            >
              {recipient.removeLabel}
            </button>
          </li>
        ))}
      </ul>
    )}
    <form onSubmit={calendar.onShare} className="flex flex-wrap gap-2">
      <input
        type="email"
        value={calendar.email}
        onChange={calendar.onEmailChange}
        placeholder="teammate@example.com"
        aria-label={`Share ${calendar.label} with`}
        autoComplete="off"
        className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-1.5"
      />
      <button
        type="submit"
        disabled={!calendar.canShare}
        className="rounded-lg bg-accent px-4 py-1.5 font-semibold text-accent-foreground disabled:opacity-50"
      >
        {calendar.shareLabel}
      </button>
    </form>
  </li>
);
