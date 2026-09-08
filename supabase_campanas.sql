-- Ejecutar esto UNA VEZ en Supabase → SQL Editor → New query → Run

create table if not exists campanas (
  id          bigint generated always as identity primary key,
  agente      text not null,
  titulo      text not null,
  mensaje     text not null,
  imagen      text,
  created_at  timestamptz not null default now()
);

-- Misma política que ya tienen "agentes" y "contactos": acceso completo
-- con la key que usa la app (el filtrado por agente lo hace el backend).
alter table campanas enable row level security;
create policy "service role full access" on campanas
  for all using (true) with check (true);
