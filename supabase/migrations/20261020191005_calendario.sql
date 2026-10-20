-- Base del calendario (docs/rediseno-calendario.md § Base de datos): la hora del episodio,
-- estrategias de D-7 a D+14 y mover solo el episodio sin mover sus posts.
--
-- La base la comparten preview y producción: aquí solo se añade una columna opcional, se amplía un
-- límite y se sustituye crear_plan por una versión compatible (sin la clave hora_episodio funciona
-- como antes). El código publicado sigue funcionando. No se borra ni se reescribe ningún dato.

-- Hora del episodio (`time` de reloj en Europe/Madrid, como plan_piezas.hora). Opcional: los planes
-- que ya hay y los que cree el código publicado se quedan sin hora.
alter table public.planes add column hora_episodio time;

-- Las estrategias pueden poner piezas de D-7 a D+14 (antes, de D-1 a D+5). Se sustituye la
-- restricción por otra más amplia con el mismo nombre, en una sola sentencia; las filas que hay
-- (todas de -1 a 5) la cumplen. plan_piezas.desplazamiento no tiene límite: un post llevado a mano
-- puede quedar a cualquier distancia del episodio.
alter table public.estrategia_piezas
  drop constraint estrategia_piezas_desplazamiento_check,
  add constraint estrategia_piezas_desplazamiento_check check (desplazamiento between -7 and 14);

-- crear_plan, igual que en funciones_planes, guardando también hora_episodio (`HH:MM` o null). Sin
-- esa clave en `plan`, jsonb_populate_record la deja en null. create or replace conserva los
-- permisos que ya tiene (solo authenticated).
create or replace function public.crear_plan(plan jsonb, piezas jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  nuevo_id uuid;
  restriccion text;
begin
  insert into public.planes (lunes, dia_d, con_episodio, numero, invitado, tema, estrategia_id,
                             estrategia_nombre, hora_episodio)
  select p.lunes, p.dia_d, p.con_episodio, p.numero, p.invitado, p.tema, p.estrategia_id,
         p.estrategia_nombre, p.hora_episodio
    from jsonb_populate_record(null::public.planes, crear_plan.plan) as p
  returning id into nuevo_id;

  insert into public.plan_piezas (plan_id, pieza_id, nombre, nombre_corto, formato, canales,
                                  dias_preparacion, desplazamiento, fecha, hora)
  select nuevo_id, p.pieza_id, p.nombre, p.nombre_corto, p.formato, p.canales, p.dias_preparacion,
         p.desplazamiento, p.fecha, p.hora
    from jsonb_populate_recordset(null::public.plan_piezas, crear_plan.piezas) as p;

  return nuevo_id;
exception
  -- planes.lunes es único: si dos llamadas llegan a la vez, la segunda espera a que la primera
  -- termine y choca aquí.
  when unique_violation then
    get stacked diagnostics restriccion = constraint_name;
    if restriccion = 'planes_lunes_key' then
      raise exception 'semana_con_plan' using errcode = 'P0001';
    end if;
    raise;
end;
$$;

-- Mueve solo el episodio: cambia el día D del plan (y su lunes, si cae en otra semana) y deja sus
-- posts donde estaban, sin tocar su fecha, hora, estado ni marca de revisar (no cambia nada en
-- Metricool). Lo único que cambia en cada post es su desplazamiento, que vuelve a ser los días de D
-- a su fecha. Si el nuevo D cae en una semana que ya tiene plan, da semana_con_plan y no cambia
-- nada; si el plan no existe, plan_no_existe (los dos con código P0001, como mover_plan). Mover al
-- mismo día no cambia nada.
create function public.mover_episodio(plan_id uuid, nuevo_dia_d date)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  dia_d_actual date;
  restriccion text;
begin
  -- for update: si dos personas mueven el mismo plan a la vez, la segunda espera a la primera.
  select p.dia_d into dia_d_actual
    from public.planes as p
   where p.id = mover_episodio.plan_id
     for update;
  if not found then
    raise exception 'plan_no_existe' using errcode = 'P0001';
  end if;

  if mover_episodio.nuevo_dia_d = dia_d_actual then
    return;
  end if;

  -- El lunes de la semana del nuevo D, como en mover_plan.
  update public.planes as p
     set dia_d = mover_episodio.nuevo_dia_d,
         lunes = date_trunc('week', mover_episodio.nuevo_dia_d::timestamp)::date
   where p.id = mover_episodio.plan_id;

  update public.plan_piezas as pp
     set desplazamiento = pp.fecha - mover_episodio.nuevo_dia_d
   where pp.plan_id = mover_episodio.plan_id;
exception
  when unique_violation then
    get stacked diagnostics restriccion = constraint_name;
    if restriccion = 'planes_lunes_key' then
      raise exception 'semana_con_plan' using errcode = 'P0001';
    end if;
    raise;
end;
$$;

-- Como las demás: Postgres da EXECUTE a PUBLIC en cada función nueva; se quita y solo se da a quien
-- tiene sesión.
revoke execute on function public.mover_episodio(uuid, date) from public, anon;
grant execute on function public.mover_episodio(uuid, date) to authenticated;
