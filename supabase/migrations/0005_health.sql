create table bell.job_runs (
  job text primary key check (job in ('bell-sync', 'bell-notify')),
  ran_at timestamptz not null,
  ok boolean not null,
  detail text
);

create table bell.channel_tests (
  user_id uuid not null,
  kind text not null,
  tested_at timestamptz not null,
  ok boolean not null,
  error text,
  primary key (user_id, kind),
  foreign key (user_id, kind) references bell.channels(user_id, kind) on delete cascade
);

alter table bell.job_runs enable row level security;
alter table bell.channel_tests enable row level security;

revoke all on bell.job_runs, bell.channel_tests from public, anon, authenticated;
grant all on bell.job_runs, bell.channel_tests to service_role;

create function bell.record_job_run(p_job text, p_ok boolean, p_detail text, p_at timestamptz)
returns void
language sql
set search_path = ''
as $$
  insert into bell.job_runs (job, ran_at, ok, detail)
  values (p_job, p_at, p_ok, p_detail)
  on conflict (job) do update
    set ran_at = excluded.ran_at, ok = excluded.ok, detail = excluded.detail;
$$;

create function bell.record_channel_test(
  p_user_id uuid,
  p_kind text,
  p_ok boolean,
  p_error text,
  p_at timestamptz
)
returns void
language sql
set search_path = ''
as $$
  insert into bell.channel_tests (user_id, kind, tested_at, ok, error)
  values (p_user_id, p_kind, p_at, p_ok, p_error)
  on conflict (user_id, kind) do update
    set tested_at = excluded.tested_at, ok = excluded.ok, error = excluded.error;
$$;

create function bell.calendars_record_sync()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.last_sync_at is not null and new.last_sync_at is distinct from old.last_sync_at then
    perform bell.record_job_run('bell-sync', true, null, new.last_sync_at);
  elsif new.fail_count > old.fail_count then
    perform bell.record_job_run('bell-sync', false, new.last_error, now());
  end if;
  return null;
end;
$$;

create trigger calendars_record_sync
  after update of last_sync_at, fail_count on bell.calendars
  for each row
  when (
    old.last_sync_at is distinct from new.last_sync_at
    or old.fail_count is distinct from new.fail_count
  )
  execute function bell.calendars_record_sync();

create function bell.health_report(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_cron jsonb := jsonb_build_object('installed', false, 'job', null, 'last_run', null);
begin
  if to_regclass('cron.job') is not null then
    v_cron := jsonb_build_object(
      'installed', true,
      'job', (
        select jsonb_build_object('schedule', j.schedule, 'active', j.active)
        from cron.job j
        where j.jobname = 'bell-notify'
        limit 1
      ),
      'last_run', (
        select jsonb_build_object(
          'status', d.status,
          'started_at', d.start_time,
          'message', d.return_message
        )
        from cron.job_run_details d
        join cron.job j on j.jobid = d.jobid
        where j.jobname = 'bell-notify'
        order by d.start_time desc nulls last
        limit 1
      )
    );
  end if;

  return jsonb_build_object(
    'cron', v_cron,
    'runs', coalesce((
      select jsonb_agg(
        jsonb_build_object('job', r.job, 'ran_at', r.ran_at, 'ok', r.ok, 'detail', r.detail)
        order by r.job
      )
      from bell.job_runs r
    ), '[]'::jsonb),
    'last_sent', (
      select jsonb_build_object('at', n.sent_at, 'step', n.step, 'channel', n.channel)
      from bell.notifications n
      where n.result = 'sent'
      order by n.sent_at desc
      limit 1
    ),
    'last_failed', (
      select jsonb_build_object(
        'at', n.claimed_at, 'step', n.step, 'channel', n.channel, 'error', n.error
      )
      from bell.notifications n
      where n.result = 'failed'
      order by n.claimed_at desc
      limit 1
    ),
    'channels', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'kind', c.kind,
          'active', c.active,
          'tested_at', t.tested_at,
          'test_ok', t.ok,
          'test_error', t.error
        )
        order by array_position(array['slack', 'pushover', 'sms', 'voice'], c.kind)
      )
      from bell.channels c
      left join bell.channel_tests t on t.user_id = c.user_id and t.kind = c.kind
      where c.user_id = p_user_id
    ), '[]'::jsonb),
    'sources', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'label', c.label,
          'account', a.email,
          'healthy', c.healthy,
          'last_sync_at', c.last_sync_at,
          'last_error', c.last_error,
          'channel_expires_at', c.channel_expires_at
        )
        order by a.email, c.label
      )
      from bell.calendars c
      join bell.accounts a on a.id = c.account_id
      where c.user_id = p_user_id and c.active
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function bell.record_job_run(text, boolean, text, timestamptz) from public, anon, authenticated;
revoke all on function bell.record_channel_test(uuid, text, boolean, text, timestamptz) from public, anon, authenticated;
revoke all on function bell.calendars_record_sync() from public, anon, authenticated;
revoke all on function bell.health_report(uuid) from public, anon, authenticated;

grant execute on function bell.record_job_run(text, boolean, text, timestamptz) to service_role;
grant execute on function bell.record_channel_test(uuid, text, boolean, text, timestamptz) to service_role;
grant execute on function bell.health_report(uuid) to service_role;
