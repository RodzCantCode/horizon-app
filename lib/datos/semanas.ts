// Lectura de las semanas desde Supabase (solo en el servidor: usa las cookies de la sesión). Aquí se
// pasan las filas de la base (snake_case, `lib/supabase/tipos.ts`) a los tipos de la app
// (`lib/tipos.ts`), para que las pantallas y `lib/semanas.ts` no vean nunca las de la base.

import { crearClienteServidor } from '@/lib/supabase/servidor';
import type { Tables } from '@/lib/supabase/tipos';
import type { Canal, Estado, Formato, PiezaDePlan, Plan } from '@/lib/tipos';

const FORMATOS: readonly Formato[] = ['slide', 'reel'];
const ESTADOS: readonly Estado[] = ['pendiente', 'programada'];
const CANALES: readonly Canal[] = ['ig', 'tiktok', 'shorts'];

/**
 * La base guarda formato, estado y canales como texto. Un valor que la app no conoce es un fallo
 * (de datos o de esquema) que tiene que verse, no algo que se pinte a medias.
 */
function comprobar<T extends string>(valor: string, validos: readonly T[], campo: string): T {
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
