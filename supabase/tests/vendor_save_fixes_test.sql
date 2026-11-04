-- Test for 20261103_vendor_save_fixes.sql: replace_wedding_vendors saves the whole vendor set or nothing,
-- keeps sent dates, and only works on the signed-in photographer's own weddings and vendors.
-- Run it in the Supabase SQL editor after the migration; it creates two throwaway logins and removes
-- everything it made. Expected: each result matches the "expect" in its name.
create temporary table if not exists tv (step serial, check_name text, result text);
truncate tv;
grant all on tv to authenticated, anon;
grant usage on sequence tv_step_seq to authenticated, anon;

begin;

insert into auth.users (id, email) values
  ('5a7e0000-0000-4000-8000-00000000000a', 'save-test-a@example.com'),
  ('5a7e0000-0000-4000-8000-00000000000b', 'save-test-b@example.com');

-- Photographer B's wedding and vendor.
insert into public.weddings (id, user_id, venue, city) values
  ('5a7e0000-0000-4000-8000-0000000000b1', '5a7e0000-0000-4000-8000-00000000000b', 'B Venue', 'B City');
insert into public.vendors (id, user_id, business_name, role) values
  ('5a7e0000-0000-4000-8000-0000000000b2', '5a7e0000-0000-4000-8000-00000000000b', 'B Florals', 'florist');

-- Photographer A, signed in, with one wedding and seven vendors (ids ...11 to ...17).
select set_config('request.jwt.claims', '{"sub":"5a7e0000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
set local role authenticated;

insert into public.weddings (id, user_id, venue, city) values
  ('5a7e0000-0000-4000-8000-0000000000a1', '5a7e0000-0000-4000-8000-00000000000a', 'A Venue', 'A City');
insert into public.vendors (id, user_id, business_name, role, instagram_handle)
select ('5a7e0000-0000-4000-8000-0000000000' || n)::uuid,
       '5a7e0000-0000-4000-8000-00000000000a', 'A Vendor ' || n, 'other', 'a_vendor_' || n
from generate_series(11, 17) as n;

-- 1. Save three vendors, two as collaborators.
select public.replace_wedding_vendors('5a7e0000-0000-4000-8000-0000000000a1', '[
  {"vendorId":"5a7e0000-0000-4000-8000-000000000011","isCollaborator":true},
  {"vendorId":"5a7e0000-0000-4000-8000-000000000012","isCollaborator":true},
  {"vendorId":"5a7e0000-0000-4000-8000-000000000013","isCollaborator":false}
]'::jsonb);
insert into tv (check_name, result)
select '1. saves 3 vendors, 2 collaborators, in order (expect 3 / 2 / 11,12,13)',
  count(*)::text || ' / ' || count(*) filter (where is_collaborator)::text || ' / ' ||
  string_agg(right(vendor_id::text, 2), ',' order by sort_order)
from public.wedding_vendors;

-- 2. Mark 11 as sent, then reorder and drop 12: 11 keeps its sent date, 12 is removed.
update public.wedding_vendors set shared_at = now() where vendor_id = '5a7e0000-0000-4000-8000-000000000011';
select public.replace_wedding_vendors('5a7e0000-0000-4000-8000-0000000000a1', '[
  {"vendorId":"5a7e0000-0000-4000-8000-000000000013","isCollaborator":false},
  {"vendorId":"5a7e0000-0000-4000-8000-000000000011","isCollaborator":true}
]'::jsonb);
insert into tv (check_name, result)
select '2. reorder keeps sent date, removes left-out vendor (expect 13,11 / sent 11)',
  string_agg(right(vendor_id::text, 2), ',' order by sort_order) || ' / sent ' ||
  coalesce(string_agg(right(vendor_id::text, 2), ',') filter (where shared_at is not null), 'none')
from public.wedding_vendors;

-- 3. A save that includes B's vendor fails and changes nothing (the old bug deleted first).
do $$ begin
  perform public.replace_wedding_vendors('5a7e0000-0000-4000-8000-0000000000a1', '[
    {"vendorId":"5a7e0000-0000-4000-8000-0000000000b2","isCollaborator":false}
  ]'::jsonb);
  insert into tv (check_name, result) values ('3a. save with another person''s vendor (expect blocked)', 'allowed');
exception when others then
  insert into tv (check_name, result) values ('3a. save with another person''s vendor (expect blocked)', 'blocked: ' || sqlerrm);
end $$;
insert into tv (check_name, result)
select '3b. ...and nothing changed (expect 13,11 / sent 11 / collab 11)',
  string_agg(right(vendor_id::text, 2), ',' order by sort_order) || ' / sent ' ||
  coalesce(string_agg(right(vendor_id::text, 2), ',') filter (where shared_at is not null), 'none') || ' / collab ' ||
  coalesce(string_agg(right(vendor_id::text, 2), ',') filter (where is_collaborator), 'none')
from public.wedding_vendors;

-- 4. A can't save vendors onto B's wedding.
do $$ begin
  perform public.replace_wedding_vendors('5a7e0000-0000-4000-8000-0000000000b1', '[]'::jsonb);
  insert into tv (check_name, result) values ('4. save onto B''s wedding (expect blocked)', 'allowed');
exception when others then
  insert into tv (check_name, result) values ('4. save onto B''s wedding (expect blocked)', 'blocked: ' || sqlerrm);
end $$;

-- 5. Six collaborators are refused, and the previous set survives.
do $$ begin
  perform public.replace_wedding_vendors('5a7e0000-0000-4000-8000-0000000000a1', (
    select jsonb_agg(jsonb_build_object('vendorId', ('5a7e0000-0000-4000-8000-0000000000' || n)::text, 'isCollaborator', true))
    from generate_series(11, 16) as n
  ));
  insert into tv (check_name, result) values ('5a. six collaborators (expect blocked)', 'allowed');
exception when others then
  insert into tv (check_name, result) values ('5a. six collaborators (expect blocked)', 'blocked: ' || sqlerrm);
end $$;
insert into tv (check_name, result)
select '5b. ...and nothing changed (expect 2)', count(*)::text from public.wedding_vendors;

-- 6. Five collaborators, then swap one for another in a single save (flags clear first).
select public.replace_wedding_vendors('5a7e0000-0000-4000-8000-0000000000a1', (
  select jsonb_agg(jsonb_build_object('vendorId', ('5a7e0000-0000-4000-8000-0000000000' || n)::text, 'isCollaborator', n <= 15) order by n)
  from generate_series(11, 16) as n
));
select public.replace_wedding_vendors('5a7e0000-0000-4000-8000-0000000000a1', (
  select jsonb_agg(jsonb_build_object('vendorId', ('5a7e0000-0000-4000-8000-0000000000' || n)::text, 'isCollaborator', n <> 15) order by n)
  from generate_series(11, 16) as n
));
insert into tv (check_name, result)
select '6. swap a collaborator at the limit (expect 6 / 5 / 16 on, 15 off)',
  count(*)::text || ' / ' || count(*) filter (where is_collaborator)::text || ' / ' ||
  case when bool_or(is_collaborator and right(vendor_id::text, 2) = '16') and not bool_or(is_collaborator and right(vendor_id::text, 2) = '15')
       then '16 on, 15 off' else 'wrong' end
from public.wedding_vendors;

-- 7. Signed-out visitors can't call it at all.
reset role;
set local role anon;
do $$ begin
  perform public.replace_wedding_vendors('5a7e0000-0000-4000-8000-0000000000a1', '[]'::jsonb);
  insert into tv (check_name, result) values ('7. signed-out call (expect blocked)', 'allowed');
exception when others then
  insert into tv (check_name, result) values ('7. signed-out call (expect blocked)', 'blocked: ' || sqlerrm);
end $$;

-- Clean up everything this test made.
reset role;
delete from auth.users where id in ('5a7e0000-0000-4000-8000-00000000000a', '5a7e0000-0000-4000-8000-00000000000b');

commit;

insert into tv (check_name, result)
select '8. leftovers (expect 0)', (select count(*) from public.vendors where user_id in
  ('5a7e0000-0000-4000-8000-00000000000a', '5a7e0000-0000-4000-8000-00000000000b'))::text;

select check_name, result from tv order by step;
