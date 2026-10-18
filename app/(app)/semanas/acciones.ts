'use server';

import { refresh } from 'next/cache';
import { crearClienteServidor } from '@/lib/supabase/servidor';
import type { Estado } from '@/lib/tipos';

// Acciones de servidor de la pantalla Semanas. Cada una devuelve `{ error }` con un texto para
// enseñar tal cual, o `{}` si ha ido bien; nunca el mensaje de Supabase, que viene en inglés.
// Los permisos los pone RLS: sin sesión, la base no deja escribir y la acción devuelve el error.

const PIEZA_QUITADA = 'Esa pieza ya no está en el plan';
const NO_GUARDADO = 'No se ha podido guardar. Vuelve a intentarlo.';

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
