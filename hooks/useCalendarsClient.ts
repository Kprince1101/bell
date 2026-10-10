import type { ChangeEvent } from 'react';
import { useCalendarChoices } from '@/hooks/useCalendarChoices';
import { useDisconnectAccount } from '@/hooks/useDisconnectAccount';
import type {
  CalendarChoice,
  CalendarHealth,
  CalendarsClientProps,
} from '@/types/calendar';

export const CONNECT_GOOGLE_PATH = '/api/google/connect';

type InputHandler = (event: ChangeEvent<HTMLInputElement>) => void;

export interface CalendarRowModel {
  choice: CalendarChoice;
  googleCalendarId: string;
  health: CalendarHealth;
  onToggle: InputHandler;
  onLabelChange: InputHandler;
  onColorChange: InputHandler;
}

export interface AccountCardModel {
  id: string;
  email: string;
  calendars: CalendarRowModel[];
  hasNoCalendars: boolean;
  disconnectLabel: string;
  isDisconnecting: boolean;
  onDisconnect: () => Promise<void>;
}

export type CalendarChoicesModel = ReturnType<typeof useCalendarChoices>;
export type DisconnectModel = ReturnType<typeof useDisconnectAccount>;

export const useCalendarsClient = ({
  accounts,
  error,
  notice,
}: CalendarsClientProps) => {
  const selection = useCalendarChoices(accounts);
  const disconnect = useDisconnectAccount();

  const accountCards: AccountCardModel[] = accounts.map((account) => ({
    id: account.id,
    email: account.email,
    hasNoCalendars: account.calendars.length === 0,
    disconnectLabel: disconnect.disconnectLabel(account.id),
    isDisconnecting: disconnect.isDisconnecting,
    onDisconnect: disconnect.handleDisconnect(account.id),
    calendars: account.calendars.map((calendar) => ({
      choice: selection.choices[calendar.choice.id] ?? calendar.choice,
      googleCalendarId: calendar.googleCalendarId,
      health: calendar.health,
      onToggle: selection.handleToggle(calendar.choice.id),
      onLabelChange: selection.handleLabelChange(calendar.choice.id),
      onColorChange: selection.handleColorChange(calendar.choice.id),
    })),
  }));

  return {
    accountCards,
    selection,
    disconnect,
    connectHref: CONNECT_GOOGLE_PATH,
    hasAccounts: accounts.length > 0,
    hasNoAccounts: accounts.length === 0,
    error,
    notice,
    showError: Boolean(error),
    showNotice: Boolean(notice),
  };
};
