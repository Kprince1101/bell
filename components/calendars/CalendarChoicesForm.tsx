import { AccountCard } from '@/components/calendars/AccountCard';
import { Message } from '@/components/ui/Message';
import type {
  AccountCardModel,
  CalendarChoicesModel,
  DisconnectModel,
} from '@/hooks/useCalendarsClient';

interface CalendarChoicesFormProps {
  accounts: AccountCardModel[];
  selection: CalendarChoicesModel;
  disconnect: DisconnectModel;
}

export const CalendarChoicesForm = ({
  accounts,
  selection,
  disconnect,
}: CalendarChoicesFormProps) => (
  <form onSubmit={selection.handleSave} className="space-y-6">
    {accounts.map((account) => (
      <AccountCard key={account.id} account={account} />
    ))}
    {disconnect.showDisconnectError && (
      <Message tone="error" text={disconnect.disconnectError} />
    )}
    {selection.showSaveError && (
      <Message tone="error" text={selection.saveError} />
    )}
    <button
      type="submit"
      disabled={!selection.canSave}
      className="w-full rounded-lg bg-accent py-2 font-semibold text-accent-foreground disabled:opacity-50"
    >
      {selection.saveLabel}
    </button>
  </form>
);
