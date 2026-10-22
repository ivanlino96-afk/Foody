-- Foody core schema: menu, tables, sessions, orders, payments and history.
-- Amounts are integer cents (MXN). Every write goes through the FastAPI backend.

create extension if not exists pgcrypto;

-- Enums ----------------------------------------------------------------------

create type staff_role as enum ('admin', 'kitchen', 'waiter');
create type table_status as enum ('free', 'occupied', 'awaiting_order', 'served', 'bill_requested', 'closed');
create type order_status as enum ('received', 'preparing', 'ready', 'served', 'cancelled');
create type change_source as enum ('staff', 'diner', 'system', 'payment');
create type payment_method as enum ('mercado_pago', 'cash', 'card_terminal');
create type payment_status as enum ('pending', 'approved', 'rejected', 'cancelled', 'refunded');
create type service_call_type as enum ('call_waiter', 'request_bill');
create type availability_entity as enum ('menu_item', 'ingredient', 'extra');

create function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Staff and settings -----------------------------------------------------------

create table staff (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role staff_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references staff (id),
  updated_by uuid references staff (id)
);

create table restaurant_settings (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Foody',
  logo_path text,
  currency text not null default 'MXN',
  timezone text not null default 'America/Mexico_City',
  auto_release_minutes int not null default 5 check (auto_release_minutes between 0 and 240),
  tip_options int[] not null default '{10,15,20}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references staff (id),
  updated_by uuid references staff (id)
);

-- Tables and sessions --------------------------------------------------------

create table dining_tables (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text,
  zone text,
  capacity int check (capacity > 0),
  qr_token text not null unique,
  status table_status not null default 'free',
  current_session_id uuid,
  status_changed_at timestamptz not null default now(),
  sort_order int not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references staff (id),
  updated_by uuid references staff (id)
);

create table table_sessions (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references dining_tables (id),
  opened_by uuid references staff (id),
  guests_count int check (guests_count > 0),
  opened_at timestamptz not null default now(),
  bill_requested_at timestamptz,
  paid_at timestamptz,
  closed_at timestamptz,
  subtotal_cents int not null default 0 check (subtotal_cents >= 0),
  tip_cents int not null default 0 check (tip_cents >= 0),
  cost_cents int not null default 0 check (cost_cents >= 0),
  paid_cents int not null default 0 check (paid_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references staff (id),
  updated_by uuid references staff (id)
);

alter table dining_tables
  add constraint dining_tables_current_session_fk foreign key (current_session_id) references table_sessions (id);

create table table_status_history (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references dining_tables (id),
  session_id uuid references table_sessions (id),
  from_status table_status,
  to_status table_status not null,
  source change_source not null,
  changed_by uuid references staff (id),
  changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references staff (id),
  updated_by uuid references staff (id)
);

-- Menu -------------------------------------------------------------------------

create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references staff (id),
  updated_by uuid references staff (id)
);

create table menu_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories (id),
  name text not null,
  description text not null default '',
  price_cents int not null check (price_cents >= 0),
  cost_cents int not null default 0 check (cost_cents >= 0),
  photo_path text,
  is_available boolean not null default true,
  prep_minutes int check (prep_minutes > 0),
  tags text[] not null default '{}',
  sort_order int not null default 0,
  is_active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references staff (id),
  updated_by uuid references staff (id)
);

create table ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_available boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references staff (id),
  updated_by uuid references staff (id)
);

create table menu_item_ingredients (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid not null references menu_items (id) on delete cascade,
  ingredient_id uuid not null references ingredients (id),
  is_removable boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references staff (id),
  updated_by uuid references staff (id),
  unique (menu_item_id, ingredient_id)
);

create table extras (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price_cents int not null check (price_cents >= 0),
  cost_cents int not null default 0 check (cost_cents >= 0),
  ingredient_id uuid references ingredients (id),
  is_available boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references staff (id),
  updated_by uuid references staff (id)
);

create table menu_item_extras (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid not null references menu_items (id) on delete cascade,
  extra_id uuid not null references extras (id),
  max_quantity int not null default 1 check (max_quantity between 1 and 10),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references staff (id),
  updated_by uuid references staff (id),
  unique (menu_item_id, extra_id)
);

create table availability_log (
  id uuid primary key default gen_random_uuid(),
  entity_type availability_entity not null,
  entity_id uuid not null,
  is_available boolean not null,
  changed_by uuid references staff (id),
  changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references staff (id),
  updated_by uuid references staff (id)
);

-- Orders -----------------------------------------------------------------------

create table daily_counters (
  day date primary key,
  last_number int not null
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references table_sessions (id),
  table_id uuid not null references dining_tables (id),
  daily_number int not null,
  round_number int not null check (round_number >= 1),
  status order_status not null default 'received',
  idempotency_key uuid not null unique,
  subtotal_cents int not null check (subtotal_cents >= 0),
  cost_cents int not null check (cost_cents >= 0),
  created_at timestamptz not null default now(),
  preparing_at timestamptz,
  ready_at timestamptz,
  served_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by uuid references staff (id),
  cancel_reason text,
  updated_at timestamptz not null default now(),
  created_by uuid references staff (id),
  updated_by uuid references staff (id),
  unique (session_id, round_number)
);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  position int not null default 0,
  menu_item_id uuid not null references menu_items (id),
  item_name text not null,
  unit_price_cents int not null check (unit_price_cents >= 0),
  unit_cost_cents int not null check (unit_cost_cents >= 0),
  quantity int not null check (quantity >= 1),
  note text,
  line_total_cents int not null check (line_total_cents >= 0),
  line_cost_cents int not null check (line_cost_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references staff (id),
  updated_by uuid references staff (id)
);

create table order_item_extras (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references order_items (id) on delete cascade,
  extra_id uuid not null references extras (id),
  extra_name text not null,
  unit_price_cents int not null check (unit_price_cents >= 0),
  unit_cost_cents int not null check (unit_cost_cents >= 0),
  quantity int not null check (quantity >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references staff (id),
  updated_by uuid references staff (id)
);

create table order_item_removed_ingredients (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references order_items (id) on delete cascade,
  ingredient_id uuid not null references ingredients (id),
  ingredient_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references staff (id),
  updated_by uuid references staff (id)
);

create table order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  from_status order_status,
  to_status order_status not null,
  source change_source not null,
  changed_by uuid references staff (id),
  changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references staff (id),
  updated_by uuid references staff (id)
);

-- Payments and service calls -------------------------------------------------

create table payments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references table_sessions (id),
  method payment_method not null,
  status payment_status not null default 'pending',
  amount_cents int not null check (amount_cents >= 0),
  tip_cents int not null default 0 check (tip_cents >= 0),
  mp_preference_id text,
  mp_payment_id text unique,
  received_by uuid references staff (id),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references staff (id),
  updated_by uuid references staff (id)
);

create table payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  mp_event_id text not null unique,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references staff (id),
  updated_by uuid references staff (id)
);

create table service_calls (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references table_sessions (id),
  table_id uuid not null references dining_tables (id),
  type service_call_type not null,
  attended_at timestamptz,
  attended_by uuid references staff (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references staff (id),
  updated_by uuid references staff (id)
);

-- Indexes ----------------------------------------------------------------------

create index orders_status_created_idx on orders (status, created_at);
create index orders_session_idx on orders (session_id);
create index order_items_order_idx on order_items (order_id);
create index payments_session_status_idx on payments (session_id, status);
create index order_status_history_order_idx on order_status_history (order_id, changed_at);
create index table_status_history_table_idx on table_status_history (table_id, changed_at);
create index menu_items_category_idx on menu_items (category_id);

-- updated_at triggers, RLS and staff read policies ------------------------------

create function is_active_staff() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from staff where id = auth.uid() and is_active);
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'staff', 'restaurant_settings', 'dining_tables', 'table_sessions', 'table_status_history', 'categories',
    'menu_items', 'ingredients', 'menu_item_ingredients', 'extras', 'menu_item_extras', 'availability_log',
    'orders', 'order_items', 'order_item_extras', 'order_item_removed_ingredients', 'order_status_history',
    'payments', 'payment_webhook_events', 'service_calls'
  ] loop
    execute format('create trigger %I_set_updated_at before update on %I for each row execute function set_updated_at()', t, t);
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I_staff_read on %I for select to authenticated using (is_active_staff())', t, t);
  end loop;
end;
$$;

alter table daily_counters enable row level security;

-- Realtime for staff screens ---------------------------------------------------

alter publication supabase_realtime add table orders, dining_tables, service_calls, payments;

-- Single settings row ----------------------------------------------------------

insert into restaurant_settings (name) values ('Foody');
