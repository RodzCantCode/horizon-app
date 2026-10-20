// Lógica pura del Calendario: qué tres semanas se ven, qué tarjetas (posts y episodio) tiene cada
// día y los textos que las acompañan. Sin acceso a datos: recibe los planes y los posts ya leídos
// (`lib/datos/`) y el día de hoy en España (`hoyEnMadrid`), así se prueba entera.
//
// Fechas `YYYY-MM-DD` y horas `HH:MM` de reloj en `Europe/Madrid`; la aritmética de días es de
// `lib/fechas.ts`.

import { diaSemana, esFecha, lunesDe, sumarDias } from '@/lib/fechas';
import { compararFechaYHora, moverPiezaDePlan } from '@/lib/planes';
import type { Estrategia, PiezaDePlan, Plan } from '@/lib/tipos';

/**
 * Lo que se pinta en un día: un post (con de qué episodio es: «Del 06», «Del episodio» o «Sin
 * episodio») o el episodio de un plan. `de` va vacío si el plan del post no estaba entre los planes
 * recibidos: el post sale igual en su día, que es lo importante.
 */
export type TarjetaCalendario =
  | { tipo: 'post'; pieza: PiezaDePlan; de: string }
  | { tipo: 'episodio'; plan: Plan };

export type DiaCalendario = {
  fecha: string;
  esHoy: boolean;
  esPasado: boolean;
  /** Ordenadas por hora, con las que no tienen hora al final; el episodio entra con su hora. */
  tarjetas: TarjetaCalendario[];
};

export type SemanaCalendario = {
  lunes: string;
  plan: Plan | null;
  /** De lunes a domingo. */
  dias: DiaCalendario[];
};

/** Cuántas semanas seguidas se ven. */
export const SEMANAS_CALENDARIO = 3;

const DIAS_POR_SEMANA = 7;

/**
 * Lunes con que empieza lo que se ve. Viene de la URL (`?desde=`), así que cualquier texto es
 * posible: el pedido si es una fecha que existe y cae en lunes; si no, el lunes de la semana de hoy,
 * sin error.
 */
export function inicioCalendario(desde: string | undefined, hoy: string): string {
  if (desde !== undefined && esFecha(desde) && diaSemana(desde) === 0) return desde;
  return lunesDe(hoy);
}

/** Del lunes dado al domingo de la última semana que se ve. */
export function rangoCalendario(lunes: string): { desde: string; hasta: string } {
  return { desde: lunes, hasta: sumarDias(lunes, SEMANAS_CALENDARIO * DIAS_POR_SEMANA - 1) };
}

/** De qué episodio es un post: «Del 06», «Del episodio» (sin número) o «Sin episodio». */
export function etiquetaDe(plan: Pick<Plan, 'conEpisodio' | 'numero'>): string {
  if (!plan.conEpisodio) return 'Sin episodio';
  return plan.numero === null ? 'Del episodio' : `Del ${plan.numero}`;
}

/** Lo que dice la tarjeta del episodio: «Episodio 06», o «Episodio» si aún no tiene número. */
export function tituloEpisodio(plan: Pick<Plan, 'numero'>): string {
  return plan.numero === null ? 'Episodio' : `Episodio ${plan.numero}`;
}

/** Hora de una tarjeta, para ordenarla dentro del día. El episodio sin hora va al final. */
function horaDe(tarjeta: TarjetaCalendario): string | null {
  return tarjeta.tipo === 'post' ? tarjeta.pieza.hora : tarjeta.plan.horaEpisodio;
}

/**
 * Las tarjetas de un día por hora, las que no tienen al final. `sort` es estable: a igual hora se
 * mantiene el orden en que llegan.
 */
function ordenarDelDia(fecha: string, tarjetas: TarjetaCalendario[]): TarjetaCalendario[] {
  return [...tarjetas].sort((a, b) => compararFechaYHora({ fecha, hora: horaDe(a) }, { fecha, hora: horaDe(b) }));
}

/**
 * Las `SEMANAS_CALENDARIO` semanas que empiezan en `lunes` (que ya es lunes: ver `inicioCalendario`).
 * Cada post va al día de su fecha, sea de un plan de esa semana o de otro: el D+4 de un plan del
 * viernes sale en la semana siguiente aunque esa no tenga plan. El episodio de cada plan con episodio
 * va a su `diaD`. Lo que cae fuera de esas semanas se ignora.
 */
export function construirCalendario(
  planes: Plan[],
  piezas: PiezaDePlan[],
  hoy: string,
  lunes: string,
): SemanaCalendario[] {
  const tarjetasPorFecha = new Map<string, TarjetaCalendario[]>();
  const agregar = (fecha: string, tarjeta: TarjetaCalendario) => {
    const delDia = tarjetasPorFecha.get(fecha) ?? [];
    delDia.push(tarjeta);
    tarjetasPorFecha.set(fecha, delDia);
  };

  for (const pieza of piezas) {
    const plan = planes.find((p) => p.id === pieza.planId);
    agregar(pieza.fecha, { tipo: 'post', pieza, de: plan ? etiquetaDe(plan) : '' });
  }
  for (const plan of planes) {
    if (plan.conEpisodio) agregar(plan.diaD, { tipo: 'episodio', plan });
  }

  const semanas: SemanaCalendario[] = [];
  for (let s = 0; s < SEMANAS_CALENDARIO; s++) {
    const lunesDeLaSemana = sumarDias(lunes, s * DIAS_POR_SEMANA);
    const dias: DiaCalendario[] = [];
    for (let d = 0; d < DIAS_POR_SEMANA; d++) {
      const fecha = sumarDias(lunesDeLaSemana, d);
      // A igual hora, en el orden de llegada: posts, luego episodios.
      const tarjetas = ordenarDelDia(fecha, tarjetasPorFecha.get(fecha) ?? []);
      dias.push({ fecha, esHoy: fecha === hoy, esPasado: fecha < hoy, tarjetas });
    }
    semanas.push({
      lunes: lunesDeLaSemana,
      plan: planes.find((p) => p.lunes === lunesDeLaSemana) ?? null,
      dias,
    });
  }
  return semanas;
}

/** Una tarjeta guardada que se ha soltado en otro día: un post (por su id) o el episodio de un plan. */
export type Movimiento = { tipo: 'post'; id: string; fecha: string } | { tipo: 'episodio'; planId: string; fecha: string };

/**
 * Las semanas con la tarjeta del movimiento ya en su día nuevo: lo que enseña el Calendario mientras
 * se guarda (su estado optimista). El post cambia de fecha como lo hará en la base
 * (`moverPiezaDePlan`: si estaba programado, vuelve a pendiente y queda para revisar); el episodio
 * cambia de día D y de semana, y sus posts no se mueven. Si el día nuevo no se ve, la tarjeta deja de
 * verse; si la tarjeta no está, las semanas no cambian.
 */
export function moverTarjeta(semanas: SemanaCalendario[], movimiento: Movimiento): SemanaCalendario[] {
  const esLaMovida = (t: TarjetaCalendario) =>
    movimiento.tipo === 'post'
      ? t.tipo === 'post' && t.pieza.id === movimiento.id
      : t.tipo === 'episodio' && t.plan.id === movimiento.planId;

  let movida: TarjetaCalendario | undefined;
  for (const semana of semanas) {
    for (const dia of semana.dias) movida ??= dia.tarjetas.find(esLaMovida);
  }
  if (movida === undefined) return semanas;

  const { fecha } = movimiento;
  const nueva: TarjetaCalendario =
    movida.tipo === 'post'
      ? { ...movida, pieza: moverPiezaDePlan(movida.pieza, fecha, movida.pieza.hora) }
      : { ...movida, plan: { ...movida.plan, diaD: fecha, lunes: lunesDe(fecha) } };

  return semanas.map((semana) => ({
    ...semana,
    dias: semana.dias.map((dia) => {
      const tarjetas = dia.tarjetas.filter((t) => !esLaMovida(t));
      return { ...dia, tarjetas: dia.fecha === fecha ? ordenarDelDia(fecha, [...tarjetas, nueva]) : tarjetas };
    }),
  }));
}

/** Lo que muestra siempre la mini fila de una estrategia: de D-2 a D+12, aunque no se use todo. */
const MINI_FILA_DESDE = -2;
const MINI_FILA_HASTA = 12;

/**
 * Días respecto a D que dibuja la mini fila de una estrategia: de D-2 a D+12, ampliados si la
 * estrategia tiene ítems fuera de ahí.
 */
export function rangoMiniFila(estrategia: Estrategia): { desde: number; hasta: number } {
  const desplazamientos = estrategia.items.map((i) => i.desplazamiento);
  return {
    desde: Math.min(MINI_FILA_DESDE, ...desplazamientos),
    hasta: Math.max(MINI_FILA_HASTA, ...desplazamientos),
  };
}
