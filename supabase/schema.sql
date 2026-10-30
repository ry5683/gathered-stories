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
