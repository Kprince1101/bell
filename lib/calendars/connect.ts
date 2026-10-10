import type { BellServices } from '@/lib/calendars/services';
import { readIdTokenClaims } from '@/lib/google/idToken';
import type { GoogleCalendarListEntry } from '@/lib/google/schemas';
import type { AccountRow, DiscoveredCalendar } from '@/types/calendar';

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

const hexColor = (color: string | undefined): string | null => {
  if (color && HEX_COLOR.test(color)) return color.toLowerCase();
  return null;
};

export const toDiscoveredCalendar = (
  entry: GoogleCalendarListEntry,
): DiscoveredCalendar => ({
  googleCalendarId: entry.id,
  label: entry.summaryOverride ?? entry.summary ?? entry.id,
  color: hexColor(entry.backgroundColor),
  timeZone: entry.timeZone ?? null,
});

export const connectGoogleAccount = async (
  services: BellServices,
  userId: string,
  code: string,
): Promise<AccountRow> => {
  const { google, repo, log } = services;
  const tokens = await google.exchangeCode(code);
  if (!tokens.refresh_token) {
    throw new Error('Google did not return a refresh token');
  }
  const identity = readIdTokenClaims(tokens.id_token);
  const account = await repo.saveAccount({
    userId,
    googleAccountId: identity.sub,
    email: identity.email,
    refreshToken: tokens.refresh_token,
  });
  const entries = await google.listCalendars(tokens.access_token);
  await repo.saveDiscoveredCalendars(
    account,
    entries.map(toDiscoveredCalendar),
  );
  log(`[bell] connect account=${account.id} calendars=${entries.length}`);
  return account;
};
