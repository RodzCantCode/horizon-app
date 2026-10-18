import { avisoDePieza } from '@/lib/semanas';
import type { PiezaDePlan } from '@/lib/tipos';
import estilos from './semanas.module.css';

const TEXTO_AVISO = { 'va-justa': 'va justa', revisar: 'revisar en Metricool' } as const;

// La marca de cada pieza: hueca si está pendiente, rellena si está programada y en ámbar si va justa
// o hay que revisarla en Metricool. La marca sola no se oye: el estado va también en texto para
// lectores de pantalla.
export function MarcaEstado({ pieza, hoy }: { pieza: PiezaDePlan; hoy: string }) {
  const aviso = avisoDePieza(pieza, hoy);
  const estado = pieza.estado === 'programada' ? 'Programada' : 'Pendiente';

  return (
    <>
      <span
        className={estilos.marca}
        data-estado={pieza.estado}
        data-atencion={aviso ? '' : undefined}
        aria-hidden="true"
      />
      <span className="solo-lectores">{aviso ? `${estado}, ${TEXTO_AVISO[aviso]}.` : `${estado}.`}</span>
    </>
  );
}
