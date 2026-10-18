-- Pruebas de seguridad y registro del esquema (migraciones esquema_inicial y ajustes_esquema).
--
-- Cómo se ejecutan: el archivo entero con execute_sql de la conexión supabase-horizon. Todo va en
-- una transacción que acaba en rollback, así que los usuarios y las filas de prueba no se quedan en
-- la base de datos. Devuelve una fila por comprobación: ok = true si pasa; detalle dice qué falló.
--
-- Cómo se actúa como alguien: `anon` es una visita sin sesión; pg_temp.con_sesion() pone el rol
-- `authenticated` y la sesión de un usuario (auth.uid() lee el `sub` de request.jwt.claims).
-- `reset role` vuelve al rol de quien ejecuta. Si un bloque falla sin esperarlo, el error queda
-- anotado como fallo y el cambio de rol se deshace con el bloque.
--
-- Los planes de prueba van en semanas de 2099, como en funciones.sql, para no chocar con planes
-- reales: un lunes solo puede tener un plan. Octubre de 2099 cae en los mismos días de la semana que
-- el de 2026 (el 19 es lunes).

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

-- Dos usuarios de prueba, con correos de un dominio que no puede existir (.invalid).
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000a1', 'prueba@ejemplo.invalid'),
  ('00000000-0000-4000-8000-0000000000a2', 'otra@ejemplo.invalid');

-- 1. Sin sesión no hay nada: anon no tiene ningún permiso y no puede leer ninguna tabla.
do $$
declare
  prueba text := 'sin sesión (anon) no se lee ninguna tabla ni hay permisos';
  tabla text;
  fallos text[] := '{}';
begin
  foreach tabla in array array['perfiles', 'piezas', 'estrategias', 'estrategia_piezas', 'planes',
                               'plan_piezas', 'registro'] loop
    if has_table_privilege('anon', 'public.' || tabla,
         'select, insert, update, delete, truncate, references, trigger, maintain') then
      fallos := fallos || (tabla || ': anon tiene algún permiso');
    end if;
    set local role anon;
    begin
      execute format('select count(*) from public.%I', tabla);
      fallos := fallos || (tabla || ': anon la ha leído');
    exception when insufficient_privilege then
      null;
    end;
    reset role;
  end loop;
  insert into resultados (prueba, ok, detalle)
  values (prueba, cardinality(fallos) = 0, array_to_string(fallos, '; '));
exception when others then
  insert into resultados (prueba, ok, detalle) values (prueba, false, sqlerrm);
end $$;

-- 2. Dar de alta un usuario le crea el perfil con la parte del correo antes de la @.
do $$
declare
  prueba text := 'el alta de un usuario crea su perfil con el nombre del correo';
  nombre_perfil text;
begin
  select nombre into nombre_perfil
    from public.perfiles
   where id = '00000000-0000-4000-8000-0000000000a1';
  insert into resultados (prueba, ok, detalle)
  values (prueba, nombre_perfil is not distinct from 'prueba', coalesce(nombre_perfil, 'sin perfil'));
exception when others then
  insert into resultados (prueba, ok, detalle) values (prueba, false, sqlerrm);
end $$;

-- 3. Con sesión se crea una pieza y el registro anota quién, qué y sobre qué fila.
do $$
declare
  prueba text := 'con sesión se crea una pieza y el registro anota quién la creó';
  coinciden int;
  total int;
begin
  perform pg_temp.con_sesion('00000000-0000-4000-8000-0000000000a1');
  insert into public.piezas (id, nombre, nombre_corto, formato, canales, dias_permitidos,
                             dias_preparacion)
  values ('00000000-0000-4000-8000-0000000000b1', 'T9 · Pieza de prueba', 'Pieza de prueba', 'reel',
          '{ig}', '{0,1}', 2);
  select count(*) filter (where usuario_id = '00000000-0000-4000-8000-0000000000a1'
                            and accion = 'crear' and tabla = 'piezas' and detalle is null),
         count(*)
    into coinciden, total
    from public.registro
   where fila_id = '00000000-0000-4000-8000-0000000000b1';
  reset role;
  insert into resultados (prueba, ok, detalle)
  values (prueba, coinciden = 1 and total = 1,
          format('%s filas en el registro, %s como se esperaba', total, coinciden));
exception when others then
  insert into resultados (prueba, ok, detalle) values (prueba, false, sqlerrm);
end $$;

-- 4. El registro solo lo escribe la base de datos: con sesión no se toca a mano.
do $$
declare
  prueba text := 'con sesión no se escribe en el registro a mano (insert, update, delete)';
  fallos text[] := '{}';
begin
  perform pg_temp.con_sesion('00000000-0000-4000-8000-0000000000a1');
  begin
    insert into public.registro (accion, tabla, fila_id)
    values ('crear', 'piezas', '00000000-0000-4000-8000-0000000000b1');
    fallos := fallos || 'insert permitido'::text;
  exception when insufficient_privilege then
    null;
  end;
  begin
    update public.registro set accion = 'borrar'
     where fila_id = '00000000-0000-4000-8000-0000000000b1';
    fallos := fallos || 'update permitido'::text;
  exception when insufficient_privilege then
    null;
  end;
  begin
    delete from public.registro where fila_id = '00000000-0000-4000-8000-0000000000b1';
    fallos := fallos || 'delete permitido'::text;
  exception when insufficient_privilege then
    null;
  end;
  reset role;
  insert into resultados (prueba, ok, detalle)
  values (prueba, cardinality(fallos) = 0, array_to_string(fallos, '; '));
exception when others then
  insert into resultados (prueba, ok, detalle) values (prueba, false, sqlerrm);
end $$;

-- 5. Una pieza que usa una estrategia no se puede borrar (restrict).
do $$
declare
  prueba text := 'una pieza usada en una estrategia no se borra';
  borrada boolean := false;
  codigo text;
begin
  perform pg_temp.con_sesion('00000000-0000-4000-8000-0000000000a1');
  insert into public.estrategias (id, nombre, con_episodio)
  values ('00000000-0000-4000-8000-0000000000c1', 'Estrategia de prueba', true);
  insert into public.estrategia_piezas (estrategia_id, pieza_id, desplazamiento)
  values ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000b1', 0);
  begin
    delete from public.piezas where id = '00000000-0000-4000-8000-0000000000b1';
    borrada := found;
  exception when foreign_key_violation then
    codigo := sqlstate;
  end;
  reset role;
  insert into resultados (prueba, ok, detalle)
  values (prueba, codigo is not distinct from '23503' and not borrada,
          format('código %s, borrada %s', coalesce(codigo, 'ninguno'), borrada));
exception when others then
  insert into resultados (prueba, ok, detalle) values (prueba, false, sqlerrm);
end $$;

-- 6. Archivarla sí funciona, y el registro guarda solo la columna que cambió.
do $$
declare
  prueba text := 'archivar una pieza usada funciona y el registro guarda el cambio';
  filas int;
  detalle_registro jsonb;
begin
  perform pg_temp.con_sesion('00000000-0000-4000-8000-0000000000a1');
  update public.piezas set archivada = true where id = '00000000-0000-4000-8000-0000000000b1';
  get diagnostics filas = row_count;
  select detalle into detalle_registro
    from public.registro
   where fila_id = '00000000-0000-4000-8000-0000000000b1' and accion = 'editar';
  reset role;
  insert into resultados (prueba, ok, detalle)
  values (prueba,
          coalesce(filas = 1 and detalle_registro = '{"archivada": {"antes": false, "despues": true}}',
                   false),
          format('%s filas; detalle %s', filas, coalesce(detalle_registro::text, 'ninguno')));
exception when others then
  insert into resultados (prueba, ok, detalle) values (prueba, false, sqlerrm);
end $$;

-- 7. En las piezas de un plan, el registro distingue programar, volver a pendiente, mover y editar.
do $$
declare
  prueba text := 'en plan_piezas el registro distingue programar, volver a pendiente, mover, editar y borrar';
  acciones text;
  detalle_vuelta jsonb;
  esperado jsonb := '{"estado": {"antes": "programada", "despues": "pendiente"},
                      "fecha": {"antes": "2099-10-24", "despues": "2099-10-25"},
                      "revisar": {"antes": false, "despues": true}}';
begin
  perform pg_temp.con_sesion('00000000-0000-4000-8000-0000000000a1');
  insert into public.planes (id, lunes, dia_d, con_episodio, estrategia_id, estrategia_nombre)
  values ('00000000-0000-4000-8000-0000000000d1', '2099-10-19', '2099-10-23', true,
          '00000000-0000-4000-8000-0000000000c1', 'Estrategia de prueba');
  insert into public.plan_piezas (id, plan_id, pieza_id, nombre, nombre_corto, formato, canales,
                                  dias_preparacion, desplazamiento, fecha, hora)
  values ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000d1',
          '00000000-0000-4000-8000-0000000000b1', 'T9 · Pieza de prueba', 'Pieza de prueba', 'reel',
          '{ig}', 2, 0, '2099-10-23', '18:00');
  -- programar
  update public.plan_piezas set estado = 'programada'
   where id = '00000000-0000-4000-8000-0000000000e1';
  -- mover (hora)
  update public.plan_piezas set hora = '19:30'
   where id = '00000000-0000-4000-8000-0000000000e1';
  -- mover (fecha)
  update public.plan_piezas set fecha = '2099-10-24'
   where id = '00000000-0000-4000-8000-0000000000e1';
  -- volver_a_pendiente: cambian estado y fecha a la vez; manda el estado
  update public.plan_piezas set estado = 'pendiente', fecha = '2099-10-25', revisar = true
   where id = '00000000-0000-4000-8000-0000000000e1';
  -- editar
  update public.plan_piezas set revisar = false
   where id = '00000000-0000-4000-8000-0000000000e1';
  -- sin cambios: no se anota
  update public.plan_piezas set revisar = false
   where id = '00000000-0000-4000-8000-0000000000e1';
  -- borrar el plan borra sus piezas (cascade) y cada una deja su «borrar»
  delete from public.planes where id = '00000000-0000-4000-8000-0000000000d1';
  select string_agg(accion, ',' order by accion) into acciones
    from public.registro
   where fila_id = '00000000-0000-4000-8000-0000000000e1' and tabla = 'plan_piezas';
  select detalle into detalle_vuelta
    from public.registro
   where fila_id = '00000000-0000-4000-8000-0000000000e1' and accion = 'volver_a_pendiente';
  reset role;
  insert into resultados (prueba, ok, detalle)
  values (prueba,
          coalesce(acciones = 'borrar,crear,editar,mover,mover,programar,volver_a_pendiente'
                   and detalle_vuelta = esperado, false),
          format('acciones %s; detalle de volver_a_pendiente %s', coalesce(acciones, 'ninguna'),
                 coalesce(detalle_vuelta::text, 'ninguno')));
exception when others then
  insert into resultados (prueba, ok, detalle) values (prueba, false, sqlerrm);
end $$;

-- 8. Perfiles: cada uno edita solo su nombre; no se crean ni se borran desde la app.
do $$
declare
  prueba text := 'cada uno edita solo su perfil; los perfiles no se crean ni se borran a mano';
  fallos text[] := '{}';
  filas int;
begin
  perform pg_temp.con_sesion('00000000-0000-4000-8000-0000000000a1');
  update public.perfiles set nombre = 'Prueba' where id = '00000000-0000-4000-8000-0000000000a1';
  get diagnostics filas = row_count;
  if filas <> 1 then
    fallos := fallos || 'no pudo editar su propio nombre'::text;
  end if;
  update public.perfiles set nombre = 'Cambiado' where id = '00000000-0000-4000-8000-0000000000a2';
  get diagnostics filas = row_count;
  if filas <> 0 then
    fallos := fallos || 'editó el perfil de otro'::text;
  end if;
  begin
    insert into public.perfiles (id, nombre)
    values ('00000000-0000-4000-8000-0000000000a2', 'Repetido');
    fallos := fallos || 'insert permitido'::text;
  exception when insufficient_privilege then
    null;
  end;
  begin
    delete from public.perfiles where id = '00000000-0000-4000-8000-0000000000a2';
    fallos := fallos || 'delete permitido'::text;
  exception when insufficient_privilege then
    null;
  end;
  reset role;
  insert into resultados (prueba, ok, detalle)
  values (prueba, cardinality(fallos) = 0, array_to_string(fallos, '; '));
exception when others then
  insert into resultados (prueba, ok, detalle) values (prueba, false, sqlerrm);
end $$;

-- 9. Un plan empieza en lunes y su día D cae dentro de esa semana (de lunes a domingo).
do $$
declare
  prueba text := 'un plan solo empieza en lunes y su día D cae en esa semana';
  fallos text[] := '{}';
begin
  perform pg_temp.con_sesion('00000000-0000-4000-8000-0000000000a1');
  begin
    insert into public.planes (lunes, dia_d, con_episodio, estrategia_nombre)
    values ('2099-10-20', '2099-10-23', true, 'Prueba');
    fallos := fallos || 'aceptó un martes como lunes'::text;
  exception when check_violation then
    null;
  end;
  begin
    insert into public.planes (lunes, dia_d, con_episodio, estrategia_nombre)
    values ('2099-10-26', '2099-10-25', true, 'Prueba');
    fallos := fallos || 'aceptó un día D anterior al lunes'::text;
  exception when check_violation then
    null;
  end;
  begin
    insert into public.planes (lunes, dia_d, con_episodio, estrategia_nombre)
    values ('2099-10-26', '2099-11-02', true, 'Prueba');
    fallos := fallos || 'aceptó un día D de la semana siguiente'::text;
  exception when check_violation then
    null;
  end;
  -- El domingo de la misma semana sí vale.
  insert into public.planes (lunes, dia_d, con_episodio, estrategia_nombre)
  values ('2099-10-26', '2099-11-01', true, 'Prueba');
  reset role;
  insert into resultados (prueba, ok, detalle)
  values (prueba, cardinality(fallos) = 0, array_to_string(fallos, '; '));
exception when others then
  insert into resultados (prueba, ok, detalle) values (prueba, false, sqlerrm);
end $$;

-- 10. Con sesión no se pueden vaciar las tablas ni crear referencias o disparadores sobre ellas.
do $$
declare
  prueba text := 'con sesión no hay permiso de truncate, references ni trigger en ninguna tabla';
  tabla text;
  fallos text[] := '{}';
begin
  foreach tabla in array array['perfiles', 'piezas', 'estrategias', 'estrategia_piezas', 'planes',
                               'plan_piezas', 'registro'] loop
    if has_table_privilege('authenticated', 'public.' || tabla, 'truncate, references, trigger') then
      fallos := fallos || (tabla || ': authenticated tiene truncate, references o trigger');
    end if;
  end loop;
  insert into resultados (prueba, ok, detalle)
  values (prueba, cardinality(fallos) = 0, array_to_string(fallos, '; '));
exception when others then
  insert into resultados (prueba, ok, detalle) values (prueba, false, sqlerrm);
end $$;

-- 11. Las funciones de los disparadores no se pueden llamar desde fuera (security definer).
do $$
declare
  prueba text := 'ni anon ni authenticated pueden ejecutar registrar_cambio() ni crear_perfil()';
  rol text;
  funcion text;
  fallos text[] := '{}';
begin
  foreach rol in array array['anon', 'authenticated'] loop
    foreach funcion in array array['public.registrar_cambio()', 'public.crear_perfil()'] loop
      if has_function_privilege(rol, funcion, 'execute') then
        fallos := fallos || (rol || ' puede ejecutar ' || funcion);
      end if;
    end loop;
  end loop;
  insert into resultados (prueba, ok, detalle)
  values (prueba, cardinality(fallos) = 0, array_to_string(fallos, '; '));
exception when others then
  insert into resultados (prueba, ok, detalle) values (prueba, false, sqlerrm);
end $$;

select prueba, ok, detalle from resultados order by orden;

rollback;
