create table bell.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references bell.users(id) on delete cascade,
  google_account_id text not null,
  email text not null,
  created_at timestamptz not null default now(),
  unique (user_id, google_account_id),
  unique (id, user_id)
);

create table bell.account_secrets (
  account_id uuid primary key references bell.accounts(id) on delete cascade,
  refresh_token_encrypted text not null,
  updated_at timestamptz not null default now()
);

create table bell.calendars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  account_id uuid not null,
  google_calendar_id text not null,
  label text not null,
  color text not null default '#4285f4' check (color ~ '^#[0-9a-fA-F]{6}$'),
  time_zone text,
  sync_token text,
  channel_id uuid unique,
  channel_resource_id text,
  channel_expires_at timestamptz,
  active boolean not null default false,
  healthy boolean not null default true,
  last_sync_at timestamptz,
  last_error text,
  fail_count integer not null default 0 check (fail_count >= 0),
  created_at timestamptz not null default now(),
  unique (account_id, google_calendar_id),
  unique (id, user_id),
  foreign key (account_id, user_id) references bell.accounts(id, user_id) on delete cascade
);

create table bell.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  calendar_id uuid not null,
  event_id text not null,
  recurring_event_id text,
  instance_at timestamptz,
  title text not null default '',
  location text,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  source_tz text,
  raw_start text not null,
  all_day boolean not null default false,
  status text not null check (status in ('tentative', 'confirmed', 'cancelled')),
  organizer text,
  attendees jsonb not null default '[]'::jsonb,
  join_url text,
  fingerprint text not null,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (calendar_id, event_id),
  foreign key (calendar_id, user_id) references bell.calendars(id, user_id) on delete cascade
);

create index calendars_user_idx on bell.calendars (user_id);
create index calendars_channel_expiry_idx on bell.calendars (channel_expires_at) where active;
create index events_user_starts_idx on bell.events (user_id, starts_at);
create index events_recurring_idx on bell.events (calendar_id, recurring_event_id);

alter table bell.accounts enable row level security;
alter table bell.account_secrets enable row level security;
alter table bell.calendars enable row level security;
alter table bell.events enable row level security;

create policy accounts_select_own on bell.accounts
  for select to authenticated using (user_id = auth.uid());

create policy calendars_select_own on bell.calendars
  for select to authenticated using (user_id = auth.uid());

create policy events_select_own on bell.events
  for select to authenticated using (user_id = auth.uid());

revoke all on bell.accounts, bell.account_secrets, bell.calendars, bell.events
  from public, anon, authenticated;
grant select on bell.accounts, bell.calendars, bell.events to authenticated;
grant all on bell.accounts, bell.account_secrets, bell.calendars, bell.events
  to service_role;

create function bell.apply_sync(
  p_calendar_id uuid,
  p_events jsonb,
  p_cancelled text[],
  p_sync_token text,
  p_full boolean,
  p_window_start timestamptz,
  p_seen_at timestamptz
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  select c.user_id into v_user_id
  from bell.calendars c
  where c.id = p_calendar_id
  for update;

  if v_user_id is null then
    raise exception 'unknown calendar: %', p_calendar_id using errcode = 'P0002';
  end if;

  insert into bell.events (
    user_id, calendar_id, event_id, recurring_event_id, instance_at, title,
    location, description, starts_at, ends_at, source_tz, raw_start, all_day,
    status, organizer, attendees, join_url, fingerprint, last_seen_at
  )
  select
    v_user_id, p_calendar_id, e.event_id, e.recurring_event_id, e.instance_at,
    coalesce(e.title, ''), e.location, e.description, e.starts_at, e.ends_at,
    e.source_tz, e.raw_start, coalesce(e.all_day, false), e.status, e.organizer,
    coalesce(e.attendees, '[]'::jsonb), e.join_url, e.fingerprint, p_seen_at
  from jsonb_to_recordset(coalesce(p_events, '[]'::jsonb)) as e(
    event_id text,
    recurring_event_id text,
    instance_at timestamptz,
    title text,
    location text,
    description text,
    starts_at timestamptz,
    ends_at timestamptz,
    source_tz text,
    raw_start text,
    all_day boolean,
    status text,
    organizer text,
    attendees jsonb,
    join_url text,
    fingerprint text
  )
  on conflict (calendar_id, event_id) do update set
    recurring_event_id = excluded.recurring_event_id,
    instance_at = excluded.instance_at,
    title = excluded.title,
    location = excluded.location,
    description = excluded.description,
    starts_at = excluded.starts_at,
    ends_at = excluded.ends_at,
    source_tz = excluded.source_tz,
    raw_start = excluded.raw_start,
    all_day = excluded.all_day,
    status = excluded.status,
    organizer = excluded.organizer,
    attendees = excluded.attendees,
    join_url = excluded.join_url,
    fingerprint = excluded.fingerprint,
    last_seen_at = excluded.last_seen_at;

  update bell.events ev
  set status = 'cancelled', last_seen_at = p_seen_at
  where ev.calendar_id = p_calendar_id
    and (
      ev.event_id = any(coalesce(p_cancelled, '{}'))
      or ev.recurring_event_id = any(coalesce(p_cancelled, '{}'))
    );

  if p_full then
    update bell.events ev
    set status = 'cancelled'
    where ev.calendar_id = p_calendar_id
      and ev.last_seen_at < p_seen_at
      and ev.ends_at >= p_window_start
      and ev.status <> 'cancelled';
  end if;

  update bell.calendars
  set sync_token = p_sync_token,
      last_sync_at = p_seen_at,
      fail_count = 0,
      last_error = null,
      healthy = true
  where id = p_calendar_id;
end;
$$;

create function bell.record_sync_failure(p_calendar_id uuid, p_error text)
returns bell.calendars
language sql
set search_path = ''
as $$
  update bell.calendars
  set fail_count = fail_count + 1,
      last_error = p_error,
      healthy = fail_count + 1 < 3
  where id = p_calendar_id
  returning *;
$$;

create function bell.mark_push_stopped(p_now timestamptz)
returns setof uuid
language sql
set search_path = ''
as $$
  update bell.calendars
  set healthy = false,
      last_error = 'Push notifications stopped: the watch channel is missing or expired.'
  where active
    and (channel_id is null or channel_expires_at is null or channel_expires_at <= p_now)
  returning id;
$$;

revoke all on function bell.apply_sync(uuid, jsonb, text[], text, boolean, timestamptz, timestamptz)
  from public, anon, authenticated;
revoke all on function bell.record_sync_failure(uuid, text) from public, anon, authenticated;
revoke all on function bell.mark_push_stopped(timestamptz) from public, anon, authenticated;

grant execute on function bell.apply_sync(uuid, jsonb, text[], text, boolean, timestamptz, timestamptz)
  to service_role;
grant execute on function bell.record_sync_failure(uuid, text) to service_role;
grant execute on function bell.mark_push_stopped(timestamptz) to service_role;
