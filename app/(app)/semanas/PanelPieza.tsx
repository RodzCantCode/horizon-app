'use client';

import { startTransition, useEffect, useId, useRef, useState, useTransition, type FormEvent } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Button, PencilIcon, Select, TextField } from 'mochi-ui';
import { existeEnMadrid, normalizarHora } from '@/lib/fechas';
import {
  avisoDePieza,
  datosPlan,
  diasDelPlan,
  estadoDePieza,
  fechaLarga,
  fechaYPosicion,
  fraseDeRegistro,
  textoCanales,
  textoFormato,
  textoPreparacion,
} from '@/lib/semanas';
import type { EntradaRegistro, PiezaDePlan, Plan } from '@/lib/tipos';
import { Panel, useFocoAlCambiarDeVista, useMientrasSeCierra } from '../componentes/Panel';
import { editarPiezaDePlan, marcarEstado, quitarPiezaDePlan } from './acciones';
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
 * Con el lápiz pasa a modo edición (docs/diseno.md § Paneles de detalle): día de D-1 a D+5 y hora,
 * con **Guardar** y **Cancelar**, y **Quitar de este plan**, que pide confirmación dentro del panel.
 * Al quitarla, el panel se cierra. El modo es estado del panel, no va en la URL: al cerrarlo, se
 * pierde.
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

  const mostrado = useMientrasSeCierra(detalle, abierto);

  return (
    <Panel
      abierto={abierto}
      alCerrar={cerrar}
      titulo={mostrado ? mostrado.pieza.nombre : 'Esa pieza ya no está en el plan'}
    >
      {mostrado && <ContenidoPieza key={id} detalle={mostrado} hoy={hoy} alQuitar={cerrar} />}
    </Panel>
  );
}

/** Ver o editar: el lápiz pasa a editar; **Guardar** y **Cancelar** vuelven a ver. */
function ContenidoPieza({
  detalle,
  hoy,
  alQuitar,
}: {
  detalle: DetalleDePieza;
  hoy: string;
  alQuitar: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const vista = useRef<HTMLDivElement>(null);
  useFocoAlCambiarDeVista(editando ? 'editar' : 'ver', vista);

  return (
    <div ref={vista} className={estilos.vista}>
      {editando ? (
        <EditarPieza detalle={detalle} alTerminar={() => setEditando(false)} alQuitar={alQuitar} />
      ) : (
        <DatosPieza detalle={detalle} hoy={hoy} alEditar={() => setEditando(true)} />
      )}
    </div>
  );
}

function DatosPieza({
  detalle: { pieza, plan, registro },
  hoy,
  alEditar,
}: {
  detalle: DetalleDePieza;
  hoy: string;
  alEditar: () => void;
}) {
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
      <div className={estilos.cabeceraPanel}>
        <div className={estilos.cuandoPieza}>
          <p className={estilos.fechaPieza}>{fechaYPosicion(pieza)}</p>
          <p className={estilos.estadoPieza} data-atencion={avisoDePieza(pieza, hoy) ? '' : undefined}>
            {estadoDePieza(pieza, hoy)}
          </p>
        </div>
        <Button variant="surface" iconOnly aria-label="Editar" onClick={alEditar}>
          <PencilIcon size={18} />
        </Button>
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

/**
 * La pieza en modo edición: día (de D-1 a D+5 de su plan) y hora (vacía, sin hora), con el mismo
 * aviso que al planificar si la hora no existe en España ese día. **Guardar** es la acción principal
 * (azul); lo demás, superficie. **Quitar de este plan** pregunta antes en una fila del propio panel.
 *
 * El servidor vuelve a comprobarlo todo y, si estaba programada y cambia, la deja para revisar en
 * Metricool; si otra persona la ha movido con el panel abierto, no guarda y lo dice. Las acciones
 * refrescan la página al terminar: el botón sigue cargando hasta que llega la pieza nueva y entonces
 * se vuelve a ver (o, al quitarla, se cierra el panel).
 */
function EditarPieza({
  detalle: { pieza, plan },
  alTerminar,
  alQuitar,
}: {
  detalle: DetalleDePieza;
  alTerminar: () => void;
  alQuitar: () => void;
}) {
  const [fecha, setFecha] = useState(pieza.fecha);
  const [hora, setHora] = useState(pieza.hora ?? '');
  const [error, setError] = useState<string | null>(null);
  const [guardando, iniciarGuardar] = useTransition();

  const horaNormal = normalizarHora(hora);
  const horaNoExiste = horaNormal !== null && !existeEnMadrid(fecha, horaNormal);

  function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (guardando) return;
    setError(null);
    iniciarGuardar(async () => {
      try {
        // Con lo que enseñaba el panel: si la pieza ya no está ahí, el servidor no la guarda.
        const resultado = await editarPiezaDePlan(pieza.id, fecha, hora, { fecha: pieza.fecha, hora: pieza.hora });
        // Dentro de la transición, para volver a ver a la vez que llega la pieza nueva.
        startTransition(() => {
          if (resultado.error) setError(resultado.error);
          else alTerminar();
        });
      } catch {
        setError(SIN_CONEXION);
      }
    });
  }

  return (
    <>
      <form className={estilos.edicion} onSubmit={guardar} noValidate>
        <div className={estilos.campos}>
          <Select
            label="Día"
            options={diasDelPlan(plan.diaD).map((d) => ({ value: d.fecha, label: d.etiqueta }))}
            value={fecha}
            onValueChange={setFecha}
          />
          <TextField
            label="Hora"
            autoComplete="off"
            placeholder="hh:mm"
            value={hora}
            onValueChange={setHora}
          />
        </div>
        {horaNoExiste && (
          <p className={estilos.avisoHora}>
            {`Las ${horaNormal} del ${fechaLarga(fecha).toLowerCase()} no existen en España por el cambio de horario.`}
          </p>
        )}
        <div className={estilos.accionPieza}>
          <div className={estilos.botones}>
            <Button type="submit" variant="accent" status={guardando ? 'loading' : 'idle'} loadingLabel="Guardando">
              Guardar
            </Button>
            <Button variant="surface" onClick={alTerminar}>
              Cancelar
            </Button>
          </div>
          <p className={estilos.errorPieza} role="alert">
            {error}
          </p>
        </div>
      </form>

      <QuitarPieza pieza={pieza} alQuitar={alQuitar} />
    </>
  );
}

/**
 * **Quitar de este plan**, con su confirmación en una fila dentro del panel (no otra ventana encima):
 * «¿Quitar esta pieza del plan?» con **Quitar** y **Cancelar**. Al aparecer, el foco va a la
 * pregunta; al cancelar, vuelve al botón.
 */
function QuitarPieza({ pieza, alQuitar }: { pieza: PiezaDePlan; alQuitar: () => void }) {
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quitando, iniciar] = useTransition();
  const zona = useRef<HTMLDivElement>(null);
  useFocoAlCambiarDeVista(confirmando ? 'confirmar' : 'boton', zona);

  function quitar() {
    if (quitando) return;
    setError(null);
    iniciar(async () => {
      try {
        const resultado = await quitarPiezaDePlan(pieza.id);
        // Dentro de la transición, para que el panel se cierre a la vez que se refresca la semana.
        startTransition(() => {
          if (resultado.error) setError(resultado.error);
          else alQuitar();
        });
      } catch {
        setError(SIN_CONEXION);
      }
    });
  }

  return (
    <div ref={zona} className={estilos.zonaQuitar}>
      {confirmando ? (
        <div className={estilos.confirmacion}>
          <p data-foco tabIndex={-1}>
            ¿Quitar esta pieza del plan?
          </p>
          <div className={estilos.botones}>
            <Button
              variant="surface"
              className={estilos.peligro}
              status={quitando ? 'loading' : 'idle'}
              loadingLabel="Quitando"
              onClick={quitar}
            >
              Quitar
            </Button>
            <Button variant="surface" onClick={() => setConfirmando(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <Button variant="surface" className={estilos.peligro} onClick={() => setConfirmando(true)}>
            Quitar de este plan
          </Button>
        </div>
      )}
      <p className={estilos.errorPieza} role="alert">
        {error}
      </p>
    </div>
  );
}
