-- Public bucket for menu photos; the backend uploads with the service role.
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public) values ('menu-photos', 'menu-photos', true)
    on conflict (id) do nothing;
  end if;
end $$;
