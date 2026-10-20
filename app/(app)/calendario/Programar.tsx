'use client';

import {
  startTransition,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type DragEvent,
  type FormEvent,
  type TransitionStartFunction,
} from 'react';
import { Button, RadioGroup, TextField } from 'mochi-ui';
import { etiquetaDe, tituloEpisodio } from '@/lib/calendario';
import { esFecha, existeEnMadrid, normalizarHora } from '@/lib/fechas';
import { estrategiasParaPlanificar, proponerDiaD, proponerNumero } from '@/lib/planes';
import {
  borradorNuevo,
  cambiarConEpisodio,
  elegirEstrategia,
  moverEpisodioBorrador,
  proponerHoraEpisodio,
  type Borrador,
  type PostDelBorrador,
} from '@/lib/programar';
import { fechaLarga } from '@/lib/semanas';
import type { Estrategia, Pieza, Plan } from '@/lib/tipos';
import { SIN_CONEXION } from '../componentes/edicion';
import { crearPlan } from '../semanas/acciones';
import { MarcaEstado } from '../semanas/MarcaEstado';
import { MiniFila } from '../semanas/MiniFila';
import estilosPaneles from '../semanas/semanas.module.css';
import estilos from './calendario.module.css';

// El modo programar del Calendario (docs/diseno.md § Programar): el panel de la izquierda (o de
// encima, en pantallas estrechas) con los datos del episodio y las estrategias, y las tarjetas del
// borrador que Calendario.tsx pinta en los días. Nada se guarda hasta **Guardar**, que crea el
// plan de una vez con `crearPlan`. El estado (Programacion) lo guarda Calendario.tsx, porque lo
// usan el panel y los días; la lógica del borrador es de lib/programar.ts.

/** Lo que lee el servidor para programar (page.tsx). */
export type DatosParaProgramar = {
  estrategias: Estrategia[];
  /** Todas, archivadas incluidas: hacen falta para descartar las estrategias que las usan. */
  piezas: Pieza[];
  /** Todos los planes: para proponer número, día y hora, y la semana de **Programar**. */
  planes: Plan[];
};

/** El borrador y los datos del episodio que no le hacen falta a lib/programar.ts. */
export type Programacion = {
  borrador: Borrador;
  numero: string;
  invitado: string;
  tema: string;
};

const FALTA_NUMERO = 'Falta el número del episodio';
const FALTA_ESTRATEGIA = 'Elige una estrategia';

/**
 * Al entrar en el modo programar la semana de `lunes`: con episodio, con el número siguiente al
 * último, la hora del último y, como día, `diaD` (un día vacío que se ha pulsado) o el que propone
 * `proponerDiaD` (el mismo día de la semana que el último episodio, o el viernes).
 */
export function nuevaProgramacion(datos: DatosParaProgramar, lunes: string, diaD?: string): Programacion {
  return {
    borrador: borradorNuevo(diaD ?? proponerDiaD(datos.planes, lunes), proponerHoraEpisodio(datos.planes)),
    numero: proponerNumero(datos.planes) ?? '',
    invitado: '',
    tema: '',
  };
}

/**
 * Las estrategias que se ofrecen: las del tipo que toca y sin piezas archivadas, como al planificar.
 */
function estrategiasDisponibles(p: Programacion, datos: DatosParaProgramar): Estrategia[] {
  return estrategiasParaPlanificar(datos.estrategias, datos.piezas, p.borrador.conEpisodio);
}

/**
 * La estrategia elegida, si se puede usar. Si ha dejado de ofrecerse, o ahora tiene otro número de
 * posts (alguien la ha editado mientras se programaba y `crearPlan` lo ha avisado), ninguna: sus
 * posts dejan de verse y hay que volver a elegirla.
 */
export function estrategiaElegida(p: Programacion, datos: DatosParaProgramar): Estrategia | null {
  const { borrador } = p;
  const elegida = estrategiasDisponibles(p, datos).find((e) => e.id === borrador.estrategiaId);
  return elegida && elegida.items.length === borrador.fechas.length ? elegida : null;
}

// Se arrastra a partir de 1024 px, el mismo corte que la lista de días (calendario.module.css). Por
// debajo, los posts se mueven después desde su ventana.
const CONSULTA_ARRASTRE = '(min-width: 64rem)';

function suscribirAlAncho(avisar: () => void) {
  const consulta = window.matchMedia(CONSULTA_ARRASTRE);
  consulta.addEventListener('change', avisar);
  return () => consulta.removeEventListener('change', avisar);
}

/** Si se puede arrastrar (pantalla de 1024 px o más). En el servidor, no. */
export function useSePuedeArrastrar(): boolean {
  return useSyncExternalStore(
    suscribirAlAncho,
    () => window.matchMedia(CONSULTA_ARRASTRE).matches,
    () => false,
  );
}

// Todos los arrastres del Calendario (borrador y tarjetas guardadas) llevan solo este tipo propio:
// un campo de texto no lo acepta, así que soltar una tarjeta en «Invitado» no escribe nada en él. Lo
// que se arrastra lo sabe Calendario.tsx por su estado, no por este dato.
const TIPO_ARRASTRE = 'application/x-horizon-tarjeta';

/**
 * Al empezar a arrastrar una tarjeta: quita lo que el navegador pone por su cuenta (en un enlace, su
 * dirección como texto) y deja solo el tipo propio. Hay que poner algún dato: Firefox no empieza a
 * arrastrar sin él.
 */
export function empezarArrastre(datos: DataTransfer, valor: string) {
  datos.clearData();
  datos.setData(TIPO_ARRASTRE, valor);
  datos.effectAllowed = 'move';
}

/**
 * El panel de programar: título, **Guardar** (azul, la acción principal mientras se programa) y
 * **Cancelar** con el error al lado, ¿Hay episodio?, los datos del episodio (o el día de referencia)
 * y las estrategias con su número de posts y su mini fila. Pulsar una estrategia pega sus posts en el
 * calendario. Si `crearPlan` devuelve un error, se enseña y el modo sigue abierto con lo colocado.
 *
 * La transición de **Guardar** (`guardando`, `iniciar`) es de Calendario.tsx, que no deja arrastrar
 * mientras dura. Aquí, mientras dura, no se cancela ni se cambia nada: el plan se crea con
 * lo que había al pulsar, y cancelar o cambiar algo entonces no lo evitaría.
 */
export function PanelProgramar({
  programacion,
  datos,
  guardando,
  iniciar,
  alCambiar,
  alGuardar,
  alCancelar,
}: {
  programacion: Programacion;
  datos: DatosParaProgramar;
  guardando: boolean;
  iniciar: TransitionStartFunction;
  alCambiar: (cambio: (p: Programacion) => Programacion) => void;
  alGuardar: () => void;
  alCancelar: () => void;
}) {
  const { borrador, numero, invitado, tema } = programacion;
  const [error, setError] = useState<string | null>(null);
  const [faltaNumero, setFaltaNumero] = useState(false);
  const titulo = useRef<HTMLHeadingElement>(null);

  // Al abrirse, el foco va al título, para que se anuncie. Sin desplazar la página: al pulsar un día
  // de la tercera semana, se sigue viendo ese día.
  useEffect(() => {
    titulo.current?.focus({ preventScroll: true });
  }, []);

  const disponibles = estrategiasDisponibles(programacion, datos);
  const estrategia = estrategiaElegida(programacion, datos);
  const horaNormal = borrador.horaEpisodio === null ? null : normalizarHora(borrador.horaEpisodio);
  const horaNoExiste = horaNormal !== null && !existeEnMadrid(borrador.diaD, horaNormal);

  const cambiarBorrador = (cambio: (b: Borrador) => Borrador) =>
    alCambiar((p) => ({ ...p, borrador: cambio(p.borrador) }));

  // Lo que falta se dice al pulsar Guardar, no desactivando el botón. La acción refresca la página al
  // terminar: el botón sigue cargando hasta que llega el plan, y entonces el modo se cierra.
  function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (guardando) return;

    const numeroLimpio = numero.trim();
    if (borrador.conEpisodio && numeroLimpio === '') {
      setFaltaNumero(true);
      setError(FALTA_NUMERO);
      return;
    }
    if (!estrategia) {
      setError(FALTA_ESTRATEGIA);
      return;
    }

    setError(null);
    iniciar(async () => {
      try {
        const resultado = await crearPlan({
          conEpisodio: borrador.conEpisodio,
          diaD: borrador.diaD,
          numero: borrador.conEpisodio ? numeroLimpio : null,
          invitado: borrador.conEpisodio ? invitado : null,
          tema: borrador.conEpisodio ? tema : null,
          horaEpisodio: borrador.conEpisodio ? borrador.horaEpisodio : null,
          estrategiaId: estrategia.id,
          fechas: borrador.fechas,
        });
        startTransition(() => {
          if (resultado.error) setError(resultado.error);
          else alGuardar();
        });
      } catch {
        setError(SIN_CONEXION);
      }
    });
  }

  const textoTitulo = !borrador.conEpisodio
    ? 'Programar una semana sin episodio'
    : numero.trim() === ''
      ? 'Programar un episodio'
      : `Programar el ${numero.trim()}`;

  return (
    <form className={estilos.panelProgramar} onSubmit={guardar} noValidate aria-labelledby="titulo-programar">
      <div className={estilos.cabeceraProgramar}>
        <h2 id="titulo-programar" ref={titulo} tabIndex={-1} className={`ancha ${estilos.tituloProgramar}`}>
          {textoTitulo}
        </h2>
        <div className={estilosPaneles.accionPieza}>
          <div className={estilosPaneles.botones}>
            <Button type="submit" variant="accent" status={guardando ? 'loading' : 'idle'} loadingLabel="Guardando">
              Guardar
            </Button>
            <Button variant="surface" onClick={alCancelar} disabled={guardando}>
              Cancelar
            </Button>
          </div>
          <p className={estilosPaneles.errorPieza} role="alert">
            {error}
          </p>
        </div>
      </div>

      <RadioGroup
        label="¿Hay episodio?"
        orientation="horizontal"
        options={[
          { value: 'si', label: 'Sí' },
          { value: 'no', label: 'No' },
        ]}
        value={borrador.conEpisodio ? 'si' : 'no'}
        disabled={guardando}
        onValueChange={(valor) => {
          cambiarBorrador((b) => cambiarConEpisodio(b, valor === 'si'));
          setError(null);
        }}
      />

      <div className={estilos.camposProgramar}>
        {borrador.conEpisodio && (
          <>
            <TextField
              label="Número"
              inputMode="numeric"
              autoComplete="off"
              value={numero}
              readOnly={guardando}
              onValueChange={(valor) => {
                alCambiar((p) => ({ ...p, numero: valor }));
                setFaltaNumero(false);
              }}
              error={faltaNumero}
            />
            <TextField
              label="Invitado"
              autoComplete="off"
              value={invitado}
              readOnly={guardando}
              onValueChange={(valor) => alCambiar((p) => ({ ...p, invitado: valor }))}
            />
            <TextField
              label="Tema"
              autoComplete="off"
              value={tema}
              readOnly={guardando}
              onValueChange={(valor) => alCambiar((p) => ({ ...p, tema: valor }))}
            />
          </>
        )}
        {/* Cambiar el día es como arrastrar el episodio: los posts ya colocados no se mueven. */}
        <TextField
          type="date"
          label={borrador.conEpisodio ? 'Día del episodio' : 'Día de referencia'}
          value={borrador.diaD}
          readOnly={guardando}
          onValueChange={(valor) => {
            if (esFecha(valor)) cambiarBorrador((b) => moverEpisodioBorrador(b, valor, estrategia));
          }}
        />
        {borrador.conEpisodio && (
          <TextField
            label="Hora"
            autoComplete="off"
            placeholder="hh:mm"
            value={borrador.horaEpisodio ?? ''}
            readOnly={guardando}
            onValueChange={(valor) =>
              cambiarBorrador((b) => ({ ...b, horaEpisodio: valor.trim() === '' ? null : valor }))
            }
          />
        )}
      </div>
      {borrador.conEpisodio && horaNoExiste && (
        <p className={estilosPaneles.avisoHora}>
          {`Las ${horaNormal} del ${fechaLarga(borrador.diaD).toLowerCase()} no existen en España por el cambio de horario.`}
        </p>
      )}

      {disponibles.length > 0 ? (
        <RadioGroup
          label="Estrategia"
          className={estilos.estrategiasProgramar}
          options={disponibles.map((e) => ({
            value: e.id,
            label: e.nombre,
            description: (
              <>
                <span className={estilos.postsEstrategia}>
                  {e.items.length === 1 ? '1 post' : `${e.items.length} posts`}
                </span>
                <MiniFila estrategia={e} piezas={datos.piezas} />
              </>
            ),
          }))}
          value={estrategia?.id ?? null}
          disabled={guardando}
          onValueChange={(id) => {
            const elegida = disponibles.find((e) => e.id === id);
            if (elegida) cambiarBorrador((b) => elegirEstrategia(b, elegida));
            setError(null);
          }}
        />
      ) : (
        <p className={estilosPaneles.sinEstrategias}>
          {borrador.conEpisodio
            ? 'No hay ninguna estrategia disponible para una semana con episodio.'
            : 'No hay ninguna estrategia disponible para una semana sin episodio.'}
        </p>
      )}
    </form>
  );
}

/** Lo que se arrastra: un post del borrador (por su índice en la estrategia) o el episodio. */
export type Arrastre = { tipo: 'post'; indice: number } | { tipo: 'episodio' };

/**
 * Una tarjeta del borrador en su día: un post (con el filete azul y «Del 06» en azul) o el episodio
 * (la tarjeta invertida). No son enlaces: aún no existen. Con `arrastrable`, se arrastran a otro día.
 */
export function TarjetaBorrador({
  tarjeta,
  programacion,
  hoy,
  arrastrable,
  alEmpezar,
  alTerminar,
}: {
  tarjeta: { tipo: 'post'; post: PostDelBorrador } | { tipo: 'episodio' };
  programacion: Programacion;
  hoy: string;
  arrastrable: boolean;
  alEmpezar: (arrastre: Arrastre) => void;
  alTerminar: () => void;
}) {
  const [arrastrando, setArrastrando] = useState(false);
  const datosDelPlan = { conEpisodio: programacion.borrador.conEpisodio, numero: programacion.numero.trim() || null };

  const eventos = arrastrable
    ? {
        draggable: true,
        onDragStart: (evento: DragEvent<HTMLDivElement>) => {
          empezarArrastre(evento.dataTransfer, tarjeta.tipo === 'post' ? `borrador-${tarjeta.post.indice}` : 'borrador-episodio');
          alEmpezar(tarjeta.tipo === 'post' ? { tipo: 'post', indice: tarjeta.post.indice } : { tipo: 'episodio' });
          setArrastrando(true);
        },
        onDragEnd: () => {
          setArrastrando(false);
          alTerminar();
        },
      }
    : {};

  if (tarjeta.tipo === 'episodio') {
    const hora = programacion.borrador.horaEpisodio && normalizarHora(programacion.borrador.horaEpisodio);
    return (
      <div
        className={estilos.tarjeta}
        data-tipo="episodio"
        data-borrador=""
        data-arrastrable={arrastrable ? '' : undefined}
        data-arrastrando={arrastrando ? '' : undefined}
        {...eventos}
      >
        <span className={estilos.marcaEpisodio} aria-hidden="true" />
        <span className={estilos.texto}>
          {hora && <span className={estilos.hora}>{hora}</span>}
          <span>{tituloEpisodio(datosDelPlan)}</span>
          <span className={estilos.de}>YouTube y Spotify</span>
        </span>
      </div>
    );
  }

  const { post } = tarjeta;
  return (
    <div
      className={estilos.tarjeta}
      data-borrador=""
      data-arrastrable={arrastrable ? '' : undefined}
      data-arrastrando={arrastrando ? '' : undefined}
      {...eventos}
    >
      <MarcaEstado pieza={{ ...post, id: `borrador-${post.indice}`, planId: '' }} hoy={hoy} />
      <span className={estilos.texto}>
        {post.hora && <span className={estilos.hora}>{post.hora}</span>}
        <span>{post.nombre}</span>
        <span className={estilos.de}>{etiquetaDe(datosDelPlan)}</span>
      </span>
    </div>
  );
}
