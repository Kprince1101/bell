import { createHash } from 'node:crypto';
import type {
  GoogleEvent,
  GoogleEventDateTime,
  GoogleEventPerson,
} from '@/lib/google/schemas';
import { toUtcIso, zonedMidnightToUtc } from '@/lib/sync/zonedTime';
import type { EventAttendee, EventStatus, SyncedEvent } from '@/types/calendar';

const KNOWN_STATUSES = new Set<string>(['tentative', 'confirmed', 'cancelled']);
const URL_IN_TEXT = /https?:\/\/[^\s<>"')]+/i;

export const eventStatus = (status: string | undefined): EventStatus => {
  if (status && KNOWN_STATUSES.has(status)) return status as EventStatus;
  return 'confirmed';
};

export const isCancelled = (event: GoogleEvent): boolean =>
  eventStatus(event.status) === 'cancelled';

export const instantOf = (
  when: GoogleEventDateTime | undefined,
  calendarTimeZone: string | null,
): string | null => {
  if (when?.dateTime) return toUtcIso(when.dateTime);
  if (when?.date) {
    return zonedMidnightToUtc(
      when.date,
      when.timeZone ?? calendarTimeZone ?? 'UTC',
    );
  }
  return null;
};

export const findJoinUrl = (event: GoogleEvent): string | null => {
  const video = event.conferenceData?.entryPoints?.find(
    (entry) => entry.entryPointType === 'video' && entry.uri,
  );
  return (
    event.hangoutLink ??
    video?.uri ??
    event.location?.match(URL_IN_TEXT)?.[0] ??
    null
  );
};

export const fingerprintOf = (
  title: string,
  startsAt: string,
  endsAt: string,
  location: string | null,
): string =>
  createHash('sha256')
    .update(JSON.stringify([title, startsAt, endsAt, location]))
    .digest('hex');

const toAttendee = (person: GoogleEventPerson): EventAttendee => ({
  email: person.email ?? null,
  name: person.displayName ?? null,
  response: person.responseStatus ?? null,
  optional: person.optional ?? false,
  organizer: person.organizer ?? false,
  self: person.self ?? false,
});

export const normalizeEvent = (
  event: GoogleEvent,
  calendarTimeZone: string | null,
): SyncedEvent | null => {
  const startsAt = instantOf(event.start, calendarTimeZone);
  const endsAt = instantOf(event.end, calendarTimeZone);
  const rawStart = event.start?.dateTime ?? event.start?.date;
  if (!startsAt || !endsAt || !rawStart) return null;

  const title = event.summary ?? '';
  const location = event.location ?? null;
  return {
    event_id: event.id,
    recurring_event_id: event.recurringEventId ?? null,
    instance_at: instantOf(event.originalStartTime, calendarTimeZone),
    title,
    location,
    description: event.description ?? null,
    starts_at: startsAt,
    ends_at: endsAt,
    source_tz: event.start?.timeZone ?? calendarTimeZone,
    raw_start: rawStart,
    all_day: Boolean(event.start?.date && !event.start.dateTime),
    status: eventStatus(event.status),
    organizer: event.organizer?.email ?? null,
    attendees: (event.attendees ?? []).map(toAttendee),
    join_url: findJoinUrl(event),
    fingerprint: fingerprintOf(title, startsAt, endsAt, location),
  };
};

export const planDelta = (
  items: GoogleEvent[],
  calendarTimeZone: string | null,
): { upserts: SyncedEvent[]; cancelled: string[] } => {
  const latest = new Map(items.map((item) => [item.id, item]));
  const upserts: SyncedEvent[] = [];
  const cancelled: string[] = [];
  latest.forEach((item) => {
    if (isCancelled(item)) {
      cancelled.push(item.id);
      return;
    }
    const normalized = normalizeEvent(item, calendarTimeZone);
    if (normalized) upserts.push(normalized);
  });
  return { upserts, cancelled };
};
