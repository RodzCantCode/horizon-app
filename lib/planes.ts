// Lógica pura de los planes: generar sus piezas, avisar de las que van justas, moverlas y proponer
// número y día D del siguiente. Sin acceso a datos: recibe y devuelve valores, así se prueba entera.
//
// Fechas `YYYY-MM-DD` y horas `HH:MM` de reloj en `Europe/Madrid`; la aritmética de días es de
// `lib/fechas.ts`.

import { diaSemana, diasEntre, sumarDias } from '@/lib/fechas';
import type { Estrategia, NuevaPiezaDePlan, Pieza, PiezaDePlan, Plan } from '@/lib/tipos';

/** Por fecha; dentro del día, por hora y con las que no tienen hora al final. */
export function compararFechaYHora(
  a: Pick<NuevaPiezaDePlan, 'fecha' | 'hora'>,
  b: Pick<NuevaPiezaDePlan, 'fecha' | 'hora'>,
): number {
  if (a.fecha !== b.fecha) return a.fecha < b.fecha ? -1 : 1;
  if (a.hora === b.hora) return 0;
  if (a.hora === null) return 1;
  if (b.hora === null) return -1;
  return a.hora < b.hora ? -1 : 1;
}

/**
 * Los días respecto a D en que puede ir una pieza, en una estrategia o en un plan: de D-1 a D+5 (el
 * mismo límite que pone la base en estrategia_piezas).
 *
 * Provisional: el rediseño del calendario lo sustituye por `DESPLAZAMIENTOS_ESTRATEGIA` y se quita
 * cuando cada pantalla que lo usa pase a la nueva.
 */
export const DESPLAZAMIENTOS: readonly number[] = [-1, 0, 1, 2, 3, 4, 5];

/**
 * Los días respecto a D que ofrece una estrategia: de D-7 a D+14 (el mismo límite que pone la base en
 * estrategia_piezas). Solo acota lo que se elige al crear o editar una estrategia: un post de un plan
 * puede llevarse a cualquier fecha (ver `desplazamientoDe`).
 */
export const DESPLAZAMIENTOS_ESTRATEGIA: readonly number[] = Array.from(
  { length: 22 },
  (_, i) => i - 7,
);

/** Días de D a la fecha, sin límite: un post llevado a D+20 o D-10 guarda 20 o -10. */
export function desplazamientoDe(diaD: string, fecha: string): number {
  return diasEntre(diaD, fecha);
}

/**
 * Copia fija de una pieza para un plan, en ese día respecto a D, con su hora habitual, pendiente y sin
 * marca de revisar. Editarla o archivarla después no cambia la copia.
 */
export function copiarPieza(pieza: Pieza, diaD: string, desplazamiento: number): NuevaPiezaDePlan {
  return {
    piezaId: pieza.id,
    nombre: pieza.nombre,
    nombreCorto: pieza.nombreCorto,
    formato: pieza.formato,
    canales: [...pieza.canales],
    diasPreparacion: pieza.diasPreparacion,
    desplazamiento,
    fecha: sumarDias(diaD, desplazamiento),
    hora: pieza.horaHabitual,
    estado: 'pendiente',
    revisar: false,
  };
}

/**
 * Piezas de un plan a partir de una estrategia y el día D. Cada una es una copia fija de la pieza en
 * ese momento (`copiarPieza`). Salen ordenadas por fecha y hora; a igual fecha y hora se mantiene el
 * orden de la estrategia.
 *
 * `fechas[i]`, si viene y no es `null`, sustituye la fecha del ítem `i` de la estrategia (en el orden
 * de `estrategia.items`) y su desplazamiento se recalcula con `desplazamientoDe`: es el caso de quien
 * coloca los posts a mano al programar una semana. Sin `fechas`, o con `null`, la de la estrategia.
 */
export function generarPiezasDePlan(
  estrategia: Estrategia,
  piezas: Pieza[],
  diaD: string,
  fechas?: (string | null)[],
): NuevaPiezaDePlan[] {
  const generadas = estrategia.items.map(({ piezaId, desplazamiento }, i): NuevaPiezaDePlan => {
    const pieza = piezas.find((p) => p.id === piezaId);
    if (!pieza) {
      throw new Error(`La estrategia «${estrategia.nombre}» usa la pieza «${piezaId}», que no existe`);
    }
    const fecha = fechas?.[i];
    return copiarPieza(pieza, diaD, fecha ? desplazamientoDe(diaD, fecha) : desplazamiento);
  });
  // `sort` es estable: las que empatan en fecha y hora conservan el orden de la estrategia.
  return generadas.sort(compararFechaYHora);
}

/**
 * Una pieza pendiente «va justa» cuando faltan sus días de preparación o menos para publicarla (o ya
 * pasó la fecha). Las programadas no avisan.
 */
export function vaJusta(
  p: Pick<PiezaDePlan, 'estado' | 'fecha' | 'diasPreparacion'>,
  hoy: string,
): boolean {
  return p.estado === 'pendiente' && diasEntre(hoy, p.fecha) <= p.diasPreparacion;
}

/** Pide atención si va justa o está marcada para revisar. */
export function necesitaAtencion(p: PiezaDePlan, hoy: string): boolean {
  return vaJusta(p, hoy) || p.revisar;
}

/**
 * Una estrategia solo se ofrece si tiene alguna pieza (sin ninguna daría un plan vacío), todas sus
 * piezas existen y ninguna está archivada.
 */
export function estrategiaDisponible(e: Estrategia, piezas: Pieza[]): boolean {
  return e.items.length > 0 && e.items.every((item) => {
    const pieza = piezas.find((p) => p.id === item.piezaId);
    return pieza !== undefined && !pieza.archivada;
  });
}

/** Estrategias que se pueden ofrecer al planificar una semana con o sin episodio. */
export function estrategiasParaPlanificar(
  es: Estrategia[],
  piezas: Pieza[],
  conEpisodio: boolean,
): Estrategia[] {
  return es.filter((e) => e.conEpisodio === conEpisodio && estrategiaDisponible(e, piezas));
}

/**
 * Mueve una pieza de plan a otra fecha u hora y devuelve una nueva (no modifica la recibida). Si ya
 * estaba programada en Metricool y la fecha o la hora cambian de verdad, vuelve a pendiente y queda
 * marcada para revisar; en cualquier otro caso conserva su estado y su marca.
 */
export function moverPiezaDePlan(
  p: PiezaDePlan,
  fecha: string,
  hora: string | null,
): PiezaDePlan {
  const cambia = fecha !== p.fecha || hora !== p.hora;
  if (cambia && p.estado === 'programada') {
    return { ...p, fecha, hora, estado: 'pendiente', revisar: true };
  }
  return { ...p, fecha, hora };
}

/**
 * Número del próximo episodio: el mayor número de los planes con episodio más uno, con al menos dos
 * cifras («05» → «06», «99» → «100»). Ignora los planes sin episodio y los que no tienen número o lo
 * tienen no numérico. Sin ninguno, `null`: la persona lo escribe.
 */
export function proponerNumero(planes: Plan[]): string | null {
  let mayor: number | null = null;
  for (const { conEpisodio, numero } of planes) {
    if (!conEpisodio || numero === null || !/^\d+$/.test(numero)) continue;
    const valor = Number.parseInt(numero, 10);
    if (mayor === null || valor > mayor) mayor = valor;
  }
  return mayor === null ? null : String(mayor + 1).padStart(2, '0');
}

/**
 * Día D que se propone para la semana que empieza en `lunes`: el mismo día de la semana que el
 * último plan con episodio. Sin ninguno, el viernes.
 */
export function proponerDiaD(planes: Plan[], lunes: string): string {
  const VIERNES = 4;
  let ultimo: string | null = null;
  for (const p of planes) {
    if (p.conEpisodio && (ultimo === null || p.diaD > ultimo)) ultimo = p.diaD;
  }
  return sumarDias(lunes, ultimo === null ? VIERNES : diaSemana(ultimo));
}
