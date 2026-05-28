-- ========================================================
-- EVIDENCIA FOTOGRAFICA OPCIONAL DE RECOGIDA
-- ========================================================

alter table public.delivery_orders
add column if not exists pickup_evidence_path text;

insert into storage.buckets (id, name, public)
values ('delivery-evidence', 'delivery-evidence', false)
on conflict (id) do update set public = false;

drop policy if exists "Authenticated users can upload delivery evidence" on storage.objects;
drop policy if exists "Authenticated users can read delivery evidence" on storage.objects;
drop policy if exists "Authenticated users can update delivery evidence" on storage.objects;

create policy "Authenticated users can upload delivery evidence"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'delivery-evidence');

create policy "Authenticated users can read delivery evidence"
on storage.objects
for select
to authenticated
using (bucket_id = 'delivery-evidence');

create policy "Authenticated users can update delivery evidence"
on storage.objects
for update
to authenticated
using (bucket_id = 'delivery-evidence')
with check (bucket_id = 'delivery-evidence');
