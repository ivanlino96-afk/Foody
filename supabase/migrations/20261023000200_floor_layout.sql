-- Floor layout: areas (salón, jardín, roof…) and where each table sits, in meters on one floor plan.

create table floor_areas (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'salon' check (kind in ('salon', 'jardin', 'roof', 'terraza', 'barra', 'privado', 'otro')),
  x double precision not null default 0,
  y double precision not null default 0,
  width double precision not null check (width > 0 and width <= 100),
  depth double precision not null check (depth > 0 and depth <= 100),
  sort_order int not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references staff (id),
  updated_by uuid references staff (id)
);

alter table dining_tables
  add column kind text not null default 'table' check (kind in ('table', 'round', 'bar', 'high', 'booth')),
  add column area_id uuid references floor_areas (id),
  add column pos_x double precision,
  add column pos_y double precision,
  add column rotation int not null default 0 check (rotation in (0, 90, 180, 270));

create trigger floor_areas_set_updated_at before update on floor_areas for each row execute function set_updated_at();
alter table floor_areas enable row level security;
create policy floor_areas_staff_read on floor_areas for select to authenticated using (is_active_staff());

alter publication supabase_realtime add table floor_areas;
