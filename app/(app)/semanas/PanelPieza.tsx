'use client';

import { useEffect, useId, useRef, useState, useTransition } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Button } from 'mochi-ui';
import {
  avisoDePieza,
  datosPlan,
  estadoDePieza,
  fechaYPosicion,
  fraseDeRegistro,
  textoCanales,
  textoFormato,
  textoPreparacion,
} from '@/lib/semanas';
import type { EntradaRegistro, PiezaDePlan, Plan } from '@/lib/tipos';
import { Panel } from '../componentes/Panel';
import { marcarEstado } from './acciones';
import estilos from './semanas.module.css';

export type DetalleDePieza = { pieza: PiezaDePlan; plan: Plan; registro: EntradaRegistro[] };

// Lo que se enseña si la acción ni siquiera llega al servidor (sin conexión, por ejemplo).
const SIN_CONEXION = 'No se ha podido conectar. Vuelve a intentarlo.';

/**
 * El panel de una pieza (docs/diseno.md § Paneles de detalle): cuándo va, su estado, sus datos, el
 * botón para marcarla como programada o devolverla a pendiente, y su registro. Los datos los lee el
 * servidor para la pieza de `?pieza=<id>` (page.tsx); si ya no existe, llega `detalle = null` y el
 * panel lo dice en vez de romperse.
 *
 * Está abierto mientras la URL lleve su id, así sobrevive a una recarga. Se abre con el enlace de la
 * pieza (Dia.tsx) y se cierra quitando `pieza` de la URL con history.pushState, sin ir al servidor:
 * se cierra al momento y con su animación. Atrás lo vuelve a abrir. Al cerrar, el foco vuelve a la
 * pieza en la semana (Mochi lo devuelve a lo que lo tenía al abrir, pero tras una recarga no había
 * nada, y Safari no enfoca los enlaces al pulsarlos).
 *
 * El lápiz (modo edición) llega con la Tarea 10.
 */
export function PanelPieza({ id, detalle, hoy }: { id: string; detalle: DetalleDePieza | null; hoy: string }) {
  const parametros = useSearchParams();
  const ruta = usePathname();
  const abierto = parametros.get('pieza') === id;

  function cerrar() {
    const siguientes = new URLSearchParams(parametros.toString());
    siguientes.delete('pieza');
    const consulta = siguientes.toString();
    window.history.pushState(null, '', consulta ? `${ruta}?${consulta}` : ruta);
  }

  const estuvoAbierto = useRef(abierto);
  useEffect(() => {
    if (abierto) {
      estuvoAbierto.current = true;
      return;
    }
    if (!estuvoAbierto.current) return;
    estuvoAbierto.current = false;
    document.querySelector<HTMLElement>(`[data-pieza="${CSS.escape(id)}"]`)?.focus();
  }, [abierto, id]);

  return (
    <Panel
      abierto={abierto}
      alCerrar={cerrar}
      titulo={detalle ? detalle.pieza.nombre : 'Esa pieza ya no está en el plan'}
    >
      {detalle && <DatosPieza key={id} detalle={detalle} hoy={hoy} />}
    </Panel>
  );
}

function DatosPieza({ detalle: { pieza, plan, registro }, hoy }: { detalle: DetalleDePieza; hoy: string }) {
  const [enviando, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const idRegistro = useId();
  const programada = pieza.estado === 'programada';

  // La acción refresca la página al terminar: el botón sigue cargando hasta que llega la pieza con
  // su estado nuevo (y su registro con la anotación), y la semana se actualiza a la vez.
  function cambiarEstado() {
    setError(null);
    iniciar(async () => {
      try {
        const resultado = await marcarEstado(pieza.id, programada ? 'pendiente' : 'programada');
        if (resultado.error) setError(resultado.error);
      } catch {
        setError(SIN_CONEXION);
      }
    });
  }

  return (
    <>
      <div className={estilos.cuandoPieza}>
        <p className={estilos.fechaPieza}>{fechaYPosicion(pieza)}</p>
        <p className={estilos.estadoPieza} data-atencion={avisoDePieza(pieza, hoy) ? '' : undefined}>
          {estadoDePieza(pieza, hoy)}
        </p>
      </div>

      <dl className={estilos.datosPieza}>
        <dt>Episodio</dt>
        <dd>{datosPlan(plan)}</dd>
        <dt>Formato</dt>
        <dd>{textoFormato(pieza.formato)}</dd>
        <dt>Canales</dt>
        <dd>{textoCanales(pieza.canales)}</dd>
        <dt>Preparación</dt>
        <dd>{textoPreparacion(pieza.diasPreparacion)}</dd>
      </dl>

      {/* Azul solo para marcarla como programada: es lo que falta por hacer. Devolverla es la
          excepción. */}
      <div className={estilos.accionPieza}>
        <Button
          variant={programada ? 'surface' : 'accent'}
          status={enviando ? 'loading' : 'idle'}
          loadingLabel="Guardando"
          onClick={cambiarEstado}
        >
          {programada ? 'Volver a pendiente' : 'Marcar como programada'}
        </Button>
        <p className={estilos.errorPieza} role="alert">
          {error}
        </p>
      </div>

      <section className={estilos.registro} aria-labelledby={idRegistro}>
        <h3 id={idRegistro} className={estilos.tituloRegistro}>
          Registro
        </h3>
        {registro.length > 0 ? (
          <ul className={estilos.anotaciones}>
            {registro.map((entrada) => (
              <li key={`${entrada.creadoEn}-${entrada.accion}`}>{fraseDeRegistro(entrada)}</li>
            ))}
          </ul>
        ) : (
          <p className={estilos.anotaciones}>Sin cambios registrados</p>
        )}
      </section>
    </>
  );
}
