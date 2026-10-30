-- Add v2 work-in-progress state and keep encrypted WordPress credentials server-only.
alter table public.weddings add column if not exists photos jsonb not null default '[]'::jsonb;
alter table public.weddings add column if not exists favorite_moment text not null default '';
alter table public.weddings add column if not exists optional_inspiration text not null default '';
alter table public.weddings add column if not exists current_step integer not null default 0;
alter table public.weddings add column if not exists voice text not null default 'delicate';
alter table public.weddings add column if not exists use_voice_examples boolean not null default true;
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

update public.drafts
set content = content || jsonb_build_object(
  'caption', coalesce(content->>'caption', ''),
  'hashtags', coalesce(content->>'hashtags', ''),
  'photoFileNames', coalesce(content->'photoFileNames', '[]'::jsonb),
  'photoCaptions', coalesce(content->'photoCaptions', content->'altTexts', '[]'::jsonb),
  'extraCaptions', coalesce(content->'extraCaptions', '[]'::jsonb),
  'extraFormats', coalesce(content->'extraFormats', '{}'::jsonb)
);

alter table public.wordpress_connections enable row level security;
alter table public.wordpress_posts enable row level security;
alter table public.wordpress_delivery_locks enable row level security;
alter table public.post_inquiries enable row level security;

revoke all on public.wordpress_connections, public.wordpress_posts, public.wordpress_delivery_locks, public.post_inquiries from anon, authenticated;
grant select, insert, update, delete on public.wordpress_connections, public.wordpress_posts, public.wordpress_delivery_locks, public.post_inquiries to service_role;

create index if not exists drafts_owner_updated_idx on public.drafts(user_id, updated_at desc);
create index if not exists wordpress_posts_owner_wedding_idx on public.wordpress_posts(user_id, wedding_id, sent_at desc);
create index if not exists post_inquiries_owner_created_idx on public.post_inquiries(user_id, created_at desc);
