import type { NotifyLinks } from '@/lib/notify/links';
import type { ChannelTestResult, JobRun } from '@/types/health';
import type {
  AckTarget,
  ChannelKind,
  ChannelTarget,
  Delivery,
  NotificationOwner,
  PushoverGateway,
  SendOutcome,
  SlackGateway,
  SlackInstall,
  TwilioGateway,
} from '@/types/notifications';

export interface ChannelSecretInput {
  userId: string;
  kinds: ChannelKind[];
  value: string;
  hint: string;
  slackTeamId?: string;
}

export interface NotifyRepo {
  materialize: (now: string) => Promise<number>;
  claimDue: (now: string) => Promise<Delivery[]>;
  finish: (id: string, outcome: SendOutcome, at: string) => Promise<void>;
  claimFallback: (id: string, now: string) => Promise<Delivery | null>;
  acknowledge: (
    target: AckTarget,
    by: string,
    at: string,
  ) => Promise<Delivery[]>;
  ackTargetsForPhone: (phone: string, now: string) => Promise<AckTarget[]>;
  notificationOwner: (id: string) => Promise<NotificationOwner | null>;
  slackEventOwner: (
    eventId: string,
    teamId: string,
    slackUserId: string,
  ) => Promise<string | null>;
  saveChannelSecret: (input: ChannelSecretInput) => Promise<void>;
  setChannelActive: (
    userId: string,
    kind: ChannelKind,
    active: boolean,
  ) => Promise<boolean>;
  channelTarget: (
    userId: string,
    kind: ChannelKind,
  ) => Promise<ChannelTarget | null>;
  saveSlackInstall: (
    install: SlackInstall,
    botTokenEncrypted: string,
    userId: string,
  ) => Promise<void>;
  setCalendarQuiet: (
    userId: string,
    calendarId: string,
    quiet: boolean,
  ) => Promise<boolean>;
  recordJobRun: (run: JobRun) => Promise<void>;
  recordChannelTest: (test: ChannelTestResult) => Promise<void>;
}

export interface NotifyServices {
  repo: NotifyRepo;
  slack: SlackGateway;
  pushover: PushoverGateway;
  twilio: TwilioGateway;
  links: NotifyLinks;
  encrypt: (plain: string) => string;
  decrypt: (sealed: string) => string;
  now: () => Date;
  log: (line: string) => void;
}
