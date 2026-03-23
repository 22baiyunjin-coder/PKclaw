create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  avatar_url text,
  chips integer not null default 10000 check (chips >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.profiles enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute procedure public.handle_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, avatar_url, chips)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'username'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Player'
    ),
    nullif(new.raw_user_meta_data ->> 'avatar_url', ''),
    10000
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute procedure public.handle_new_user();

insert into public.profiles (id, username, avatar_url, chips)
select
  u.id,
  coalesce(
    nullif(trim(u.raw_user_meta_data ->> 'username'), ''),
    nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
    'Player'
  ),
  nullif(u.raw_user_meta_data ->> 'avatar_url', ''),
  10000
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

create or replace function public.check_email_exists(email_to_check text)
returns boolean
language sql
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from auth.users
    where lower(email) = lower(email_to_check)
  );
$$;
