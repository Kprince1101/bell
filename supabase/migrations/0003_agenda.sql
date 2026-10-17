alter table bell.calendars add column paused boolean not null default false;

alter table bell.events add column changed_at timestamptz;
alter table bell.events add column previous_starts_at timestamptz;

create index events_user_changed_idx on bell.events (user_id, changed_at)
  where changed_at is not null;

create function bell.events_track_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if exists (
      select 1 from bell.calendars c
      where c.id = new.calendar_id and c.last_sync_at is not null
    ) then
      new.changed_at := now();
    end if;
    return new;
  end if;

  if new.status = 'cancelled' and old.status <> 'cancelled' then
    new.changed_at := now();
  elsif new.status <> 'cancelled' and old.status = 'cancelled' then
    new.changed_at := now();
    new.previous_starts_at := null;
  elsif new.status <> 'cancelled' and new.starts_at <> old.starts_at then
    new.changed_at := now();
    new.previous_starts_at := old.starts_at;
  end if;
  return new;
end;
$$;

create trigger events_track_change
  before insert or update on bell.events
  for each row execute function bell.events_track_change();

create table bell.agenda_visits (
  user_id uuid primary key references bell.users(id) on delete cascade,
  seen_at timestamptz not null,
  baseline_at timestamptz
);

alter table bell.agenda_visits enable row level security;

create policy agenda_visits_select_own on bell.agenda_visits
  for select to authenticated using (user_id = auth.uid());

create policy agenda_visits_insert_own on bell.agenda_visits
  for insert to authenticated with check (user_id = auth.uid());

create policy agenda_visits_update_own on bell.agenda_visits
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on bell.agenda_visits from public, anon, authenticated;
grant select, insert, update on bell.agenda_visits to authenticated;
grant all on bell.agenda_visits to service_role;

revoke all on function bell.events_track_change() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table bell.events;
  end if;
end;
$$;
