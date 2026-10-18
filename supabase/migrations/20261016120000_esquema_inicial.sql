-- Esquema inicial de Horizon App: tablas, seguridad (RLS) y registro automático de cambios.
--
-- Fechas como `date` y horas como `time` sin zona: son de reloj en Europe/Madrid, nunca instantes
-- UTC (ver lib/fechas.ts). Solo `registro.creado_en` es un instante.
--
-- Seguridad: RLS en todas las tablas. Con sesión (`authenticated`) se lee y se escribe todo, salvo
-- el registro (solo lectura: lo escriben los disparadores) y los perfiles (se leen todos y cada uno
-- edita el suyo; los crea el disparador de auth.users). Sin sesión (`anon`), ningún permiso.

-- Tablas -------------------------------------------------------------------------------------------

-- Una fila por usuario de Supabase Auth: el nombre que sale en el registro.
create table public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null
);

-- Plantillas de contenido. Se archivan, no se borran.
create table public.piezas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  nombre_corto text not null,
  formato text not null check (formato in ('slide', 'reel')),
  canales text[] not null,
  dias_permitidos int[] not null,
  dias_preparacion int not null check (dias_preparacion >= 0),
  hora_habitual time,
  archivada boolean not null default false
);

create table public.estrategias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  con_episodio boolean not null
);

-- Qué pieza va en qué día respecto al día D (de D-1 a D+5). Una pieza en uso no se puede borrar.
create table public.estrategia_piezas (
  id uuid primary key default gen_random_uuid(),
  estrategia_id uuid not null references public.estrategias (id) on delete cascade,
  pieza_id uuid not null references public.piezas (id) on delete restrict,
  desplazamiento int not null check (desplazamiento between -1 and 5)
);

-- Como mucho un plan por semana (la de su lunes). El día D cae dentro de esa semana.
create table public.planes (
  id uuid primary key default gen_random_uuid(),
  lunes date not null unique check (extract(isodow from lunes) = 1),
  dia_d date not null,
  con_episodio boolean not null,
  numero text,
  invitado text,
  tema text,
  estrategia_id uuid references public.estrategias (id) on delete set null,
  estrategia_nombre text not null,
  constraint planes_dia_d_check check (dia_d between lunes and lunes + 6)
);

-- Copia fija de las piezas al planificar: editar o archivar la pieza original no la cambia.
create table public.plan_piezas (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.planes (id) on delete cascade,
  pieza_id uuid references public.piezas (id) on delete set null,
  nombre text not null,
  nombre_corto text not null,
  formato text not null,
  canales text[] not null,
  dias_preparacion int not null,
  desplazamiento int not null,
  fecha date not null,
  hora time,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'programada')),
  revisar boolean not null default false
);

-- Quién hizo qué, sobre qué fila y cuándo. Lo escriben los disparadores, no la app.
create table public.registro (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid default auth.uid(),
  accion text not null,
  tabla text not null,
  fila_id uuid not null,
  detalle jsonb,
  creado_en timestamptz not null default now()
);

-- Índices de las claves ajenas y de la lectura del registro de una fila.
create index estrategia_piezas_estrategia_id_idx on public.estrategia_piezas (estrategia_id);
create index estrategia_piezas_pieza_id_idx on public.estrategia_piezas (pieza_id);
create index planes_estrategia_id_idx on public.planes (estrategia_id);
create index plan_piezas_plan_id_idx on public.plan_piezas (plan_id);
create index plan_piezas_pieza_id_idx on public.plan_piezas (pieza_id);
create index registro_fila_id_idx on public.registro (fila_id);

-- Permisos ---------------------------------------------------------------------------------------

-- Primero se quita todo, también lo que Supabase da por defecto (truncate, trigger…), y luego se
-- da solo lo necesario. anon se queda sin nada.
revoke all on table public.perfiles, public.piezas, public.estrategias, public.estrategia_piezas,
  public.planes, public.plan_piezas, public.registro from anon, authenticated;

grant select, insert, update, delete on table public.piezas, public.estrategias,
  public.estrategia_piezas, public.planes, public.plan_piezas to authenticated;
grant select on table public.registro to authenticated;
grant select, update on table public.perfiles to authenticated;

-- RLS ---------------------------------------------------------------------------------------------

alter table public.perfiles enable row level security;
alter table public.piezas enable row level security;
alter table public.estrategias enable row level security;
alter table public.estrategia_piezas enable row level security;
alter table public.planes enable row level security;
alter table public.plan_piezas enable row level security;
alter table public.registro enable row level security;

-- Los tres usuarios pueden lo mismo: con sesión, todo.
create policy "Con sesión, todo" on public.piezas
  for all to authenticated using (true) with check (true);
create policy "Con sesión, todo" on public.estrategias
  for all to authenticated using (true) with check (true);
create policy "Con sesión, todo" on public.estrategia_piezas
  for all to authenticated using (true) with check (true);
create policy "Con sesión, todo" on public.planes
  for all to authenticated using (true) with check (true);
create policy "Con sesión, todo" on public.plan_piezas
  for all to authenticated using (true) with check (true);

create policy "Con sesión se lee" on public.registro
  for select to authenticated using (true);

create policy "Con sesión se leen" on public.perfiles
  for select to authenticated using (true);
create policy "Cada uno edita el suyo" on public.perfiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Registro automático -----------------------------------------------------------------------------

-- Anota cada alta, cambio y borrado. Corre como su dueño (security definer) para poder escribir en
-- el registro, que con sesión es de solo lectura; el usuario lo pone el valor por defecto de
-- usuario_id (auth.uid(), el de la sesión). En un cambio guarda solo las columnas que cambian,
-- {columna: {antes, despues}}, y si no cambia ninguna no anota nada. En plan_piezas, cambiar el
-- estado es programar o volver a pendiente (aunque cambie también la fecha o la hora) y cambiar
-- fecha u hora es mover.
create function public.registrar_cambio()
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

create trigger registrar_cambio after insert or update or delete on public.piezas
  for each row execute function public.registrar_cambio();
create trigger registrar_cambio after insert or update or delete on public.estrategias
  for each row execute function public.registrar_cambio();
create trigger registrar_cambio after insert or update or delete on public.estrategia_piezas
  for each row execute function public.registrar_cambio();
create trigger registrar_cambio after insert or update or delete on public.planes
  for each row execute function public.registrar_cambio();
create trigger registrar_cambio after insert or update or delete on public.plan_piezas
  for each row execute function public.registrar_cambio();

-- Perfiles automáticos ----------------------------------------------------------------------------

-- Crea el perfil de cada usuario nuevo de Supabase Auth con la parte del correo antes de la @ (se
-- puede cambiar luego). security definer porque lo dispara Auth, que no escribe en public.
create function public.crear_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfiles (id, nombre)
  values (new.id, split_part(new.email, '@', 1))
  on conflict do nothing;
  return new;
end;
$$;

create trigger crear_perfil after insert on auth.users
  for each row execute function public.crear_perfil();

-- Perfiles de los usuarios que ya existían antes de esta migración.
insert into public.perfiles (id, nombre)
select id, split_part(email, '@', 1)
  from auth.users
on conflict do nothing;

-- Las funciones de los disparadores no se llaman desde fuera.
revoke execute on function public.registrar_cambio() from public, anon, authenticated;
revoke execute on function public.crear_perfil() from public, anon, authenticated;
