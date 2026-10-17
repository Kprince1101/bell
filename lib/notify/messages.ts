import { MINUTE_MS } from '@/lib/constants';
import { SLACK_ACK_ACTION, SLACK_JOIN_ACTION } from '@/lib/notify/slack';
import type {
  Delivery,
  NotifyStep,
  PushoverPriority,
  SlackButton,
  SlackMessage,
} from '@/types/notifications';

type Reminder = Pick<
  Delivery,
  | 'event_id'
  | 'step'
  | 'title'
  | 'starts_at'
  | 'source_tz'
  | 'join_url'
  | 'time_zone'
>;

const UNTITLED = '(no title)';

const minutesWord = (minutes: number): string => {
  if (minutes === 1) return '1 minute';
  return `${minutes} minutes`;
};

export const leadPhrase = (startsAt: string, now: Date): string => {
  const minutes = Math.round(
    (Date.parse(startsAt) - now.getTime()) / MINUTE_MS,
  );
  if (minutes > 0) return `starts in ${minutesWord(minutes)}`;
  if (minutes === 0) return 'is starting now';
  return `started ${minutesWord(-minutes)} ago`;
};

export const PUSHOVER_PRIORITY: Record<NotifyStep, PushoverPriority> = {
  '30m': 0,
  '10m': 1,
  '2m': 2,
  start: 2,
  moved: 0,
};

export const TEST_MESSAGE =
  'This is a test from Bell. Meeting reminders will arrive here.';

const formatTime = (iso: string, timeZone: string, withDay: boolean) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
    ...(withDay && { weekday: 'short', month: 'short', day: 'numeric' }),
  }).format(new Date(iso));

export const formatEventTime = (
  startsAt: string,
  userZone: string,
  sourceZone: string | null,
  withDay = false,
): string => {
  const local = formatTime(startsAt, userZone, withDay);
  if (!sourceZone || sourceZone === userZone) return local;
  const invite = formatTime(startsAt, sourceZone, withDay);
  if (invite === local) return local;
  return `${local} (${invite} in the invite)`;
};

const titleOf = (reminder: Pick<Reminder, 'title'>): string =>
  reminder.title.trim() || UNTITLED;

const whenOf = (reminder: Reminder): string =>
  formatEventTime(
    reminder.starts_at,
    reminder.time_zone,
    reminder.source_tz,
    reminder.step === 'moved',
  );

export const reminderSentence = (reminder: Reminder, now: Date): string => {
  if (reminder.step === 'moved') {
    return `${titleOf(reminder)} has moved to ${whenOf(reminder)}.`;
  }
  return `${titleOf(reminder)} ${leadPhrase(reminder.starts_at, now)}, at ${whenOf(reminder)}.`;
};

const joinButton = (url: string | null): SlackButton[] => {
  if (!url) return [];
  return [{ text: 'Join', actionId: SLACK_JOIN_ACTION, url }];
};

export const slackReminder = (reminder: Reminder, now: Date): SlackMessage => {
  const buttons = joinButton(reminder.join_url);
  if (reminder.step === 'moved') {
    return {
      text: `:bell: *${titleOf(reminder)}* has moved to ${whenOf(reminder)}.`,
      buttons,
    };
  }
  buttons.push({
    text: 'Acknowledge',
    actionId: SLACK_ACK_ACTION,
    value: reminder.event_id,
    primary: true,
  });
  return {
    text: `:bell: *${titleOf(reminder)}* ${leadPhrase(reminder.starts_at, now)}, at ${whenOf(reminder)}.`,
    buttons,
  };
};

export const slackAcknowledged = (reminder: Reminder): SlackMessage => ({
  text: `:white_check_mark: *${titleOf(reminder)}* at ${formatEventTime(reminder.starts_at, reminder.time_zone, reminder.source_tz)}. Acknowledged, nothing else will ring for it.`,
  buttons: joinButton(reminder.join_url),
});

export const pushoverBody = (reminder: Reminder, now: Date) => ({
  title: titleOf(reminder),
  message: reminderSentence(reminder, now),
  priority: PUSHOVER_PRIORITY[reminder.step],
  url: reminder.join_url,
});

export const smsBody = (reminder: Reminder, now: Date): string => {
  const join = reminder.join_url && ` Join: ${reminder.join_url}`;
  return `Bell: ${reminderSentence(reminder, now)}${join || ''} Reply to acknowledge.`;
};

export const voiceScript = (reminder: Reminder, now: Date): string =>
  `Bell reminder. ${reminderSentence(reminder, now)} Press any key to acknowledge.`;
