-- Ejecutar esto UNA VEZ en Supabase → SQL Editor → New query → Run
-- (pegar SOLO esto, sin nada de otras veces mezclado en la misma pestaña)

create table if not exists eventos_comerciales (
  id           bigint generated always as identity primary key,
  agente       text not null,
  contacto_id  bigint,
  tipo         text not null,
  xp           integer not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists eventos_comerciales_agente_idx on eventos_comerciales (agente);
create index if not exists eventos_comerciales_created_idx on eventos_comerciales (created_at);

alter table eventos_comerciales enable row level security;
create policy "service role full access" on eventos_comerciales
  for all using (true) with check (true);
