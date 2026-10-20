-- El registro deja de anotar los cambios de plan_piezas en los que solo cambia el desplazamiento.
--
-- mover_episodio (migración calendario) mueve solo el episodio: en cada post recalcula el
-- desplazamiento (los días de D a su fecha) y no toca nada más. Para quien mira el post no ha
-- cambiado nada, pero el disparador anotaba un «editar» en cada uno («Mario la editó»), ruido para
-- siempre en su historial. El cambio del plan (día D y lunes) se sigue anotando en el plan.
--
-- registrar_cambio queda igual que en esquema_inicial salvo esa salida. create or replace conserva
-- el dueño, los permisos (sin execute para public, anon ni authenticated) y los disparadores que ya
-- la usan, que no se tocan. Todo lo demás se anota como antes; si el desplazamiento cambia junto con
-- otra columna (mover un post, mover la semana), sigue apareciendo en el detalle.
--
-- La base la comparten preview y producción: no cambia ninguna tabla ni dato, y el código publicado
-- sigue funcionando igual.
create or replace function public.registrar_cambio()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  accion text;
  fila uuid;
  cambios jsonb;
begin
  if tg_op = 'INSERT' then
    accion := 'crear';
    fila := new.id;
  elsif tg_op = 'DELETE' then
    accion := 'borrar';
    fila := old.id;
  else
    fila := new.id;
    select jsonb_object_agg(despues.key,
                            jsonb_build_object('antes', antes.value, 'despues', despues.value))
      into cambios
      from jsonb_each(to_jsonb(new)) as despues
      join jsonb_each(to_jsonb(old)) as antes on antes.key = despues.key
     where despues.value is distinct from antes.value;

    if cambios is null then
      return null;
    end if;

    -- En plan_piezas, si solo cambia el desplazamiento (mover_episodio), el post sigue igual: no se
    -- anota.
    if tg_table_name = 'plan_piezas' and cambios - 'desplazamiento' = '{}'::jsonb then
      return null;
    end if;

    accion := 'editar';
    if tg_table_name = 'plan_piezas' then
      if cambios ? 'estado' then
        accion := case cambios -> 'estado' ->> 'despues'
                    when 'programada' then 'programar'
                    else 'volver_a_pendiente'
                  end;
      elsif cambios ? 'fecha' or cambios ? 'hora' then
        accion := 'mover';
      end if;
    end if;
  end if;

  insert into public.registro (accion, tabla, fila_id, detalle)
  values (accion, tg_table_name, fila, cambios);

  return null;
end;
$$;
