-- Enable UUID extension if not already enabled
create extension if not exists "uuid-ossp";

-- 1. Purchases Table
create table public.purchases (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  time timestamptz default now() not null,
  total_price numeric(10, 2) not null,
  products jsonb default '[]'::jsonb, -- Storing products as a JSON array for flexibility
  store text,
  category text,
  store_image text, -- URL or path to the image in the storage bucket
  status text check (status in ('success', 'failure')) -- 'success' (stopped) or 'failure' (purchased)
);

-- Enable RLS for purchases
alter table public.purchases enable row level security;

-- Policy: Users can only view and insert their own purchases
create policy "Users can view their own purchases"
  on public.purchases for select
  using (auth.uid() = user_id);

create policy "Users can insert their own purchases"
  on public.purchases for insert
  with check (auth.uid() = user_id);


-- 2. Goals Table
create table public.goals (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  goal text not null,
  goal_value numeric(10, 2) not null,
  created_at timestamptz default now()
);

-- Enable RLS for goals
alter table public.goals enable row level security;

-- Policy: Users can only view and manage their own goals
create policy "Users can view their own goals"
  on public.goals for select
  using (auth.uid() = user_id);

create policy "Users can insert their own goals"
  on public.goals for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own goals"
  on public.goals for update
  using (auth.uid() = user_id);


-- 3. User Profiles Table (Preferences, Motivations, Struggles, Tone)
create table public.user_profiles (
  user_id uuid references auth.users(id) on delete cascade primary key,
  preferences text[] default '{}',
  motivations text[] default '{}',
  struggles text[] default '{}',
  tone text,
  updated_at timestamptz default now()
);

-- Enable RLS for user_profiles
alter table public.user_profiles enable row level security;

-- Policy: Users can view and update their own profile
create policy "Users can view their own profile"
  on public.user_profiles for select
  using (auth.uid() = user_id);

create policy "Users can insert their own profile"
  on public.user_profiles for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own profile"
  on public.user_profiles for update
  using (auth.uid() = user_id);

-- Function to handle new user creation (optional but recommended)
-- This automatically creates a profile entry when a new user signs up via Supabase Auth
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_profiles (user_id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

-- Trigger for new user creation
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
