import { ShareCalendarRow } from '@/components/calendars/ShareCalendarRow';
import { SharedWithMeList } from '@/components/calendars/SharedWithMeList';
import { Message } from '@/components/ui/Message';
import type { CalendarSharingModel } from '@/hooks/useCalendarSharing';

interface CalendarSharingProps {
  sharing: CalendarSharingModel;
}

export const CalendarSharing = ({ sharing }: CalendarSharingProps) => (
  <section className="space-y-4 rounded-xl border border-border bg-card p-6">
    <header className="space-y-1">
      <h2 className="text-lg font-semibold">Sharing</h2>
      <p className="text-sm text-text-muted">
        Share a calendar with a teammate on Bell. Its meetings show on their
        agenda and ring on their own channels. They never see your Google
        account.
      </p>
    </header>
    {sharing.hasNoCalendars && (
      <p className="text-sm text-text-muted">
        Include a calendar above to share it.
      </p>
    )}
    {sharing.hasCalendars && (
      <ul className="space-y-3">
        {sharing.calendars.map((calendar) => (
          <ShareCalendarRow key={calendar.calendarId} calendar={calendar} />
        ))}
      </ul>
    )}
    {sharing.hasSharedWithMe && (
      <SharedWithMeList calendars={sharing.sharedWithMe} />
    )}
    {sharing.showError && <Message tone="error" text={sharing.error} />}
  </section>
);
