import { DESPLAZAMIENTOS } from '@/lib/planes';
import { posicionRespectoAD } from '@/lib/semanas';
import type { Estrategia, Pieza } from '@/lib/tipos';
import estilos from './minifila.module.css';

/**
 * La mini fila de días de una estrategia: siete huecos, de D-1 a D+5, con el nombre corto de las
 * piezas que van en cada uno. La usan el panel de planificar y la sección Estrategias. Los días
 * vacíos solo se ven: el lector de pantalla lee los que tienen piezas («D-1 Historia del
 * invitado…»).
 */
export function MiniFila({ estrategia, piezas }: { estrategia: Estrategia; piezas: Pieza[] }) {
  return (
    <ol className={estilos.fila}>
      {DESPLAZAMIENTOS.map((desplazamiento) => {
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
            data-vacio={vacio ? '' : undefined}
            aria-hidden={vacio || undefined}
          >
            <span className={estilos.posicion}>{posicionRespectoAD(desplazamiento)}</span>
            {nombres.map((nombre, i) => (
              <span key={i} className={estilos.pieza}>
                {nombre}
              </span>
            ))}
          </li>
        );
      })}
    </ol>
  );
}
