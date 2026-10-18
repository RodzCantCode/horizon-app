-- Datos iniciales: las 9 piezas y las 4 estrategias del prototipo (función `semilla` de
-- prototipo/index.html). No hay planes de ejemplo.
--
-- - nombre_corto es el texto tras «· » del nombre («T4 · Historia del invitado» → «Historia del
--   invitado»), o el nombre entero si no lleva prefijo.
-- - hora_habitual queda vacía en todas: la rellena Mario, no se inventa.
-- - dias_permitidos y los desplazamientos de las estrategias son los `dias` y `offset` del
--   prototipo (-1 = D-1, 0 = D, 5 = D+5).
-- - El campo `requiereEp` del prototipo no tiene columna en `piezas`, así que no se carga.
--
-- Corre como postgres, sin sesión: auth.uid() es null y las filas del registro que escriben los
-- disparadores para esta carga quedan sin usuario.

insert into public.piezas (nombre, nombre_corto, formato, canales, dias_permitidos,
                           dias_preparacion)
values
  ('T0 · Semana sin podcast', 'Semana sin podcast', 'slide', '{ig,tiktok}', '{-1,0,1,2,3,4,5}', 3),
  ('T1 · Próximos invitados', 'Próximos invitados', 'slide', '{ig,tiktok}', '{4,5}', 2),
  ('T2 · Valor + CTA', 'Valor + CTA', 'slide', '{ig,tiktok}', '{1,2,3,4}', 3),
  ('T3 · Frases de invitados', 'Frases de invitados', 'slide', '{ig,tiktok}', '{-1,0,1,2,3,4,5}', 2),
  ('T4 · Historia del invitado', 'Historia del invitado', 'slide', '{ig,tiktok}', '{-1}', 3),
  ('Clip principal', 'Clip principal', 'reel', '{ig,tiktok,shorts}', '{0}', 2),
  ('Clip secundario', 'Clip secundario', 'reel', '{ig,tiktok,shorts}', '{1,2,3,4,5}', 2),
  ('Teaser', 'Teaser', 'reel', '{ig,tiktok,shorts}', '{-1}', 2),
  ('Clip de archivo', 'Clip de archivo', 'reel', '{ig,tiktok,shorts}', '{-1,0,1,2,3,4,5}', 1);

insert into public.estrategias (nombre, con_episodio)
values
  ('E1 · Anticipación fuerte', true),
  ('E2 · Valor primero', true),
  ('E3 · Recopilación', false),
  ('E4 · Actualidad', false);

-- Piezas de cada estrategia, enlazadas por nombre (los ids se generan al insertar).
insert into public.estrategia_piezas (estrategia_id, pieza_id, desplazamiento)
select e.id, p.id, i.desplazamiento
  from (values
    ('E1 · Anticipación fuerte', 'T4 · Historia del invitado', -1),
    ('E1 · Anticipación fuerte', 'Clip principal', 0),
    ('E1 · Anticipación fuerte', 'Clip secundario', 2),
    ('E1 · Anticipación fuerte', 'T2 · Valor + CTA', 4),
    ('E1 · Anticipación fuerte', 'Clip secundario', 5),
    ('E2 · Valor primero', 'Teaser', -1),
    ('E2 · Valor primero', 'Clip principal', 0),
    ('E2 · Valor primero', 'T2 · Valor + CTA', 1),
    ('E2 · Valor primero', 'T3 · Frases de invitados', 4),
    ('E2 · Valor primero', 'Clip secundario', 5),
    ('E3 · Recopilación', 'T3 · Frases de invitados', -1),
    ('E3 · Recopilación', 'Clip de archivo', 1),
    ('E3 · Recopilación', 'Clip de archivo', 4),
    ('E3 · Recopilación', 'T1 · Próximos invitados', 5),
    ('E4 · Actualidad', 'T0 · Semana sin podcast', 0),
    ('E4 · Actualidad', 'Clip de archivo', 2),
    ('E4 · Actualidad', 'Clip de archivo', 4),
    ('E4 · Actualidad', 'T1 · Próximos invitados', 5)
  ) as i (estrategia, pieza, desplazamiento)
  join public.estrategias e on e.nombre = i.estrategia
  join public.piezas p on p.nombre = i.pieza;

-- Si algún nombre no enlazara, la carga quedaría a medias sin avisar: se comprueba y se deshace.
do $$
begin
  if (select count(*) from public.piezas) <> 9
     or (select count(*) from public.estrategias) <> 4
     or (select count(*) from public.estrategia_piezas) <> 18 then
    raise exception 'Datos iniciales incompletos: se esperaban 9 piezas, 4 estrategias y 18 ítems';
  end if;
end $$;
