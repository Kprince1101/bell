import type { GoogleConfig } from '@/lib/google/config';
import type {
  AccountRow,
  CalendarChannel,
  CalendarChoice,
  CalendarRow,
  DiscoveredCalendar,
  NewAccount,
  SyncDelta,
} from '@/types/calendar';
import type { GoogleGateway } from '@/types/google';

export interface CalendarRepo {
  accountsForUser: (userId: string) => Promise<AccountRow[]>;
  accountForUser: (
    userId: string,
    accountId: string,
  ) => Promise<AccountRow | null>;
  saveAccount: (account: NewAccount) => Promise<AccountRow>;
  refreshToken: (accountId: string) => Promise<string>;
  saveRefreshToken: (accountId: string, refreshToken: string) => Promise<void>;
  deleteAccount: (accountId: string) => Promise<void>;
  saveDiscoveredCalendars: (
    account: AccountRow,
    calendars: DiscoveredCalendar[],
  ) => Promise<void>;
  calendarsForUser: (userId: string) => Promise<CalendarRow[]>;
  calendarsForAccount: (accountId: string) => Promise<CalendarRow[]>;
  calendarById: (calendarId: string) => Promise<CalendarRow | null>;
  calendarByChannel: (channelId: string) => Promise<CalendarRow | null>;
  calendarsDueForRenewal: (cutoff: string) => Promise<CalendarRow[]>;
  saveChoice: (choice: CalendarChoice) => Promise<void>;
  saveChannel: (
    calendar: CalendarRow,
    channel: CalendarChannel,
  ) => Promise<void>;
  clearCalendar: (calendarId: string) => Promise<void>;
  applySync: (calendarId: string, delta: SyncDelta) => Promise<boolean>;
  recordFailure: (calendarId: string, message: string) => Promise<void>;
  markPushStopped: (now: string) => Promise<string[]>;
}

export interface BellServices {
  google: GoogleGateway;
  repo: CalendarRepo;
  config: () => GoogleConfig;
  now: () => Date;
  log: (line: string) => void;
  accessToken: (accountId: string) => Promise<string>;
}

export interface BellServiceParts {
  google: GoogleGateway;
  repo: CalendarRepo;
  config: () => GoogleConfig;
  now?: () => Date;
  log?: (line: string) => void;
}

const rotateAccessToken = async (
  google: GoogleGateway,
  repo: CalendarRepo,
  accountId: string,
): Promise<string> => {
  const refreshToken = await repo.refreshToken(accountId);
  const tokens = await google.refreshAccessToken(refreshToken);
  if (tokens.refresh_token && tokens.refresh_token !== refreshToken) {
    await repo.saveRefreshToken(accountId, tokens.refresh_token);
  }
  return tokens.access_token;
};

export const createBellServices = ({
  google,
  repo,
  config,
  now = () => new Date(),
  log = console.info,
}: BellServiceParts): BellServices => {
  const tokens = new Map<string, Promise<string>>();
  return {
    google,
    repo,
    config,
    now,
    log,
    accessToken: (accountId) => {
      const cached =
        tokens.get(accountId) ?? rotateAccessToken(google, repo, accountId);
      tokens.set(accountId, cached);
      return cached;
    },
  };
};
