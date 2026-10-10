import { createNotifyLinks } from '@/lib/notify/links';
import type { NotifyRepo, NotifyServices } from '@/lib/notify/services';
import type {
  Delivery,
  PushoverGateway,
  SlackGateway,
  TwilioGateway,
} from '@/types/notifications';
import type { Fake } from '@/test-utils/calendarFakes';
import { USER_ID } from '@/test-utils/supabaseFake';

export const TEST_LINKS = {
  appUrl: 'https://bell.test',
  webhookSecret: 'webhook-secret-webhook-secret-webhook-secret',
};

export const EVENT_ID = 'eeeeeeee-0000-4000-8000-000000000001';
export const NOTIFICATION_ID = 'ffffffff-0000-4000-8000-000000000001';

export const sealed = (plain: string) => `sealed:${plain}`;

export const delivery = (overrides: Partial<Delivery> = {}): Delivery => ({
  id: NOTIFICATION_ID,
  event_id: EVENT_ID,
  user_id: USER_ID,
  step: '30m',
  channel: 'pushover',
  due_at: '2026-10-10T13:30:00+00:00',
  provider_ref: null,
  title: 'Client sync',
  starts_at: '2026-10-10T14:00:00+00:00',
  source_tz: 'America/Chicago',
  join_url: 'https://meet.google.com/abc-defg-hij',
  time_zone: 'America/Chicago',
  target: 'u'.repeat(30),
  slack_team_id: null,
  slack_bot_token: null,
  slack_ref: null,
  ...overrides,
});

export const createFakeSlack = () => {
  const slack: Fake<SlackGateway> = {
    authorizeUrl: vi.fn<SlackGateway['authorizeUrl']>(
      (state) => `https://slack.test/oauth?state=${state}`,
    ),
    exchangeCode: vi.fn<SlackGateway['exchangeCode']>(async () => ({
      teamId: 'T1',
      teamName: 'Toptal',
      botUserId: 'B1',
      botToken: 'xoxb-1',
      authedUserId: 'U1',
    })),
    postMessage: vi.fn<SlackGateway['postMessage']>(async () => ({
      channel: 'D1',
      ts: '1700000000.000100',
    })),
    updateMessage: vi.fn<SlackGateway['updateMessage']>(async () => undefined),
  };
  return slack;
};

const receiptFor = (priority: number): string | null => {
  if (priority === 2) return 'receipt-1';
  return null;
};

export const createFakePushover = () => {
  const pushover: Fake<PushoverGateway> = {
    send: vi.fn<PushoverGateway['send']>(async (message) => ({
      receipt: receiptFor(message.priority),
    })),
    cancelReceipt: vi.fn<PushoverGateway['cancelReceipt']>(
      async () => undefined,
    ),
  };
  return pushover;
};

export const createFakeTwilio = () => {
  const twilio: Fake<TwilioGateway> = {
    sendSms: vi.fn<TwilioGateway['sendSms']>(async () => 'SM1'),
    call: vi.fn<TwilioGateway['call']>(async () => 'CA1'),
  };
  return twilio;
};

export const createFakeNotifyRepo = () => {
  const repo: Fake<NotifyRepo> = {
    materialize: vi.fn<NotifyRepo['materialize']>(async () => 0),
    claimDue: vi.fn<NotifyRepo['claimDue']>(async () => []),
    finish: vi.fn<NotifyRepo['finish']>(async () => undefined),
    claimFallback: vi.fn<NotifyRepo['claimFallback']>(async () => null),
    acknowledge: vi.fn<NotifyRepo['acknowledge']>(async () => []),
    ackTargetsForPhone: vi.fn<NotifyRepo['ackTargetsForPhone']>(async () => []),
    notificationOwner: vi.fn<NotifyRepo['notificationOwner']>(async () => null),
    slackEventOwner: vi.fn<NotifyRepo['slackEventOwner']>(async () => null),
    saveChannelSecret: vi.fn<NotifyRepo['saveChannelSecret']>(
      async () => undefined,
    ),
    setChannelActive: vi.fn<NotifyRepo['setChannelActive']>(async () => true),
    channelTarget: vi.fn<NotifyRepo['channelTarget']>(async () => null),
    saveSlackInstall: vi.fn<NotifyRepo['saveSlackInstall']>(
      async () => undefined,
    ),
    setCalendarQuiet: vi.fn<NotifyRepo['setCalendarQuiet']>(async () => true),
  };
  return repo;
};

export const createFakeNotifyServices = ({
  repo,
  now = () => new Date('2026-10-10T13:30:00.000Z'),
}: { repo?: NotifyRepo; now?: () => Date } = {}) => {
  const fakeRepo = createFakeNotifyRepo();
  const slack = createFakeSlack();
  const pushover = createFakePushover();
  const twilio = createFakeTwilio();
  const log = vi.fn();
  const services: NotifyServices = {
    repo: repo ?? (fakeRepo as NotifyRepo),
    slack: slack as SlackGateway,
    pushover: pushover as PushoverGateway,
    twilio: twilio as TwilioGateway,
    links: createNotifyLinks(() => TEST_LINKS),
    encrypt: sealed,
    decrypt: (value) => value.replace(/^sealed:/, ''),
    now,
    log,
  };
  return { services, repo: fakeRepo, slack, pushover, twilio, log };
};
