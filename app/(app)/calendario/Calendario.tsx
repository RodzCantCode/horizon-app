'use client';

import { useEffect, useState, type DragEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, LinkButton } from 'mochi-ui';
import { rangoCalendario, type SemanaCalendario } from '@/lib/calendario';
import { lunesDe, normalizarHora, sumarDias } from '@/lib/fechas';
import { compararFechaYHora } from '@/lib/planes';
import { moverEpisodioBorrador, moverPost, postsDelBorrador, semanaParaProgramar } from '@/lib/programar';
import { etiquetaDia, etiquetaSemana, fechaLarga } from '@/lib/semanas';
import {
  estrategiaElegida,
  nuevaProgramacion,
  PanelProgramar,
  TarjetaBorrador,
  useSePuedeArrastrar,
  type Arrastre,
  type DatosParaProgramar,
  type Programacion,
} from './Programar';
import { Tarjeta } from './Tarjeta';
import estilos from './calendario.module.css';

// La pantalla Calendario ya leída (page.tsx): el titular con los botones para cambiar de semana y
// **Programar**, y debajo las semanas, cada una con sus siete días y sus tarjetas. En escritorio los
// días van en fila, siete columnas; por debajo de 1024 px, en lista y solo los que tienen algo (y
// hoy), como la semana de Inicio en el móvil (calendario.module.css).
//
// **Programar** abre el modo programar (Programar.tsx) en la semana siguiente sin plan; también se
// abre pulsando un día vacío (que no haya pasado) de una semana sin plan, con ese día como el del
// episodio, o llegando con `?programar=<lunes>` (el **Planificar** de Inicio). Mientras está abierto,
// el panel va a la izquierda (o encima), los posts del borrador salen en sus días con el filete azul y,
// a partir de 1024 px, se arrastran a otro día, igual que el episodio.
//
// Es de cliente porque los botones son LinkButton con el Link de Next (`as`), y un componente de
// servidor no puede pasar funciones a uno de cliente; y por el modo programar.
export function Calendario({
  semanas,
  hoy,
  lunes,
  datos,
  programar,
}: {
  semanas: SemanaCalendario[];
  hoy: string;
  lunes: string;
  datos: DatosParaProgramar;
  /** El lunes de `?programar=` (ya comprobado en page.tsx), o `null`. */
  programar: string | null;
}) {
  const router = useRouter();
  const sePuedeArrastrar = useSePuedeArrastrar();
  // `?programar=<lunes>` abre el modo al llegar y cada vez que llega uno nuevo (se guarda el último
  // visto: el estado se cambia al pintar, no en un efecto, para no pintar antes sin el modo).
  const [programacion, setProgramacion] = useState<Programacion | null>(() =>
    programar === null ? null : nuevaProgramacion(datos, programar),
  );
  const [programarVisto, setProgramarVisto] = useState(programar);
  const [arrastre, setArrastre] = useState<Arrastre | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  if (programar !== programarVisto) {
    setProgramarVisto(programar);
    if (programar !== null) setProgramacion(nuevaProgramacion(datos, programar));
  }
  // Y se quita de la URL, para que recargar (o refrescar tras guardar) no vuelva a abrirlo. En su
  // lugar queda la semana que se ve (`?desde=`), que page.tsx puede haber elegido por `?programar=`.
  useEffect(() => {
    if (programar === null) return;
    const parametros = new URLSearchParams(window.location.search);
    if (!parametros.has('programar')) return;
    parametros.delete('programar');
    if (!parametros.has('desde')) parametros.set('desde', lunes);
    window.history.replaceState(null, '', `${window.location.pathname}?${parametros.toString()}`);
  }, [programar, lunes]);

  // Los enlaces a los paneles llevan la semana que se ve, para que abrir uno no vuelva a la de hoy.
  const enlace = (parametro: 'pieza' | 'semana', valor: string) =>
    `?${new URLSearchParams({ desde: lunes, [parametro]: valor }).toString()}`;
  const lunesDeHoy = lunesDe(hoy);

  function abrir(lunesAProgramar: string, diaD?: string) {
    setProgramacion(nuevaProgramacion(datos, lunesAProgramar, diaD));
    // Si esa semana no se ve, se va a ella (el modo sigue abierto: es el mismo componente).
    const { desde, hasta } = rangoCalendario(lunes);
    if (lunesAProgramar < desde || lunesAProgramar > hasta) {
      router.push(`?desde=${lunesAProgramar}`, { scroll: false });
    }
  }

  // Lo que pinta el borrador: la estrategia elegida (si se puede usar), sus posts y el episodio.
  const estrategia = programacion && estrategiaElegida(programacion, datos);
  const posts = programacion && estrategia ? postsDelBorrador(programacion.borrador, estrategia, datos.piezas) : [];
  const arrastrable = programacion !== null && sePuedeArrastrar;

  function soltar(fecha: string) {
    if (!arrastre) return;
    setProgramacion((p) => {
      if (!p) return p;
      const borrador =
        arrastre.tipo === 'post'
          ? moverPost(p.borrador, arrastre.indice, fecha)
          : moverEpisodioBorrador(p.borrador, fecha, estrategia);
      return { ...p, borrador };
    });
    setArrastre(null);
    setSobre(null);
  }

  // Un día recibe lo que se arrastra del borrador (y solo eso).
  const destino = (fecha: string) =>
    arrastrable
      ? {
          onDragOver: (evento: DragEvent<HTMLLIElement>) => {
            if (!arrastre) return;
            evento.preventDefault();
            evento.dataTransfer.dropEffect = 'move';
            if (sobre !== fecha) setSobre(fecha);
          },
          onDragLeave: (evento: DragEvent<HTMLLIElement>) => {
            if (!evento.currentTarget.contains(evento.relatedTarget as Node | null) && sobre === fecha) setSobre(null);
          },
          onDrop: (evento: DragEvent<HTMLLIElement>) => {
            evento.preventDefault();
            soltar(fecha);
          },
        }
      : {};

  /** Las tarjetas de un día: las guardadas y, programando, las del borrador, todas por hora. */
  function tarjetasDelDia(dia: SemanaCalendario['dias'][number]): { hora: string | null; nodo: ReactNode }[] {
    const guardadas = dia.tarjetas.map((tarjeta) =>
      tarjeta.tipo === 'post'
        ? {
            hora: tarjeta.pieza.hora,
            nodo: (
              <li key={tarjeta.pieza.id}>
                <Tarjeta tarjeta={tarjeta} hoy={hoy} href={enlace('pieza', tarjeta.pieza.id)} />
              </li>
            ),
          }
        : {
            hora: tarjeta.plan.horaEpisodio,
            nodo: (
              <li key={`episodio-${tarjeta.plan.id}`}>
                <Tarjeta tarjeta={tarjeta} hoy={hoy} href={enlace('semana', tarjeta.plan.lunes)} />
              </li>
            ),
          },
    );
    if (!programacion) return guardadas;

    const propias = {
      programacion,
      hoy,
      arrastrable,
      alEmpezar: setArrastre,
      alTerminar: () => {
        setArrastre(null);
        setSobre(null);
      },
    };
    const delBorrador = posts
      .filter((post) => post.fecha === dia.fecha)
      .map((post) => ({
        hora: post.hora,
        nodo: (
          <li key={`borrador-${post.indice}`}>
            <TarjetaBorrador tarjeta={{ tipo: 'post', post }} {...propias} />
          </li>
        ),
      }));
    const { borrador } = programacion;
    if (borrador.conEpisodio && borrador.diaD === dia.fecha) {
      delBorrador.push({
        hora: borrador.horaEpisodio === null ? null : normalizarHora(borrador.horaEpisodio),
        nodo: (
          <li key="borrador-episodio">
            <TarjetaBorrador tarjeta={{ tipo: 'episodio' }} {...propias} />
          </li>
        ),
      });
    }
    // `sort` es estable: a igual hora, las guardadas primero.
    return [...guardadas, ...delBorrador].sort((a, b) =>
      compararFechaYHora({ fecha: dia.fecha, hora: a.hora }, { fecha: dia.fecha, hora: b.hora }),
    );
  }

  const semanasPintadas = semanas.map((semana) => {
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
          {semana.dias.map((dia) => {
            const tarjetas = tarjetasDelDia(dia);
            // Un día vacío que no ha pasado, de una semana sin plan, abre el modo programar con ese
            // día como el del episodio (fuera del modo programar).
            const paraProgramar = !programacion && !semana.plan && tarjetas.length === 0 && !dia.esPasado;
            return (
              <li
                key={dia.fecha}
                className={estilos.dia}
                data-hoy={dia.esHoy ? '' : undefined}
                data-pasado={dia.esPasado ? '' : undefined}
                data-vacio={tarjetas.length === 0 ? '' : undefined}
                data-sobre={sobre === dia.fecha ? '' : undefined}
                {...destino(dia.fecha)}
              >
                <p className={estilos.etiquetaDia}>
                  <span className={estilos.fechaDia}>{etiquetaDia(dia.fecha)}</span>
                  {dia.esHoy && <span>Hoy</span>}
                </p>
                {tarjetas.length > 0 && <ul className={estilos.tarjetas}>{tarjetas.map((t) => t.nodo)}</ul>}
                {paraProgramar && (
                  <button
                    type="button"
                    className={estilos.programarDia}
                    aria-label={`Programar el episodio el ${fechaLarga(dia.fecha).toLowerCase()}`}
                    onClick={() => abrir(semana.lunes, dia.fecha)}
                  />
                )}
              </li>
            );
          })}
        </ol>
      </section>
    );
  });

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
          {/* La acción principal. Mientras se programa no se ve: la principal pasa a ser Guardar. */}
          {!programacion && (
            <Button variant="accent" onClick={() => abrir(semanaParaProgramar(datos.planes, hoy))}>
              Programar
            </Button>
          )}
        </div>
      </div>

      {programacion ? (
        <div className={estilos.programando}>
          <PanelProgramar
            programacion={programacion}
            datos={datos}
            alCambiar={(cambio) => setProgramacion((p) => (p ? cambio(p) : p))}
            alGuardar={() => setProgramacion(null)}
            alCancelar={() => setProgramacion(null)}
          />
          <div className={estilos.semanas}>{semanasPintadas}</div>
        </div>
      ) : (
        semanasPintadas
      )}
    </>
  );
}
