import { datosPlan, etiquetaSemana, type VistaSemana } from '@/lib/semanas';
import { BotonPlanificar } from './BotonPlanificar';
import { Dia } from './Dia';
import estilos from './semanas.module.css';

// Una semana abierta: la actual (titular grande y hoy resaltado) o la siguiente (más tenue). Arriba,
// las fechas y los datos del episodio; a la derecha, la estrategia o, sin plan, **Planificar**.
// Debajo, los siete días.
export function Semana({ semana, hoy }: { semana: VistaSemana; hoy: string }) {
  const Titular = semana.posicion === 'actual' ? 'h1' : 'h2';
  const idTitular = `semana-${semana.lunes}`;

  return (
    <section className={estilos.semana} data-posicion={semana.posicion} aria-labelledby={idTitular}>
      <div className={estilos.titulos}>
        <Titular id={idTitular} className={`ancha ${estilos.fechas}`}>
          {etiquetaSemana(semana.lunes)}
        </Titular>
        <p className={estilos.datos} data-aviso={semana.avisoSinPlan ? '' : undefined}>
          {datosPlan(semana.plan)}
        </p>
      </div>

      <div className={estilos.lateral}>
        {semana.plan ? (
          <p className={estilos.estrategia}>{semana.plan.estrategiaNombre}</p>
        ) : (
          <BotonPlanificar lunes={semana.lunes} principal={semana.avisoSinPlan} />
        )}
      </div>

      <ol className={estilos.dias}>
        {semana.dias.map((dia) => (
          <Dia key={dia.fecha} dia={dia} hoy={hoy} />
        ))}
      </ol>
    </section>
  );
}
