import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useRequest } from '@/hooks/useRequest';
import { removeCalendarShare, shareCalendar } from '@/lib/calendarsApi';
import { CALENDARS_PATH } from '@/lib/constants';
import { redirectTo } from '@/lib/navigation';
import type {
  OwnedShareView,
  SharedCalendarView,
  SharingView,
} from '@/types/calendar';

export interface ShareRecipientModel {
  userId: string;
  email: string;
  removeLabel: string;
  disabled: boolean;
  onRemove: () => Promise<void>;
}

export interface ShareCalendarModel {
  calendarId: string;
  label: string;
  color: string;
  email: string;
  canShare: boolean;
  shareLabel: string;
  hasRecipients: boolean;
  recipients: ShareRecipientModel[];
  onEmailChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onShare: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}

export interface SharedWithMeModel extends SharedCalendarView {
  removeLabel: string;
  disabled: boolean;
  onRemove: () => Promise<void>;
}

const pendingLabel = (
  isPending: boolean,
  busy: string,
  idle: string,
): string => {
  if (isPending) return busy;
  return idle;
};

const shareKey = (calendarId: string) => `share:${calendarId}`;

const removeKey = (calendarId: string, userId: string) =>
  `remove:${calendarId}:${userId}`;

export const useCalendarSharing = ({
  userId,
  owned,
  sharedWithMe,
}: SharingView) => {
  const request = useRequest();
  const [emails, setEmails] = useState<Record<string, string>>({});

  const emailFor = (calendarId: string) => emails[calendarId] ?? '';

  const handleEmailChange =
    (calendarId: string) => (event: ChangeEvent<HTMLInputElement>) => {
      setEmails((current) => ({
        ...current,
        [calendarId]: event.target.value,
      }));
    };

  const handleShare =
    (calendarId: string) => async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const email = emailFor(calendarId).trim();
      if (!email) return;
      const saved = await request.run(shareKey(calendarId), () =>
        shareCalendar(calendarId, email),
      );
      if (saved) redirectTo(`${CALENDARS_PATH}?notice=shared`);
    };

  const handleRemove =
    (calendarId: string, sharedWithUserId: string) => async () => {
      const removed = await request.run(
        removeKey(calendarId, sharedWithUserId),
        () => removeCalendarShare(calendarId, sharedWithUserId),
      );
      if (removed) redirectTo(`${CALENDARS_PATH}?notice=unshared`);
    };

  const toCalendar = (calendar: OwnedShareView): ShareCalendarModel => ({
    calendarId: calendar.calendarId,
    label: calendar.label,
    color: calendar.color,
    email: emailFor(calendar.calendarId),
    canShare:
      emailFor(calendar.calendarId).trim().length > 0 && !request.isBusy,
    shareLabel: pendingLabel(
      request.isPending(shareKey(calendar.calendarId)),
      'Sharing...',
      'Share',
    ),
    hasRecipients: calendar.recipients.length > 0,
    recipients: calendar.recipients.map((recipient) => ({
      ...recipient,
      removeLabel: pendingLabel(
        request.isPending(removeKey(calendar.calendarId, recipient.userId)),
        'Stopping...',
        'Stop sharing',
      ),
      disabled: request.isBusy,
      onRemove: handleRemove(calendar.calendarId, recipient.userId),
    })),
    onEmailChange: handleEmailChange(calendar.calendarId),
    onShare: handleShare(calendar.calendarId),
  });

  const toSharedWithMe = (calendar: SharedCalendarView): SharedWithMeModel => ({
    ...calendar,
    removeLabel: pendingLabel(
      request.isPending(removeKey(calendar.calendarId, userId)),
      'Removing...',
      'Remove',
    ),
    disabled: request.isBusy,
    onRemove: handleRemove(calendar.calendarId, userId),
  });

  return {
    calendars: owned.map(toCalendar),
    sharedWithMe: sharedWithMe.map(toSharedWithMe),
    hasCalendars: owned.length > 0,
    hasNoCalendars: owned.length === 0,
    hasSharedWithMe: sharedWithMe.length > 0,
    error: request.error,
    showError: request.showError,
  };
};

export type CalendarSharingModel = ReturnType<typeof useCalendarSharing>;
