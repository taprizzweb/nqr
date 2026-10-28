-- Taprizz plates: schema, security rules, atomic activation
-- Run in Supabase SQL editor (or via migration).


-- ---------- profiles (admin / rep) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text unique,
  role text not null check (role in ('admin','rep')) default 'rep',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- plates ----------
create table if not exists public.plates (
  number int primary key check (number > 0),
  place_id text,
  shop_name text,
  shop_address text,
  review_url text,
  activated_by uuid references public.profiles(id),
  activated_at timestamptz,
  locked boolean not null default false,
  scan_count int not null default 0,
  last_scan_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- audit log ----------
create table if not exists public.plate_history (
  id bigint generated always as identity primary key,
  plate_number int not null references public.plates(number) on delete cascade,
  action text not null,                 -- activate | edit | clear | lock | unlock | restore
  actor uuid references public.profiles(id),
  old_review_url text,
  new_review_url text,
  old_shop_name text,
  new_shop_name text,
  created_at timestamptz not null default now()
);

create index if not exists plate_history_plate_idx on public.plate_history(plate_number, created_at desc);

-- ---------- scans (lightweight) ----------
create table if not exists public.scans (
  id bigint generated always as identity primary key,
  plate_number int not null,
  scanned_at timestamptz not null default now(),
  user_agent text
);
create index if not exists scans_plate_idx on public.scans(plate_number, scanned_at desc);

-- ---------- helpers ----------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin' and active);
$$;

create or replace function public.is_active_rep() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and active);
$$;

-- Only genuine Google review / Maps links are accepted.
create or replace function public.valid_review_url(u text) returns boolean
language sql immutable as $$
  select u ~* '^https://(search\.google\.com/local/writereview\?placeid=[A-Za-z0-9_-]+|g\.page/r/[A-Za-z0-9_-]+/review|www\.google\.com/maps/.+|maps\.app\.goo\.gl/.+|goo\.gl/maps/.+)$';
$$;

-- ---------- atomic activation (reps) ----------
-- Succeeds only if the plate is still empty. Two reps saving at once: first wins.
create or replace function public.activate_plate(
  p_number int, p_place_id text, p_shop_name text, p_shop_address text, p_review_url text
) returns json
language plpgsql security definer set search_path = public as $$
declare
  rows int;
begin
  if not is_active_rep() then
    raise exception 'Not allowed';
  end if;
  if not valid_review_url(p_review_url) then
    raise exception 'Invalid review link';
  end if;

  update plates
     set place_id = p_place_id,
         shop_name = p_shop_name,
         shop_address = p_shop_address,
         review_url = p_review_url,
         activated_by = auth.uid(),
         activated_at = now()
   where number = p_number
     and review_url is null
     and locked = false;
  get diagnostics rows = row_count;

  if rows = 0 then
    return json_build_object('ok', false, 'error', 'Plate ' || p_number || ' is already activated or does not exist.');
  end if;

  insert into plate_history(plate_number, action, actor, new_review_url, new_shop_name)
  values (p_number, 'activate', auth.uid(), p_review_url, p_shop_name);

  return json_build_object('ok', true);
end $$;

-- ---------- rep fix window (own plate, within 1 hour) ----------
create or replace function public.fix_own_plate(
  p_number int, p_place_id text, p_shop_name text, p_shop_address text, p_review_url text
) returns json
language plpgsql security definer set search_path = public as $$
declare
  old_url text; old_name text; rows int;
begin
  if not is_active_rep() then raise exception 'Not allowed'; end if;
  if not valid_review_url(p_review_url) then raise exception 'Invalid review link'; end if;

  select review_url, shop_name into old_url, old_name from plates where number = p_number;

  update plates
     set place_id = p_place_id, shop_name = p_shop_name,
         shop_address = p_shop_address, review_url = p_review_url
   where number = p_number
     and activated_by = auth.uid()
     and activated_at > now() - interval '1 hour'
     and locked = false;
  get diagnostics rows = row_count;

  if rows = 0 then
    return json_build_object('ok', false, 'error', 'The fix window has closed. Ask the admin to change it.');
  end if;

  insert into plate_history(plate_number, action, actor, old_review_url, new_review_url, old_shop_name, new_shop_name)
  values (p_number, 'edit', auth.uid(), old_url, p_review_url, old_name, p_shop_name);

  return json_build_object('ok', true);
end $$;

-- ---------- admin operations ----------
create or replace function public.admin_set_plate(
  p_number int, p_place_id text, p_shop_name text, p_shop_address text, p_review_url text
) returns json
language plpgsql security definer set search_path = public as $$
declare old_url text; old_name text;
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  if not valid_review_url(p_review_url) then raise exception 'Invalid review link'; end if;
  select review_url, shop_name into old_url, old_name from plates where number = p_number;
  update plates set place_id = p_place_id, shop_name = p_shop_name, shop_address = p_shop_address,
         review_url = p_review_url, activated_by = coalesce(activated_by, auth.uid()),
         activated_at = coalesce(activated_at, now())
   where number = p_number;
  insert into plate_history(plate_number, action, actor, old_review_url, new_review_url, old_shop_name, new_shop_name)
  values (p_number, 'edit', auth.uid(), old_url, p_review_url, old_name, p_shop_name);
  return json_build_object('ok', true);
end $$;

create or replace function public.admin_clear_plate(p_number int) returns json
language plpgsql security definer set search_path = public as $$
declare old_url text; old_name text;
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  select review_url, shop_name into old_url, old_name from plates where number = p_number;
  update plates set place_id=null, shop_name=null, shop_address=null, review_url=null,
         activated_by=null, activated_at=null where number = p_number;
  insert into plate_history(plate_number, action, actor, old_review_url, old_shop_name)
  values (p_number, 'clear', auth.uid(), old_url, old_name);
  return json_build_object('ok', true);
end $$;

create or replace function public.admin_lock_plate(p_number int, p_locked boolean) returns json
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  update plates set locked = p_locked where number = p_number;
  insert into plate_history(plate_number, action, actor)
  values (p_number, case when p_locked then 'lock' else 'unlock' end, auth.uid());
  return json_build_object('ok', true);
end $$;

-- restore the previous link from a history row
create or replace function public.admin_restore_history(p_history_id bigint) returns json
language plpgsql security definer set search_path = public as $$
declare h plate_history; cur_url text; cur_name text;
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  select * into h from plate_history where id = p_history_id;
  if h.old_review_url is null then
    return json_build_object('ok', false, 'error', 'Nothing to restore from this entry.');
  end if;
  select review_url, shop_name into cur_url, cur_name from plates where number = h.plate_number;
  update plates set review_url = h.old_review_url, shop_name = h.old_shop_name where number = h.plate_number;
  insert into plate_history(plate_number, action, actor, old_review_url, new_review_url, old_shop_name, new_shop_name)
  values (h.plate_number, 'restore', auth.uid(), cur_url, h.old_review_url, cur_name, h.old_shop_name);
  return json_build_object('ok', true);
end $$;

create or replace function public.admin_create_plates(p_from int, p_to int) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  if p_to - p_from > 20000 then raise exception 'Range too large'; end if;
  insert into plates(number) select g from generate_series(p_from, p_to) g on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

-- ---------- public redirect lookup (no login) ----------
-- Returns only the review URL for a number. Counts the scan.
create or replace function public.resolve_plate(p_number int, p_ua text default null) returns text
language plpgsql security definer set search_path = public as $$
declare url text;
begin
  update plates set scan_count = scan_count + 1, last_scan_at = now()
   where number = p_number returning review_url into url;
  insert into scans(plate_number, user_agent) values (p_number, left(p_ua, 200));
  return url;
end $$;

-- ---------- row level security ----------
alter table public.profiles       enable row level security;
alter table public.plates         enable row level security;
alter table public.plate_history  enable row level security;
alter table public.scans          enable row level security;

-- profiles: a user sees own row; admin sees and manages all
create policy profiles_self_read  on public.profiles for select using (id = auth.uid() or is_admin());
create policy profiles_admin_all  on public.profiles for all    using (is_admin()) with check (is_admin());

-- plates: reps/admin can read; nobody writes directly (only through functions above)
create policy plates_read on public.plates for select using (is_active_rep());
-- (no insert/update/delete policies => direct writes are blocked for everyone except service role)

-- history: admin reads everything; a rep reads only their own actions
create policy history_read on public.plate_history for select using (is_admin() or actor = auth.uid());

-- scans: admin only
create policy scans_admin_read on public.scans for select using (is_admin());

-- lock down function access
revoke all on function public.resolve_plate(int, text) from public;
grant execute on function public.resolve_plate(int, text) to anon, authenticated;
revoke all on function public.admin_set_plate(int,text,text,text,text) from public;
revoke all on function public.admin_clear_plate(int) from public;
revoke all on function public.admin_lock_plate(int,boolean) from public;
revoke all on function public.admin_restore_history(bigint) from public;
revoke all on function public.admin_create_plates(int,int) from public;
revoke all on function public.activate_plate(int,text,text,text,text) from public;
revoke all on function public.fix_own_plate(int,text,text,text,text) from public;
grant execute on function public.admin_set_plate(int,text,text,text,text) to authenticated;
grant execute on function public.admin_clear_plate(int) to authenticated;
grant execute on function public.admin_lock_plate(int,boolean) to authenticated;
grant execute on function public.admin_restore_history(bigint) to authenticated;
grant execute on function public.admin_create_plates(int,int) to authenticated;
grant execute on function public.activate_plate(int,text,text,text,text) to authenticated;
grant execute on function public.fix_own_plate(int,text,text,text,text) to authenticated;
