insert into storage.buckets (id, name, public)
values ('generated-assets', 'generated-assets', true)
on conflict (id) do update set public = excluded.public;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Public can view generated assets'
  ) then
    create policy "Public can view generated assets"
    on storage.objects
    for select
    using (bucket_id = 'generated-assets');
  end if;
end
$$;