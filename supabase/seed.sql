-- Demo data for local development only. Staff password for every user: foody1234

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, recovery_token, email_change_token_new, email_change)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated',
   'admin@foody.local', crypt('foody1234', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}',
   now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated',
   'cocina@foody.local', crypt('foody1234', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}',
   now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated',
   'mesero@foody.local', crypt('foody1234', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}',
   now(), now(), '', '', '', '');

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), 'email', now(), now(), now()
from auth.users u
where u.email like '%@foody.local';

insert into staff (id, full_name, role) values
  ('11111111-1111-1111-1111-111111111111', 'Admin Demo', 'admin'),
  ('22222222-2222-2222-2222-222222222222', 'Cocina Demo', 'kitchen'),
  ('33333333-3333-3333-3333-333333333333', 'Mesero Demo', 'waiter');

insert into dining_tables (code, label, zone, capacity, qr_token, sort_order) values
  ('M1', null, 'Salón', 4, 'dev-qr-m1-000000000000000000000000', 1),
  ('M2', null, 'Salón', 4, 'dev-qr-m2-000000000000000000000000', 2),
  ('M3', null, 'Salón', 2, 'dev-qr-m3-000000000000000000000000', 3),
  ('M4', null, 'Salón', 6, 'dev-qr-m4-000000000000000000000000', 4),
  ('T1', 'Terraza 1', 'Terraza', 4, 'dev-qr-t1-000000000000000000000000', 5),
  ('T2', 'Terraza 2', 'Terraza', 4, 'dev-qr-t2-000000000000000000000000', 6);

insert into categories (id, name, sort_order) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Bowls', 1),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Sándwiches', 2),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Jugos', 3);

insert into ingredients (id, name) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'Quinoa'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Kale'),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'Cebolla morada'),
  ('bbbbbbbb-0000-0000-0000-000000000004', 'Aguacate'),
  ('bbbbbbbb-0000-0000-0000-000000000005', 'Pan de masa madre'),
  ('bbbbbbbb-0000-0000-0000-000000000006', 'Salmón ahumado'),
  ('bbbbbbbb-0000-0000-0000-000000000007', 'Jitomate'),
  ('bbbbbbbb-0000-0000-0000-000000000008', 'Pepino');

insert into menu_items (id, category_id, name, description, price_cents, cost_cents, prep_minutes, tags, sort_order) values
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Bowl de quinoa y kale',
   'Quinoa, kale, cebolla morada y aguacate con vinagreta de limón', 16500, 5200, 10, '{vegano}', 1),
  ('cccccccc-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Bowl mediterráneo',
   'Quinoa, jitomate, pepino y cebolla morada', 15500, 4800, 10, '{vegano,sin gluten}', 2),
  ('cccccccc-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000002', 'Sándwich de salmón',
   'Pan de masa madre, salmón ahumado, pepino y cebolla morada', 18500, 7000, 12, '{}', 1),
  ('cccccccc-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000002', 'Sándwich caprese',
   'Pan de masa madre, jitomate y aguacate', 14500, 4200, 8, '{vegetariano}', 2),
  ('cccccccc-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000003', 'Jugo verde',
   'Kale, pepino y piña', 7500, 1800, 5, '{vegano}', 1),
  ('cccccccc-0000-0000-0000-000000000006', 'aaaaaaaa-0000-0000-0000-000000000003', 'Limonada de pepino',
   'Pepino, limón y menta', 6000, 1200, 5, '{vegano}', 2);

insert into menu_item_ingredients (menu_item_id, ingredient_id, is_removable, sort_order) values
  ('cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', false, 1),
  ('cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', true, 2),
  ('cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000003', true, 3),
  ('cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000004', true, 4),
  ('cccccccc-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000001', false, 1),
  ('cccccccc-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000007', true, 2),
  ('cccccccc-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000008', true, 3),
  ('cccccccc-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000003', true, 4),
  ('cccccccc-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000005', false, 1),
  ('cccccccc-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000006', false, 2),
  ('cccccccc-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000008', true, 3),
  ('cccccccc-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000003', true, 4),
  ('cccccccc-0000-0000-0000-000000000004', 'bbbbbbbb-0000-0000-0000-000000000005', false, 1),
  ('cccccccc-0000-0000-0000-000000000004', 'bbbbbbbb-0000-0000-0000-000000000007', true, 2),
  ('cccccccc-0000-0000-0000-000000000004', 'bbbbbbbb-0000-0000-0000-000000000004', true, 3),
  ('cccccccc-0000-0000-0000-000000000005', 'bbbbbbbb-0000-0000-0000-000000000002', false, 1),
  ('cccccccc-0000-0000-0000-000000000005', 'bbbbbbbb-0000-0000-0000-000000000008', false, 2);

insert into extras (id, name, price_cents, cost_cents, ingredient_id) values
  ('dddddddd-0000-0000-0000-000000000001', 'Aguacate extra', 3000, 1200, 'bbbbbbbb-0000-0000-0000-000000000004'),
  ('dddddddd-0000-0000-0000-000000000002', 'Huevo pochado', 2500, 600, null),
  ('dddddddd-0000-0000-0000-000000000003', 'Shot de jengibre', 1500, 300, null);

insert into menu_item_extras (menu_item_id, extra_id, max_quantity, sort_order) values
  ('cccccccc-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000001', 2, 1),
  ('cccccccc-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000002', 2, 2),
  ('cccccccc-0000-0000-0000-000000000002', 'dddddddd-0000-0000-0000-000000000001', 2, 1),
  ('cccccccc-0000-0000-0000-000000000003', 'dddddddd-0000-0000-0000-000000000001', 1, 1),
  ('cccccccc-0000-0000-0000-000000000003', 'dddddddd-0000-0000-0000-000000000002', 1, 2),
  ('cccccccc-0000-0000-0000-000000000004', 'dddddddd-0000-0000-0000-000000000001', 1, 1),
  ('cccccccc-0000-0000-0000-000000000005', 'dddddddd-0000-0000-0000-000000000003', 2, 1);
