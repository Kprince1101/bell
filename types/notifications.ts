import type { z } from 'zod';
import type {
  channelTargetSchema,
  deliverySchema,
} from '@/lib/schemas/notifications';
import type { CHANNEL_KINDS, NOTIFY_STEPS } from '@/lib/schemas/notifications';

export type ChannelKind = (typeof CHANNEL_KINDS)[number];
export type NotifyStep = (typeof NOTIFY_STEPS)[number];
export type NotifyResult = 'sent' | 'failed' | 'skipped' | 'cancelled';

export type Delivery = z.infer<typeof deliverySchema>;
export type ChannelTarget = z.infer<typeof channelTargetSchema>;

export interface SendOutcome {
  result: NotifyResult;
  error: string | null;
  providerRef: string | null;
}

export interface AckTarget {
  eventId: string;
  userId: string;
}

export interface NotificationOwner extends AckTarget {
  providerRef: string | null;
  target: string | null;
}

export interface SlackMessageRef {
  channel: string;
  ts: string;
}

export interface SlackButton {
  text: string;
  actionId: string;
  url?: string;
  value?: string;
  primary?: boolean;
}

export interface SlackMessage {
  text: string;
  buttons: SlackButton[];
}

export interface SlackInstall {
  teamId: string;
  teamName: string;
  botUserId: string;
  botToken: string;
  authedUserId: string;
}

export type PushoverPriority = 0 | 1 | 2;

export interface PushoverMessage {
  user: string;
  title: string;
  message: string;
  priority: PushoverPriority;
  url: string | null;
  callback: string | null;
}

export interface PushoverReceipt {
  receipt: string | null;
}

export interface SlackGateway {
  authorizeUrl: (state: string) => string;
  exchangeCode: (code: string) => Promise<SlackInstall>;
  postMessage: (
    botToken: string,
    slackUserId: string,
    message: SlackMessage,
  ) => Promise<SlackMessageRef>;
  updateMessage: (
    botToken: string,
    ref: SlackMessageRef,
    message: SlackMessage,
  ) => Promise<void>;
}

export interface PushoverGateway {
  send: (message: PushoverMessage) => Promise<PushoverReceipt>;
  cancelReceipt: (receipt: string) => Promise<void>;
}

export interface TwilioGateway {
  sendSms: (to: string, body: string) => Promise<string>;
  call: (to: string, twiml: string) => Promise<string>;
}

export interface ChannelView {
  kind: ChannelKind;
  configured: boolean;
  active: boolean;
  hint: string | null;
}

export interface QuietCalendarView {
  id: string;
  label: string;
  color: string;
  quiet: boolean;
}

export interface RingingEventView {
  eventId: string;
  title: string;
  when: string;
  joinUrl: string | null;
  status: string;
}

export interface NotificationsClientProps {
  channels: ChannelView[];
  calendars: QuietCalendarView[];
  ringing: RingingEventView[];
  error: string | null;
  notice: string | null;
}
