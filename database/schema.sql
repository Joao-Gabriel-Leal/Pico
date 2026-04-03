create extension if not exists "pgcrypto";

create table if not exists sport (
  id serial primary key,
  slug text not null unique,
  name text not null
);

create table if not exists app_user (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  username text not null unique,
  password_hash text not null,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  location_accuracy numeric(10, 2),
  created_at timestamptz not null default now()
);

create table if not exists profile (
  user_id uuid primary key references app_user(id) on delete cascade,
  display_name text not null,
  bio text default '',
  avatar_url text default '',
  updated_at timestamptz not null default now()
);

create table if not exists user_favorite_sport (
  user_id uuid not null references app_user(id) on delete cascade,
  sport_id integer not null references sport(id),
  primary key (user_id, sport_id)
);

create table if not exists user_follow (
  follower_id uuid not null references app_user(id) on delete cascade,
  following_id uuid not null references app_user(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create table if not exists auth_session (
  token text primary key,
  user_id uuid not null references app_user(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists pico (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references app_user(id) on delete cascade,
  primary_sport_id integer not null references sport(id),
  name text not null,
  slug text not null unique,
  description text not null,
  latitude numeric(9, 6) not null,
  longitude numeric(9, 6) not null,
  status_text text not null,
  condition_label text not null,
  cover_image_url text default '',
  created_at timestamptz not null default now()
);

create table if not exists pico_vote (
  pico_id uuid not null references pico(id) on delete cascade,
  user_id uuid not null references app_user(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (pico_id, user_id)
);

create table if not exists pico_media (
  id uuid primary key default gen_random_uuid(),
  pico_id uuid not null references pico(id) on delete cascade,
  user_id uuid not null references app_user(id) on delete cascade,
  media_type text not null check (media_type in ('photo', 'video')),
  title text not null,
  file_url text not null,
  likes_count integer not null default 0,
  views_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists pico_event (
  id uuid primary key default gen_random_uuid(),
  pico_id uuid not null references pico(id) on delete cascade,
  created_by uuid not null references app_user(id) on delete cascade,
  title text not null,
  description text default '',
  sport_id integer not null references sport(id),
  starts_at timestamptz not null,
  entry_fee_cents integer not null default 0,
  prize_pool_cents integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists crowdfunding_campaign (
  id uuid primary key default gen_random_uuid(),
  pico_id uuid not null references pico(id) on delete cascade,
  created_by uuid not null references app_user(id) on delete cascade,
  title text not null,
  purpose text not null,
  goal_cents integer not null,
  amount_raised_cents integer not null default 0,
  status text not null default 'active' check (status in ('active', 'funded', 'closed')),
  created_at timestamptz not null default now()
);

create table if not exists crowdfunding_contribution (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references crowdfunding_campaign(id) on delete cascade,
  user_id uuid not null references app_user(id) on delete cascade,
  amount_cents integer not null,
  created_at timestamptz not null default now()
);

create table if not exists direct_conversation (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists direct_conversation_participant (
  conversation_id uuid not null references direct_conversation(id) on delete cascade,
  user_id uuid not null references app_user(id) on delete cascade,
  primary key (conversation_id, user_id)
);

create table if not exists direct_message (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references direct_conversation(id) on delete cascade,
  sender_id uuid not null references app_user(id) on delete cascade,
  text_content text not null,
  created_at timestamptz not null default now()
);

create index if not exists user_follow_following_id_idx on user_follow (following_id);
create index if not exists auth_session_user_id_idx on auth_session (user_id);
create index if not exists pico_created_at_idx on pico (created_at desc);
create index if not exists pico_vote_user_id_idx on pico_vote (user_id);
create index if not exists pico_media_pico_created_at_idx on pico_media (pico_id, created_at desc);
create index if not exists pico_media_user_created_at_idx on pico_media (user_id, created_at desc);
create index if not exists pico_event_pico_starts_at_idx on pico_event (pico_id, starts_at);
create index if not exists crowdfunding_campaign_pico_created_at_idx on crowdfunding_campaign (pico_id, created_at desc);
create unique index if not exists crowdfunding_campaign_one_active_per_pico_idx
  on crowdfunding_campaign (pico_id)
  where status = 'active';
create index if not exists direct_conversation_updated_at_idx on direct_conversation (updated_at desc);
create index if not exists direct_message_conversation_created_at_idx
  on direct_message (conversation_id, created_at);
