create table bell.calendar_shares (
  calendar_id uuid not null,
  shared_with_user_id uuid not null references bell.users(id) on delete cascade,
  created_by uuid not null references bell.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (calendar_id, shared_with_user_id),
  check (shared_with_user_id <> created_by),
  foreign key (calendar_id, created_by) references bell.calendars(id, user_id) on delete cascade
);

create index calendar_shares_shared_with_idx on bell.calendar_shares (shared_with_user_id);
create index calendar_shares_created_by_idx on bell.calendar_shares (created_by);

alter table bell.calendar_shares enable row level security;

create policy calendar_shares_select_own on bell.calendar_shares
  for select to authenticated
  using (created_by = auth.uid() or shared_with_user_id = auth.uid());

create policy events_select_shared on bell.events
  for select to authenticated
  using (
    exists (
      select 1 from bell.calendar_shares s
      where s.calendar_id = events.calendar_id
        and s.shared_with_user_id = auth.uid()
    )
  );

revoke all on bell.calendar_shares from public, anon, authenticated;
grant select on bell.calendar_shares to authenticated;
grant all on bell.calendar_shares to service_role;

alter table bell.notifications drop constraint notifications_event_id_step_channel_key;
alter table bell.notifications
  add constraint notifications_event_user_step_channel_key unique (event_id, user_id, step, channel);

create function bell.calendar_recipients(p_calendar_id uuid)
returns table (user_id uuid)
language sql
stable
set search_path = ''
as $$
  select c.user_id
  from bell.calendars c
  where c.id = p_calendar_id and c.active and not c.quiet
  union all
  select s.shared_with_user_id
  from bell.calendar_shares s
  join bell.calendars c on c.id = s.calendar_id
  where s.calendar_id = p_calendar_id and c.active;
$$;

create or replace function bell.notification_delivery(p_id uuid)
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
        and p.user_id = n.user_id
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

create or replace function bell.materialize_notifications(p_now timestamptz, p_event_id uuid default null)
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
    e.id, r.user_id, plan.step, plan.channel, e.starts_at - plan.lead,
    e.starts_at, ack.acknowledged_at, ack.acknowledged_by
  from bell.events e
  cross join lateral bell.calendar_recipients(e.calendar_id) r
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
    on ch.user_id = r.user_id and ch.kind = plan.channel and ch.active
  join bell.channel_secrets s on s.user_id = ch.user_id and s.kind = ch.kind
  left join lateral (
    select a.acknowledged_at, a.acknowledged_by
    from bell.notifications a
    where a.event_id = e.id
      and a.user_id = r.user_id
      and a.acknowledged_at is not null
    order by a.acknowledged_at
    limit 1
  ) ack on true
  where (p_event_id is null or e.id = p_event_id)
    and e.status <> 'cancelled'
    and not e.all_day
    and e.starts_at > p_now - interval '2 minutes'
    and e.starts_at <= p_now + interval '35 minutes'
  on conflict (event_id, user_id, step, channel) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function bell.claim_due_notifications(p_now timestamptz)
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
        when e.status = 'cancelled' or e.all_day or ch.active is not true
          or not exists (
            select 1 from bell.calendar_recipients(e.calendar_id) r
            where r.user_id = n.user_id
          ) then 'cancelled'
        when n.step <> 'moved' and p_now > e.starts_at + interval '2 minutes'
          then 'late'
        when n.step <> 'moved' and n.due_at < max(n.due_at)
          filter (where n.step <> 'moved') over (partition by n.event_id, n.user_id)
          then 'superseded'
      end as reason
    from bell.notifications n
    join locked l on l.id = n.id
    join bell.events e on e.id = n.event_id
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
    returning n.id, n.user_id, n.due_at, n.channel, k.reason
  )
  select bell.notification_delivery(cl.id)
  from claimed cl
  where cl.reason is null
  order by cl.due_at, cl.user_id,
    array_position(array['slack', 'pushover', 'sms', 'voice'], cl.channel);
end;
$$;

create or replace function bell.claim_fallback(p_id uuid, p_now timestamptz)
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
      on conflict (event_id, user_id, step, channel) do nothing
      returning id into v_new_id;

      if v_new_id is not null then
        return bell.notification_delivery(v_new_id);
      end if;
    end if;
  end loop;

  return null;
end;
$$;

create or replace function bell.slack_event_owner(
  p_event_id uuid,
  p_team_id text,
  p_slack_user_id text
)
returns uuid
language sql
stable
set search_path = ''
as $$
  select s.user_id
  from bell.events e
  join bell.channel_secrets s
    on s.kind = 'slack'
    and s.slack_team_id = p_team_id
    and s.value = p_slack_user_id
  where e.id = p_event_id
    and (
      s.user_id = e.user_id
      or exists (
        select 1 from bell.calendar_shares cs
        where cs.calendar_id = e.calendar_id and cs.shared_with_user_id = s.user_id
      )
    )
  order by s.user_id = e.user_id desc
  limit 1;
$$;

create or replace function bell.events_after_change()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_recipient uuid;
  v_channel text;
begin
  if new.status = 'cancelled' or new.all_day then
    perform bell.queue_stale_receipts(new.id, v_now);
    update bell.notifications
    set claimed_at = v_now, result = 'cancelled', error = 'event cancelled'
    where event_id = new.id and claimed_at is null;
    return null;
  end if;

  if new.starts_at is distinct from old.starts_at then
    perform bell.queue_stale_receipts(new.id, v_now);
    delete from bell.notifications where event_id = new.id and step <> 'moved';

    if old.status <> 'cancelled' and not old.all_day and (
      (old.starts_at > v_now and old.starts_at <= v_now + interval '2 hours')
      or (new.starts_at > v_now and new.starts_at <= v_now + interval '2 hours')
    ) then
      for v_recipient in
        select r.user_id from bell.calendar_recipients(new.calendar_id) r
      loop
        select ch.kind into v_channel
        from bell.channels ch
        join bell.channel_secrets s on s.user_id = ch.user_id and s.kind = ch.kind
        where ch.user_id = v_recipient
          and ch.active
          and ch.kind in ('pushover', 'slack', 'sms')
        order by array_position(array['pushover', 'slack', 'sms'], ch.kind)
        limit 1;

        if v_channel is not null then
          insert into bell.notifications (
            event_id, user_id, step, channel, due_at, event_starts_at
          )
          values (new.id, v_recipient, 'moved', v_channel, v_now, new.starts_at)
          on conflict (event_id, user_id, step, channel) do update
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
      end loop;
    end if;
  else
    delete from bell.notifications
    where event_id = new.id
      and step <> 'moved'
      and acknowledged_at is null
      and (claimed_at is null or result = 'cancelled');
  end if;

  perform bell.materialize_notifications(v_now, new.id);
  return null;
end;
$$;

create function bell.share_calendar(p_user_id uuid, p_calendar_id uuid, p_email text)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_target uuid;
begin
  if not exists (
    select 1 from bell.calendars c where c.id = p_calendar_id and c.user_id = p_user_id
  ) then
    return 'unknown_calendar';
  end if;

  select u.id into v_target from bell.users u where u.email = lower(trim(p_email));
  if v_target is null then
    return 'unknown_user';
  end if;
  if v_target = p_user_id then
    return 'self';
  end if;

  delete from bell.notifications n
  using bell.events e
  where e.id = n.event_id
    and e.calendar_id = p_calendar_id
    and n.user_id = v_target
    and n.result = 'cancelled';

  insert into bell.calendar_shares (calendar_id, shared_with_user_id, created_by)
  values (p_calendar_id, v_target, p_user_id)
  on conflict (calendar_id, shared_with_user_id) do nothing;

  return 'shared';
end;
$$;

create function bell.unshare_calendar(p_user_id uuid, p_calendar_id uuid, p_shared_with uuid)
returns boolean
language plpgsql
set search_path = ''
as $$
begin
  delete from bell.calendar_shares s
  where s.calendar_id = p_calendar_id
    and s.shared_with_user_id = p_shared_with
    and p_user_id in (s.created_by, s.shared_with_user_id);
  if not found then
    return false;
  end if;

  update bell.notifications n
  set claimed_at = now(), result = 'cancelled', error = 'share removed'
  from bell.events e
  where e.id = n.event_id
    and e.calendar_id = p_calendar_id
    and n.user_id = p_shared_with
    and n.claimed_at is null;

  return true;
end;
$$;

create function bell.shared_with_me()
returns table (id uuid, label text, color text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.label, c.color
  from bell.calendar_shares s
  join bell.calendars c on c.id = s.calendar_id
  where s.shared_with_user_id = auth.uid() and c.active
  order by c.label, c.id;
$$;

create function bell.my_shares()
returns table (calendar_id uuid, shared_with_user_id uuid, email text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.calendar_id, s.shared_with_user_id, u.email
  from bell.calendar_shares s
  join bell.users u on u.id = s.shared_with_user_id
  where s.created_by = auth.uid()
  order by u.email, s.calendar_id;
$$;

create or replace function bell.delete_me()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_table name;
  v_has_profile boolean := false;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  select lower(u.email) into v_email from auth.users u where u.id = v_uid;

  delete from bell.calendar_shares
  where created_by = v_uid or shared_with_user_id = v_uid;

  for v_table in
    select c.relname
    from pg_catalog.pg_attribute a
    join pg_catalog.pg_class c on c.oid = a.attrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'bell'
      and c.relkind in ('r', 'p')
      and a.attname = 'user_id'
      and not a.attisdropped
  loop
    execute format('delete from bell.%I where user_id = $1', v_table) using v_uid;
  end loop;

  delete from bell.users where id = v_uid;
  delete from bell.allowlist where email = v_email;

  if to_regclass('public.profiles') is not null then
    execute 'select exists (select 1 from public.profiles where user_id = $1)'
      into v_has_profile
      using v_uid;
  end if;

  return not v_has_profile;
end;
$$;

revoke all on function bell.calendar_recipients(uuid) from public, anon, authenticated;
revoke all on function bell.share_calendar(uuid, uuid, text) from public, anon, authenticated;
revoke all on function bell.unshare_calendar(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function bell.shared_with_me() from public, anon;
revoke all on function bell.my_shares() from public, anon;

grant execute on function bell.calendar_recipients(uuid) to service_role;
grant execute on function bell.share_calendar(uuid, uuid, text) to service_role;
grant execute on function bell.unshare_calendar(uuid, uuid, uuid) to service_role;
grant execute on function bell.shared_with_me() to authenticated, service_role;
grant execute on function bell.my_shares() to authenticated, service_role;
