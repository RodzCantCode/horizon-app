// Lectura de las piezas y las estrategias desde Supabase (solo en el servidor: usa las cookies de la
// sesión). Pasa sus filas a los tipos de la app (`Pieza` y `Estrategia`, en `lib/tipos.ts`), como
// semanas.ts con las de los planes.

import { comprobar } from '@/lib/datos/semanas';
import { crearClienteServidor } from '@/lib/supabase/servidor';
import type { Tables } from '@/lib/supabase/tipos';
import { CANALES, FORMATOS, type Estrategia, type Pieza } from '@/lib/tipos';

export function aPieza(fila: Tables<'piezas'>): Pieza {
  return {
    id: fila.id,
    nombre: fila.nombre,
    nombreCorto: fila.nombre_corto,
    formato: comprobar(fila.formato, FORMATOS, 'piezas.formato'),
    canales: fila.canales.map((c) => comprobar(c, CANALES, 'piezas.canales')),
    diasPermitidos: fila.dias_permitidos,
    diasPreparacion: fila.dias_preparacion,
    // Las columnas `time` llegan como «18:00:00»; la app trabaja con «18:00».
    horaHabitual: fila.hora_habitual === null ? null : fila.hora_habitual.slice(0, 5),
    archivada: fila.archivada,
  };
}

/** Una estrategia con sus filas de `estrategia_piezas` anidadas, como la da la consulta de abajo. */
type FilaEstrategia = Tables<'estrategias'> & {
  estrategia_piezas: Pick<Tables<'estrategia_piezas'>, 'id' | 'pieza_id' | 'desplazamiento'>[];
};

/**
 * Las piezas de la estrategia van por día, de D-7 a D+14: la base no guarda otro orden. Dos en el
 * mismo día van por el id de su fila de `estrategia_piezas`, para que salgan siempre igual: PostgREST
 * no garantiza el orden de las filas anidadas, y `crearPlan` empareja las fechas del borrador con los
 * ítems por posición.
 */
export function aEstrategia(fila: FilaEstrategia): Estrategia {
  return {
    id: fila.id,
    nombre: fila.nombre,
    conEpisodio: fila.con_episodio,
    items: [...fila.estrategia_piezas]
      .sort((a, b) => a.desplazamiento - b.desplazamiento || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .map((item) => ({ piezaId: item.pieza_id, desplazamiento: item.desplazamiento })),
  };
}

/**
 * Todas las estrategias, con sus piezas, y todas las piezas, archivadas incluidas: para saber qué
 * estrategias se pueden ofrecer (`estrategiasParaPlanificar`) hace falta ver las archivadas. Por
 * orden de nombre. Si Supabase falla, lanza un error.
 */
export async function leerEstrategiasYPiezas(): Promise<{ estrategias: Estrategia[]; piezas: Pieza[] }> {
  const supabase = await crearClienteServidor();
  const [piezas, estrategias] = await Promise.all([
    supabase.from('piezas').select('*').order('nombre'),
    supabase
      .from('estrategias')
      .select('id, nombre, con_episodio, estrategia_piezas(id, pieza_id, desplazamiento)')
      .order('nombre'),
  ]);

  const error = piezas.error ?? estrategias.error;
  if (error) throw new Error('No se han podido leer las estrategias', { cause: error });

  return {
    estrategias: (estrategias.data ?? []).map(aEstrategia),
    piezas: (piezas.data ?? []).map(aPieza),
  };
}
