create extension if not exists pgcrypto;

create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.hand_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null default 'played' check (source in ('played', 'imported', 'reconstructed', 'simulated')),
  status text not null default 'recorded' check (status in ('recorded', 'draft', 'reconstructed', 'simulated')),
  title text not null,
  table_name text not null default 'PokerMind Arena',
  hero_name text not null,
  hero_seat integer not null default 0,
  seat_count integer not null default 8,
  small_blind integer not null default 10,
  big_blind integer not null default 20,
  final_street text not null default 'showdown' check (final_street in ('preflop', 'flop', 'turn', 'river', 'showdown')),
  action_count integer not null default 0,
  hero_profit integer not null default 0,
  pot_size integer not null default 0,
  summary text not null default '',
  tags text[] not null default '{}'::text[],
  raw_input text,
  hand_payload jsonb not null default '{}'::jsonb,
  replay_payload jsonb,
  analysis_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hand_records_user_id_created_at_idx
  on public.hand_records(user_id, created_at desc);

create index if not exists hand_records_source_idx
  on public.hand_records(source);

drop trigger if exists set_hand_records_updated_at on public.hand_records;
create trigger set_hand_records_updated_at
before update on public.hand_records
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.hand_records enable row level security;

drop policy if exists "Users can read their own hand records" on public.hand_records;
create policy "Users can read their own hand records"
  on public.hand_records
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create their own hand records" on public.hand_records;
create policy "Users can create their own hand records"
  on public.hand_records
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own hand records" on public.hand_records;
create policy "Users can update their own hand records"
  on public.hand_records
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own hand records" on public.hand_records;
create policy "Users can delete their own hand records"
  on public.hand_records
  for delete
  using (auth.uid() = user_id);
