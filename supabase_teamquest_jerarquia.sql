-- Ejecutar esto UNA VEZ en Supabase → SQL Editor → New query → Run
-- (pegar SOLO esto, sin nada de otras veces mezclado en la misma pestaña)

alter table agentes add column if not exists equipo_lider text;
alter table agentes add column if not exists es_broker boolean not null default false;

-- Julieta reporta a Gustavo (Team Lugo). El resto queda independiente
-- (equipo_lider en null = es su propio equipo de una persona).
update agentes set equipo_lider = 'gustavo-lugo' where key = 'julieta-vidal';

-- Ricardo ve la oficina completa.
update agentes set es_broker = true where key = 'ricardo';
