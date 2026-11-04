-- WHAT: Saves a wedding's whole vendor set in one transaction, and serializes collaborator changes.
-- WHY: The app used to delete, clear and re-insert in separate requests, so a failed last step left
-- vendors removed and sent dates lost. Two simultaneous saves could also each pass the 5-collaborator
-- count. Additive and safe to run more than once. Run after 20261031_vendors.sql.

-- Collaborator limit, now holding a per-wedding lock while it counts, so concurrent saves queue up.
create or replace function public.enforce_collaborator_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_collaborator then
    -- Transaction-scoped lock keyed on the wedding; released automatically at commit or rollback.
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('wedding_vendors:' || new.wedding_id::text, 0));
    if (
      select count(*)
      from public.wedding_vendors as wv
      where wv.wedding_id = new.wedding_id
        and wv.is_collaborator
        and wv.vendor_id <> new.vendor_id
    ) >= 5 then
      raise exception 'A wedding can have at most 5 Instagram collaborators.';
    end if;
  end if;
  return new;
end;
$$;

-- Replaces one wedding's vendor set: removes vendors left out, then saves the rest in order.
-- Runs with the caller's permissions (security invoker), so row-level security still decides what
-- they can touch. Sent dates are kept for vendors that stay on. Any failure rolls back everything.
-- p_vendors: [{ "vendorId": uuid, "isCollaborator": boolean }, ...] in credit order.
create or replace function public.replace_wedding_vendors(p_wedding_id uuid, p_vendors jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Sign in to save vendors.' using errcode = '42501';
  end if;
  if pg_catalog.jsonb_typeof(p_vendors) is distinct from 'array' or pg_catalog.jsonb_array_length(p_vendors) > 60 then
    raise exception 'Check the vendor list.' using errcode = '22023';
  end if;
  -- Row-level security hides other people's weddings, so this also checks ownership.
  if not exists (select 1 from public.weddings where id = p_wedding_id and user_id = v_user) then
    raise exception 'Wedding not found.' using errcode = 'P0002';
  end if;

  -- Same lock as the trigger, so a whole-set save and a single change can't interleave.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('wedding_vendors:' || p_wedding_id::text, 0));

  delete from public.wedding_vendors as wv
  where wv.wedding_id = p_wedding_id
    and wv.vendor_id not in (
      select (item->>'vendorId')::uuid from pg_catalog.jsonb_array_elements(p_vendors) as item
    );

  -- Clear flags first so swapping one collaborator for another never trips the limit mid-save.
  update public.wedding_vendors set is_collaborator = false
  where wedding_id = p_wedding_id and is_collaborator;

  insert into public.wedding_vendors (wedding_id, vendor_id, user_id, sort_order, is_collaborator)
  select p_wedding_id,
         (item.value->>'vendorId')::uuid,
         v_user,
         (item.ordinality - 1)::integer,
         coalesce((item.value->>'isCollaborator')::boolean, false)
  from pg_catalog.jsonb_array_elements(p_vendors) with ordinality as item(value, ordinality)
  on conflict (wedding_id, vendor_id) do update
    set sort_order = excluded.sort_order,
        is_collaborator = excluded.is_collaborator;
end;
$$;

revoke all on function public.replace_wedding_vendors(uuid, jsonb) from public, anon;
grant execute on function public.replace_wedding_vendors(uuid, jsonb) to authenticated;
