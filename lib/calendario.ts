// Lógica pura del Calendario: qué tres semanas se ven, qué tarjetas (posts y episodio) tiene cada
// día y los textos que las acompañan. Sin acceso a datos: recibe los planes y los posts ya leídos
// (`lib/datos/`) y el día de hoy en España (`hoyEnMadrid`), así se prueba entera.
//
// Fechas `YYYY-MM-DD` y horas `HH:MM` de reloj en `Europe/Madrid`; la aritmética de días es de
// `lib/fechas.ts`.

import { diaSemana, esFecha, lunesDe, sumarDias } from '@/lib/fechas';
import { compararFechaYHora } from '@/lib/planes';
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
export function etiquetaDe(plan: Plan): string {
  if (!plan.conEpisodio) return 'Sin episodio';
  return plan.numero === null ? 'Del episodio' : `Del ${plan.numero}`;
}

/** Hora de una tarjeta, para ordenarla dentro del día. El episodio sin hora va al final. */
function horaDe(tarjeta: TarjetaCalendario): string | null {
  return tarjeta.tipo === 'post' ? tarjeta.pieza.hora : tarjeta.plan.horaEpisodio;
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
      // `sort` es estable: a igual hora se mantiene el orden de llegada (posts, luego episodios).
      const tarjetas = [...(tarjetasPorFecha.get(fecha) ?? [])].sort((a, b) =>
        compararFechaYHora({ fecha, hora: horaDe(a) }, { fecha, hora: horaDe(b) }),
      );
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
