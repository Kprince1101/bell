create schema if not exists bell;

grant usage on schema bell to anon, authenticated, service_role;

create table bell.migrations (
  name text primary key,
  applied_at timestamptz not null default now()
);

create table bell.allowlist (
  email text primary key check (email = lower(email)),
  role text not null default 'member' check (role in ('member', 'owner')),
  added_at timestamptz not null default now()
);

create table bell.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  time_zone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table bell.migrations enable row level security;
alter table bell.allowlist enable row level security;
alter table bell.users enable row level security;

create function bell.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from bell.allowlist a
    join auth.users u on lower(u.email) = a.email
    where u.id = auth.uid() and a.role = 'owner'
  );
$$;

create policy users_select_own on bell.users
  for select to authenticated using (id = auth.uid());

create policy users_update_own on bell.users
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy allowlist_select_owner on bell.allowlist
  for select to authenticated using (bell.is_owner());

revoke all on all tables in schema bell from anon, authenticated;
grant select on bell.users to authenticated;
grant update (time_zone) on bell.users to authenticated;
grant select on bell.allowlist to authenticated;
grant all on all tables in schema bell to service_role;

create function bell.users_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.time_zone) then
    raise exception 'invalid time zone: %', new.time_zone using errcode = '22023';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger users_before_write
  before insert or update on bell.users
  for each row execute function bell.users_before_write();

create function bell.claim_account(p_time_zone text)
returns bell.users
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_time_zone text;
  v_user bell.users;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  select lower(u.email) into v_email from auth.users u where u.id = v_uid;

  if v_email is null or not exists (select 1 from bell.allowlist a where a.email = v_email) then
    raise exception 'not invited' using errcode = '42501';
  end if;

  select coalesce(
    (select z.name from pg_catalog.pg_timezone_names z where z.name = p_time_zone),
    'UTC'
  ) into v_time_zone;

  insert into bell.users (id, email, time_zone)
  values (v_uid, v_email, v_time_zone)
  on conflict (id) do nothing;

  select * into v_user from bell.users where id = v_uid;
  return v_user;
end;
$$;

create function bell.delete_me()
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

revoke all on function bell.is_owner() from public, anon;
revoke all on function bell.users_before_write() from public, anon, authenticated;
revoke all on function bell.claim_account(text) from public, anon;
revoke all on function bell.delete_me() from public, anon;

grant execute on function bell.is_owner() to authenticated;
grant execute on function bell.claim_account(text) to authenticated;
grant execute on function bell.delete_me() to authenticated;
