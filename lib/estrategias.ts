// Lógica pura de la sección Estrategias (docs/diseno.md § Estrategias): los textos de sus listas y
// paneles, qué estrategias usan una pieza y qué piezas se pueden poner en un día de una estrategia.
// Sin acceso a datos: recibe las estrategias y las piezas ya leídas (`lib/datos/estrategias.ts`).

import { estrategiaDisponible } from '@/lib/planes';
import { textoCanales, textoFormato, textoPreparacion } from '@/lib/semanas';
import type { Estrategia, Pieza } from '@/lib/tipos';

/** Lo que lleva la URL (`?estrategia=nueva`, `?pieza=nueva`) para abrir el panel de crear una. */
export const NUEVA = 'nueva';

/**
 * La línea de una pieza en la lista: formato, canales, preparación y hora habitual. Sin los días
 * permitidos, que ya no se usan. «Carrusel · Instagram, TikTok · 3 días de preparación · sin hora».
 */
export function resumenPieza(p: Pieza): string {
  return [
    textoFormato(p.formato),
    p.canales.map((c) => textoCanales([c])).join(', '),
    `${textoPreparacion(p.diasPreparacion)} de preparación`,
    p.horaHabitual ?? 'sin hora',
  ].join(' · ');
}

/** «A», «A y B», «A, B y C». */
function enumerar(nombres: string[]): string {
  if (nombres.length <= 1) return nombres.join('');
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
}

/**
 * Por qué no se ofrece una estrategia al planificar: que no tiene piezas, o las archivadas que usa,
 * cada una una vez («No disponible: Teaser está archivada»). `null` si se puede usar
 * (`estrategiaDisponible`).
 */
export function motivoNoDisponible(e: Estrategia, piezas: Pieza[]): string | null {
  if (estrategiaDisponible(e, piezas)) return null;
  if (e.items.length === 0) return 'No disponible: no tiene piezas';
  const archivadas = piezas.filter((p) => p.archivada && e.items.some((i) => i.piezaId === p.id));
  // Una pieza en uso no se puede borrar (la base lo impide); si aun así falta, se dice.
  if (archivadas.length === 0) return 'No disponible: usa una pieza que ya no existe';
  const nombres = enumerar(archivadas.map((p) => p.nombre));
  return archivadas.length === 1
    ? `No disponible: ${nombres} está archivada`
    : `No disponible: ${nombres} están archivadas`;
}

/** Las estrategias que tienen esa pieza en algún día. */
export function estrategiasQueUsan(piezaId: string, estrategias: Estrategia[]): Estrategia[] {
  return estrategias.filter((e) => e.items.some((i) => i.piezaId === piezaId));
}

/** Lo que se pregunta antes de archivar una pieza que usan `cuantas` estrategias. */
export function preguntaArchivar(cuantas: number): string {
  return cuantas === 1
    ? 'La usa 1 estrategia, que dejará de ofrecerse al planificar. ¿Archivar igualmente?'
    : `La usan ${cuantas} estrategias, que dejarán de ofrecerse al planificar. ¿Archivar igualmente?`;
}

/**
 * Las piezas que se pueden poner en ese día de una estrategia: las no archivadas que no están ya en
 * él (cualquier pieza puede ir cualquier día). En el orden en que llegan.
 */
export function piezasParaAnadir(
  piezas: Pieza[],
  items: Estrategia['items'],
  desplazamiento: number,
): Pieza[] {
  return piezas.filter(
    (p) =>
      !p.archivada &&
      !items.some((i) => i.piezaId === p.id && i.desplazamiento === desplazamiento),
  );
}
