-- Ajustes al esquema inicial detectados al revisar la migración esquema_inicial.

-- plan_piezas copia el formato de la pieza: debe aceptar los mismos valores que piezas.formato.
alter table public.plan_piezas
  add constraint plan_piezas_formato_check check (formato in ('slide', 'reel'));

-- now() devuelve el instante en que empieza la transacción, así que dos anotaciones de una misma
-- transacción empatan en creado_en y pierden su orden. clock_timestamp() es el instante real de cada
-- inserción.
alter table public.registro alter column creado_en set default clock_timestamp();
