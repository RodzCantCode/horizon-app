'use server';

import { refresh } from 'next/cache';
import { aPieza, leerEstrategiasYPiezas } from '@/lib/datos/estrategias';
import { aFilaPiezaDePlan, aFilaPlan, leerPiezaDePlan } from '@/lib/datos/semanas';
import { diaSemana, diasEntre, esFecha, hoyEnMadrid, normalizarHora } from '@/lib/fechas';
import {
  copiarPieza,
  DESPLAZAMIENTOS,
  estrategiasParaPlanificar,
  generarPiezasDePlan,
  moverPiezaDePlan,
} from '@/lib/planes';
import { AVISO_PIEZA_CAMBIADA, AVISO_SEMANA_CAMBIADA, rangoSemanas } from '@/lib/semanas';
import { crearClienteServidor } from '@/lib/supabase/servidor';
import type { Estado, Estrategia, NuevaPiezaDePlan } from '@/lib/tipos';

// Acciones de servidor de la pantalla Semanas. Cada una devuelve `{ error }` con un texto para
// enseñar tal cual, o `{}` si ha ido bien; nunca el mensaje de Supabase, que viene en inglés.
// Los permisos los pone RLS: sin sesión, la base no deja escribir y la acción devuelve el error.
// Lo que llega del navegador se vuelve a comprobar aquí, y lo que hace falta saber del plan (su día
// D, si tiene episodio, sus piezas) se lee de la base, no del panel.
// Los avisos de panel desfasado (AVISO_*) viven en lib/semanas.ts: los paneles los reconocen
// (esAvisoDeDesfase) para salir del modo edición.

const PIEZA_QUITADA = 'Esa pieza ya no está en el plan';
const PLAN_NO_EXISTE = 'Ese plan ya no existe';
const NO_GUARDADO = 'No se ha podido guardar. Vuelve a intentarlo.';
const SEMANA_NO_VALIDA = 'Esa semana no es válida';
const DIA_FUERA_DE_LA_SEMANA = 'El día de publicación tiene que caer en esa semana';
const DIA_FUERA_DEL_PLAN = 'El día tiene que estar entre D-1 y D+5';
const FECHA_NO_VALIDA = 'Esa fecha no es válida';
const HORA_NO_VALIDA = 'Esa hora no es válida';
const FALTA_NUMERO = 'Falta el número del episodio';
const SIN_EPISODIO = 'Esa semana no tiene episodio';
const ESTRATEGIA_NO_DISPONIBLE = 'Esa estrategia ya no está disponible';
const PIEZA_NO_DISPONIBLE = 'Esa pieza ya no está disponible';
const SEMANA_CON_PLAN = 'Esa semana ya tiene plan';
const FUERA_DE_LA_PORTADA = 'Solo se puede mover dentro de las semanas que se ven en la portada.';

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
 * La estrategia elegida y las piezas que genera desde el día D, con las estrategias y las piezas de
 * la base: solo si existe, es del tipo que toca y no usa piezas archivadas. Si no, el error que hay
 * que devolver; cuando la estrategia ya no se puede usar, refresca para que el panel deje de
 * ofrecerla. Las piezas las genera siempre el servidor, nunca las manda el navegador.
 */
async function generarConEstrategia(
  estrategiaId: string,
  conEpisodio: boolean,
  diaD: string,
): Promise<{ estrategia: Estrategia; nuevas: NuevaPiezaDePlan[] } | { error: string }> {
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
  if (estrategia) {
    try {
      return { estrategia, nuevas: generarPiezasDePlan(estrategia, piezas, diaD) };
    } catch {
      // No debería pasar: una estrategia disponible tiene todas sus piezas. Si una falta, la
      // estrategia tampoco se puede usar.
    }
  }
  refresh();
  return { error: ESTRATEGIA_NO_DISPONIBLE };
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

  const generadas = await generarConEstrategia(estrategiaId, conEpisodio, diaD);
  if ('error' in generadas) return generadas;
  const { estrategia, nuevas } = generadas;

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
      horaEpisodio: null,
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

// --- Modo edición (docs/diseno.md § Paneles de detalle) --------------------------------------------

/** La hora que manda un panel: vacía es «sin hora» (`null`); si no es una hora, `undefined`. */
function leerHora(texto: string | null): string | null | undefined {
  const limpia = limpiar(texto);
  return limpia === null ? null : (normalizarHora(limpia) ?? undefined);
}

/** Cuántos días hay de D a `fecha`, si cae de D-1 a D+5; si no, `null`. */
function desplazamientoEnElPlan(diaD: string, fecha: string): number | null {
  const desplazamiento = diasEntre(diaD, fecha);
  return DESPLAZAMIENTOS.includes(desplazamiento) ? desplazamiento : null;
}

/**
 * Los errores de las funciones de la base que dicen que el panel se ha quedado desfasado (otra
 * persona ha movido o borrado el plan), ya en español; `null` si es otro error o no hay error.
 */
function avisoDePlanDesfasado(error: { code: string; message: string } | null): string | null {
  if (error?.code !== 'P0001') return null;
  if (error.message === 'semana_con_plan') return SEMANA_CON_PLAN;
  if (error.message === 'plan_no_existe') return PLAN_NO_EXISTE;
  return null;
}

/**
 * Cambia el día y la hora de una pieza de plan. La pieza y su plan se leen de la base: el día tiene
 * que caer de D-1 a D+5 de ese plan y su posición respecto a D se recalcula. Si estaba programada y
 * cambia de verdad, `moverPiezaDePlan` la devuelve a pendiente y la marca para revisar en Metricool.
 * Una hora vacía es «sin hora». Si la pieza ya no existe, lo dice y refresca, como marcarEstado.
 *
 * `original` es el día y la hora que enseñaba el panel. Si la pieza ya no está ahí (otra persona ha
 * movido la semana o la pieza con el panel abierto), no se guarda: guardar el día del panel desharía
 * ese cambio sin avisar. Por lo mismo, el cambio solo se aplica si la fila sigue con el día y el
 * estado que se leyeron. En los dos casos se avisa y se refresca, para que el panel se ponga al día.
 */
export async function editarPiezaDePlan(
  id: string,
  fecha: string,
  hora: string | null,
  original: { fecha: string; hora: string | null },
): Promise<{ error?: string }> {
  const horaNueva = leerHora(hora);
  if (horaNueva === undefined) return { error: HORA_NO_VALIDA };
  if (!esFecha(fecha)) return { error: DIA_FUERA_DEL_PLAN };

  let leida: Awaited<ReturnType<typeof leerPiezaDePlan>>;
  try {
    leida = await leerPiezaDePlan(id);
  } catch {
    return { error: NO_GUARDADO };
  }
  if (leida === null) {
    refresh();
    return { error: PIEZA_QUITADA };
  }
  if (leida.pieza.fecha !== original.fecha || leida.pieza.hora !== original.hora) {
    refresh();
    return { error: AVISO_PIEZA_CAMBIADA };
  }
  const desplazamiento = desplazamientoEnElPlan(leida.plan.diaD, fecha);
  if (desplazamiento === null) {
    // Los días del panel salen de su día D, que puede no ser ya el de la base.
    refresh();
    return { error: DIA_FUERA_DEL_PLAN };
  }

  const movida = moverPiezaDePlan(leida.pieza, fecha, horaNueva);
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from('plan_piezas')
    .update({
      fecha: movida.fecha,
      hora: movida.hora,
      desplazamiento,
      estado: movida.estado,
      revisar: movida.revisar,
    })
    .eq('id', id)
    .eq('fecha', leida.pieza.fecha)
    .eq('estado', leida.pieza.estado)
    .select('id');

  if (error) return { error: NO_GUARDADO };

  refresh();
  // Ninguna fila: entre la lectura y el cambio, otra persona la ha movido, marcado o quitado.
  if (data.length === 0) return { error: AVISO_PIEZA_CAMBIADA };
  return {};
}

/**
 * Quita una pieza de su plan: borra esa fila y solo esa, filtrando por su id. La estrategia y la
 * pieza de origen no cambian. Si ya no estaba (otra persona la quitó antes), lo dice y refresca.
 */
export async function quitarPiezaDePlan(id: string): Promise<{ error?: string }> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from('plan_piezas').delete().eq('id', id).select('id');

  if (error) return { error: NO_GUARDADO };

  refresh();
  if (data.length === 0) return { error: PIEZA_QUITADA };
  return {};
}

/** Lo que manda el panel de una semana al editar los datos de su episodio. */
export type DatosEpisodio = {
  numero: string | null;
  invitado: string | null;
  tema: string | null;
};

/**
 * Cambia número, invitado y tema del episodio de un plan. El número hace falta; invitado y tema
 * pueden quedar vacíos. Una semana sin episodio no los tiene: se comprueba en la base.
 */
export async function editarEpisodio(planId: string, datos: DatosEpisodio): Promise<{ error?: string }> {
  const numero = limpiar(datos.numero);
  if (numero === null) return { error: FALTA_NUMERO };

  const supabase = await crearClienteServidor();
  const leido = await supabase.from('planes').select('con_episodio').eq('id', planId).maybeSingle();
  if (leido.error) return { error: NO_GUARDADO };
  if (leido.data === null) {
    refresh();
    return { error: PLAN_NO_EXISTE };
  }
  if (!leido.data.con_episodio) return { error: SIN_EPISODIO };

  const { data, error } = await supabase
    .from('planes')
    .update({ numero, invitado: limpiar(datos.invitado), tema: limpiar(datos.tema) })
    .eq('id', planId)
    .select('id');

  if (error) return { error: NO_GUARDADO };

  refresh();
  if (data.length === 0) return { error: PLAN_NO_EXISTE };
  return {};
}

/**
 * Añade a un plan una pieza que no venía en su estrategia: una copia fija de la pieza de la base
 * (`copiarPieza`), en un día de D-1 a D+5 de ese plan y a la hora elegida (vacía, sin hora). Una pieza
 * archivada o que ya no existe no se puede añadir. Empieza pendiente, como todas.
 *
 * `diaDEsperado` es el día D que enseñaba el panel, del que salen los días que ofrece. Si el plan ya
 * tiene otro (otra persona ha movido la semana con el panel abierto), no se añade: el día elegido
 * caería en otro sitio respecto a D. Se avisa y se refresca.
 */
export async function anadirPiezaSuelta(
  planId: string,
  piezaId: string,
  fecha: string,
  hora: string | null,
  diaDEsperado: string,
): Promise<{ error?: string }> {
  const horaElegida = leerHora(hora);
  if (horaElegida === undefined) return { error: HORA_NO_VALIDA };
  if (!esFecha(fecha)) return { error: DIA_FUERA_DEL_PLAN };

  const supabase = await crearClienteServidor();
  const [plan, pieza] = await Promise.all([
    supabase.from('planes').select('dia_d').eq('id', planId).maybeSingle(),
    supabase.from('piezas').select('*').eq('id', piezaId).maybeSingle(),
  ]);
  if (plan.error || pieza.error) return { error: NO_GUARDADO };
  if (plan.data === null) {
    refresh();
    return { error: PLAN_NO_EXISTE };
  }
  if (plan.data.dia_d !== diaDEsperado) {
    refresh();
    return { error: AVISO_SEMANA_CAMBIADA };
  }
  if (pieza.data === null || pieza.data.archivada) {
    refresh();
    return { error: PIEZA_NO_DISPONIBLE };
  }
  const diaD = plan.data.dia_d;
  const desplazamiento = desplazamientoEnElPlan(diaD, fecha);
  if (desplazamiento === null) return { error: DIA_FUERA_DEL_PLAN };

  let nueva: NuevaPiezaDePlan;
  try {
    nueva = { ...copiarPieza(aPieza(pieza.data), diaD, desplazamiento), hora: horaElegida };
  } catch {
    // aPieza lanza si la fila trae un formato o un canal que la app no conoce.
    return { error: NO_GUARDADO };
  }
  const { error } = await supabase.from('plan_piezas').insert({ ...aFilaPiezaDePlan(nueva), plan_id: planId });

  // 23503: la clave ajena del plan ya no apunta a nada (otra persona lo ha borrado entretanto).
  if (error?.code === '23503') {
    refresh();
    return { error: PLAN_NO_EXISTE };
  }
  if (error) return { error: NO_GUARDADO };

  refresh();
  return {};
}

/**
 * Mueve la semana entera de fecha con la función `mover_plan` de la base: el día D pasa a
 * `nuevoDiaD` y todas las piezas se mueven los mismos días; las programadas quedan para revisar en
 * Metricool. Si el nuevo D cae en otra semana que ya tiene plan, no cambia nada.
 *
 * El nuevo D tiene que caer en las semanas que pinta la portada hoy (`rangoSemanas`): más allá, el
 * plan dejaría de verse y no habría desde dónde abrirlo para volver a moverlo.
 */
export async function moverSemana(planId: string, nuevoDiaD: string): Promise<{ error?: string }> {
  if (!esFecha(nuevoDiaD)) return { error: FECHA_NO_VALIDA };

  // «Hoy» después de crear el cliente, que espera a la petición real (lib/supabase/servidor.ts).
  const supabase = await crearClienteServidor();
  const { desde, hasta } = rangoSemanas(hoyEnMadrid());
  if (nuevoDiaD < desde || nuevoDiaD > hasta) return { error: FUERA_DE_LA_PORTADA };

  const { error } = await supabase.rpc('mover_plan', { plan_id: planId, nuevo_dia_d: nuevoDiaD });

  const desfase = avisoDePlanDesfasado(error);
  if (desfase) {
    refresh();
    return { error: desfase };
  }
  if (error) return { error: NO_GUARDADO };

  refresh();
  return {};
}

/**
 * Cambia la estrategia de un plan con la función `cambiar_estrategia` de la base: sus piezas se
 * sustituyen por las que genera la nueva desde el día D que tiene el plan en la base (no el del
 * panel). La estrategia tiene que ser del mismo tipo (con o sin episodio) y no usar piezas
 * archivadas.
 *
 * Las piezas ya programadas en Metricool se pierden, así que, si hay alguna y no viene
 * `confirmado`, no cambia nada y devuelve `{ error: 'confirmar' }`: el panel lo pregunta y vuelve a
 * llamar con `confirmado: true`.
 */
export async function cambiarEstrategiaDePlan(
  planId: string,
  estrategiaId: string,
  confirmado: boolean,
): Promise<{ error?: string }> {
  const supabase = await crearClienteServidor();
  const leido = await supabase
    .from('planes')
    .select('dia_d, con_episodio, plan_piezas(estado)')
    .eq('id', planId)
    .maybeSingle();
  if (leido.error) return { error: NO_GUARDADO };
  if (leido.data === null) {
    refresh();
    return { error: PLAN_NO_EXISTE };
  }
  const plan = leido.data;

  const generadas = await generarConEstrategia(estrategiaId, plan.con_episodio, plan.dia_d);
  if ('error' in generadas) return generadas;
  const { estrategia, nuevas } = generadas;

  if (!confirmado && plan.plan_piezas.some((p) => p.estado === 'programada')) {
    return { error: 'confirmar' };
  }

  const { error } = await supabase.rpc('cambiar_estrategia', {
    plan_id: planId,
    estrategia_id: estrategia.id,
    estrategia_nombre: estrategia.nombre,
    piezas: nuevas.map(aFilaPiezaDePlan),
  });

  const desfase = avisoDePlanDesfasado(error);
  if (desfase) {
    refresh();
    return { error: desfase };
  }
  if (error) return { error: NO_GUARDADO };

  refresh();
  return {};
}
