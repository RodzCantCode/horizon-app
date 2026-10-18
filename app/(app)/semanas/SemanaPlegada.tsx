import { etiquetaSemana, resumenPlegada, type VistaSemana } from '@/lib/semanas';
import { BotonPlanificar } from './BotonPlanificar';
import { Dia } from './Dia';
import estilos from './semanas.module.css';

// Una semana pasada o lejana: una línea con las fechas y el resumen que se abre al pulsarla y enseña
// sus siete días. Es un <details> nativo: se abre y se cierra sin JavaScript y con el teclado. Una
// lejana sin plan se puede planificar desde aquí; una pasada, no.
export function SemanaPlegada({ semana, hoy }: { semana: VistaSemana; hoy: string }) {
  return (
    <details className={estilos.plegada} data-posicion={semana.posicion}>
      <summary className={estilos.linea}>
        <span className={estilos.fechasPlegada}>{etiquetaSemana(semana.lunes)}</span>
        <span className={estilos.resumen}>{resumenPlegada(semana)}</span>
        <span className={estilos.flecha} aria-hidden="true">
          ▸
        </span>
      </summary>

      <div className={estilos.contenidoPlegada}>
        {semana.posicion === 'lejana' && semana.plan === null && (
          <div>
            <BotonPlanificar lunes={semana.lunes} principal={false} />
          </div>
        )}
        <ol className={estilos.dias}>
          {semana.dias.map((dia) => (
            <Dia key={dia.fecha} dia={dia} hoy={hoy} />
          ))}
        </ol>
      </div>
    </details>
  );
}
