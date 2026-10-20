'use client';

import { useEffect, useOptimistic, useState, useTransition, type DragEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, LinkButton, Toaster, toast } from 'mochi-ui';
import { moverTarjeta, rangoCalendario, type Movimiento, type SemanaCalendario } from '@/lib/calendario';
import { lunesDe, normalizarHora, sumarDias } from '@/lib/fechas';
import { compararFechaYHora } from '@/lib/planes';
import { moverEpisodioBorrador, moverPost, postsDelBorrador, semanaParaProgramar } from '@/lib/programar';
import { etiquetaDia, etiquetaSemana, fechaLarga } from '@/lib/semanas';
import type { PiezaDePlan, Plan } from '@/lib/tipos';
import { SIN_CONEXION } from '../componentes/edicion';
import { editarPiezaDePlan, moverEpisodio } from '../semanas/acciones';
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
// Fuera del modo programar, a partir de 1024 px, se arrastra lo ya guardado
// (docs/diseno.md § Calendario): soltar un post en otro día lo guarda con su
// hora de siempre (`editarPiezaDePlan`) y soltar el episodio mueve solo el episodio (`moverEpisodio`).
// Mientras se guarda, la tarjeta ya se ve en su día nuevo (`useOptimistic`); si la acción devuelve un
// error, vuelve a su sitio y el error sale en un aviso (Toast de Mochi).
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
  const [arrastre, setArrastre] = useState<Arrastre | ArrastreGuardado | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  // Mientras Guardar crea el plan, el borrador no se arrastra (PanelProgramar no deja cambiar nada).
  const [guardandoPlan, iniciarGuardadoPlan] = useTransition();
  // Las semanas con lo que se está moviendo ya en su día nuevo. Mientras se guarda un movimiento no
  // se empieza otro: la tarjeta enseña el día nuevo y la base aún tiene el de antes.
  const [semanasVistas, moverOptimista] = useOptimistic(semanas, moverTarjeta);
  const [guardandoMovimiento, iniciarMovimiento] = useTransition();
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
  const arrastrable = programacion !== null && sePuedeArrastrar && !guardandoPlan;
  const guardadasArrastrables = programacion === null && sePuedeArrastrar && !guardandoMovimiento;

  function soltar(fecha: string) {
    const soltado = arrastre;
    setArrastre(null);
    setSobre(null);
    if (!soltado) return;
    if (soltado.tipo === 'post-guardado' || soltado.tipo === 'episodio-guardado') {
      guardarMovimiento(soltado, fecha);
      return;
    }
    setProgramacion((p) => {
      if (!p) return p;
      const borrador =
        soltado.tipo === 'post'
          ? moverPost(p.borrador, soltado.indice, fecha)
          : moverEpisodioBorrador(p.borrador, fecha, estrategia);
      return { ...p, borrador };
    });
  }

  // Soltar lo guardado en otro día lo guarda ya; en el mismo día no hace nada. El post conserva su
  // hora y lleva como `original` el día y la hora que tenía al empezar a arrastrarlo: si otra persona
  // lo ha cambiado entretanto, no se pisa (la acción avisa y refresca).
  function guardarMovimiento(soltado: ArrastreGuardado, fecha: string) {
    const movimiento: Movimiento =
      soltado.tipo === 'post-guardado'
        ? { tipo: 'post', id: soltado.pieza.id, fecha }
        : { tipo: 'episodio', planId: soltado.plan.id, fecha };
    if (fecha === (soltado.tipo === 'post-guardado' ? soltado.pieza.fecha : soltado.plan.diaD)) return;

    iniciarMovimiento(async () => {
      moverOptimista(movimiento);
      let aviso: string | undefined;
      try {
        if (soltado.tipo === 'post-guardado') {
          const { pieza } = soltado;
          ({ error: aviso } = await editarPiezaDePlan(pieza.id, fecha, pieza.hora, {
            fecha: pieza.fecha,
            hora: pieza.hora,
          }));
        } else {
          ({ error: aviso } = await moverEpisodio(soltado.plan.id, fecha));
        }
      } catch {
        aviso = SIN_CONEXION;
      }
      // Al acabar la transición, la tarjeta vuelve a lo que diga la base: a su día nuevo si se ha
      // guardado y a su sitio (o adonde la haya dejado otra persona) si no.
      if (aviso !== undefined) toast({ title: aviso, icon: 'none', duration: DURACION_AVISO });
    });
  }

  // Un día recibe lo que se arrastra del Calendario (y solo eso: el estado `arrastre`).
  const destino = (fecha: string) =>
    sePuedeArrastrar
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
    // Lo que hace falta para arrastrar una tarjeta guardada, o nada si ahora no se puede.
    const arrastreDe = (deEsta: ArrastreGuardado, arrastrando: boolean) =>
      guardadasArrastrables
        ? {
            arrastrando,
            alEmpezar: () => setArrastre(deEsta),
            alTerminar: () => {
              setArrastre(null);
              setSobre(null);
            },
          }
        : undefined;
    const guardadas = dia.tarjetas.map((tarjeta) =>
      tarjeta.tipo === 'post'
        ? {
            hora: tarjeta.pieza.hora,
            nodo: (
              <li key={tarjeta.pieza.id}>
                <Tarjeta
                  tarjeta={tarjeta}
                  hoy={hoy}
                  href={enlace('pieza', tarjeta.pieza.id)}
                  arrastre={arrastreDe(
                    { tipo: 'post-guardado', pieza: tarjeta.pieza },
                    arrastre?.tipo === 'post-guardado' && arrastre.pieza.id === tarjeta.pieza.id,
                  )}
                />
              </li>
            ),
          }
        : {
            hora: tarjeta.plan.horaEpisodio,
            nodo: (
              <li key={`episodio-${tarjeta.plan.id}`}>
                <Tarjeta
                  tarjeta={tarjeta}
                  hoy={hoy}
                  href={enlace('semana', tarjeta.plan.lunes)}
                  arrastre={arrastreDe(
                    { tipo: 'episodio-guardado', plan: tarjeta.plan },
                    arrastre?.tipo === 'episodio-guardado' && arrastre.plan.id === tarjeta.plan.id,
                  )}
                />
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

  const semanasPintadas = semanasVistas.map((semana) => {
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
            guardando={guardandoPlan}
            iniciar={iniciarGuardadoPlan}
            alCambiar={(cambio) => setProgramacion((p) => (p ? cambio(p) : p))}
            alGuardar={() => setProgramacion(null)}
            alCancelar={() => setProgramacion(null)}
          />
          <div className={estilos.semanas}>{semanasPintadas}</div>
        </div>
      ) : (
        semanasPintadas
      )}
      <Toaster />
    </>
  );
}

/** Lo que se arrastra fuera del modo programar: un post guardado o el episodio de un plan guardado. */
type ArrastreGuardado = { tipo: 'post-guardado'; pieza: PiezaDePlan } | { tipo: 'episodio-guardado'; plan: Plan };

// Lo que dura el aviso de un error al mover: más que los 3 s de Mochi, porque es una frase entera.
const DURACION_AVISO = 6000;
