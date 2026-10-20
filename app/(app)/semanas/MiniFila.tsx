import { rangoMiniFila } from '@/lib/calendario';
import { posicionRespectoAD } from '@/lib/semanas';
import type { Estrategia, Pieza } from '@/lib/tipos';
import estilos from './minifila.module.css';

/**
 * La mini fila de días de una estrategia: un cuadrado por día de `rangoMiniFila` (de D-2 a D+12,
 * más si la estrategia usa días fuera), con el de D marcado como el episodio y los que tienen piezas
 * en azul. La usan los paneles de planificar y de semana y la sección Estrategias. Los cuadrados solo
 * se ven: el lector de pantalla lee los días que tienen piezas, con sus nombres cortos («D+3 Clip
 * principal»).
 */
export function MiniFila({ estrategia, piezas }: { estrategia: Estrategia; piezas: Pieza[] }) {
  const { desde, hasta } = rangoMiniFila(estrategia);
  const dias = Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i);

  return (
    <ol className={estilos.fila}>
      {dias.map((desplazamiento) => {
        // Una pieza no se puede borrar mientras una estrategia la use (la base lo impide), así que
        // siempre está entre las leídas, archivada o no.
        const nombres = estrategia.items
          .filter((item) => item.desplazamiento === desplazamiento)
          .flatMap((item) => piezas.find((p) => p.id === item.piezaId)?.nombreCorto ?? []);
        const vacio = nombres.length === 0;
        return (
          <li
            key={desplazamiento}
            className={estilos.dia}
            data-episodio={desplazamiento === 0 ? '' : undefined}
            data-piezas={vacio ? undefined : ''}
            aria-hidden={vacio || undefined}
          >
            {!vacio && (
              <span className="solo-lectores">{`${posicionRespectoAD(desplazamiento)} ${nombres.join(', ')}`}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
