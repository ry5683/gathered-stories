-- WHAT: Creates the private tables and row policies used by this app.
-- WHY: Every user-owned row is scoped to auth.uid(), including a draft's parent wedding.
create extension if not exists pgcrypto;

create table if not exists public.weddings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  venue text not null,
  city text not null,
  wedding_date text not null default '',
  ceremony_time text not null default '',
  reception_time text not null default '',
  dress_code text not null default '',
  palette text not null default '',
  edit_style text not null default '',
  music_loved text not null default '',
  music_rejected text not null default '',
  photos jsonb not null default '[]'::jsonb check (jsonb_typeof(photos) = 'array'),
  favorite_moment text not null default '',
  optional_inspiration text not null default '',
  current_step integer not null default 0 check (current_step between 0 and 3),
  voice text not null default 'delicate' check (voice in ('delicate', 'active')),
  use_voice_examples boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.weddings add column if not exists photos jsonb not null default '[]'::jsonb;
alter table public.weddings add column if not exists favorite_moment text not null default '';
alter table public.weddings add column if not exists optional_inspiration text not null default '';
alter table public.weddings add column if not exists current_step integer not null default 0;
alter table public.weddings add column if not exists voice text not null default 'delicate';
alter table public.weddings add column if not exists use_voice_examples boolean not null default true;

create table if not exists public.drafts (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'approved')),
  content jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

update public.drafts
set content = content || jsonb_build_object(
  'caption', coalesce(content->>'caption', ''),
  'hashtags', coalesce(content->>'hashtags', ''),
  'photoFileNames', coalesce(content->'photoFileNames', '[]'::jsonb),
  'photoCaptions', coalesce(content->'photoCaptions', content->'altTexts', '[]'::jsonb),
  'extraCaptions', coalesce(content->'extraCaptions', '[]'::jsonb),
  'extraFormats', coalesce(content->'extraFormats', '{}'::jsonb)
);

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text not null check (theme in ('light', 'dark')),
  voice_examples_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.user_preferences
  add column if not exists voice_examples_enabled boolean not null default true;

create table if not exists public.wordpress_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  site_url text not null,
  credentials_ciphertext text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wordpress_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  draft_id uuid not null unique references public.drafts(id) on delete cascade,
  wordpress_post_id bigint not null,
  draft_url text not null,
  sent_at timestamptz not null default now(),
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.wordpress_delivery_locks (
  draft_id uuid primary key references public.drafts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null
);

create table if not exists public.post_inquiries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  wordpress_post_id uuid not null references public.wordpress_posts(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists drafts_owner_updated_idx on public.drafts(user_id, updated_at desc);
create index if not exists wordpress_posts_owner_wedding_idx on public.wordpress_posts(user_id, wedding_id, sent_at desc);
create index if not exists post_inquiries_owner_created_idx on public.post_inquiries(user_id, created_at desc);

alter table public.weddings enable row level security;
alter table public.drafts enable row level security;
alter table public.user_preferences enable row level security;
alter table public.wordpress_connections enable row level security;
alter table public.wordpress_posts enable row level security;
alter table public.wordpress_delivery_locks enable row level security;
alter table public.post_inquiries enable row level security;

drop policy if exists "Owners can read their weddings" on public.weddings;
create policy "Owners can read their weddings"
  on public.weddings for select
  using (user_id = auth.uid());

drop policy if exists "Owners can insert their weddings" on public.weddings;
create policy "Owners can insert their weddings"
  on public.weddings for insert
  with check (user_id = auth.uid());

drop policy if exists "Owners can update their weddings" on public.weddings;
create policy "Owners can update their weddings"
  on public.weddings for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Owners can read their drafts" on public.drafts;
create policy "Owners can read their drafts"
  on public.drafts for select
  using (user_id = auth.uid());

drop policy if exists "Owners can insert drafts for their weddings" on public.drafts;
create policy "Owners can insert drafts for their weddings"
  on public.drafts for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.weddings
      where weddings.id = drafts.wedding_id
        and weddings.user_id = auth.uid()
    )
  );

drop policy if exists "Owners can update their drafts" on public.drafts;
create policy "Owners can update their drafts"
  on public.drafts for update
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.weddings
      where weddings.id = drafts.wedding_id
        and weddings.user_id = auth.uid()
    )
  );

drop policy if exists "Owners can read their preferences" on public.user_preferences;
create policy "Owners can read their preferences"
  on public.user_preferences for select
  using (user_id = auth.uid());

drop policy if exists "Owners can insert their preferences" on public.user_preferences;
create policy "Owners can insert their preferences"
  on public.user_preferences for insert
  with check (user_id = auth.uid());

drop policy if exists "Owners can update their preferences" on public.user_preferences;
create policy "Owners can update their preferences"
  on public.user_preferences for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update on public.weddings to authenticated;
grant select, insert, update on public.drafts to authenticated;
grant select, insert, update on public.user_preferences to authenticated;
revoke all on public.wordpress_connections, public.wordpress_posts, public.wordpress_delivery_locks, public.post_inquiries from anon, authenticated;
grant select, insert, update, delete on public.wordpress_connections, public.wordpress_posts, public.wordpress_delivery_locks, public.post_inquiries to service_role;

-- Vendor library, per-wedding credits and share-kit tracking (same as migrations/20261031_vendors.sql).

-- The photographer's saved vendors, reused across weddings.
create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_name text not null check (char_length(btrim(business_name)) between 1 and 120),
  role text not null check (role in (
    'venue', 'planner', 'coordinator', 'florist', 'rentals', 'stationery', 'catering', 'cake',
    'hair_makeup', 'attire', 'music', 'officiant', 'videographer', 'second_photographer', 'other'
  )),
  role_label text check (role_label is null or char_length(role_label) <= 40),
  website text check (website is null or (char_length(website) <= 300 and website ~ '^https://')),
  instagram_handle text check (instagram_handle is null or instagram_handle ~ '^[A-Za-z0-9._]{1,30}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The same business in the same role is saved once per photographer.
create unique index if not exists vendors_owner_name_role_idx
  on public.vendors (user_id, lower(btrim(business_name)), role);

-- Which vendors worked a wedding, in credit order, who is an Instagram collaborator, and when the
-- share-kit message was sent.
create table if not exists public.wedding_vendors (
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  sort_order integer not null default 0 check (sort_order between 0 and 999),
  is_collaborator boolean not null default false,
  shared_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (wedding_id, vendor_id)
);

create index if not exists wedding_vendors_owner_wedding_idx
  on public.wedding_vendors (user_id, wedding_id, sort_order);
create index if not exists wedding_vendors_vendor_idx
  on public.wedding_vendors (vendor_id);

-- Instagram allows 5 collaborators per post; the database enforces it, not just the app.
create or replace function public.enforce_collaborator_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_collaborator and (
    select count(*)
    from public.wedding_vendors as wv
    where wv.wedding_id = new.wedding_id
      and wv.is_collaborator
      and wv.vendor_id <> new.vendor_id
  ) >= 5 then
    raise exception 'A wedding can have at most 5 Instagram collaborators.';
  end if;
  return new;
end;
$$;

drop trigger if exists wedding_vendors_collaborator_limit on public.wedding_vendors;
create trigger wedding_vendors_collaborator_limit
  before insert or update on public.wedding_vendors
  for each row execute function public.enforce_collaborator_limit();

-- Where the post lives once published (ShowIt or anywhere), for the share-kit link.
alter table public.weddings
  add column if not exists post_url text
    check (post_url is null or (char_length(post_url) <= 500 and post_url ~ '^https://'));

-- The photographer's own name and Instagram handle, used in the vendor credit line.
alter table public.user_preferences
  add column if not exists photographer_name text check (photographer_name is null or char_length(photographer_name) <= 120);
alter table public.user_preferences
  add column if not exists photographer_instagram text
    check (photographer_instagram is null or photographer_instagram ~ '^[A-Za-z0-9._]{1,30}$');

alter table public.vendors enable row level security;
alter table public.wedding_vendors enable row level security;

drop policy if exists "Owners can read their vendors" on public.vendors;
create policy "Owners can read their vendors"
  on public.vendors for select
  using (user_id = auth.uid());

drop policy if exists "Owners can insert their vendors" on public.vendors;
create policy "Owners can insert their vendors"
  on public.vendors for insert
  with check (user_id = auth.uid());

drop policy if exists "Owners can update their vendors" on public.vendors;
create policy "Owners can update their vendors"
  on public.vendors for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Owners can delete their vendors" on public.vendors;
create policy "Owners can delete their vendors"
  on public.vendors for delete
  using (user_id = auth.uid());

drop policy if exists "Owners can read their wedding vendors" on public.wedding_vendors;
create policy "Owners can read their wedding vendors"
  on public.wedding_vendors for select
  using (user_id = auth.uid());

-- Links must join the owner's own wedding to the owner's own vendor.
drop policy if exists "Owners can link their own weddings and vendors" on public.wedding_vendors;
create policy "Owners can link their own weddings and vendors"
  on public.wedding_vendors for insert
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.weddings where weddings.id = wedding_vendors.wedding_id and weddings.user_id = auth.uid())
    and exists (select 1 from public.vendors where vendors.id = wedding_vendors.vendor_id and vendors.user_id = auth.uid())
  );

drop policy if exists "Owners can update their wedding vendors" on public.wedding_vendors;
create policy "Owners can update their wedding vendors"
  on public.wedding_vendors for update
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.weddings where weddings.id = wedding_vendors.wedding_id and weddings.user_id = auth.uid())
    and exists (select 1 from public.vendors where vendors.id = wedding_vendors.vendor_id and vendors.user_id = auth.uid())
  );

drop policy if exists "Owners can unlink their wedding vendors" on public.wedding_vendors;
create policy "Owners can unlink their wedding vendors"
  on public.wedding_vendors for delete
  using (user_id = auth.uid());

grant select, insert, update, delete on public.vendors, public.wedding_vendors to authenticated;
revoke all on public.vendors, public.wedding_vendors from anon;
