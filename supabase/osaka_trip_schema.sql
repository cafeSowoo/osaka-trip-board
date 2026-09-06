-- Osaka 2026 collaborative trip board.
-- Lives beside the tennis tables in tennis-homepage-preview but is isolated by the osaka_trip_ prefix.

create schema if not exists private;

create table if not exists public.osaka_trip_trips (
  id text primary key,
  title text not null,
  destination text not null,
  start_date date not null,
  end_date date not null,
  flights text not null default '',
  hotel text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint osaka_trip_trips_dates_check check (start_date <= end_date)
);

create table if not exists public.osaka_trip_members (
  trip_id text not null references public.osaka_trip_trips(id) on delete cascade,
  member_id text not null,
  display_name text not null,
  sort_order smallint not null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (trip_id, member_id),
  unique (trip_id, sort_order),
  constraint osaka_trip_members_id_check check (member_id ~ '^p[1-5]$'),
  constraint osaka_trip_members_name_check check (char_length(btrim(display_name)) between 1 and 24),
  constraint osaka_trip_members_order_check check (sort_order between 1 and 5)
);

create table if not exists private.osaka_trip_member_tokens (
  trip_id text not null,
  member_id text not null,
  token_hash text not null,
  created_at timestamptz not null default now(),
  primary key (trip_id, member_id),
  unique (trip_id, token_hash),
  foreign key (trip_id, member_id)
    references public.osaka_trip_members(trip_id, member_id) on delete cascade,
  constraint osaka_trip_member_tokens_hash_check check (token_hash ~ '^[0-9a-f]{64}$')
);

create table if not exists public.osaka_trip_days (
  trip_id text not null references public.osaka_trip_trips(id) on delete cascade,
  day_date date not null,
  status text not null default 'collect',
  locked boolean not null default false,
  primary key (trip_id, day_date),
  constraint osaka_trip_days_status_check check (status in ('collect','vote','final'))
);

create table if not exists public.osaka_trip_slots (
  trip_id text not null,
  day_date date not null,
  slot_id text not null,
  sort_order smallint not null,
  enabled boolean not null default true,
  start_time time not null,
  end_time time not null,
  transfer text not null default '',
  confirmed_candidate_id uuid,
  rain_candidate_id uuid,
  primary key (trip_id, day_date, slot_id),
  unique (trip_id, day_date, sort_order),
  foreign key (trip_id, day_date)
    references public.osaka_trip_days(trip_id, day_date) on delete cascade,
  constraint osaka_trip_slots_id_check check (slot_id in ('breakfast','morning','lunch','afternoon1','afternoon2','dinner','evening1','evening2')),
  constraint osaka_trip_slots_order_check check (sort_order between 1 and 8),
  constraint osaka_trip_slots_time_check check (start_time < end_time),
  constraint osaka_trip_slots_transfer_check check (char_length(transfer) <= 120),
  constraint osaka_trip_slots_rain_check check (rain_candidate_id is null or rain_candidate_id is distinct from confirmed_candidate_id)
);

create table if not exists public.osaka_trip_candidates (
  id uuid primary key default gen_random_uuid(),
  trip_id text not null,
  day_date date not null,
  slot_id text not null,
  title text not null,
  address text not null default '',
  maps_url text not null,
  category text not null,
  cost numeric,
  duration_minutes integer,
  reservation boolean not null default false,
  weather text not null default 'any',
  description text not null default '',
  photo_url text not null default '',
  lat double precision,
  lng double precision,
  author_member_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trip_id, id),
  foreign key (trip_id, day_date, slot_id)
    references public.osaka_trip_slots(trip_id, day_date, slot_id) on delete cascade,
  foreign key (trip_id, author_member_id)
    references public.osaka_trip_members(trip_id, member_id),
  constraint osaka_trip_candidates_title_check check (char_length(btrim(title)) between 1 and 100),
  constraint osaka_trip_candidates_address_check check (char_length(address) <= 300),
  constraint osaka_trip_candidates_maps_check check (char_length(maps_url) between 1 and 2000),
  constraint osaka_trip_candidates_maps_scheme_check check (maps_url ~ '^https://'),
  constraint osaka_trip_candidates_maps_host_check check (maps_url ~ '^https://(maps\.app\.goo\.gl|goo\.gl/maps|((www|maps)\.)?google\.(com|co\.jp|co\.kr)/maps)'),
  constraint osaka_trip_candidates_category_check check (category in ('meal','cafe','sight','shopping','activity','drink','night','other')),
  constraint osaka_trip_candidates_cost_check check (cost is null or (cost >= 0 and cost <= 10000000)),
  constraint osaka_trip_candidates_duration_check check (duration_minutes is null or (duration_minutes >= 0 and duration_minutes <= 1440)),
  constraint osaka_trip_candidates_weather_check check (weather in ('any','indoor','outdoor')),
  constraint osaka_trip_candidates_description_check check (char_length(description) <= 2000),
  constraint osaka_trip_candidates_photo_check check (char_length(photo_url) <= 2000),
  constraint osaka_trip_candidates_photo_scheme_check check (photo_url = '' or photo_url ~ '^https?://'),
  constraint osaka_trip_candidates_lat_check check (lat is null or abs(lat) <= 90),
  constraint osaka_trip_candidates_lng_check check (lng is null or abs(lng) <= 180),
  constraint osaka_trip_candidates_coords_check check ((lat is null) = (lng is null))
);

create table if not exists public.osaka_trip_votes (
  trip_id text not null,
  candidate_id uuid not null,
  member_id text not null,
  created_at timestamptz not null default now(),
  primary key (candidate_id, member_id),
  foreign key (trip_id, candidate_id)
    references public.osaka_trip_candidates(trip_id, id) on delete cascade,
  foreign key (trip_id, member_id)
    references public.osaka_trip_members(trip_id, member_id)
);

create table if not exists public.osaka_trip_picks (
  trip_id text not null,
  candidate_id uuid not null,
  member_id text not null,
  created_at timestamptz not null default now(),
  primary key (candidate_id, member_id),
  foreign key (trip_id, candidate_id)
    references public.osaka_trip_candidates(trip_id, id) on delete cascade,
  foreign key (trip_id, member_id)
    references public.osaka_trip_members(trip_id, member_id)
);

create table if not exists public.osaka_trip_comments (
  id uuid primary key default gen_random_uuid(),
  trip_id text not null,
  candidate_id uuid not null,
  member_id text not null,
  body text not null,
  created_at timestamptz not null default now(),
  foreign key (trip_id, candidate_id)
    references public.osaka_trip_candidates(trip_id, id) on delete cascade,
  foreign key (trip_id, member_id)
    references public.osaka_trip_members(trip_id, member_id),
  constraint osaka_trip_comments_body_check check (char_length(btrim(body)) between 1 and 500)
);

create index if not exists osaka_trip_candidates_slot_idx
  on public.osaka_trip_candidates(trip_id, day_date, slot_id, created_at);
create index if not exists osaka_trip_candidates_author_idx
  on public.osaka_trip_candidates(trip_id, author_member_id);
create index if not exists osaka_trip_votes_trip_member_idx
  on public.osaka_trip_votes(trip_id, member_id);
create index if not exists osaka_trip_votes_trip_candidate_idx
  on public.osaka_trip_votes(trip_id, candidate_id);
create index if not exists osaka_trip_picks_trip_member_idx
  on public.osaka_trip_picks(trip_id, member_id);
create index if not exists osaka_trip_picks_trip_candidate_idx
  on public.osaka_trip_picks(trip_id, candidate_id);
create index if not exists osaka_trip_comments_candidate_idx
  on public.osaka_trip_comments(candidate_id, created_at);
create index if not exists osaka_trip_comments_trip_candidate_idx
  on public.osaka_trip_comments(trip_id, candidate_id);
create index if not exists osaka_trip_comments_member_idx
  on public.osaka_trip_comments(trip_id, member_id);
create unique index if not exists osaka_trip_members_name_idx
  on public.osaka_trip_members(trip_id, lower(btrim(display_name)));

create or replace function private.osaka_trip_current_member(p_trip_id text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  with request_token as (
    select nullif(
      coalesce(current_setting('request.headers', true), '{}')::jsonb ->> 'x-osaka-trip-token',
      ''
    ) as token
  )
  select t.member_id
  from private.osaka_trip_member_tokens t
  cross join request_token r
  where t.trip_id = p_trip_id
    and r.token is not null
    and t.token_hash = encode(extensions.digest(r.token, 'sha256'), 'hex')
  limit 1;
$$;

create or replace function private.osaka_trip_day_unlocked(p_trip_id text, p_day date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select not d.locked
    from public.osaka_trip_days d
    where d.trip_id = p_trip_id and d.day_date = p_day
  ), false);
$$;

create or replace function private.osaka_trip_candidate_unlocked(p_trip_id text, p_candidate uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.osaka_trip_candidates c
    join public.osaka_trip_days d
      on d.trip_id = c.trip_id and d.day_date = c.day_date
    where c.trip_id = p_trip_id
      and c.id = p_candidate
      and not d.locked
  );
$$;

create or replace function private.osaka_trip_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.osaka_trip_bump_trip_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trip_id text;
begin
  if tg_op = 'DELETE' then
    v_trip_id := old.trip_id;
  else
    v_trip_id := new.trip_id;
  end if;
  update public.osaka_trip_trips set updated_at = now() where id = v_trip_id;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function private.osaka_trip_validate_slot_choices()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.confirmed_candidate_id is not null and not exists (
    select 1 from public.osaka_trip_candidates c
    where c.id = new.confirmed_candidate_id
      and c.trip_id = new.trip_id
      and c.day_date = new.day_date
      and c.slot_id = new.slot_id
  ) then
    raise exception '확정 일정은 같은 날짜와 시간대의 후보여야 합니다.';
  end if;
  if new.rain_candidate_id is not null and not exists (
    select 1 from public.osaka_trip_candidates c
    where c.id = new.rain_candidate_id
      and c.trip_id = new.trip_id
      and c.day_date = new.day_date
      and c.slot_id = new.slot_id
  ) then
    raise exception '우천 대체는 같은 날짜와 시간대의 후보여야 합니다.';
  end if;
  if new.confirmed_candidate_id is not null and new.rain_candidate_id = new.confirmed_candidate_id then
    raise exception '확정 일정과 우천 대체 후보는 달라야 합니다.';
  end if;
  return new;
end;
$$;

create or replace function private.osaka_trip_validate_final_day()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.locked and (
    new.locked
    or new.status is distinct from old.status
  ) then
    raise exception '잠긴 날짜는 잠금 해제만 할 수 있습니다.';
  end if;
  if new.status = 'final' then
    if not exists (
      select 1 from public.osaka_trip_slots s
      where s.trip_id = new.trip_id and s.day_date = new.day_date and s.enabled
    ) or exists (
      select 1 from public.osaka_trip_slots s
      where s.trip_id = new.trip_id
        and s.day_date = new.day_date
        and s.enabled
        and s.confirmed_candidate_id is null
    ) then
      raise exception '사용하는 모든 시간대에 일정을 선택한 뒤 확정할 수 있습니다.';
    end if;
  end if;
  return new;
end;
$$;

create or replace function private.osaka_trip_candidate_delete_cleanup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.osaka_trip_slots
  set confirmed_candidate_id = case when confirmed_candidate_id = old.id then null else confirmed_candidate_id end,
      rain_candidate_id = case when rain_candidate_id = old.id then null else rain_candidate_id end
  where trip_id = old.trip_id
    and day_date = old.day_date
    and (confirmed_candidate_id = old.id or rain_candidate_id = old.id);

  update public.osaka_trip_days
  set status = 'vote'
  where trip_id = old.trip_id
    and day_date = old.day_date
    and status = 'final'
    and exists (
      select 1 from public.osaka_trip_slots s
      where s.trip_id = old.trip_id
        and s.day_date = old.day_date
        and s.enabled
        and s.confirmed_candidate_id is null
    );
  return old;
end;
$$;

create or replace function private.osaka_trip_slot_reopen_day()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.enabled and new.confirmed_candidate_id is null then
    update public.osaka_trip_days
    set status = 'vote'
    where trip_id = new.trip_id and day_date = new.day_date and status = 'final';
  end if;
  return new;
end;
$$;

create or replace function private.osaka_trip_enforce_pick_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.osaka_trip_picks p where p.trip_id = new.trip_id and p.member_id = new.member_id) >= 3 then
    raise exception 'PICK은 여행 전체에서 3개까지 선택할 수 있습니다.';
  end if;
  return new;
end;
$$;

drop trigger if exists osaka_trip_trips_touch on public.osaka_trip_trips;
create trigger osaka_trip_trips_touch
before update on public.osaka_trip_trips
for each row execute function private.osaka_trip_set_updated_at();

drop trigger if exists osaka_trip_candidates_touch on public.osaka_trip_candidates;
create trigger osaka_trip_candidates_touch
before update on public.osaka_trip_candidates
for each row execute function private.osaka_trip_set_updated_at();

drop trigger if exists osaka_trip_slots_validate on public.osaka_trip_slots;
create trigger osaka_trip_slots_validate
before update of confirmed_candidate_id, rain_candidate_id on public.osaka_trip_slots
for each row execute function private.osaka_trip_validate_slot_choices();

drop trigger if exists osaka_trip_slots_reopen_day on public.osaka_trip_slots;
create trigger osaka_trip_slots_reopen_day
after update of enabled, confirmed_candidate_id on public.osaka_trip_slots
for each row execute function private.osaka_trip_slot_reopen_day();

drop trigger if exists osaka_trip_days_validate_final on public.osaka_trip_days;
create trigger osaka_trip_days_validate_final
before update of status on public.osaka_trip_days
for each row execute function private.osaka_trip_validate_final_day();

drop trigger if exists osaka_trip_picks_limit on public.osaka_trip_picks;
create trigger osaka_trip_picks_limit
before insert on public.osaka_trip_picks
for each row execute function private.osaka_trip_enforce_pick_limit();

drop trigger if exists osaka_trip_candidates_delete_cleanup on public.osaka_trip_candidates;
create trigger osaka_trip_candidates_delete_cleanup
after delete on public.osaka_trip_candidates
for each row execute function private.osaka_trip_candidate_delete_cleanup();

do $$
declare
  t text;
begin
  foreach t in array array['osaka_trip_members','osaka_trip_days','osaka_trip_slots','osaka_trip_candidates','osaka_trip_votes','osaka_trip_picks','osaka_trip_comments'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_bump_trip', t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function private.osaka_trip_bump_trip_updated_at()', t || '_bump_trip', t);
  end loop;
end $$;

alter table public.osaka_trip_trips enable row level security;
alter table public.osaka_trip_members enable row level security;
alter table public.osaka_trip_days enable row level security;
alter table public.osaka_trip_slots enable row level security;
alter table public.osaka_trip_candidates enable row level security;
alter table public.osaka_trip_votes enable row level security;
alter table public.osaka_trip_picks enable row level security;
alter table public.osaka_trip_comments enable row level security;

drop policy if exists osaka_trip_trips_select on public.osaka_trip_trips;
create policy osaka_trip_trips_select on public.osaka_trip_trips
for select to anon
using ((select private.osaka_trip_current_member(id)) is not null);
drop policy if exists osaka_trip_trips_update on public.osaka_trip_trips;
create policy osaka_trip_trips_update on public.osaka_trip_trips
for update to anon
using ((select private.osaka_trip_current_member(id)) is not null)
with check ((select private.osaka_trip_current_member(id)) is not null);

drop policy if exists osaka_trip_members_select on public.osaka_trip_members;
create policy osaka_trip_members_select on public.osaka_trip_members
for select to anon
using ((select private.osaka_trip_current_member(trip_id)) is not null);
drop policy if exists osaka_trip_members_update on public.osaka_trip_members;
create policy osaka_trip_members_update on public.osaka_trip_members
for update to anon
using (
  (select private.osaka_trip_current_member(trip_id)) = member_id
  or (select private.osaka_trip_current_member(trip_id)) = 'p1'
)
with check (
  (select private.osaka_trip_current_member(trip_id)) = member_id
  or (select private.osaka_trip_current_member(trip_id)) = 'p1'
);

drop policy if exists osaka_trip_days_select on public.osaka_trip_days;
create policy osaka_trip_days_select on public.osaka_trip_days
for select to anon
using ((select private.osaka_trip_current_member(trip_id)) is not null);
drop policy if exists osaka_trip_days_update on public.osaka_trip_days;
create policy osaka_trip_days_update on public.osaka_trip_days
for update to anon
using ((select private.osaka_trip_current_member(trip_id)) is not null)
with check ((select private.osaka_trip_current_member(trip_id)) is not null);

drop policy if exists osaka_trip_slots_select on public.osaka_trip_slots;
create policy osaka_trip_slots_select on public.osaka_trip_slots
for select to anon
using ((select private.osaka_trip_current_member(trip_id)) is not null);
drop policy if exists osaka_trip_slots_update on public.osaka_trip_slots;
create policy osaka_trip_slots_update on public.osaka_trip_slots
for update to anon
using (
  (select private.osaka_trip_current_member(trip_id)) is not null
  and (select private.osaka_trip_day_unlocked(trip_id, day_date))
)
with check (
  (select private.osaka_trip_current_member(trip_id)) is not null
  and (select private.osaka_trip_day_unlocked(trip_id, day_date))
);

drop policy if exists osaka_trip_candidates_select on public.osaka_trip_candidates;
create policy osaka_trip_candidates_select on public.osaka_trip_candidates
for select to anon
using ((select private.osaka_trip_current_member(trip_id)) is not null);
drop policy if exists osaka_trip_candidates_insert on public.osaka_trip_candidates;
create policy osaka_trip_candidates_insert on public.osaka_trip_candidates
for insert to anon
with check (
  author_member_id = (select private.osaka_trip_current_member(trip_id))
  and (select private.osaka_trip_day_unlocked(trip_id, day_date))
  and exists (
    select 1 from public.osaka_trip_slots s
    where s.trip_id = osaka_trip_candidates.trip_id
      and s.day_date = osaka_trip_candidates.day_date
      and s.slot_id = osaka_trip_candidates.slot_id
      and s.enabled
  )
);
drop policy if exists osaka_trip_candidates_update on public.osaka_trip_candidates;
create policy osaka_trip_candidates_update on public.osaka_trip_candidates
for update to anon
using (
  author_member_id = (select private.osaka_trip_current_member(trip_id))
  and (select private.osaka_trip_day_unlocked(trip_id, day_date))
)
with check (
  author_member_id = (select private.osaka_trip_current_member(trip_id))
  and (select private.osaka_trip_day_unlocked(trip_id, day_date))
);
drop policy if exists osaka_trip_candidates_delete on public.osaka_trip_candidates;
create policy osaka_trip_candidates_delete on public.osaka_trip_candidates
for delete to anon
using (
  author_member_id = (select private.osaka_trip_current_member(trip_id))
  and (select private.osaka_trip_day_unlocked(trip_id, day_date))
);

drop policy if exists osaka_trip_votes_select on public.osaka_trip_votes;
create policy osaka_trip_votes_select on public.osaka_trip_votes
for select to anon
using ((select private.osaka_trip_current_member(trip_id)) is not null);
drop policy if exists osaka_trip_votes_insert on public.osaka_trip_votes;
create policy osaka_trip_votes_insert on public.osaka_trip_votes
for insert to anon
with check (
  member_id = (select private.osaka_trip_current_member(trip_id))
  and (select private.osaka_trip_candidate_unlocked(trip_id, candidate_id))
);
drop policy if exists osaka_trip_votes_delete on public.osaka_trip_votes;
create policy osaka_trip_votes_delete on public.osaka_trip_votes
for delete to anon
using (
  member_id = (select private.osaka_trip_current_member(trip_id))
  and (select private.osaka_trip_candidate_unlocked(trip_id, candidate_id))
);

drop policy if exists osaka_trip_picks_select on public.osaka_trip_picks;
create policy osaka_trip_picks_select on public.osaka_trip_picks
for select to anon
using ((select private.osaka_trip_current_member(trip_id)) is not null);
drop policy if exists osaka_trip_picks_insert on public.osaka_trip_picks;
create policy osaka_trip_picks_insert on public.osaka_trip_picks
for insert to anon
with check (
  member_id = (select private.osaka_trip_current_member(trip_id))
  and (select private.osaka_trip_candidate_unlocked(trip_id, candidate_id))
);
drop policy if exists osaka_trip_picks_delete on public.osaka_trip_picks;
create policy osaka_trip_picks_delete on public.osaka_trip_picks
for delete to anon
using (
  member_id = (select private.osaka_trip_current_member(trip_id))
  and (select private.osaka_trip_candidate_unlocked(trip_id, candidate_id))
);

drop policy if exists osaka_trip_comments_select on public.osaka_trip_comments;
create policy osaka_trip_comments_select on public.osaka_trip_comments
for select to anon
using ((select private.osaka_trip_current_member(trip_id)) is not null);
drop policy if exists osaka_trip_comments_insert on public.osaka_trip_comments;
create policy osaka_trip_comments_insert on public.osaka_trip_comments
for insert to anon
with check (
  member_id = (select private.osaka_trip_current_member(trip_id))
  and (select private.osaka_trip_candidate_unlocked(trip_id, candidate_id))
);

revoke all on table public.osaka_trip_trips from anon, authenticated;
revoke all on table public.osaka_trip_members from anon, authenticated;
revoke all on table public.osaka_trip_days from anon, authenticated;
revoke all on table public.osaka_trip_slots from anon, authenticated;
revoke all on table public.osaka_trip_candidates from anon, authenticated;
revoke all on table public.osaka_trip_votes from anon, authenticated;
revoke all on table public.osaka_trip_picks from anon, authenticated;
revoke all on table public.osaka_trip_comments from anon, authenticated;

grant select on table public.osaka_trip_trips to anon;
grant update(flights, hotel) on table public.osaka_trip_trips to anon;
grant select on table public.osaka_trip_members to anon;
grant update(display_name) on table public.osaka_trip_members to anon;
grant select on table public.osaka_trip_days to anon;
grant update(status, locked) on table public.osaka_trip_days to anon;
grant select on table public.osaka_trip_slots to anon;
grant update(enabled, start_time, end_time, transfer, confirmed_candidate_id, rain_candidate_id) on table public.osaka_trip_slots to anon;
grant select, insert, delete on table public.osaka_trip_candidates to anon;
grant update(title, address, maps_url, category, cost, duration_minutes, reservation, weather, description, photo_url, lat, lng) on table public.osaka_trip_candidates to anon;
grant select, insert, delete on table public.osaka_trip_votes to anon;
grant select, insert, delete on table public.osaka_trip_picks to anon;
grant select, insert on table public.osaka_trip_comments to anon;

grant usage on schema private to anon;
revoke all on function private.osaka_trip_current_member(text) from public;
revoke all on function private.osaka_trip_day_unlocked(text, date) from public;
revoke all on function private.osaka_trip_candidate_unlocked(text, uuid) from public;
grant execute on function private.osaka_trip_current_member(text) to anon;
grant execute on function private.osaka_trip_day_unlocked(text, date) to anon;
grant execute on function private.osaka_trip_candidate_unlocked(text, uuid) to anon;

create or replace function public.osaka_trip_whoami(p_trip_id text)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select private.osaka_trip_current_member(p_trip_id);
$$;
revoke all on function public.osaka_trip_whoami(text) from public;
grant execute on function public.osaka_trip_whoami(text) to anon;

insert into public.osaka_trip_trips(id, title, destination, start_date, end_date)
values ('osaka-2026', '우리들의 오사카', 'Osaka, Japan', '2026-11-06', '2026-11-08')
on conflict (id) do nothing;

insert into public.osaka_trip_members(trip_id, member_id, display_name, sort_order, is_admin)
values
  ('osaka-2026','p1','지석',1,true),
  ('osaka-2026','p2','여행자 2',2,false),
  ('osaka-2026','p3','여행자 3',3,false),
  ('osaka-2026','p4','여행자 4',4,false),
  ('osaka-2026','p5','여행자 5',5,false)
on conflict (trip_id, member_id) do nothing;

insert into public.osaka_trip_days(trip_id, day_date, status, locked)
values
  ('osaka-2026','2026-11-06','collect',false),
  ('osaka-2026','2026-11-07','collect',false),
  ('osaka-2026','2026-11-08','collect',false)
on conflict (trip_id, day_date) do nothing;

insert into public.osaka_trip_slots(trip_id, day_date, slot_id, sort_order, enabled, start_time, end_time)
select 'osaka-2026', d.day_date, s.slot_id, s.sort_order, true, s.start_time::time, s.end_time::time
from (values ('2026-11-06'::date),('2026-11-07'::date),('2026-11-08'::date)) d(day_date)
cross join (values
  ('breakfast',1,'08:00','09:00'),
  ('morning',2,'09:00','12:00'),
  ('lunch',3,'12:00','13:00'),
  ('afternoon1',4,'13:00','15:00'),
  ('afternoon2',5,'15:00','18:00'),
  ('dinner',6,'18:00','19:00'),
  ('evening1',7,'19:00','21:00'),
  ('evening2',8,'21:00','23:00')
) s(slot_id,sort_order,start_time,end_time)
on conflict (trip_id, day_date, slot_id) do nothing;
