alter table bell.calendars add column quiet boolean not null default false;

create table bell.slack_installs (
  team_id text primary key,
  team_name text not null,
  bot_user_id text not null,
  bot_token_encrypted text not null,
  installed_by uuid references bell.users(id) on delete set null,
  installed_at timestamptz not null default now()
);

create table bell.channels (
  user_id uuid not null references bell.users(id) on delete cascade,
  kind text not null check (kind in ('slack', 'pushover', 'sms', 'voice')),
  active boolean not null default false,
  hint text,
  updated_at timestamptz not null default now(),
  primary key (user_id, kind)
);

create table bell.channel_secrets (
  user_id uuid not null,
  kind text not null,
  value text not null,
  slack_team_id text references bell.slack_installs(team_id) on delete cascade,
  updated_at timestamptz not null default now(),
  primary key (user_id, kind),
  foreign key (user_id, kind) references bell.channels(user_id, kind) on delete cascade
);

create table bell.notifications (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references bell.events(id) on delete cascade,
  user_id uuid not null references bell.users(id) on delete cascade,
  step text not null check (step in ('30m', '10m', '2m', 'start', 'moved')),
  channel text not null check (channel in ('slack', 'pushover', 'sms', 'voice')),
  due_at timestamptz not null,
  event_starts_at timestamptz not null,
  fallback_for text check (fallback_for in ('slack', 'pushover', 'sms', 'voice')),
  claimed_at timestamptz,
  sent_at timestamptz,
  result text check (result in ('sent', 'failed', 'skipped', 'cancelled')),
  error text,
  provider_ref text,
  acknowledged_at timestamptz,
  acknowledged_by text,
  created_at timestamptz not null default now(),
  unique (event_id, step, channel)
);

create index channel_secrets_value_idx on bell.channel_secrets (kind, value);
create index notifications_due_idx on bell.notifications (due_at) where claimed_at is null;
create index notifications_user_idx on bell.notifications (user_id, event_starts_at);
create index events_starts_idx on bell.events (starts_at)
  where status <> 'cancelled' and not all_day;

alter table bell.slack_installs enable row level security;
alter table bell.channels enable row level security;
alter table bell.channel_secrets enable row level security;
alter table bell.notifications enable row level security;

create policy channels_select_own on bell.channels
  for select to authenticated using (user_id = auth.uid());

create policy notifications_select_own on bell.notifications
  for select to authenticated using (user_id = auth.uid());

revoke all on bell.slack_installs, bell.channels, bell.channel_secrets, bell.notifications
  from public, anon, authenticated;
grant select on bell.channels, bell.notifications to authenticated;
grant all on bell.slack_installs, bell.channels, bell.channel_secrets, bell.notifications
  to service_role;

create function bell.notification_delivery(p_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', n.id,
    'event_id', n.event_id,
    'user_id', n.user_id,
    'step', n.step,
    'channel', n.channel,
    'due_at', n.due_at,
    'provider_ref', n.provider_ref,
    'title', e.title,
    'starts_at', e.starts_at,
    'source_tz', e.source_tz,
    'join_url', e.join_url,
    'time_zone', u.time_zone,
    'target', s.value,
    'slack_team_id', s.slack_team_id,
    'slack_bot_token', si.bot_token_encrypted,
    'slack_ref', (
      select p.provider_ref
      from bell.notifications p
      where p.event_id = n.event_id
        and p.channel = 'slack'
        and p.result = 'sent'
        and p.provider_ref is not null
        and p.id <> n.id
      order by p.sent_at desc
      limit 1
    )
  )
  from bell.notifications n
  join bell.events e on e.id = n.event_id
  join bell.users u on u.id = n.user_id
  left join bell.channel_secrets s on s.user_id = n.user_id and s.kind = n.channel
  left join bell.slack_installs si on si.team_id = s.slack_team_id
  where n.id = p_id;
$$;

create function bell.materialize_notifications(p_now timestamptz, p_event_id uuid default null)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into bell.notifications (
    event_id, user_id, step, channel, due_at, event_starts_at,
    acknowledged_at, acknowledged_by
  )
  select
    e.id, e.user_id, plan.step, plan.channel, e.starts_at - plan.lead,
    e.starts_at, ack.acknowledged_at, ack.acknowledged_by
  from bell.events e
  join bell.calendars c on c.id = e.calendar_id
  cross join (values
    ('30m', 'slack', interval '30 minutes'),
    ('30m', 'pushover', interval '30 minutes'),
    ('10m', 'slack', interval '10 minutes'),
    ('10m', 'pushover', interval '10 minutes'),
    ('2m', 'pushover', interval '2 minutes'),
    ('2m', 'sms', interval '2 minutes'),
    ('start', 'voice', interval '0 minutes')
  ) as plan(step, channel, lead)
  join bell.channels ch
    on ch.user_id = e.user_id and ch.kind = plan.channel and ch.active
  join bell.channel_secrets s on s.user_id = ch.user_id and s.kind = ch.kind
  left join lateral (
    select a.acknowledged_at, a.acknowledged_by
    from bell.notifications a
    where a.event_id = e.id and a.acknowledged_at is not null
    order by a.acknowledged_at
    limit 1
  ) ack on true
  where (p_event_id is null or e.id = p_event_id)
    and e.status <> 'cancelled'
    and not e.all_day
    and c.active
    and not c.quiet
    and e.starts_at > p_now - interval '2 minutes'
    and e.starts_at <= p_now + interval '35 minutes'
  on conflict (event_id, step, channel) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create function bell.claim_due_notifications(p_now timestamptz)
returns setof jsonb
language plpgsql
set search_path = ''
as $$
begin
  return query
  with locked as (
    select n.id
    from bell.notifications n
    where n.claimed_at is null and n.due_at <= p_now
    for update skip locked
  ),
  classified as (
    select
      n.id,
      case
        when n.acknowledged_at is not null then 'acknowledged'
        when e.status = 'cancelled' or e.all_day or not c.active or c.quiet
          or ch.active is not true then 'cancelled'
        when n.step <> 'moved' and p_now > e.starts_at + interval '2 minutes'
          then 'late'
        when n.step <> 'moved' and n.due_at < max(n.due_at)
          filter (where n.step <> 'moved') over (partition by n.event_id)
          then 'superseded'
      end as reason
    from bell.notifications n
    join locked l on l.id = n.id
    join bell.events e on e.id = n.event_id
    join bell.calendars c on c.id = e.calendar_id
    left join bell.channels ch on ch.user_id = n.user_id and ch.kind = n.channel
  ),
  claimed as (
    update bell.notifications n
    set claimed_at = p_now,
        result = case
          when k.reason is null then null
          when k.reason = 'cancelled' then 'cancelled'
          else 'skipped'
        end,
        error = k.reason
    from classified k
    where n.id = k.id
    returning n.id, k.reason
  )
  select bell.notification_delivery(cl.id)
  from claimed cl
  where cl.reason is null;
end;
$$;

create function bell.finish_notification(
  p_id uuid,
  p_result text,
  p_error text,
  p_provider_ref text,
  p_at timestamptz
)
returns void
language sql
set search_path = ''
as $$
  update bell.notifications
  set result = p_result,
      error = p_error,
      provider_ref = p_provider_ref,
      sent_at = case when p_result = 'sent' then p_at end
  where id = p_id;
$$;

create function bell.claim_fallback(p_id uuid, p_now timestamptz)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_order text[] := array['slack', 'pushover', 'sms', 'voice'];
  v_failed bell.notifications;
  v_position integer;
  v_kind text;
  v_new_id uuid;
begin
  select * into v_failed from bell.notifications where id = p_id;
  if not found or v_failed.acknowledged_at is not null then
    return null;
  end if;

  v_position := array_position(v_order, v_failed.channel);
  for i in 1 .. array_length(v_order, 1) - 1 loop
    v_kind := v_order[((v_position - 1 + i) % array_length(v_order, 1)) + 1];
    if exists (
      select 1
      from bell.channels ch
      join bell.channel_secrets s on s.user_id = ch.user_id and s.kind = ch.kind
      where ch.user_id = v_failed.user_id and ch.kind = v_kind and ch.active
    ) then
      insert into bell.notifications (
        event_id, user_id, step, channel, due_at, event_starts_at,
        fallback_for, claimed_at
      )
      values (
        v_failed.event_id, v_failed.user_id, v_failed.step, v_kind,
        v_failed.due_at, v_failed.event_starts_at, v_failed.channel, p_now
      )
      on conflict (event_id, step, channel) do nothing
      returning id into v_new_id;

      if v_new_id is not null then
        return bell.notification_delivery(v_new_id);
      end if;
    end if;
  end loop;

  return null;
end;
$$;

create function bell.acknowledge_event(
  p_event_id uuid,
  p_user_id uuid,
  p_by text,
  p_at timestamptz
)
returns setof jsonb
language plpgsql
set search_path = ''
as $$
begin
  return query
  with acked as (
    update bell.notifications n
    set acknowledged_at = p_at, acknowledged_by = p_by
    where n.event_id = p_event_id
      and n.user_id = p_user_id
      and n.acknowledged_at is null
    returning n.id, n.result, n.provider_ref
  )
  select bell.notification_delivery(a.id)
  from acked a
  where a.result = 'sent' and a.provider_ref is not null;
end;
$$;

create function bell.ack_target_for_phone(p_phone text, p_now timestamptz)
returns table (event_id uuid, user_id uuid)
language sql
stable
set search_path = ''
as $$
  select distinct on (n.user_id) n.event_id, n.user_id
  from bell.notifications n
  join bell.channel_secrets s
    on s.user_id = n.user_id and s.kind = 'sms' and s.value = p_phone
  where n.acknowledged_at is null
    and n.sent_at is not null
    and n.event_starts_at > p_now - interval '30 minutes'
  order by n.user_id, n.sent_at desc;
$$;

create function bell.notification_owner(p_id uuid)
returns table (event_id uuid, user_id uuid, provider_ref text, target text)
language sql
stable
set search_path = ''
as $$
  select n.event_id, n.user_id, n.provider_ref, s.value
  from bell.notifications n
  left join bell.channel_secrets s on s.user_id = n.user_id and s.kind = n.channel
  where n.id = p_id;
$$;

create function bell.slack_event_owner(
  p_event_id uuid,
  p_team_id text,
  p_slack_user_id text
)
returns uuid
language sql
stable
set search_path = ''
as $$
  select e.user_id
  from bell.events e
  join bell.channel_secrets s
    on s.user_id = e.user_id
    and s.kind = 'slack'
    and s.slack_team_id = p_team_id
    and s.value = p_slack_user_id
  where e.id = p_event_id;
$$;

create function bell.save_channel_secret(
  p_user_id uuid,
  p_kinds text[],
  p_value text,
  p_hint text,
  p_slack_team_id text default null
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  insert into bell.channels (user_id, kind, active, hint, updated_at)
  select p_user_id, k, true, p_hint, now()
  from unnest(p_kinds) as k
  on conflict (user_id, kind) do update
    set active = true, hint = excluded.hint, updated_at = excluded.updated_at;

  insert into bell.channel_secrets (user_id, kind, value, slack_team_id, updated_at)
  select p_user_id, k, p_value, p_slack_team_id, now()
  from unnest(p_kinds) as k
  on conflict (user_id, kind) do update
    set value = excluded.value,
        slack_team_id = excluded.slack_team_id,
        updated_at = excluded.updated_at;
end;
$$;

create function bell.set_channel_active(p_user_id uuid, p_kind text, p_active boolean)
returns boolean
language sql
set search_path = ''
as $$
  with changed as (
    update bell.channels ch
    set active = p_active, updated_at = now()
    where ch.user_id = p_user_id
      and ch.kind = p_kind
      and exists (
        select 1 from bell.channel_secrets s
        where s.user_id = ch.user_id and s.kind = ch.kind
      )
    returning 1
  )
  select exists (select 1 from changed);
$$;

create function bell.channel_target(p_user_id uuid, p_kind text)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'target', s.value,
    'slack_team_id', s.slack_team_id,
    'slack_bot_token', si.bot_token_encrypted
  )
  from bell.channel_secrets s
  left join bell.slack_installs si on si.team_id = s.slack_team_id
  where s.user_id = p_user_id and s.kind = p_kind;
$$;

create function bell.save_slack_install(
  p_team_id text,
  p_team_name text,
  p_bot_user_id text,
  p_bot_token_encrypted text,
  p_installed_by uuid
)
returns void
language sql
set search_path = ''
as $$
  insert into bell.slack_installs (
    team_id, team_name, bot_user_id, bot_token_encrypted, installed_by, installed_at
  )
  values (
    p_team_id, p_team_name, p_bot_user_id, p_bot_token_encrypted, p_installed_by, now()
  )
  on conflict (team_id) do update
    set team_name = excluded.team_name,
        bot_user_id = excluded.bot_user_id,
        bot_token_encrypted = excluded.bot_token_encrypted,
        installed_by = excluded.installed_by,
        installed_at = excluded.installed_at;
$$;

create function bell.set_calendar_quiet(p_user_id uuid, p_calendar_id uuid, p_quiet boolean)
returns boolean
language sql
set search_path = ''
as $$
  with changed as (
    update bell.calendars
    set quiet = p_quiet
    where id = p_calendar_id and user_id = p_user_id
    returning 1
  )
  select exists (select 1 from changed);
$$;

create function bell.events_after_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform bell.materialize_notifications(now(), new.id);
  return null;
end;
$$;

create function bell.events_after_change()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_channel text;
begin
  if new.status = 'cancelled' or new.all_day then
    update bell.notifications
    set claimed_at = v_now, result = 'cancelled', error = 'event cancelled'
    where event_id = new.id and claimed_at is null;
    return null;
  end if;

  if new.starts_at is distinct from old.starts_at then
    delete from bell.notifications where event_id = new.id and step <> 'moved';

    if old.status <> 'cancelled' and not old.all_day and (
      (old.starts_at > v_now and old.starts_at <= v_now + interval '2 hours')
      or (new.starts_at > v_now and new.starts_at <= v_now + interval '2 hours')
    ) then
      select ch.kind into v_channel
      from bell.channels ch
      join bell.channel_secrets s on s.user_id = ch.user_id and s.kind = ch.kind
      join bell.calendars c on c.id = new.calendar_id
      where ch.user_id = new.user_id
        and ch.active
        and c.active
        and not c.quiet
        and ch.kind in ('pushover', 'slack', 'sms')
      order by array_position(array['pushover', 'slack', 'sms'], ch.kind)
      limit 1;

      if v_channel is not null then
        insert into bell.notifications (
          event_id, user_id, step, channel, due_at, event_starts_at
        )
        values (new.id, new.user_id, 'moved', v_channel, v_now, new.starts_at)
        on conflict (event_id, step, channel) do update
          set due_at = excluded.due_at,
              event_starts_at = excluded.event_starts_at,
              claimed_at = null,
              sent_at = null,
              result = null,
              error = null,
              provider_ref = null,
              acknowledged_at = null,
              acknowledged_by = null;
      end if;
    end if;
  else
    delete from bell.notifications
    where event_id = new.id
      and step <> 'moved'
      and (claimed_at is null or result = 'cancelled');
  end if;

  perform bell.materialize_notifications(v_now, new.id);
  return null;
end;
$$;

create trigger events_after_insert
  after insert on bell.events
  for each row execute function bell.events_after_insert();

create trigger events_after_change
  after update of starts_at, status, all_day on bell.events
  for each row
  when (
    old.starts_at is distinct from new.starts_at
    or old.status is distinct from new.status
    or old.all_day is distinct from new.all_day
  )
  execute function bell.events_after_change();

revoke all on function bell.notification_delivery(uuid) from public, anon, authenticated;
revoke all on function bell.materialize_notifications(timestamptz, uuid) from public, anon, authenticated;
revoke all on function bell.claim_due_notifications(timestamptz) from public, anon, authenticated;
revoke all on function bell.finish_notification(uuid, text, text, text, timestamptz) from public, anon, authenticated;
revoke all on function bell.claim_fallback(uuid, timestamptz) from public, anon, authenticated;
revoke all on function bell.acknowledge_event(uuid, uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function bell.ack_target_for_phone(text, timestamptz) from public, anon, authenticated;
revoke all on function bell.notification_owner(uuid) from public, anon, authenticated;
revoke all on function bell.slack_event_owner(uuid, text, text) from public, anon, authenticated;
revoke all on function bell.save_channel_secret(uuid, text[], text, text, text) from public, anon, authenticated;
revoke all on function bell.set_channel_active(uuid, text, boolean) from public, anon, authenticated;
revoke all on function bell.channel_target(uuid, text) from public, anon, authenticated;
revoke all on function bell.save_slack_install(text, text, text, text, uuid) from public, anon, authenticated;
revoke all on function bell.set_calendar_quiet(uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function bell.events_after_insert() from public, anon, authenticated;
revoke all on function bell.events_after_change() from public, anon, authenticated;

grant execute on function bell.notification_delivery(uuid) to service_role;
grant execute on function bell.materialize_notifications(timestamptz, uuid) to service_role;
grant execute on function bell.claim_due_notifications(timestamptz) to service_role;
grant execute on function bell.finish_notification(uuid, text, text, text, timestamptz) to service_role;
grant execute on function bell.claim_fallback(uuid, timestamptz) to service_role;
grant execute on function bell.acknowledge_event(uuid, uuid, text, timestamptz) to service_role;
grant execute on function bell.ack_target_for_phone(text, timestamptz) to service_role;
grant execute on function bell.notification_owner(uuid) to service_role;
grant execute on function bell.slack_event_owner(uuid, text, text) to service_role;
grant execute on function bell.save_channel_secret(uuid, text[], text, text, text) to service_role;
grant execute on function bell.set_channel_active(uuid, text, boolean) to service_role;
grant execute on function bell.channel_target(uuid, text) to service_role;
grant execute on function bell.save_slack_install(text, text, text, text, uuid) to service_role;
grant execute on function bell.set_calendar_quiet(uuid, uuid, boolean) to service_role;
