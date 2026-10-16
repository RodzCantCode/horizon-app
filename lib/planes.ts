// Lógica pura de los planes: generar sus piezas, avisar de las que van justas, moverlas y proponer
// número y día D del siguiente. Sin acceso a datos: recibe y devuelve valores, así se prueba entera.
//
// Fechas `YYYY-MM-DD` y horas `HH:MM` de reloj en `Europe/Madrid`; la aritmética de días es de
// `lib/fechas.ts`.

import { diaSemana, diasEntre, sumarDias } from '@/lib/fechas';
import type { Estrategia, NuevaPiezaDePlan, Pieza, PiezaDePlan, Plan } from '@/lib/tipos';

/** Por fecha; dentro del día, por hora y con las que no tienen hora al final. */
function compararFechaYHora(a: NuevaPiezaDePlan, b: NuevaPiezaDePlan): number {
  if (a.fecha !== b.fecha) return a.fecha < b.fecha ? -1 : 1;
  if (a.hora === b.hora) return 0;
  if (a.hora === null) return 1;
  if (b.hora === null) return -1;
  return a.hora < b.hora ? -1 : 1;
}

/**
 * Piezas de un plan a partir de una estrategia y el día D. Cada una es una copia fija de la pieza en
 * ese momento: editarla o archivarla después no cambia lo generado. Salen ordenadas por fecha y hora;
 * a igual fecha y hora se mantiene el orden de la estrategia.
 */
export function generarPiezasDePlan(
  estrategia: Estrategia,
  piezas: Pieza[],
  diaD: string,
): NuevaPiezaDePlan[] {
  const generadas = estrategia.items.map(({ piezaId, desplazamiento }): NuevaPiezaDePlan => {
    const pieza = piezas.find((p) => p.id === piezaId);
    if (!pieza) {
      throw new Error(`La estrategia «${estrategia.nombre}» usa la pieza «${piezaId}», que no existe`);
    }
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

/** Una estrategia solo se ofrece si todas sus piezas existen y ninguna está archivada. */
export function estrategiaDisponible(e: Estrategia, piezas: Pieza[]): boolean {
  return e.items.every((item) => {
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

/** Si la pieza puede ir en ese desplazamiento respecto al día D. */
export function diaPermitido(pieza: Pieza, desplazamiento: number): boolean {
  return pieza.diasPermitidos.includes(desplazamiento);
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
