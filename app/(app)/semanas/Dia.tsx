import Link from 'next/link';
import { avisoDePieza, etiquetaDia, type VistaDia } from '@/lib/semanas';
import { MarcaEstado } from './MarcaEstado';
import estilos from './semanas.module.css';

const TEXTO_AVISO = { 'va-justa': 'va justa', revisar: 'revisar' } as const;

// Un día de una semana: su etiqueta («Mié 14», y «Hoy» si lo es) y sus piezas con la marca de estado,
// la hora y el nombre corto. En escritorio es una columna; en pantallas estrechas, una fila de la
// lista, y los días sin piezas (salvo hoy) no se pintan (semanas.module.css).
//
// Pulsar una pieza la apunta en la URL (?pieza=<id>) y abre su panel (PanelPieza.tsx), que al
// cerrarse devuelve el foco al enlace por su data-pieza.
export function Dia({ dia, hoy }: { dia: VistaDia; hoy: string }) {
  return (
    <li
      className={estilos.dia}
      data-hoy={dia.esHoy ? '' : undefined}
      data-vacio={dia.piezas.length === 0 ? '' : undefined}
    >
      <p className={estilos.etiquetaDia}>
        <span className={estilos.fechaDia}>{etiquetaDia(dia.fecha)}</span>
        {dia.esHoy && <span>Hoy</span>}
      </p>

      {dia.piezas.length > 0 && (
        <ul className={estilos.piezas}>
          {dia.piezas.map((pieza) => {
            const aviso = avisoDePieza(pieza, hoy);
            return (
              <li key={pieza.id}>
                <Link
                  href={`/?pieza=${pieza.id}`}
                  scroll={false}
                  className={estilos.pieza}
                  data-pieza={pieza.id}
                >
                  <MarcaEstado pieza={pieza} hoy={hoy} />
                  <span className={estilos.texto}>
                    {pieza.hora && <span className={estilos.hora}>{pieza.hora}</span>}{' '}
                    {pieza.nombreCorto}
                  </span>
                  {aviso && (
                    <span className={estilos.aviso} aria-hidden="true">
                      {TEXTO_AVISO[aviso]}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}
