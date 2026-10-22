-- Keeps the diner's order of extras and removed ingredients inside a line.
alter table order_item_extras add column position int not null default 0;
alter table order_item_removed_ingredients add column position int not null default 0;
