-- Migration 002: rep sets link -> tests QR -> confirms; reps lose access after confirming.
-- Run once in the Supabase SQL editor if you already ran the first schema.sql.
-- (A fresh install does not need this file: schema.sql already includes everything.)

alter table public.plates add column if not exists link_set_at timestamptz;
alter table public.plates add column if not exists confirmed_at timestamptz;

-- Plates that were already activated before this change are treated as confirmed.
update public.plates set confirmed_at = coalesce(activated_at, now()), link_set_at = coalesce(link_set_at, activated_at)
 where review_url is not null and confirmed_at is null;

drop function if exists public.fix_own_plate(int,text,text,text,text);

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
         activated_at = now(),
         link_set_at = now(),
         confirmed_at = null
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

-- ---------- step 1b: rep changes the link while it is still PENDING (own plate only) ----------
-- Once the plate is confirmed, reps have no way to touch it again. Only the admin can.
create or replace function public.edit_pending_plate(
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
         shop_address = p_shop_address, review_url = p_review_url,
         link_set_at = now()
   where number = p_number
     and activated_by = auth.uid()
     and confirmed_at is null
     and review_url is not null
     and locked = false;
  get diagnostics rows = row_count;

  if rows = 0 then
    return json_build_object('ok', false, 'error', 'This plate is confirmed or not yours. Only the admin can change it.');
  end if;

  insert into plate_history(plate_number, action, actor, old_review_url, new_review_url, old_shop_name, new_shop_name)
  values (p_number, 'edit', auth.uid(), old_url, p_review_url, old_name, p_shop_name);

  return json_build_object('ok', true);
end $$;

-- ---------- step 2: rep confirms after testing the real QR ----------
-- Only works if the plate's short link was actually scanned AFTER the current link was set.
create or replace function public.confirm_plate(p_number int) returns json
language plpgsql security definer set search_path = public as $$
declare
  p plates;
begin
  if not is_active_rep() then raise exception 'Not allowed'; end if;

  select * into p from plates where number = p_number for update;
  if not found or p.review_url is null or p.activated_by is distinct from auth.uid()
     or p.confirmed_at is not null or p.locked then
    return json_build_object('ok', false, 'error', 'This plate cannot be confirmed by you.');
  end if;

  if not exists (select 1 from scans where plate_number = p_number and scanned_at > p.link_set_at) then
    return json_build_object('ok', false, 'code', 'no_scan',
      'error', 'We have not seen a scan of this plate since you set the link. Scan the plate QR, check the review page opens, then confirm.');
  end if;

  update plates set confirmed_at = now() where number = p_number;
  insert into plate_history(plate_number, action, actor, new_review_url, new_shop_name)
  values (p_number, 'confirm', auth.uid(), p.review_url, p.shop_name);

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
         activated_at = coalesce(activated_at, now()),
         link_set_at = now(), confirmed_at = coalesce(confirmed_at, now())
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
         activated_by=null, activated_at=null, link_set_at=null, confirmed_at=null where number = p_number;
  insert into plate_history(plate_number, action, actor, old_review_url, old_shop_name)
  values (p_number, 'clear', auth.uid(), old_url, old_name);
  return json_build_object('ok', true);
end $$;


-- admin_lock_plate, admin_restore_history, admin_create_plates, resolve_plate are unchanged.

revoke all on function public.edit_pending_plate(int,text,text,text,text) from public;
revoke all on function public.confirm_plate(int) from public;
grant execute on function public.edit_pending_plate(int,text,text,text,text) to authenticated;
grant execute on function public.confirm_plate(int) to authenticated;
