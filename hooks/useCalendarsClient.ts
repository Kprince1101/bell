import type { ChangeEvent } from 'react';
import { useCalendarChoices } from '@/hooks/useCalendarChoices';
import { useCalendarSharing } from '@/hooks/useCalendarSharing';
import { useDisconnectAccount } from '@/hooks/useDisconnectAccount';
import type {
  CalendarChoice,
  CalendarHealth,
  CalendarView,
  CalendarsClientProps,
} from '@/types/calendar';

export const CONNECT_GOOGLE_PATH = '/api/google/connect';

type InputHandler = (event: ChangeEvent<HTMLInputElement>) => void;

export interface CalendarRowModel {
  choice: CalendarChoice;
  googleCalendarId: string;
  health: CalendarHealth;
  details: string[];
  showPause: boolean;
  onToggle: InputHandler;
  onPauseToggle: InputHandler;
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
  sharing: sharingView,
  error,
  notice,
}: CalendarsClientProps) => {
  const selection = useCalendarChoices(accounts);
  const disconnect = useDisconnectAccount();
  const sharing = useCalendarSharing(sharingView);

  const toRow = (calendar: CalendarView): CalendarRowModel => {
    const choice = selection.choices[calendar.choice.id] ?? calendar.choice;
    return {
      choice,
      googleCalendarId: calendar.googleCalendarId,
      health: calendar.health,
      details: calendar.details,
      showPause: choice.active,
      onToggle: selection.handleToggle(choice.id),
      onPauseToggle: selection.handlePauseToggle(choice.id),
      onLabelChange: selection.handleLabelChange(choice.id),
      onColorChange: selection.handleColorChange(choice.id),
    };
  };

  const accountCards: AccountCardModel[] = accounts.map((account) => ({
    id: account.id,
    email: account.email,
    hasNoCalendars: account.calendars.length === 0,
    disconnectLabel: disconnect.disconnectLabel(account.id),
    isDisconnecting: disconnect.isDisconnecting,
    onDisconnect: disconnect.handleDisconnect(account.id),
    calendars: account.calendars.map(toRow),
  }));

  return {
    accountCards,
    selection,
    disconnect,
    sharing,
    connectHref: CONNECT_GOOGLE_PATH,
    hasAccounts: accounts.length > 0,
    hasNoAccounts: accounts.length === 0,
    error,
    notice,
    showError: Boolean(error),
    showNotice: Boolean(notice),
  };
};
