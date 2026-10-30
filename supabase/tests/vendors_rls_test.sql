-- Test for 20261031_vendors.sql: each photographer only sees and links their own vendors, and a wedding
-- can't have more than 5 Instagram collaborators. Run it in the Supabase SQL editor; it creates two
-- throwaway logins and removes everything it made. Expected: each result matches the "expect" in its name.
create temporary table if not exists tv (step serial, check_name text, result text);
truncate tv;
grant all on tv to authenticated;
grant usage on sequence tv_step_seq to authenticated;

begin;

insert into auth.users (id, email) values
  ('7e570000-0000-4000-8000-00000000000a', 'vendor-test-a@example.com'),
  ('7e570000-0000-4000-8000-00000000000b', 'vendor-test-b@example.com');

-- Photographer B's wedding and vendor.
insert into public.weddings (id, user_id, venue, city) values
  ('7e570000-0000-4000-8000-0000000000b1', '7e570000-0000-4000-8000-00000000000b', 'B Venue', 'B City');
insert into public.vendors (id, user_id, business_name, role) values
  ('7e570000-0000-4000-8000-0000000000b2', '7e570000-0000-4000-8000-00000000000b', 'B Florals', 'florist');

-- Photographer A, signed in.
select set_config('request.jwt.claims', '{"sub":"7e570000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
set local role authenticated;

insert into public.weddings (id, user_id, venue, city) values
  ('7e570000-0000-4000-8000-0000000000a1', '7e570000-0000-4000-8000-00000000000a', 'A Venue', 'A City');
insert into public.vendors (id, user_id, business_name, role, instagram_handle)
select ('7e570000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid,
       '7e570000-0000-4000-8000-00000000000a', 'A Vendor ' || n, 'other', 'a_vendor_' || n
from generate_series(11, 16) as n;

insert into tv (check_name, result)
select '1. A sees only their own vendors (expect 6)', count(*)::text from public.vendors;

do $$ begin
  insert into public.wedding_vendors (wedding_id, vendor_id, user_id)
  values ('7e570000-0000-4000-8000-0000000000a1', '7e570000-0000-4000-8000-0000000000b2', '7e570000-0000-4000-8000-00000000000a');
  insert into tv (check_name, result) values ('2. A links B''s vendor to A''s wedding (expect blocked)', 'allowed');
exception when others then
  insert into tv (check_name, result) values ('2. A links B''s vendor to A''s wedding (expect blocked)', 'blocked: ' || sqlerrm);
end $$;

do $$ begin
  insert into public.wedding_vendors (wedding_id, vendor_id, user_id)
  values ('7e570000-0000-4000-8000-0000000000b1', '7e570000-0000-4000-8000-000000000011', '7e570000-0000-4000-8000-00000000000a');
  insert into tv (check_name, result) values ('3. A links a vendor to B''s wedding (expect blocked)', 'allowed');
exception when others then
  insert into tv (check_name, result) values ('3. A links a vendor to B''s wedding (expect blocked)', 'blocked: ' || sqlerrm);
end $$;

update public.vendors set business_name = 'Hacked' where id = '7e570000-0000-4000-8000-0000000000b2';
insert into tv (check_name, result)
select '4. A renames B''s vendor (expect 0 rows changed)', count(*)::text from public.vendors where business_name = 'Hacked';

-- Five collaborators are fine; a sixth is refused.
insert into public.wedding_vendors (wedding_id, vendor_id, user_id, sort_order, is_collaborator)
select '7e570000-0000-4000-8000-0000000000a1', ('7e570000-0000-4000-8000-0000000000' || n)::uuid,
       '7e570000-0000-4000-8000-00000000000a', n, n <= 15
from generate_series(11, 16) as n;
insert into tv (check_name, result)
select '5. A links 6 vendors, 5 as collaborators (expect 6 / 5)',
  count(*)::text || ' / ' || count(*) filter (where is_collaborator)::text
from public.wedding_vendors;

do $$ begin
  update public.wedding_vendors set is_collaborator = true where vendor_id = '7e570000-0000-4000-8000-000000000016';
  insert into tv (check_name, result) values ('6. sixth collaborator (expect blocked)', 'allowed');
exception when others then
  insert into tv (check_name, result) values ('6. sixth collaborator (expect blocked)', 'blocked: ' || sqlerrm);
end $$;

update public.wedding_vendors set shared_at = now() where vendor_id = '7e570000-0000-4000-8000-000000000011';
insert into tv (check_name, result)
select '7. A marks a vendor as sent (expect 1)', count(*)::text from public.wedding_vendors where shared_at is not null;

do $$ begin
  insert into public.vendors (user_id, business_name, role, instagram_handle)
  values ('7e570000-0000-4000-8000-00000000000a', 'Bad Handle', 'other', '@with_at');
  insert into tv (check_name, result) values ('8. handle saved with an @ (expect blocked)', 'allowed');
exception when others then
  insert into tv (check_name, result) values ('8. handle saved with an @ (expect blocked)', 'blocked: ' || sqlerrm);
end $$;

do $$ begin
  insert into public.vendors (user_id, business_name, role, website)
  values ('7e570000-0000-4000-8000-00000000000a', 'Plain Http', 'other', 'http://example.com');
  insert into tv (check_name, result) values ('9. non-https website (expect blocked)', 'allowed');
exception when others then
  insert into tv (check_name, result) values ('9. non-https website (expect blocked)', 'blocked: ' || sqlerrm);
end $$;

-- Photographer B can't see A's links.
reset role;
select set_config('request.jwt.claims', '{"sub":"7e570000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
insert into tv (check_name, result)
select '10. B sees A''s wedding links (expect 0)', count(*)::text from public.wedding_vendors;

-- Clean up everything this test made.
reset role;
delete from auth.users where id in ('7e570000-0000-4000-8000-00000000000a', '7e570000-0000-4000-8000-00000000000b');

commit;

insert into tv (check_name, result)
select '11. leftovers (expect 0)', (select count(*) from public.vendors where user_id in
  ('7e570000-0000-4000-8000-00000000000a', '7e570000-0000-4000-8000-00000000000b'))::text;

select check_name, result from tv order by step;
