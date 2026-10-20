'use client';

import Link from 'next/link';
import { Button, LinkButton } from 'mochi-ui';
import type { SemanaCalendario } from '@/lib/calendario';
import { lunesDe, sumarDias } from '@/lib/fechas';
import { etiquetaDia, etiquetaSemana } from '@/lib/semanas';
import { Tarjeta } from './Tarjeta';
import estilos from './calendario.module.css';

// La pantalla Calendario ya leída (page.tsx): el titular con los botones para cambiar de semana y
// **Programar**, y debajo las semanas, cada una con sus siete días y sus tarjetas. En escritorio los
// días van en fila, siete columnas; por debajo de 768 px, en lista y solo los que tienen algo (y hoy),
// como la semana de Inicio en el móvil (calendario.module.css).
//
// Es de cliente porque los botones son LinkButton con el Link de Next (`as`), y un componente de
// servidor no puede pasar funciones a uno de cliente.
export function Calendario({ semanas, hoy, lunes }: { semanas: SemanaCalendario[]; hoy: string; lunes: string }) {
  // Los enlaces a los paneles llevan la semana que se ve, para que abrir uno no vuelva a la de hoy.
  const enlace = (parametro: 'pieza' | 'semana', valor: string) =>
    `?${new URLSearchParams({ desde: lunes, [parametro]: valor }).toString()}`;
  const lunesDeHoy = lunesDe(hoy);

  return (
    <>
      <div className={estilos.cabecera}>
        <h1 className={`ancha ${estilos.titular}`}>Calendario</h1>
        <div className={estilos.botones}>
          <LinkButton as={Link} href={`?desde=${sumarDias(lunes, -7)}`} variant="surface">
            Anterior
          </LinkButton>
          <LinkButton as={Link} href="/calendario" variant="surface">
            Hoy
          </LinkButton>
          <LinkButton as={Link} href={`?desde=${sumarDias(lunes, 7)}`} variant="surface">
            Siguiente
          </LinkButton>
          {/* La acción principal: abrirá el modo programar un episodio. Aún no hace nada. */}
          <Button variant="accent">Programar</Button>
        </div>
      </div>

      {semanas.map((semana) => {
        const idTitular = `semana-${semana.lunes}`;
        const actual = semana.lunes === lunesDeHoy;
        return (
          <section key={semana.lunes} className={estilos.semana} aria-labelledby={idTitular}>
            <header className={estilos.cabeceraSemana}>
              {/* Con plan, las fechas abren el panel de la semana (también el de una semana sin
                  episodio, que no tiene tarjeta). Al cerrarlo, el foco vuelve aquí por data-semana. */}
              <h2 id={idTitular} className={`ancha ${estilos.fechas}`} data-actual={actual ? '' : undefined}>
                {semana.plan ? (
                  <Link
                    href={enlace('semana', semana.lunes)}
                    scroll={false}
                    className={estilos.enlaceSemana}
                    data-semana={semana.lunes}
                  >
                    {etiquetaSemana(semana.lunes)}
                  </Link>
                ) : (
                  etiquetaSemana(semana.lunes)
                )}
              </h2>
              {actual && <span className="estrecha">Esta semana</span>}
            </header>

            <ol className={estilos.dias}>
              {semana.dias.map((dia) => (
                <li
                  key={dia.fecha}
                  className={estilos.dia}
                  data-hoy={dia.esHoy ? '' : undefined}
                  data-pasado={dia.esPasado ? '' : undefined}
                  data-vacio={dia.tarjetas.length === 0 ? '' : undefined}
                >
                  <p className={estilos.etiquetaDia}>
                    <span className={estilos.fechaDia}>{etiquetaDia(dia.fecha)}</span>
                    {dia.esHoy && <span>Hoy</span>}
                  </p>
                  {dia.tarjetas.length > 0 && (
                    <ul className={estilos.tarjetas}>
                      {dia.tarjetas.map((tarjeta) =>
                        tarjeta.tipo === 'post' ? (
                          <li key={tarjeta.pieza.id}>
                            <Tarjeta tarjeta={tarjeta} hoy={hoy} href={enlace('pieza', tarjeta.pieza.id)} />
                          </li>
                        ) : (
                          <li key={`episodio-${tarjeta.plan.id}`}>
                            <Tarjeta tarjeta={tarjeta} hoy={hoy} href={enlace('semana', tarjeta.plan.lunes)} />
                          </li>
                        ),
                      )}
                    </ul>
                  )}
                </li>
              ))}
            </ol>
          </section>
        );
      })}
    </>
  );
}
