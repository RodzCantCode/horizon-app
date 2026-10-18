'use server';

import { refresh } from 'next/cache';
import { leerEstrategiasYPiezas } from '@/lib/datos/estrategias';
import { aFilaPiezaDePlan, aFilaPlan } from '@/lib/datos/semanas';
import { diaSemana, diasEntre, esFecha } from '@/lib/fechas';
import { estrategiasParaPlanificar, generarPiezasDePlan } from '@/lib/planes';
import { crearClienteServidor } from '@/lib/supabase/servidor';
import type { Estado, NuevaPiezaDePlan } from '@/lib/tipos';

// Acciones de servidor de la pantalla Semanas. Cada una devuelve `{ error }` con un texto para
// enseñar tal cual, o `{}` si ha ido bien; nunca el mensaje de Supabase, que viene en inglés.
// Los permisos los pone RLS: sin sesión, la base no deja escribir y la acción devuelve el error.

const PIEZA_QUITADA = 'Esa pieza ya no está en el plan';
const NO_GUARDADO = 'No se ha podido guardar. Vuelve a intentarlo.';
const SEMANA_NO_VALIDA = 'Esa semana no es válida';
const DIA_FUERA_DE_LA_SEMANA = 'El día de publicación tiene que caer en esa semana';
const FALTA_NUMERO = 'Falta el número del episodio';
const ESTRATEGIA_NO_DISPONIBLE = 'Esa estrategia ya no está disponible';
const SEMANA_CON_PLAN = 'Esa semana ya tiene plan';

/**
 * Cambia el estado de una pieza de plan. Al marcarla como programada se quita también la marca de
 * «revisar en Metricool»: quien la marca acaba de comprobarla allí. El registro lo anota la base.
 *
 * Si la pieza ya no existe (otra persona la ha quitado con el panel abierto), devuelve el aviso y
 * refresca igualmente, para que desaparezca de la semana y el panel lo diga.
 */
export async function marcarEstado(planPiezaId: string, estado: Estado): Promise<{ error?: string }> {
  const supabase = await crearClienteServidor();
  const cambios = estado === 'programada' ? { estado, revisar: false } : { estado };
  const { data, error } = await supabase
    .from('plan_piezas')
    .update(cambios)
    .eq('id', planPiezaId)
    .select('id');

  if (error) return { error: NO_GUARDADO };

  refresh();
  if (data.length === 0) return { error: PIEZA_QUITADA };
  return {};
}

/** Lo que manda el panel de planificar. `diaD` es el día de publicación o, sin episodio, el de referencia. */
export type EntradaPlan = {
  lunes: string;
  conEpisodio: boolean;
  diaD: string;
  numero: string | null;
  invitado: string | null;
  tema: string | null;
  estrategiaId: string;
};

/** Sin los espacios de los lados; un texto vacío es `null`. */
function limpiar(texto: string | null): string | null {
  const limpio = texto?.trim() ?? '';
  return limpio === '' ? null : limpio;
}

/**
 * Crea el plan de una semana con sus piezas (docs/diseno.md § Planificar). Lo que llega del
 * navegador se vuelve a comprobar aquí: la semana empieza en lunes, el día D cae dentro y la
 * estrategia existe, es del tipo que toca y no usa piezas archivadas. Las piezas las genera el
 * servidor con las piezas y la estrategia de la base, nunca las manda el navegador. Sin episodio no
 * se guardan número, invitado ni tema.
 *
 * Plan y piezas se crean de una vez con la función `crear_plan` de la base. Si esa semana ya tiene
 * plan (doble pulsación, o dos personas a la vez), la base no crea otro y aquí se avisa. Cuando el
 * panel se ha quedado desfasado (esa semana ya tiene plan, o la estrategia ya no se puede usar),
 * también se refresca, para que la semana y la lista de estrategias se pongan al día.
 */
export async function crearPlan(entrada: EntradaPlan): Promise<{ error?: string }> {
  const { lunes, conEpisodio, diaD, estrategiaId } = entrada;
  if (!esFecha(lunes) || diaSemana(lunes) !== 0) return { error: SEMANA_NO_VALIDA };
  if (!esFecha(diaD) || diasEntre(lunes, diaD) < 0 || diasEntre(lunes, diaD) > 6) {
    return { error: DIA_FUERA_DE_LA_SEMANA };
  }
  const numero = conEpisodio ? limpiar(entrada.numero) : null;
  if (conEpisodio && numero === null) return { error: FALTA_NUMERO };

  let leidas: Awaited<ReturnType<typeof leerEstrategiasYPiezas>>;
  try {
    leidas = await leerEstrategiasYPiezas();
  } catch {
    return { error: NO_GUARDADO };
  }
  const { estrategias, piezas } = leidas;

  const estrategia = estrategiasParaPlanificar(estrategias, piezas, conEpisodio).find(
    (e) => e.id === estrategiaId,
  );
  if (!estrategia) {
    refresh();
    return { error: ESTRATEGIA_NO_DISPONIBLE };
  }
  let nuevas: NuevaPiezaDePlan[];
  try {
    nuevas = generarPiezasDePlan(estrategia, piezas, diaD);
  } catch {
    // No debería pasar: una estrategia disponible tiene todas sus piezas. Si una falta, la
    // estrategia tampoco se puede usar.
    refresh();
    return { error: ESTRATEGIA_NO_DISPONIBLE };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc('crear_plan', {
    plan: aFilaPlan({
      lunes,
      diaD,
      conEpisodio,
      numero,
      invitado: conEpisodio ? limpiar(entrada.invitado) : null,
      tema: conEpisodio ? limpiar(entrada.tema) : null,
      estrategiaId: estrategia.id,
      estrategiaNombre: estrategia.nombre,
    }),
    piezas: nuevas.map(aFilaPiezaDePlan),
  });

  if (error?.code === 'P0001' && error.message === 'semana_con_plan') {
    refresh();
    return { error: SEMANA_CON_PLAN };
  }
  if (error) return { error: NO_GUARDADO };

  refresh();
  return {};
}
