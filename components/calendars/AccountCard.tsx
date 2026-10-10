import { CalendarChoiceRow } from '@/components/calendars/CalendarChoiceRow';
import type { AccountCardModel } from '@/hooks/useCalendarsClient';

interface AccountCardProps {
  account: AccountCardModel;
}

export const AccountCard = ({ account }: AccountCardProps) => (
  <section className="space-y-4 rounded-xl border border-border bg-card p-6">
    <header className="flex items-center justify-between gap-4">
      <h2 className="truncate text-lg font-semibold">{account.email}</h2>
      <button
        type="button"
        onClick={account.onDisconnect}
        disabled={account.isDisconnecting}
        className="text-sm text-danger hover:underline disabled:opacity-50"
      >
        {account.disconnectLabel}
      </button>
    </header>
    {account.hasNoCalendars && (
      <p className="text-sm text-text-muted">
        This account has no calendars Bell can read.
      </p>
    )}
    <ul className="space-y-3">
      {account.calendars.map((calendar) => (
        <CalendarChoiceRow key={calendar.choice.id} calendar={calendar} />
      ))}
    </ul>
  </section>
);
