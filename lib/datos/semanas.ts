// Lectura de las semanas, de los planes y de una pieza o una semana para su panel, desde Supabase
// (solo en el servidor: usa las cookies de la sesión). Aquí se pasan las filas de la base
// (snake_case, `lib/supabase/tipos.ts`) a los tipos de la app (`lib/tipos.ts`) y, para crear o
// cambiar un plan, al revés: las pantallas y `lib/semanas.ts` no ven nunca las de la base.

import { compararFechaYHora } from '@/lib/planes';
import { crearClienteServidor } from '@/lib/supabase/servidor';
import type { Tables, TablesInsert } from '@/lib/supabase/tipos';
import type { Canal, Estado, Formato, NuevaPiezaDePlan, PiezaDePlan, Plan } from '@/lib/tipos';

export const FORMATOS: readonly Formato[] = ['slide', 'reel'];
const ESTADOS: readonly Estado[] = ['pendiente', 'programada'];
export const CANALES: readonly Canal[] = ['ig', 'tiktok', 'shorts'];

/**
 * La base guarda formato, estado y canales como texto. Un valor que la app no conoce es un fallo
 * (de datos o de esquema) que tiene que verse, no algo que se pinte a medias.
 */
export function comprobar<T extends string>(valor: string, validos: readonly T[], campo: string): T {
  if ((validos as readonly string[]).includes(valor)) return valor as T;
  throw new Error(`Valor desconocido en ${campo}: «${valor}»`);
}

export function aPlan(fila: Tables<'planes'>): Plan {
  return {
    id: fila.id,
    lunes: fila.lunes,
    diaD: fila.dia_d,
    conEpisodio: fila.con_episodio,
    numero: fila.numero,
    invitado: fila.invitado,
    tema: fila.tema,
    estrategiaId: fila.estrategia_id,
    estrategiaNombre: fila.estrategia_nombre,
  };
}

export function aPiezaDePlan(fila: Tables<'plan_piezas'>): PiezaDePlan {
  return {
    id: fila.id,
    planId: fila.plan_id,
    piezaId: fila.pieza_id,
    nombre: fila.nombre,
    nombreCorto: fila.nombre_corto,
    formato: comprobar(fila.formato, FORMATOS, 'plan_piezas.formato'),
    canales: fila.canales.map((c) => comprobar(c, CANALES, 'plan_piezas.canales')),
    diasPreparacion: fila.dias_preparacion,
    desplazamiento: fila.desplazamiento,
    fecha: fila.fecha,
    // Las columnas `time` llegan como «18:00:00»; la app trabaja con «18:00».
    hora: fila.hora === null ? null : fila.hora.slice(0, 5),
    estado: comprobar(fila.estado, ESTADOS, 'plan_piezas.estado'),
    revisar: fila.revisar,
  };
}

/** Un plan nuevo como lo espera la función `crear_plan` de la base (sus columnas, sin `id`). */
export function aFilaPlan(plan: Omit<Plan, 'id'>): TablesInsert<'planes'> {
  return {
    lunes: plan.lunes,
    dia_d: plan.diaD,
    con_episodio: plan.conEpisodio,
    numero: plan.numero,
    invitado: plan.invitado,
    tema: plan.tema,
    estrategia_id: plan.estrategiaId,
    estrategia_nombre: plan.estrategiaNombre,
  };
}

/**
 * Una pieza nueva de plan como la esperan `crear_plan` y `cambiar_estrategia`: sin `plan_id` (lo
 * pone la función) ni estado ni marca de revisar (toda pieza nueva empieza pendiente y sin revisar).
 * La hora va `HH:MM` o `null`, nunca vacía.
 */
export function aFilaPiezaDePlan(
  p: NuevaPiezaDePlan,
): Omit<TablesInsert<'plan_piezas'>, 'id' | 'plan_id' | 'estado' | 'revisar'> {
  return {
    pieza_id: p.piezaId,
    nombre: p.nombre,
    nombre_corto: p.nombreCorto,
    formato: p.formato,
    canales: [...p.canales],
    dias_preparacion: p.diasPreparacion,
    desplazamiento: p.desplazamiento,
    fecha: p.fecha,
    hora: p.hora,
  };
}

/**
 * Planes cuyo lunes cae entre `desde` y `hasta`, y piezas de cualquier plan cuya fecha cae entre las
 * dos (así llegan también las que cruzan desde la semana anterior). Si Supabase falla, lanza un
 * error: mejor una página de error que unas semanas vacías que parezcan sin planificar.
 */
export async function leerSemanas(
  desde: string,
  hasta: string,
): Promise<{ planes: Plan[]; piezas: PiezaDePlan[] }> {
  const supabase = await crearClienteServidor();
  const [planes, piezas] = await Promise.all([
    supabase.from('planes').select('*').gte('lunes', desde).lte('lunes', hasta).order('lunes'),
    supabase
      .from('plan_piezas')
      .select('*')
      .gte('fecha', desde)
      .lte('fecha', hasta)
      .order('fecha')
      .order('hora', { nullsFirst: false })
      .order('nombre'),
  ]);

  const error = planes.error ?? piezas.error;
  if (error) throw new Error('No se han podido leer las semanas', { cause: error });

  return {
    planes: (planes.data ?? []).map(aPlan),
    piezas: (piezas.data ?? []).map(aPiezaDePlan),
  };
}

/**
 * Todos los planes, por orden de semana: para proponer el número y el día D del siguiente y saber si
 * una semana ya tiene plan. Son uno por semana, así que caben enteros. Si Supabase falla, lanza un
 * error.
 */
export async function leerPlanes(): Promise<Plan[]> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from('planes').select('*').order('lunes');
  if (error) throw new Error('No se han podido leer los planes', { cause: error });
  return (data ?? []).map(aPlan);
}

/**
 * El plan de la semana que empieza en `lunes`, con sus piezas por fecha y hora (las que no tienen
 * hora, al final del día), para el panel de la semana. `null` si esa semana no tiene plan (o otra
 * persona acaba de moverlo a otra). Si Supabase falla, lanza un error.
 */
export async function leerPlanDeSemana(lunes: string): Promise<{ plan: Plan; piezas: PiezaDePlan[] } | null> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from('planes')
    .select('*, plan_piezas(*)')
    .eq('lunes', lunes)
    .maybeSingle();

  if (error) throw new Error('No se ha podido leer la semana', { cause: error });
  if (data === null) return null;
  const { plan_piezas: piezas, ...plan } = data;
  return { plan: aPlan(plan), piezas: piezas.map(aPiezaDePlan).sort(compararFechaYHora) };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Una pieza de plan por su id, con su plan (para el panel de la pieza). `null` si no existe: otra
 * persona la ha quitado, o el id de la URL no es un id (escrito a mano); eso no se le pregunta a la
 * base, que respondería con un error. Si Supabase falla, lanza un error.
 */
export async function leerPiezaDePlan(id: string): Promise<{ pieza: PiezaDePlan; plan: Plan } | null> {
  if (!UUID.test(id)) return null;

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from('plan_piezas')
    .select('*, planes(*)')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error('No se ha podido leer la pieza', { cause: error });
  if (data === null) return null;
  return { pieza: aPiezaDePlan(data), plan: aPlan(data.planes) };
}
