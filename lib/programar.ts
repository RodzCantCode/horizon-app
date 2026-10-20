// Lógica pura del modo programar del Calendario (docs/rediseno-calendario.md § Programar un episodio
// nuevo): el borrador de un plan mientras se coloca, antes de guardarlo con `crearPlan`. Sin acceso a
// datos ni pantalla: recibe y devuelve valores, así se prueba entera. Ninguna función cambia el
// borrador que recibe.
//
// Fechas `YYYY-MM-DD` y horas `HH:MM` de reloj en `Europe/Madrid`; la aritmética de días es de
// `lib/fechas.ts`.

import { lunesDe, sumarDias } from '@/lib/fechas';
import { generarPiezasDePlan } from '@/lib/planes';
import type { Estrategia, NuevaPiezaDePlan, Pieza, Plan } from '@/lib/tipos';

/**
 * Lo que se está programando. `diaD` es el día del episodio o, sin episodio, el de referencia.
 * `horaEpisodio` es lo que se ha escrito en el campo de la hora (sin normalizar: lo comprueba
 * `crearPlan`), `null` si está vacío.
 *
 * `fechas` va alineado con `estrategia.items` (lo que espera `crearPlan`): una por ítem, `null`
 * mientras el post siga donde lo pone la estrategia respecto a D, o la fecha a la que se ha llevado.
 * Vacío mientras no hay estrategia elegida.
 */
export type Borrador = {
  conEpisodio: boolean;
  diaD: string;
  horaEpisodio: string | null;
  estrategiaId: string | null;
  fechas: (string | null)[];
};

/** Un post del borrador, con el índice de su ítem en la estrategia (lo que se mueve al arrastrarlo). */
export type PostDelBorrador = NuevaPiezaDePlan & { indice: number };

/** Al entrar en el modo programar: con episodio, en `diaD`, sin estrategia y sin posts. */
export function borradorNuevo(diaD: string, horaEpisodio: string | null): Borrador {
  return { conEpisodio: true, diaD, horaEpisodio, estrategiaId: null, fechas: [] };
}

/**
 * Elige una estrategia: sus posts se pegan alrededor de D (todas las fechas a `null`, las de la
 * estrategia). Sustituye los de la que hubiera, también los que se habían movido; volver a elegir la
 * misma los vuelve a pegar. Recibe la estrategia, no solo su id, para dejar una fecha por ítem.
 */
export function elegirEstrategia(b: Borrador, estrategia: Estrategia): Borrador {
  return { ...b, estrategiaId: estrategia.id, fechas: estrategia.items.map(() => null) };
}

/**
 * Cambia «¿Hay episodio?». Las estrategias son de un tipo o del otro, así que la elegida se quita y
 * sus posts con ella. D se queda donde estaba (pasa a ser el día de referencia, o al revés).
 */
export function cambiarConEpisodio(b: Borrador, conEpisodio: boolean): Borrador {
  if (b.conEpisodio === conEpisodio) return b;
  return { ...b, conEpisodio, estrategiaId: null, fechas: [] };
}

/** Lleva el post del ítem `indice` a `fecha`, por lejos de D que quede. Los demás no cambian. */
export function moverPost(b: Borrador, indice: number, fecha: string): Borrador {
  return { ...b, fechas: b.fechas.map((f, i) => (i === indice ? fecha : f)) };
}

/**
 * Mueve solo el episodio (o el día de referencia): cambia D y cada post se queda en su fecha
 * (decidido por Mario: nada se mueve solo). Para eso, los que seguían pegados a D (`null`) se fijan
 * en la fecha que tenían con el D de antes, con los días de `estrategia` (la elegida; `null` si aún
 * no hay ninguna, y entonces solo cambia D).
 */
export function moverEpisodioBorrador(b: Borrador, fecha: string, estrategia: Estrategia | null): Borrador {
  const fechas = b.fechas.map((f, i) => {
    if (f !== null) return f;
    const item = estrategia?.items[i];
    return item ? sumarDias(b.diaD, item.desplazamiento) : null;
  });
  return { ...b, diaD: fecha, fechas };
}

/**
 * Los posts que se ven del borrador, en el orden de los ítems de la estrategia (no por fecha: cada
 * uno lleva su `indice`, que es lo que se mueve). Son los mismos que generará `crearPlan` con
 * `generarPiezasDePlan(estrategia, piezas, diaD, fechas)`: copias pendientes con la hora habitual de
 * cada pieza y su desplazamiento respecto a D. Se generan ítem a ítem porque `generarPiezasDePlan`
 * devuelve las suyas ordenadas por fecha y hora, sin decir de qué ítem es cada una.
 */
export function postsDelBorrador(b: Borrador, estrategia: Estrategia, piezas: Pieza[]): PostDelBorrador[] {
  return estrategia.items.map((item, indice) => {
    const [post] = generarPiezasDePlan({ ...estrategia, items: [item] }, piezas, b.diaD, [b.fechas[indice] ?? null]);
    return { ...post, indice };
  });
}

/** La semana que propone **Programar**: la siguiente a la de hoy, o la primera después sin plan. */
export function semanaParaProgramar(planes: Plan[], hoy: string): string {
  const conPlan = new Set(planes.map((p) => p.lunes));
  let lunes = sumarDias(lunesDe(hoy), 7);
  while (conPlan.has(lunes)) lunes = sumarDias(lunes, 7);
  return lunes;
}

/** Hora que se propone para el episodio: la del último episodio (`null` si no la tenía o no hay). */
export function proponerHoraEpisodio(planes: Plan[]): string | null {
  let ultimo: Plan | null = null;
  for (const p of planes) {
    if (p.conEpisodio && (ultimo === null || p.diaD > ultimo.diaD)) ultimo = p;
  }
  return ultimo?.horaEpisodio ?? null;
}
