-- Pruebas de las funciones de varias filas de los planes (migraciones funciones_planes y
-- calendario): crear_plan, mover_plan, mover_episodio y cambiar_estrategia, y los límites de
-- estrategia_piezas.desplazamiento. También lo que anota el registro al mover solo el episodio
-- (migración registro_sin_desplazamiento).
--
-- Cómo se ejecutan: igual que seguridad.sql, el archivo entero con execute_sql de la conexión
-- supabase-horizon. Todo va en una transacción que acaba en rollback, así que el usuario, los planes
-- y las filas del registro de prueba no se quedan en la base de datos. Devuelve una fila por
-- comprobación: ok = true si pasa; detalle dice qué falló.
--
-- Cómo se actúa como alguien: como en seguridad.sql, pg_temp.con_sesion() pone el rol
-- `authenticated` y la sesión de un usuario, y `reset role` vuelve al rol de quien ejecuta.
--
-- Los planes de prueba van en semanas de 2099 para no chocar con planes reales: un lunes solo puede
-- tener un plan.

begin;

create temp table resultados (
  orden serial primary key,
  prueba text not null,
  ok boolean not null,
  detalle text
) on commit drop;

create function pg_temp.con_sesion(usuario uuid) returns void
language sql
as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims',
                    json_build_object('sub', usuario, 'role', 'authenticated')::text, true);
$$;

-- Un plan y una pieza en la forma que manda la app: columnas en snake_case, fechas `YYYY-MM-DD` y
-- horas `HH:MM`.
create function pg_temp.plan(lunes text, dia_d text) returns jsonb
language sql
as $$
  select jsonb_build_object('lunes', lunes, 'dia_d', dia_d, 'con_episodio', true, 'numero', '99',
                            'invitado', 'Invitado de prueba', 'tema', null,
                            'estrategia_id', '00000000-0000-4000-8000-0000000000c1',
                            'estrategia_nombre', 'Estrategia de prueba');
$$;

create function pg_temp.pieza(nombre text, desplazamiento int, fecha text, hora text default null)
returns jsonb
language sql
as $$
  select jsonb_build_object('pieza_id', '00000000-0000-4000-8000-0000000000b1', 'nombre', nombre,
                            'nombre_corto', nombre, 'formato', 'reel',
                            'canales', jsonb_build_array('ig', 'tiktok'), 'dias_preparacion', 2,
                            'desplazamiento', desplazamiento, 'fecha', fecha, 'hora', hora);
$$;

-- Todo lo de un plan en un jsonb (sus columnas, sus piezas y cuántas anotaciones tienen en el
-- registro), para comprobar que una llamada no lo ha cambiado.
create function pg_temp.foto(id_plan uuid) returns jsonb
language sql
as $$
  select to_jsonb(p)
         || jsonb_build_object(
              'piezas', (select jsonb_agg(to_jsonb(pp) order by pp.id)
                           from public.plan_piezas as pp
                          where pp.plan_id = p.id),
              'anotaciones', (select count(*)
                                from public.registro as r
                               where r.fila_id = p.id
                                  or r.fila_id in (select pp.id
                                                     from public.plan_piezas as pp
                                                    where pp.plan_id = p.id)))
    from public.planes as p
   where p.id = id_plan;
$$;

-- Un usuario de prueba, con un correo de un dominio que no puede existir (.invalid), y una pieza y
-- dos estrategias de prueba (se crean sin sesión: no son lo que se prueba).
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000a1', 'prueba@ejemplo.invalid');

insert into public.piezas (id, nombre, nombre_corto, formato, canales, dias_permitidos,
                           dias_preparacion)
values ('00000000-0000-4000-8000-0000000000b1', 'T9 · Pieza de prueba', 'Pieza de prueba', 'reel',
        '{ig,tiktok}', '{-1,0,1,2,3,4,5}', 2);

insert into public.estrategias (id, nombre, con_episodio) values
  ('00000000-0000-4000-8000-0000000000c1', 'Estrategia de prueba', true),
  ('00000000-0000-4000-8000-0000000000c2', 'Otra estrategia de prueba', true);

-- 1. crear_plan crea el plan y sus piezas (pendientes y sin revisar, aunque el jsonb diga otra cosa)
--    y el registro anota quién lo hizo.
do $$
declare
  prueba text := 'crear_plan crea el plan y sus piezas pendientes, y el registro anota quién';
  plan_json jsonb := pg_temp.plan('2099-03-02', '2099-03-06');
  piezas_json jsonb := jsonb_build_array(
    pg_temp.pieza('Pieza A', -1, '2099-03-05', '18:00'),
    pg_temp.pieza('Pieza B', 0, '2099-03-06') || '{"estado": "programada", "revisar": true}');
  plan_esperado jsonb := '{"lunes": "2099-03-02", "dia_d": "2099-03-06", "con_episodio": true,
    "numero": "99", "invitado": "Invitado de prueba", "tema": null,
    "estrategia_id": "00000000-0000-4000-8000-0000000000c1",
    "estrategia_nombre": "Estrategia de prueba", "hora_episodio": null}';
  piezas_esperadas jsonb := '[
    {"pieza_id": "00000000-0000-4000-8000-0000000000b1", "nombre": "Pieza A",
     "nombre_corto": "Pieza A", "formato": "reel", "canales": ["ig", "tiktok"],
     "dias_preparacion": 2, "desplazamiento": -1, "fecha": "2099-03-05", "hora": "18:00:00",
     "estado": "pendiente", "revisar": false},
    {"pieza_id": "00000000-0000-4000-8000-0000000000b1", "nombre": "Pieza B",
     "nombre_corto": "Pieza B", "formato": "reel", "canales": ["ig", "tiktok"],
     "dias_preparacion": 2, "desplazamiento": 0, "fecha": "2099-03-06", "hora": null,
     "estado": "pendiente", "revisar": false}]';
  id_plan uuid;
  plan_creado jsonb;
  piezas_creadas jsonb;
  anotaciones text;
  fallos text[] := '{}';
begin
  perform pg_temp.con_sesion('00000000-0000-4000-8000-0000000000a1');
  id_plan := public.crear_plan(plan_json, piezas_json);
  select to_jsonb(p) - 'id' into plan_creado from public.planes as p where p.id = id_plan;
  select jsonb_agg(to_jsonb(pp) - 'id' - 'plan_id' order by pp.fecha)
    into piezas_creadas
    from public.plan_piezas as pp
   where pp.plan_id = id_plan;
  select string_agg(r.tabla || ':' || r.accion
                      || case when r.usuario_id = '00000000-0000-4000-8000-0000000000a1'
                              then '' else ':otro usuario' end,
                    ',' order by r.tabla)
    into anotaciones
    from public.registro as r
   where r.fila_id = id_plan
      or r.fila_id in (select pp.id from public.plan_piezas as pp where pp.plan_id = id_plan);
  reset role;
  if plan_creado is distinct from plan_esperado then
    fallos := fallos || ('plan ' || coalesce(plan_creado::text, 'ninguno'));
  end if;
  if piezas_creadas is distinct from piezas_esperadas then
    fallos := fallos || ('piezas ' || coalesce(piezas_creadas::text, 'ninguna'));
  end if;
  if anotaciones is distinct from 'plan_piezas:crear,plan_piezas:crear,planes:crear' then
    fallos := fallos || ('registro ' || coalesce(anotaciones, 'vacío'));
  end if;
  insert into resultados (prueba, ok, detalle)
  values (prueba, cardinality(fallos) = 0, array_to_string(fallos, '; '));
exception when others then
  insert into resultados (prueba, ok, detalle) values (prueba, false, sqlerrm);
end $$;

-- 2. Crear dos veces el mismo lunes (doble pulsación o dos personas a la vez): la segunda da
--    semana_con_plan y no deja ni plan ni piezas.
do $$
declare
  prueba text := 'crear_plan dos veces el mismo lunes: la segunda da semana_con_plan y no deja filas';
  plan_json jsonb := pg_temp.plan('2099-03-09', '2099-03-13');
  primera jsonb := jsonb_build_array(pg_temp.pieza('Primera', 0, '2099-03-13'));
  segunda jsonb := jsonb_build_array(pg_temp.pieza('Segunda', 0, '2099-03-13'),
                                     pg_temp.pieza('Segunda', 1, '2099-03-14'));
  error_segunda text;
  planes_semana int;
  piezas_semana text;
begin
  perform pg_temp.con_sesion('00000000-0000-4000-8000-0000000000a1');
  perform public.crear_plan(plan_json, primera);
  begin
    perform public.crear_plan(plan_json, segunda);
  exception when others then
    error_segunda := sqlstate || ' ' || sqlerrm;
  end;
  select count(*) into planes_semana from public.planes where lunes = '2099-03-09';
  select string_agg(pp.nombre, ',')
    into piezas_semana
    from public.plan_piezas as pp
    join public.planes as p on p.id = pp.plan_id
   where p.lunes = '2099-03-09';
  reset role;
  insert into resultados (prueba, ok, detalle)
  values (prueba,
          coalesce(error_segunda = 'P0001 semana_con_plan' and planes_semana = 1
                   and piezas_semana = 'Primera', false),
          format('error %s; %s planes; piezas %s', coalesce(error_segunda, 'ninguno'),
                 planes_semana, coalesce(piezas_semana, 'ninguna')));
exception when others then
  insert into resultados (prueba, ok, detalle) values (prueba, false, sqlerrm);
end $$;

-- 3. Mover un plan a otra semana corre D y todas las piezas los mismos días. La programada vuelve a
--    pendiente con revisar; las pendientes conservan su marca; el plan pasa al lunes de la nueva
--    semana; el registro anota cada cambio con quien lo hizo.
do $$
declare
  prueba text := 'mover_plan corre D y las piezas; la programada vuelve a pendiente con revisar';
  piezas_json jsonb := jsonb_build_array(
    pg_temp.pieza('Programada', -1, '2099-03-19', '18:00'),
    pg_temp.pieza('Pendiente', 0, '2099-03-20', '19:30'),
    pg_temp.pieza('Pendiente con revisar', 4, '2099-03-24'));
  piezas_esperadas jsonb := '{
    "Programada": {"fecha": "2099-03-23", "hora": "18:00:00", "estado": "pendiente",
                   "revisar": true},
    "Pendiente": {"fecha": "2099-03-24", "hora": "19:30:00", "estado": "pendiente",
                  "revisar": false},
    "Pendiente con revisar": {"fecha": "2099-03-28", "hora": null, "estado": "pendiente",
                              "revisar": true}}';
  cambio_plan_esperado jsonb := '{"lunes": {"antes": "2099-03-16", "despues": "2099-03-23"},
                                  "dia_d": {"antes": "2099-03-20", "despues": "2099-03-24"}}';
  id_plan uuid;
  plan_movido jsonb;
  piezas_movidas jsonb;
  cambio_plan jsonb;
  anotaciones text;
  fallos text[] := '{}';
begin
  perform pg_temp.con_sesion('00000000-0000-4000-8000-0000000000a1');
  id_plan := public.crear_plan(pg_temp.plan('2099-03-16', '2099-03-20'), piezas_json);
  update public.plan_piezas set estado = 'programada'
   where plan_id = id_plan and nombre = 'Programada';
  update public.plan_piezas set revisar = true
   where plan_id = id_plan and nombre = 'Pendiente con revisar';
  -- Del viernes 20 al martes 24: cuatro días más, en la semana siguiente.
  perform public.mover_plan(id_plan, '2099-03-24');
  select jsonb_build_object('lunes', p.lunes, 'dia_d', p.dia_d)
    into plan_movido
    from public.planes as p
   where p.id = id_plan;
  select jsonb_object_agg(pp.nombre, jsonb_build_object('fecha', pp.fecha, 'hora', pp.hora,
                                                        'estado', pp.estado,
                                                        'revisar', pp.revisar))
    into piezas_movidas
    from public.plan_piezas as pp
   where pp.plan_id = id_plan;
  select r.detalle into cambio_plan
    from public.registro as r
   where r.fila_id = id_plan and r.accion = 'editar';
  select string_agg(r.accion || ':' || pp.nombre
                      || case when r.usuario_id = '00000000-0000-4000-8000-0000000000a1'
                              then '' else ':otro usuario' end,
                    ',' order by pp.nombre)
    into anotaciones
    from public.registro as r
    join public.plan_piezas as pp on pp.id = r.fila_id
   where pp.plan_id = id_plan and r.accion in ('mover', 'volver_a_pendiente');
  reset role;
  if plan_movido is distinct from '{"lunes": "2099-03-23", "dia_d": "2099-03-24"}' then
    fallos := fallos || ('plan ' || coalesce(plan_movido::text, 'ninguno'));
  end if;
  if piezas_movidas is distinct from piezas_esperadas then
    fallos := fallos || ('piezas ' || coalesce(piezas_movidas::text, 'ninguna'));
  end if;
  if cambio_plan is distinct from cambio_plan_esperado then
    fallos := fallos || ('registro del plan ' || coalesce(cambio_plan::text, 'vacío'));
  end if;
  if anotaciones is distinct from
       'mover:Pendiente,mover:Pendiente con revisar,volver_a_pendiente:Programada' then
    fallos := fallos || ('registro de las piezas ' || coalesce(anotaciones, 'vacío'));
  end if;
  insert into resultados (prueba, ok, detalle)
  values (prueba, cardinality(fallos) = 0, array_to_string(fallos, '; '));
exception when others then
  insert into resultados (prueba, ok, detalle) values (prueba, false, sqlerrm);
end $$;

-- 4. Mover un plan a una semana que ya tiene otro: semana_con_plan y no cambia nada (ni el plan, ni
--    sus piezas, ni el registro).
do $$
declare
  prueba text := 'mover_plan a una semana que ya tiene plan da semana_con_plan y no cambia nada';
  id_plan uuid;
  antes jsonb;
  despues jsonb;
  error_mover text;
begin
  perform pg_temp.con_sesion('00000000-0000-4000-8000-0000000000a1');
  id_plan := public.crear_plan(pg_temp.plan('2099-04-06', '2099-04-10'),
                               jsonb_build_array(pg_temp.pieza('Programada', 0, '2099-04-10', '18:00'),
                                                 pg_temp.pieza('Pendiente', 1, '2099-04-11')));
  perform public.crear_plan(pg_temp.plan('2099-04-13', '2099-04-17'), '[]');
  update public.plan_piezas set estado = 'programada'
   where plan_id = id_plan and nombre = 'Programada';
  antes := pg_temp.foto(id_plan);
  begin
    perform public.mover_plan(id_plan, '2099-04-15');
  exception when others then
    error_mover := sqlstate || ' ' || sqlerrm;
  end;
  despues := pg_temp.foto(id_plan);
  reset role;
  insert into resultados (prueba, ok, detalle)
  values (prueba,
          coalesce(error_mover = 'P0001 semana_con_plan' and antes is not null
                   and despues = antes, false),
          format('error %s; %s', coalesce(error_mover, 'ninguno'),
                 case when antes is not null and despues = antes then 'sin cambios'
                      else format('antes %s; después %s', coalesce(antes::text, 'nada'),
                                  coalesce(despues::text, 'nada')) end));
exception when others then
  insert into resultados (prueba, ok, detalle) values (prueba, false, sqlerrm);
end $$;

-- 5. Mover al mismo día no cambia nada: la programada sigue programada y el registro no anota nada.
do $$
declare
  prueba text := 'mover_plan al mismo día D no cambia nada';
  id_plan uuid;
  antes jsonb;
  despues jsonb;
begin
  perform pg_temp.con_sesion('00000000-0000-4000-8000-0000000000a1');
  id_plan := public.crear_plan(pg_temp.plan('2099-04-20', '2099-04-24'),
                               jsonb_build_array(pg_temp.pieza('Programada', 0, '2099-04-24')));
  update public.plan_piezas set estado = 'programada' where plan_id = id_plan;
  antes := pg_temp.foto(id_plan);
  perform public.mover_plan(id_plan, '2099-04-24');
  despues := pg_temp.foto(id_plan);
  reset role;
  insert into resultados (prueba, ok, detalle)
  values (prueba, coalesce(antes is not null and despues = antes, false),
          case when antes is not null and despues = antes then 'sin cambios'
               else format('antes %s; después %s', coalesce(antes::text, 'nada'),
                           coalesce(despues::text, 'nada')) end);
exception when others then
  insert into resultados (prueba, ok, detalle) values (prueba, false, sqlerrm);
end $$;

-- 6. Con un plan que no existe (otra persona lo acaba de borrar), mover_plan y cambiar_estrategia
--    dan plan_no_existe.
do $$
declare
  prueba text := 'mover_plan y cambiar_estrategia de un plan que no existe dan plan_no_existe';
  error_mover text;
  error_cambiar text;
begin
  perform pg_temp.con_sesion('00000000-0000-4000-8000-0000000000a1');
  begin
    perform public.mover_plan('00000000-0000-4000-8000-0000000000f0', '2099-05-01');
  exception when others then
    error_mover := sqlstate || ' ' || sqlerrm;
  end;
  begin
    perform public.cambiar_estrategia('00000000-0000-4000-8000-0000000000f0',
                                      '00000000-0000-4000-8000-0000000000c2',
                                      'Otra estrategia de prueba',
                                      jsonb_build_array(pg_temp.pieza('Nueva', 0, '2099-05-01')));
  exception when others then
    error_cambiar := sqlstate || ' ' || sqlerrm;
  end;
  reset role;
  insert into resultados (prueba, ok, detalle)
  values (prueba,
          coalesce(error_mover = 'P0001 plan_no_existe'
                   and error_cambiar = 'P0001 plan_no_existe', false),
          format('mover: %s; cambiar: %s', coalesce(error_mover, 'sin error'),
                 coalesce(error_cambiar, 'sin error')));
exception when others then
  insert into resultados (prueba, ok, detalle) values (prueba, false, sqlerrm);
end $$;

-- 7. Cambiar de estrategia sustituye todas las piezas (también las programadas) y la estrategia del
--    plan; el registro anota el borrado de cada vieja, el alta de cada nueva y el cambio del plan.
do $$
declare
  prueba text := 'cambiar_estrategia sustituye las piezas y la estrategia; el registro anota cada cambio';
  piezas_nuevas_json jsonb := jsonb_build_array(
    pg_temp.pieza('Nueva', 0, '2099-05-01', '18:00'),
    pg_temp.pieza('Nueva', 2, '2099-05-03'),
    pg_temp.pieza('Nueva', 4, '2099-05-05'));
  cambio_plan_esperado jsonb := '{
    "estrategia_id": {"antes": "00000000-0000-4000-8000-0000000000c1",
                      "despues": "00000000-0000-4000-8000-0000000000c2"},
    "estrategia_nombre": {"antes": "Estrategia de prueba",
                          "despues": "Otra estrategia de prueba"}}';
  id_plan uuid;
  viejas uuid[];
  nuevas uuid[];
  quedan_viejas int;
  fechas_nuevas text;
  estrategia jsonb;
  cambio_plan jsonb;
  borrados int;
  creados int;
  de_otro int;
  fallos text[] := '{}';
begin
  perform pg_temp.con_sesion('00000000-0000-4000-8000-0000000000a1');
  id_plan := public.crear_plan(pg_temp.plan('2099-04-27', '2099-05-01'),
                               jsonb_build_array(pg_temp.pieza('Vieja', -1, '2099-04-30'),
                                                 pg_temp.pieza('Vieja', 0, '2099-05-01')));
  update public.plan_piezas set estado = 'programada' where plan_id = id_plan and desplazamiento = 0;
  select array_agg(pp.id) into viejas from public.plan_piezas as pp where pp.plan_id = id_plan;
  perform public.cambiar_estrategia(id_plan, '00000000-0000-4000-8000-0000000000c2',
                                    'Otra estrategia de prueba', piezas_nuevas_json);
  select array_agg(pp.id),
         string_agg(pp.nombre || ' ' || pp.fecha || ' ' || coalesce(pp.hora::text, '-') || ' '
                      || pp.estado, ',' order by pp.fecha)
    into nuevas, fechas_nuevas
    from public.plan_piezas as pp
   where pp.plan_id = id_plan;
  select count(*) into quedan_viejas from public.plan_piezas as pp where pp.id = any (viejas);
  select jsonb_build_object('estrategia_id', p.estrategia_id,
                            'estrategia_nombre', p.estrategia_nombre)
    into estrategia
    from public.planes as p
   where p.id = id_plan;
  select r.detalle into cambio_plan
    from public.registro as r
   where r.fila_id = id_plan and r.accion = 'editar';
  select count(*) filter (where r.accion = 'borrar' and r.fila_id = any (viejas)),
         count(*) filter (where r.accion = 'crear' and r.fila_id = any (nuevas)),
         count(*) filter (where r.usuario_id is distinct from '00000000-0000-4000-8000-0000000000a1')
    into borrados, creados, de_otro
    from public.registro as r
   where r.fila_id = any (viejas || nuevas);
  reset role;
  if quedan_viejas <> 0 then
    fallos := fallos || format('quedan %s piezas viejas', quedan_viejas);
  end if;
  if fechas_nuevas is distinct from
       'Nueva 2099-05-01 18:00:00 pendiente,Nueva 2099-05-03 - pendiente,Nueva 2099-05-05 - pendiente' then
    fallos := fallos || ('piezas nuevas ' || coalesce(fechas_nuevas, 'ninguna'));
  end if;
  if estrategia is distinct from '{"estrategia_id": "00000000-0000-4000-8000-0000000000c2",
                                   "estrategia_nombre": "Otra estrategia de prueba"}' then
    fallos := fallos || ('estrategia ' || coalesce(estrategia::text, 'ninguna'));
  end if;
  if cambio_plan is distinct from cambio_plan_esperado then
    fallos := fallos || ('registro del plan ' || coalesce(cambio_plan::text, 'vacío'));
  end if;
  if (borrados, creados, de_otro) is distinct from (2, 3, 0) then
    fallos := fallos || format('registro de las piezas: %s borrar, %s crear, %s de otro usuario',
                               borrados, creados, de_otro);
  end if;
  insert into resultados (prueba, ok, detalle)
  values (prueba, cardinality(fallos) = 0, array_to_string(fallos, '; '));
exception when others then
  insert into resultados (prueba, ok, detalle) values (prueba, false, sqlerrm);
end $$;

-- 8. Solo con sesión: ni PUBLIC (todos los roles) ni anon pueden ejecutar las funciones, y
--    authenticated sí. Sin sesión, la llamada se rechaza antes de entrar en la función.
do $$
declare
  prueba text := 'crear_plan, mover_plan, mover_episodio y cambiar_estrategia solo se ejecutan con sesión';
  plan_json jsonb := pg_temp.plan('2099-05-04', '2099-05-08');
  funcion text;
  fallos text[] := '{}';
begin
  foreach funcion in array array['public.crear_plan(jsonb, jsonb)', 'public.mover_plan(uuid, date)',
                                 'public.mover_episodio(uuid, date)',
                                 'public.cambiar_estrategia(uuid, uuid, text, jsonb)'] loop
    if has_function_privilege('public', funcion, 'execute') then
      fallos := fallos || ('public puede ejecutar ' || funcion);
    end if;
    if has_function_privilege('anon', funcion, 'execute') then
      fallos := fallos || ('anon puede ejecutar ' || funcion);
    end if;
    if not has_function_privilege('authenticated', funcion, 'execute') then
      fallos := fallos || ('authenticated no puede ejecutar ' || funcion);
    end if;
  end loop;
  set local role anon;
  begin
    perform public.crear_plan(plan_json, '[]');
    fallos := fallos || 'anon ha ejecutado crear_plan'::text;
  exception when insufficient_privilege then
    if sqlerrm not like 'permission denied for function crear_plan%' then
      fallos := fallos || ('crear_plan: ' || sqlerrm);
    end if;
  end;
  begin
    perform public.mover_plan('00000000-0000-4000-8000-0000000000f0', '2099-05-08');
    fallos := fallos || 'anon ha ejecutado mover_plan'::text;
  exception when insufficient_privilege then
    if sqlerrm not like 'permission denied for function mover_plan%' then
      fallos := fallos || ('mover_plan: ' || sqlerrm);
    end if;
  end;
  begin
    perform public.mover_episodio('00000000-0000-4000-8000-0000000000f0', '2099-05-08');
    fallos := fallos || 'anon ha ejecutado mover_episodio'::text;
  exception when insufficient_privilege then
    if sqlerrm not like 'permission denied for function mover_episodio%' then
      fallos := fallos || ('mover_episodio: ' || sqlerrm);
    end if;
  end;
  begin
    perform public.cambiar_estrategia('00000000-0000-4000-8000-0000000000f0', null, 'Prueba', '[]');
    fallos := fallos || 'anon ha ejecutado cambiar_estrategia'::text;
  exception when insufficient_privilege then
    if sqlerrm not like 'permission denied for function cambiar_estrategia%' then
      fallos := fallos || ('cambiar_estrategia: ' || sqlerrm);
    end if;
  end;
  reset role;
  insert into resultados (prueba, ok, detalle)
  values (prueba, cardinality(fallos) = 0, array_to_string(fallos, '; '));
exception when others then
  insert into resultados (prueba, ok, detalle) values (prueba, false, sqlerrm);
end $$;

-- 9. crear_plan guarda la hora del episodio (llega `HH:MM`, la base la da con segundos).
do $$
declare
  prueba text := 'crear_plan guarda hora_episodio';
  id_plan uuid;
  hora time;
begin
  perform pg_temp.con_sesion('00000000-0000-4000-8000-0000000000a1');
  id_plan := public.crear_plan(pg_temp.plan('2099-06-01', '2099-06-05')
                                 || '{"hora_episodio": "19:00"}', '[]');
  select p.hora_episodio into hora from public.planes as p where p.id = id_plan;
  reset role;
  insert into resultados (prueba, ok, detalle)
  values (prueba, coalesce(hora = '19:00', false), 'hora_episodio ' || coalesce(hora::text, 'null'));
exception when others then
  insert into resultados (prueba, ok, detalle) values (prueba, false, sqlerrm);
end $$;

-- 10. Sin la clave hora_episodio (como lo manda el código publicado antes de esta columna), el plan
--     se crea igual y la hora queda en null.
do $$
declare
  prueba text := 'crear_plan sin la clave hora_episodio deja la hora en null';
  id_plan uuid;
  hora time;
  tiene_columna boolean;
begin
  perform pg_temp.con_sesion('00000000-0000-4000-8000-0000000000a1');
  id_plan := public.crear_plan(pg_temp.plan('2099-06-08', '2099-06-12'), '[]');
  select p.hora_episodio into hora from public.planes as p where p.id = id_plan;
  reset role;
  tiene_columna := exists (select 1
                             from information_schema.columns
                            where table_schema = 'public' and table_name = 'planes'
                              and column_name = 'hora_episodio');
  insert into resultados (prueba, ok, detalle)
  values (prueba, id_plan is not null and tiene_columna and hora is null,
          format('plan %s; columna %s; hora_episodio %s',
                 case when id_plan is null then 'no creado' else 'creado' end,
                 case when tiene_columna then 'existe' else 'no existe' end,
                 coalesce(hora::text, 'null')));
exception when others then
  insert into resultados (prueba, ok, detalle) values (prueba, false, sqlerrm);
end $$;

-- 11. Una estrategia admite piezas de D-7 a D+14 y rechaza las de fuera (D-8 y D+15).
do $$
declare
  prueba text := 'estrategia_piezas admite de -7 a 14 y rechaza -8 y 15';
  desplazamiento int;
  fallos text[] := '{}';
begin
  perform pg_temp.con_sesion('00000000-0000-4000-8000-0000000000a1');
  foreach desplazamiento in array array[-7, 14] loop
    begin
      insert into public.estrategia_piezas (estrategia_id, pieza_id, desplazamiento)
      values ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000b1',
              desplazamiento);
    exception when others then
      fallos := fallos || format('%s rechazado: %s', desplazamiento, sqlerrm);
    end;
  end loop;
  foreach desplazamiento in array array[-8, 15] loop
    begin
      insert into public.estrategia_piezas (estrategia_id, pieza_id, desplazamiento)
      values ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000b1',
              desplazamiento);
      fallos := fallos || format('%s admitido', desplazamiento);
    exception when check_violation then
      null;
    end;
  end loop;
  reset role;
  insert into resultados (prueba, ok, detalle)
  values (prueba, cardinality(fallos) = 0, array_to_string(fallos, '; '));
exception when others then
  insert into resultados (prueba, ok, detalle) values (prueba, false, sqlerrm);
end $$;

-- 12. Mover solo el episodio a otra semana cambia D y el lunes del plan, deja la fecha, la hora, el
--     estado y la marca de revisar de cada post, y recalcula su desplazamiento (días de D a su fecha).
do $$
declare
  prueba text := 'mover_episodio cambia D y lunes, deja los posts y recalcula su desplazamiento';
  piezas_json jsonb := jsonb_build_array(
    pg_temp.pieza('Programada', -1, '2099-06-18', '18:00'),
    pg_temp.pieza('Pendiente', 0, '2099-06-19', '19:30'),
    pg_temp.pieza('Pendiente con revisar', 4, '2099-06-23'));
  piezas_esperadas jsonb := '{
    "Programada": {"desplazamiento": -6, "fecha": "2099-06-18", "hora": "18:00:00",
                   "estado": "programada", "revisar": false},
    "Pendiente": {"desplazamiento": -5, "fecha": "2099-06-19", "hora": "19:30:00",
                  "estado": "pendiente", "revisar": false},
    "Pendiente con revisar": {"desplazamiento": -1, "fecha": "2099-06-23", "hora": null,
                              "estado": "pendiente", "revisar": true}}';
  id_plan uuid;
  plan_movido jsonb;
  piezas_movidas jsonb;
  fallos text[] := '{}';
begin
  perform pg_temp.con_sesion('00000000-0000-4000-8000-0000000000a1');
  id_plan := public.crear_plan(pg_temp.plan('2099-06-15', '2099-06-19'), piezas_json);
  update public.plan_piezas set estado = 'programada'
   where plan_id = id_plan and nombre = 'Programada';
  update public.plan_piezas set revisar = true
   where plan_id = id_plan and nombre = 'Pendiente con revisar';
  -- Del viernes 19 al miércoles 24: el episodio pasa a la semana siguiente y los posts se quedan.
  perform public.mover_episodio(id_plan, '2099-06-24');
  select jsonb_build_object('lunes', p.lunes, 'dia_d', p.dia_d)
    into plan_movido
    from public.planes as p
   where p.id = id_plan;
  select jsonb_object_agg(pp.nombre, jsonb_build_object('desplazamiento', pp.desplazamiento,
                                                        'fecha', pp.fecha, 'hora', pp.hora,
                                                        'estado', pp.estado,
                                                        'revisar', pp.revisar))
    into piezas_movidas
    from public.plan_piezas as pp
   where pp.plan_id = id_plan;
  reset role;
  if plan_movido is distinct from '{"lunes": "2099-06-22", "dia_d": "2099-06-24"}' then
    fallos := fallos || ('plan ' || coalesce(plan_movido::text, 'ninguno'));
  end if;
  if piezas_movidas is distinct from piezas_esperadas then
    fallos := fallos || ('piezas ' || coalesce(piezas_movidas::text, 'ninguna'));
  end if;
  insert into resultados (prueba, ok, detalle)
  values (prueba, cardinality(fallos) = 0, array_to_string(fallos, '; '));
exception when others then
  insert into resultados (prueba, ok, detalle) values (prueba, false, sqlerrm);
end $$;

-- 13. Mover el episodio a una semana que ya tiene otro plan: semana_con_plan y no cambia nada (ni
--     el plan, ni sus posts, ni el registro).
do $$
declare
  prueba text := 'mover_episodio a una semana que ya tiene plan da semana_con_plan y no cambia nada';
  id_plan uuid;
  antes jsonb;
  despues jsonb;
  error_mover text;
begin
  perform pg_temp.con_sesion('00000000-0000-4000-8000-0000000000a1');
  id_plan := public.crear_plan(pg_temp.plan('2099-06-29', '2099-07-03'),
                               jsonb_build_array(pg_temp.pieza('Programada', 0, '2099-07-03', '18:00'),
                                                 pg_temp.pieza('Pendiente', 1, '2099-07-04')));
  perform public.crear_plan(pg_temp.plan('2099-07-06', '2099-07-10'), '[]');
  update public.plan_piezas set estado = 'programada'
   where plan_id = id_plan and nombre = 'Programada';
  antes := pg_temp.foto(id_plan);
  begin
    perform public.mover_episodio(id_plan, '2099-07-08');
  exception when others then
    error_mover := sqlstate || ' ' || sqlerrm;
  end;
  despues := pg_temp.foto(id_plan);
  reset role;
  insert into resultados (prueba, ok, detalle)
  values (prueba,
          coalesce(error_mover = 'P0001 semana_con_plan' and antes is not null
                   and despues = antes, false),
          format('error %s; %s', coalesce(error_mover, 'ninguno'),
                 case when antes is not null and despues = antes then 'sin cambios'
                      else format('antes %s; después %s', coalesce(antes::text, 'nada'),
                                  coalesce(despues::text, 'nada')) end));
exception when others then
  insert into resultados (prueba, ok, detalle) values (prueba, false, sqlerrm);
end $$;

-- 14. Mover el episodio al mismo día no cambia nada: ni el plan, ni sus posts, ni el registro.
do $$
declare
  prueba text := 'mover_episodio al mismo día D no cambia nada';
  id_plan uuid;
  antes jsonb;
  despues jsonb;
begin
  perform pg_temp.con_sesion('00000000-0000-4000-8000-0000000000a1');
  id_plan := public.crear_plan(pg_temp.plan('2099-07-13', '2099-07-17'),
                               jsonb_build_array(pg_temp.pieza('Programada', 0, '2099-07-17')));
  update public.plan_piezas set estado = 'programada' where plan_id = id_plan;
  antes := pg_temp.foto(id_plan);
  perform public.mover_episodio(id_plan, '2099-07-17');
  despues := pg_temp.foto(id_plan);
  reset role;
  insert into resultados (prueba, ok, detalle)
  values (prueba, coalesce(antes is not null and despues = antes, false),
          case when antes is not null and despues = antes then 'sin cambios'
               else format('antes %s; después %s', coalesce(antes::text, 'nada'),
                           coalesce(despues::text, 'nada')) end);
exception when others then
  insert into resultados (prueba, ok, detalle) values (prueba, false, sqlerrm);
end $$;

-- 15. Con un plan que no existe (otra persona lo acaba de borrar), mover_episodio da plan_no_existe.
do $$
declare
  prueba text := 'mover_episodio de un plan que no existe da plan_no_existe';
  error_mover text;
begin
  perform pg_temp.con_sesion('00000000-0000-4000-8000-0000000000a1');
  begin
    perform public.mover_episodio('00000000-0000-4000-8000-0000000000f0', '2099-07-24');
  exception when others then
    error_mover := sqlstate || ' ' || sqlerrm;
  end;
  reset role;
  insert into resultados (prueba, ok, detalle)
  values (prueba, coalesce(error_mover = 'P0001 plan_no_existe', false),
          coalesce(error_mover, 'sin error'));
exception when others then
  insert into resultados (prueba, ok, detalle) values (prueba, false, sqlerrm);
end $$;

-- 16. Mover solo el episodio no anota nada en sus posts: solo cambia su desplazamiento, y el post
--     sigue igual para quien lo mira (migración registro_sin_desplazamiento). En el plan sí anota el
--     cambio de D y lunes. Mover después un post de verdad (su fecha, con su desplazamiento, como
--     editarPiezaDePlan) sigue anotando «mover».
do $$
declare
  prueba text := 'mover_episodio no anota nada en los posts y sí en el plan; mover un post anota mover';
  cambio_plan_esperado jsonb := '{"lunes": {"antes": "2099-08-03", "despues": "2099-08-10"},
                                  "dia_d": {"antes": "2099-08-07", "despues": "2099-08-12"}}';
  mover_esperado jsonb := '{"fecha": {"antes": "2099-08-08", "despues": "2099-08-09"},
                            "desplazamiento": {"antes": -4, "despues": -3}}';
  id_plan uuid;
  id_post uuid;
  posts_antes int;
  posts_despues int;
  ediciones_plan int;
  cambio_plan jsonb;
  anotaciones_post text;
  detalle_mover jsonb;
  fallos text[] := '{}';
begin
  perform pg_temp.con_sesion('00000000-0000-4000-8000-0000000000a1');
  id_plan := public.crear_plan(pg_temp.plan('2099-08-03', '2099-08-07'),
                               jsonb_build_array(pg_temp.pieza('Programada', 0, '2099-08-07', '18:00'),
                                                 pg_temp.pieza('Pendiente', 1, '2099-08-08')));
  update public.plan_piezas set estado = 'programada'
   where plan_id = id_plan and nombre = 'Programada';
  select pp.id into id_post from public.plan_piezas as pp
   where pp.plan_id = id_plan and pp.nombre = 'Pendiente';
  select count(*) into posts_antes
    from public.registro as r
   where r.fila_id in (select pp.id from public.plan_piezas as pp where pp.plan_id = id_plan);
  -- Del viernes 7 al miércoles 12: el episodio pasa a la semana siguiente y los posts se quedan.
  perform public.mover_episodio(id_plan, '2099-08-12');
  select count(*) into posts_despues
    from public.registro as r
   where r.fila_id in (select pp.id from public.plan_piezas as pp where pp.plan_id = id_plan);
  select count(*), (array_agg(r.detalle))[1]
    into ediciones_plan, cambio_plan
    from public.registro as r
   where r.fila_id = id_plan and r.accion = 'editar';
  -- Mover de verdad el post pendiente, del sábado 8 al domingo 9 (D-4 pasa a D-3).
  update public.plan_piezas set fecha = '2099-08-09', desplazamiento = -3 where id = id_post;
  select string_agg(r.accion, ',' order by r.accion), (array_agg(r.detalle) filter (where r.accion = 'mover'))[1]
    into anotaciones_post, detalle_mover
    from public.registro as r
   where r.fila_id = id_post;
  reset role;
  if posts_despues is distinct from posts_antes then
    fallos := fallos || format('los posts tenían %s anotaciones y ahora %s', posts_antes, posts_despues);
  end if;
  if ediciones_plan <> 1 or cambio_plan is distinct from cambio_plan_esperado then
    fallos := fallos || format('registro del plan: %s ediciones, %s', ediciones_plan,
                               coalesce(cambio_plan::text, 'vacío'));
  end if;
  if anotaciones_post is distinct from 'crear,mover' or detalle_mover is distinct from mover_esperado then
    fallos := fallos || format('registro del post movido: %s, %s', coalesce(anotaciones_post, 'vacío'),
                               coalesce(detalle_mover::text, 'sin mover'));
  end if;
  insert into resultados (prueba, ok, detalle)
  values (prueba, cardinality(fallos) = 0, array_to_string(fallos, '; '));
exception when others then
  insert into resultados (prueba, ok, detalle) values (prueba, false, sqlerrm);
end $$;

select prueba, ok, detalle from resultados order by orden;

rollback;
