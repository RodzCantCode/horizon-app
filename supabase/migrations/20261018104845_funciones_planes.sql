-- Funciones para lo que toca varias filas de un plan a la vez: crearlo con sus piezas, moverlo de
-- fecha y cambiarle la estrategia. La app las llama por RPC y cada llamada es una transacción: o se
-- hace todo o no se hace nada.
--
-- security invoker: corren con los permisos de quien llama, así que RLS y los permisos de las tablas
-- se aplican igual que si la app escribiera fila a fila, y el registro (disparador registrar_cambio)
-- anota a la persona de la sesión. search_path vacío y todo con su esquema, para que no se pueda
-- colar otra tabla u otra función con el mismo nombre.
--
-- Errores que la app reconoce por el mensaje exacto (código P0001):
-- - semana_con_plan: esa semana (su lunes) ya tiene otro plan.
-- - plan_no_existe: no hay ningún plan con ese id (por ejemplo, otra persona acaba de borrarlo).
--
-- Las piezas llegan como un array jsonb de objetos con las columnas de plan_piezas en snake_case:
-- pieza_id, nombre, nombre_corto, formato, canales, dias_preparacion, desplazamiento, fecha
-- (`YYYY-MM-DD`) y hora (`HH:MM` o null). Las genera la app con generarPiezasDePlan; aquí no se
-- calcula ninguna fecha. id, plan_id, estado y revisar no se leen: toda pieza nueva empieza
-- pendiente y sin revisar.
--
-- Los parámetros se nombran con la función delante (crear_plan.plan) porque algunos se llaman igual
-- que columnas (plan_id, estrategia_id): así no hay ambigüedad.

-- Crea un plan con sus piezas y devuelve su id. `plan` lleva las columnas de planes en snake_case:
-- lunes, dia_d, con_episodio, numero, invitado, tema, estrategia_id y estrategia_nombre.
-- Si esa semana ya tiene plan (doble pulsación, o dos personas planificando a la vez), da
-- semana_con_plan y no crea nada.
create function public.crear_plan(plan jsonb, piezas jsonb)
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
                             estrategia_nombre)
  select p.lunes, p.dia_d, p.con_episodio, p.numero, p.invitado, p.tema, p.estrategia_id,
         p.estrategia_nombre
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

-- Mueve el día D de un plan y todas sus piezas los mismos días (sus horas no cambian). Las
-- programadas vuelven a pendiente con revisar = true, porque hay que cambiarlas en Metricool; las
-- pendientes conservan su marca. Si el nuevo D cae en otra semana, el plan pasa a esa semana (su
-- lunes), salvo que ya tenga plan: entonces da semana_con_plan y no cambia nada. Mover al mismo día
-- no cambia nada.
create function public.mover_plan(plan_id uuid, nuevo_dia_d date)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  dia_d_actual date;
  dias int;
  restriccion text;
begin
  -- for update: si dos personas mueven el mismo plan a la vez, la segunda espera y calcula los días
  -- desde el D que dejó la primera.
  select p.dia_d into dia_d_actual
    from public.planes as p
   where p.id = mover_plan.plan_id
     for update;
  if not found then
    raise exception 'plan_no_existe' using errcode = 'P0001';
  end if;

  dias := mover_plan.nuevo_dia_d - dia_d_actual;
  if dias = 0 then
    return;
  end if;

  -- El lunes de la semana del nuevo D. Con ::timestamp (sin zona), date_trunc no depende de la zona
  -- horaria de la sesión.
  update public.planes as p
     set dia_d = mover_plan.nuevo_dia_d,
         lunes = date_trunc('week', mover_plan.nuevo_dia_d::timestamp)::date
   where p.id = mover_plan.plan_id;

  update public.plan_piezas as pp
     set fecha = pp.fecha + dias,
         estado = 'pendiente',
         revisar = pp.revisar or pp.estado = 'programada'
   where pp.plan_id = mover_plan.plan_id;
exception
  when unique_violation then
    get stacked diagnostics restriccion = constraint_name;
    if restriccion = 'planes_lunes_key' then
      raise exception 'semana_con_plan' using errcode = 'P0001';
    end if;
    raise;
end;
$$;

-- Cambia la estrategia de un plan: borra todas sus piezas, también las programadas (la app pide
-- confirmación antes), pone las nuevas y guarda la estrategia nueva en el plan.
create function public.cambiar_estrategia(plan_id uuid, estrategia_id uuid,
                                          estrategia_nombre text, piezas jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- for update: dos cambios a la vez del mismo plan se hacen uno detrás de otro.
  perform 1
     from public.planes as p
    where p.id = cambiar_estrategia.plan_id
      for update;
  if not found then
    raise exception 'plan_no_existe' using errcode = 'P0001';
  end if;

  delete from public.plan_piezas as pp
   where pp.plan_id = cambiar_estrategia.plan_id;

  insert into public.plan_piezas (plan_id, pieza_id, nombre, nombre_corto, formato, canales,
                                  dias_preparacion, desplazamiento, fecha, hora)
  select cambiar_estrategia.plan_id, p.pieza_id, p.nombre, p.nombre_corto, p.formato, p.canales,
         p.dias_preparacion, p.desplazamiento, p.fecha, p.hora
    from jsonb_populate_recordset(null::public.plan_piezas, cambiar_estrategia.piezas) as p;

  update public.planes as p
     set estrategia_id = cambiar_estrategia.estrategia_id,
         estrategia_nombre = cambiar_estrategia.estrategia_nombre
   where p.id = cambiar_estrategia.plan_id;
end;
$$;

-- Postgres da EXECUTE a PUBLIC (todos los roles) en cada función nueva: se quita, y solo se da a
-- quien tiene sesión.
revoke execute on function public.crear_plan(jsonb, jsonb), public.mover_plan(uuid, date),
  public.cambiar_estrategia(uuid, uuid, text, jsonb) from public, anon;
grant execute on function public.crear_plan(jsonb, jsonb), public.mover_plan(uuid, date),
  public.cambiar_estrategia(uuid, uuid, text, jsonb) to authenticated;
