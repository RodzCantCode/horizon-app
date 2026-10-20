'use server';

import { refresh } from 'next/cache';
import { aPieza } from '@/lib/datos/estrategias';
import { normalizarHora } from '@/lib/fechas';
import { DESPLAZAMIENTOS_ESTRATEGIA } from '@/lib/planes';
import { crearClienteServidor } from '@/lib/supabase/servidor';
import { CANALES, FORMATOS, type Estrategia, type Pieza } from '@/lib/tipos';

// Acciones de servidor de la sección Estrategias (docs/diseno.md § Estrategias). Como las de Semanas
// (semanas/acciones.ts): cada una devuelve `{ error }` con un texto para enseñar tal cual, o `{}` si
// ha ido bien, nunca el mensaje de Supabase; lo que llega del navegador se vuelve a comprobar aquí, y
// los permisos los pone RLS.
//
// Ninguna toca los planes: sus piezas son copias fijas (plan_piezas), así que editar una estrategia o
// una pieza, o archivarla, no cambia los planes ya creados. No se borra nada salvo las filas de
// estrategia_piezas de la estrategia que se guarda, para poner las nuevas. Las piezas se archivan,
// no se borran, y las estrategias no se borran.

const NO_GUARDADO = 'No se ha podido guardar. Vuelve a intentarlo.';
const FALTA_NOMBRE = 'Falta el nombre';
const FALTA_NOMBRE_CORTO = 'Falta el nombre corto';
const SIN_PIEZAS = 'Pon al menos una pieza';
const DIA_FUERA = 'El día tiene que estar entre D-7 y D+14';
const PIEZA_REPETIDA = 'Esa pieza ya está en ese día';
const PIEZA_ARCHIVADA = 'Esa pieza está archivada';
const ESTRATEGIA_NO_EXISTE = 'Esa estrategia ya no existe';
const PIEZA_NO_EXISTE = 'Esa pieza ya no existe';
const FORMATO_NO_VALIDO = 'Elige el formato';
const SIN_CANALES = 'Elige al menos un canal';
const CANAL_NO_VALIDO = 'Ese canal no es válido';
const PREPARACION_NO_VALIDA = 'Los días de preparación tienen que ser un número entero, 0 o más';
const HORA_NO_VALIDA = 'Esa hora no es válida';

/**
 * Los días permitidos con que se crea una pieza nueva. Desde el rediseño del calendario la app ya no
 * los usa (una pieza puede ir cualquier día de D-7 a D+14), pero la columna `piezas.dias_permitidos`
 * sigue en la base (`int[] not null`) y la comparte el código publicado en `main`, que todavía los
 * comprueba de D-1 a D+5: con los siete, allí la pieza se puede poner en cualquier día y editar.
 * Al editar una pieza no se tocan: se conserva lo que tuviera.
 */
const DIAS_PERMITIDOS_DE_UNA_NUEVA = [-1, 0, 1, 2, 3, 4, 5];

/**
 * Crea una estrategia (sin `id`) o cambia una que ya existe: su nombre, si es para semanas con o
 * sin episodio y sus piezas en cada día. Hace falta nombre y al menos una pieza; cada pieza tiene
 * que existir, ir en un día de D-7 a D+14 (`DESPLAZAMIENTOS_ESTRATEGIA`) y no repetirse en el mismo
 * día. Cualquier pieza puede ir en cualquiera de esos días.
 *
 * Una pieza archivada no se puede añadir: una nueva no puede llevar ninguna y, al editar, solo
 * pueden seguir las que la estrategia ya tenía (la estrategia sigue sin ofrecerse al planificar).
 * El panel solo ofrece las no archivadas, pero otra persona puede archivar una mientras se edita:
 * entonces lo dice y refresca, para que el panel la marque.
 *
 * Las piezas se sustituyen enteras: se borran las filas de estrategia_piezas de esa estrategia (y
 * solo esas) y se ponen las nuevas.
 */
export async function guardarEstrategia(
  e: Omit<Estrategia, 'id'> & { id?: string },
): Promise<{ error?: string }> {
  const nombre = e.nombre.trim();
  if (nombre === '') return { error: FALTA_NOMBRE };
  if (e.items.length === 0) return { error: SIN_PIEZAS };
  if (e.items.some((item) => !DESPLAZAMIENTOS_ESTRATEGIA.includes(item.desplazamiento))) {
    return { error: DIA_FUERA };
  }
  const repetida = e.items.some((item, i) =>
    e.items.some((otro, j) => j < i && otro.piezaId === item.piezaId && otro.desplazamiento === item.desplazamiento),
  );
  if (repetida) return { error: PIEZA_REPETIDA };

  // Las piezas de la base y, al editar, las que la estrategia ya tiene (para saber qué archivadas
  // pueden seguir en ella).
  const supabase = await crearClienteServidor();
  const [leidas, actuales] = await Promise.all([
    supabase.from('piezas').select('*'),
    e.id === undefined
      ? Promise.resolve({ data: [] as { pieza_id: string }[], error: null })
      : supabase.from('estrategia_piezas').select('pieza_id').eq('estrategia_id', e.id),
  ]);
  if (leidas.error || actuales.error) return { error: NO_GUARDADO };
  let piezas: Pieza[];
  try {
    piezas = leidas.data.map(aPieza);
  } catch {
    // aPieza lanza si una fila trae un formato o un canal que la app no conoce.
    return { error: NO_GUARDADO };
  }
  const yaTenia = new Set(actuales.data.map((a) => a.pieza_id));

  for (const item of e.items) {
    const pieza = piezas.find((p) => p.id === item.piezaId);
    if (!pieza) {
      refresh();
      return { error: PIEZA_NO_EXISTE };
    }
    if (pieza.archivada && !yaTenia.has(pieza.id)) {
      refresh();
      return { error: PIEZA_ARCHIVADA };
    }
  }

  const fila = { nombre, con_episodio: e.conEpisodio };
  let id: string;
  if (e.id === undefined) {
    const { data, error } = await supabase.from('estrategias').insert(fila).select('id');
    if (error || data.length === 0) return { error: NO_GUARDADO };
    id = data[0].id;
  } else {
    const { data, error } = await supabase.from('estrategias').update(fila).eq('id', e.id).select('id');
    if (error) return { error: NO_GUARDADO };
    if (data.length === 0) {
      refresh();
      return { error: ESTRATEGIA_NO_EXISTE };
    }
    id = e.id;
    const borradas = await supabase.from('estrategia_piezas').delete().eq('estrategia_id', id);
    if (borradas.error) return { error: NO_GUARDADO };
  }

  const { error } = await supabase.from('estrategia_piezas').insert(
    e.items.map((item) => ({ estrategia_id: id, pieza_id: item.piezaId, desplazamiento: item.desplazamiento })),
  );
  // Son llamadas sueltas, sin transacción (no hay una función de la base que lo haga de una vez): si
  // esto falla, la estrategia se queda sin piezas (o, si era nueva, creada sin ellas) hasta que se
  // vuelva a guardar; una nueva, al guardarla otra vez, se crea de nuevo. Una estrategia sin piezas
  // no se ofrece al planificar (`estrategiaDisponible`), así que no puede dar un plan vacío, y en la
  // sección sale «No disponible». Con tres personas y sin conexión cortada a mitad, se acepta; se
  // refresca para que la página enseñe cómo ha quedado.
  if (error) {
    refresh();
    return { error: NO_GUARDADO };
  }

  refresh();
  return {};
}

/** La hora que manda un panel: vacía es «sin hora» (`null`); si no es una hora, `undefined`. */
function leerHora(texto: string | null): string | null | undefined {
  const limpia = texto?.trim() ?? '';
  return limpia === '' ? null : (normalizarHora(limpia) ?? undefined);
}

/**
 * Crea una pieza (sin `id`, sin archivar) o cambia los datos de una que ya existe, sin tocar si está
 * archivada (eso es `archivarPieza`). Hacen falta nombre y nombre corto, un formato y al menos un
 * canal; los días de preparación, un entero desde 0; la hora habitual, `HH:MM` o vacía (sin hora).
 * Los canales se guardan sin repetir y en orden.
 *
 * No pide días permitidos: ya no se usan. Una nueva se crea con `DIAS_PERMITIDOS_DE_UNA_NUEVA` y, al
 * editar, `dias_permitidos` no se toca.
 */
export async function guardarPieza(
  p: Omit<Pieza, 'id' | 'archivada' | 'diasPermitidos'> & { id?: string },
): Promise<{ error?: string }> {
  const nombre = p.nombre.trim();
  if (nombre === '') return { error: FALTA_NOMBRE };
  const nombreCorto = p.nombreCorto.trim();
  if (nombreCorto === '') return { error: FALTA_NOMBRE_CORTO };
  if (!FORMATOS.includes(p.formato)) return { error: FORMATO_NO_VALIDO };
  if (p.canales.length === 0) return { error: SIN_CANALES };
  if (p.canales.some((c) => !CANALES.includes(c))) return { error: CANAL_NO_VALIDO };
  if (!Number.isInteger(p.diasPreparacion) || p.diasPreparacion < 0) return { error: PREPARACION_NO_VALIDA };
  const hora = leerHora(p.horaHabitual);
  if (hora === undefined) return { error: HORA_NO_VALIDA };

  const fila = {
    nombre,
    nombre_corto: nombreCorto,
    formato: p.formato,
    canales: CANALES.filter((c) => p.canales.includes(c)),
    dias_preparacion: p.diasPreparacion,
    hora_habitual: hora,
  };

  const supabase = await crearClienteServidor();
  if (p.id === undefined) {
    const { error } = await supabase.from('piezas').insert({ ...fila, dias_permitidos: DIAS_PERMITIDOS_DE_UNA_NUEVA });
    if (error) return { error: NO_GUARDADO };
    refresh();
    return {};
  }

  const { data, error } = await supabase.from('piezas').update(fila).eq('id', p.id).select('id');
  if (error) return { error: NO_GUARDADO };

  refresh();
  if (data.length === 0) return { error: PIEZA_NO_EXISTE };
  return {};
}

/**
 * Archiva una pieza (`archivada: true`) o la recupera (`false`); solo cambia eso. Una archivada no se
 * puede poner en estrategias ni en planes, y las estrategias que la usan dejan de ofrecerse al
 * planificar; los planes que ya la tienen no cambian (llevan una copia).
 *
 * Si alguna estrategia la usa y no viene `confirmado`, no la archiva y devuelve
 * `{ error: 'confirmar' }`: el panel lo pregunta y vuelve a llamar con `confirmado: true`. Refresca
 * también entonces, para que el panel cuente las estrategias que la usan ahora. Recuperarla no pide
 * confirmación.
 */
export async function archivarPieza(
  id: string,
  archivada: boolean,
  confirmado = false,
): Promise<{ error?: string }> {
  const supabase = await crearClienteServidor();

  if (archivada && !confirmado) {
    const usos = await supabase.from('estrategia_piezas').select('estrategia_id').eq('pieza_id', id);
    if (usos.error) return { error: NO_GUARDADO };
    if (usos.data.length > 0) {
      refresh();
      return { error: 'confirmar' };
    }
  }

  const { data, error } = await supabase.from('piezas').update({ archivada }).eq('id', id).select('id');
  if (error) return { error: NO_GUARDADO };

  refresh();
  if (data.length === 0) return { error: PIEZA_NO_EXISTE };
  return {};
}
