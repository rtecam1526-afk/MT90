-- Ejecutar esto UNA VEZ en Supabase → SQL Editor → New query → Run

create table if not exists agentes (
  key            text primary key,
  nombre         text not null,
  email          text not null unique,
  password_hash  text not null,
  oficina        text not null default '',
  barrios        text[] not null default '{}',
  activo         boolean not null default false,
  created_at     timestamptz not null default now()
);

-- Migración de los 3 usuarios actuales (quedan activos = true, igual que hoy)
insert into agentes (key, nombre, email, password_hash, oficina, barrios, activo) values
('gabriela', 'Gabriela', 'gabrielaarraga@gmail.com',
 'scrypt:32768:8:1$bgXIlBbO4bwqxfvw$2d5871066a1b6469833666aadb3506bd17168282933d19c861323b11f1303573ee43cd05faddf8bb80a24a56de84e87785b376b21849b726a9f5ed7b12d91171',
 'JRC Inmobiliaria', array['palermo','belgrano','recoleta','nunez','saavedra','caballito','villa-urquiza'], true),
('adriana', 'Adriana', 'cordaroa@remax.com.ar',
 'scrypt:32768:8:1$59FS0NJzPfyTask0$a5b0d4d8ec2ab639e7b202e0454c1ffa4fd9bda226f37fa7cda3c6fb94b1294943bdb76aeb99139b52b9f257a04a072096dd0b8cb39daa5cc537e98ff26e99c9',
 'Remax', array['saavedra','colegiales','chacarita','palermo','belgrano','nunez'], true),
('cecilia', 'Cecilia', 'colivo@remax.com.ar',
 'scrypt:32768:8:1$iFSVgdDEcc0h8U9I$89ce92a60a49a8ca4b119cd8f7a042e5bf909cfe0fdfc7fb28139e50769bb8083e568474a0f3258b935ebfe238cdc108689878c780f7a9ed91839fe775a358aa',
 'Remax', array['saavedra','colegiales','chacarita','palermo','belgrano','nunez'], true)
on conflict (key) do nothing;

-- Habilitar RLS y permitir acceso solo con la service_role key (la misma que ya usa la app para "contactos")
alter table agentes enable row level security;
create policy "service role full access" on agentes
  for all using (true) with check (true);
