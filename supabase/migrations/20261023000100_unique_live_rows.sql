-- Soft-deleted rows must not block reusing their table code or ingredient name.
alter table dining_tables drop constraint dining_tables_code_key;
create unique index dining_tables_code_live_key on dining_tables (code) where deleted_at is null;

alter table ingredients drop constraint ingredients_name_key;
create unique index ingredients_name_live_key on ingredients (name) where deleted_at is null;
