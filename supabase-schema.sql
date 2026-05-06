-- ============================================================================
-- BetterNic — Phase 1 Database Schema
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql
-- ============================================================================

-- ----------------------------------------------------------------------------
-- TABLE: profiles (extends auth.users)
-- ----------------------------------------------------------------------------
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  display_name text,
  is_public boolean default false,
  stripe_account_id text,
  created_at timestamptz default now()
);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ----------------------------------------------------------------------------
-- TABLE: listings
-- ----------------------------------------------------------------------------
create table if not exists listings (
  id bigserial primary key,
  seller_id uuid references profiles(id) on delete cascade not null,
  domain text not null unique,
  price integer not null check (price > 0),
  min_offer integer,
  tagline text,
  category text,
  custody text not null check (custody in ('parked', 'self')),
  lto_enabled boolean default false,
  registered_year integer,
  status text default 'active' check (status in ('draft', 'active', 'sold', 'paused')),
  view_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists listings_status_idx on listings(status);
create index if not exists listings_category_idx on listings(category);
create index if not exists listings_seller_idx on listings(seller_id);
create index if not exists listings_price_idx on listings(price);

-- ----------------------------------------------------------------------------
-- TABLE: offers (buyer offers / make-offer flow)
-- ----------------------------------------------------------------------------
create table if not exists offers (
  id bigserial primary key,
  listing_id bigint references listings(id) on delete cascade not null,
  buyer_email text not null,
  buyer_name text,
  amount integer not null check (amount > 0),
  message text,
  status text default 'pending' check (status in ('pending', 'accepted', 'declined', 'countered', 'expired')),
  counter_amount integer,
  ip_address text,
  created_at timestamptz default now()
);

create index if not exists offers_listing_idx on offers(listing_id);
create index if not exists offers_status_idx on offers(status);

-- ----------------------------------------------------------------------------
-- TABLE: orders (buy-now and LTO transactions)
-- ----------------------------------------------------------------------------
create table if not exists orders (
  id bigserial primary key,
  listing_id bigint references listings(id) not null,
  buyer_email text not null,
  buyer_name text not null,
  payment_method text not null,
  amount integer not null,
  commission_amount integer not null,
  seller_payout integer not null,
  status text default 'pending_payment' check (status in (
    'pending_payment', 'paid', 'transferring', 'completed', 'refunded', 'failed'
  )),
  -- LTO-specific
  is_lto boolean default false,
  lto_months integer,
  lto_total_payments integer default 0,
  lto_completed_payments integer default 0,
  -- Payment processor refs
  stripe_payment_id text,
  escrow_transaction_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists orders_listing_idx on orders(listing_id);
create index if not exists orders_status_idx on orders(status);

-- ----------------------------------------------------------------------------
-- TABLE: comparable_sales (for the comparable-sales anchor on landers)
-- ----------------------------------------------------------------------------
create table if not exists comparable_sales (
  id bigserial primary key,
  domain text not null,
  category text not null,
  price integer not null,
  sold_date date,
  letter_count integer,
  created_at timestamptz default now()
);

create index if not exists comp_category_idx on comparable_sales(category);

-- ----------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------
alter table profiles enable row level security;
alter table listings enable row level security;
alter table offers enable row level security;
alter table orders enable row level security;
alter table comparable_sales enable row level security;

-- Profiles: users can read their own and update their own
drop policy if exists "Users see own profile" on profiles;
create policy "Users see own profile" on profiles
  for select using (auth.uid() = id or is_public = true);

drop policy if exists "Users update own profile" on profiles;
create policy "Users update own profile" on profiles
  for update using (auth.uid() = id);

-- Listings: anyone can read active listings; sellers manage their own
drop policy if exists "Public read active listings" on listings;
create policy "Public read active listings" on listings
  for select using (status = 'active' or seller_id = auth.uid());

drop policy if exists "Sellers create listings" on listings;
create policy "Sellers create listings" on listings
  for insert with check (auth.uid() = seller_id);

drop policy if exists "Sellers update own listings" on listings;
create policy "Sellers update own listings" on listings
  for update using (auth.uid() = seller_id);

drop policy if exists "Sellers delete own listings" on listings;
create policy "Sellers delete own listings" on listings
  for delete using (auth.uid() = seller_id);

-- Offers: sellers see offers on their listings; anyone can create
drop policy if exists "Sellers see own offers" on offers;
create policy "Sellers see own offers" on offers
  for select using (
    exists(select 1 from listings where listings.id = offers.listing_id and listings.seller_id = auth.uid())
  );

drop policy if exists "Anyone can create offers" on offers;
create policy "Anyone can create offers" on offers
  for insert with check (true);

drop policy if exists "Sellers update offers" on offers;
create policy "Sellers update offers" on offers
  for update using (
    exists(select 1 from listings where listings.id = offers.listing_id and listings.seller_id = auth.uid())
  );

-- Orders: sellers see orders for their listings; anyone can create
drop policy if exists "Sellers see own orders" on orders;
create policy "Sellers see own orders" on orders
  for select using (
    exists(select 1 from listings where listings.id = orders.listing_id and listings.seller_id = auth.uid())
  );

drop policy if exists "Anyone can create orders" on orders;
create policy "Anyone can create orders" on orders
  for insert with check (true);

-- Comparable sales: public read
drop policy if exists "Public read comparables" on comparable_sales;
create policy "Public read comparables" on comparable_sales
  for select using (true);

-- ----------------------------------------------------------------------------
-- SEED DATA: comparable sales (replace with real NameBio data later)
-- ----------------------------------------------------------------------------
insert into comparable_sales (domain, category, price, sold_date, letter_count) values
  ('finvex.com', 'finance', 42000, '2026-01-15', 6),
  ('payora.com', 'finance', 31500, '2025-12-08', 6),
  ('moneta.io', 'finance', 24000, '2025-11-22', 6),
  ('lendoor.com', 'finance', 18500, '2025-10-14', 7),
  ('neurix.ai', 'ai', 38000, '2026-02-03', 6),
  ('aitower.com', 'ai', 19500, '2025-12-19', 7),
  ('cogni.ai', 'ai', 28000, '2026-01-29', 5),
  ('chainvex.com', 'crypto', 45000, '2026-01-11', 8),
  ('minto.io', 'crypto', 17000, '2025-11-05', 5),
  ('blockstack.com', 'crypto', 62000, '2025-10-28', 10),
  ('verda.com', 'brandable', 22000, '2026-01-09', 5),
  ('lumio.com', 'brandable', 18500, '2025-12-12', 5),
  ('novara.com', 'brandable', 31000, '2025-11-20', 6)
on conflict do nothing;

-- ============================================================================
-- DONE. Now go to Authentication → Providers → Email and enable email auth.
-- Then update lib/config.js with your project URL and anon key.
-- ============================================================================
