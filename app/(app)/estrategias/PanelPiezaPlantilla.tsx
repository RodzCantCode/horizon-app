'use client';

import { useRef, useState, type FormEvent } from 'react';
import { Button, Checkbox, PencilIcon, RadioGroup, TextField } from 'mochi-ui';
import { NUEVA, preguntaArchivar, textoDias, textoFormatoPieza } from '@/lib/estrategias';
import { DESPLAZAMIENTOS } from '@/lib/planes';
import { posicionRespectoAD, textoCanales, textoPreparacion } from '@/lib/semanas';
import { CANALES, FORMATOS, type Canal, type Formato, type Pieza } from '@/lib/tipos';
import { BotonesGuardar, useEnvio } from '../componentes/edicion';
import { Panel, useFocoAlCambiarDeVista, usePanelDeLaUrl } from '../componentes/Panel';
import panel from '../semanas/semanas.module.css';
import { archivarPieza, guardarPieza } from './acciones';
import estilos from './estrategias.module.css';

/**
 * El panel de una pieza de la sección Estrategias (la plantilla, no la copia de un plan: esa es
 * semanas/PanelPieza.tsx), en `?pieza=<id>`: sus datos, las estrategias que la usan y **Archivar** o
 * **Recuperar**. Con el lápiz, modo edición con **Guardar** y **Cancelar**. Con `?pieza=nueva` se abre
 * ya en edición, para crear una; al guardarla o al cancelar, se cierra.
 *
 * Los datos los lee el servidor (page.tsx). Si la pieza ya no existe, llega `pieza = null` y el
 * título lo dice. Se abre y se cierra como los de Semanas (`usePanelDeLaUrl`).
 */
export function PanelPiezaPlantilla({
  id,
  pieza,
  usadaEn,
}: {
  id: string;
  pieza: Pieza | null;
  /** Nombres de las estrategias que la usan. */
  usadaEn: string[];
}) {
  const { abierto, cerrar } = usePanelDeLaUrl('pieza', id);
  const nueva = id === NUEVA;
  const titulo = nueva ? 'Nueva pieza' : (pieza?.nombre ?? 'Esa pieza ya no existe');

  return (
    <Panel abierto={abierto} alCerrar={cerrar} titulo={titulo}>
      {nueva ? (
        <EditarPieza pieza={null} alGuardar={cerrar} alCancelar={cerrar} />
      ) : (
        pieza && <ContenidoPieza pieza={pieza} usadaEn={usadaEn} />
      )}
    </Panel>
  );
}

/** Ver o editar: el lápiz pasa a editar; **Guardar** y **Cancelar** vuelven a ver. */
function ContenidoPieza({ pieza, usadaEn }: { pieza: Pieza; usadaEn: string[] }) {
  const [editando, setEditando] = useState(false);
  const vista = useRef<HTMLDivElement>(null);
  useFocoAlCambiarDeVista(editando ? 'editar' : 'ver', vista);
  const volver = () => setEditando(false);

  return (
    <div ref={vista} className={panel.vista}>
      {editando ? (
        <EditarPieza pieza={pieza} alGuardar={volver} alCancelar={volver} />
      ) : (
        <VerPieza pieza={pieza} usadaEn={usadaEn} alEditar={() => setEditando(true)} />
      )}
    </div>
  );
}

function VerPieza({ pieza, usadaEn, alEditar }: { pieza: Pieza; usadaEn: string[]; alEditar: () => void }) {
  return (
    <>
      <div className={panel.cabeceraPanel}>
        <dl className={panel.datosPieza}>
          <dt>Nombre corto</dt>
          <dd>{pieza.nombreCorto}</dd>
          <dt>Formato</dt>
          <dd>{textoFormatoPieza(pieza.formato)}</dd>
          <dt>Canales</dt>
          <dd>{textoCanales(pieza.canales)}</dd>
          <dt>Días</dt>
          <dd>{textoDias(pieza.diasPermitidos)}</dd>
          <dt>Preparación</dt>
          <dd>{textoPreparacion(pieza.diasPreparacion)}</dd>
          <dt>Hora habitual</dt>
          <dd>{pieza.horaHabitual ?? 'Sin hora'}</dd>
          <dt>Estrategias</dt>
          <dd>{usadaEn.length > 0 ? usadaEn.join(', ') : 'Ninguna'}</dd>
          {pieza.archivada && (
            <>
              <dt>Estado</dt>
              <dd>Archivada</dd>
            </>
          )}
        </dl>
        <Button variant="surface" iconOnly aria-label="Editar" onClick={alEditar}>
          <PencilIcon size={18} />
        </Button>
      </div>

      <Archivar pieza={pieza} usos={usadaEn.length} />
    </>
  );
}

/**
 * **Archivar** o **Recuperar**, en superficie: no es lo principal del panel. Si alguna estrategia la
 * usa, el servidor pide confirmación y, en el sitio del botón, aparece la pregunta con **Archivar** y
 * **Cancelar**. Recuperar no pregunta. El panel sigue abierto con la pieza ya cambiada.
 */
function Archivar({ pieza, usos }: { pieza: Pieza; usos: number }) {
  const [confirmando, setConfirmando] = useState(false);
  const { enviando, error, enviar } = useEnvio();
  const zona = useRef<HTMLDivElement>(null);
  useFocoAlCambiarDeVista(confirmando ? 'confirmar' : 'boton', zona);

  function archivar(confirmado: boolean) {
    enviar(
      () => archivarPieza(pieza.id, true, confirmado),
      () => setConfirmando(false),
      (aviso) => {
        if (aviso !== 'confirmar') return false;
        setConfirmando(true);
        return true;
      },
    );
  }

  function recuperar() {
    enviar(
      () => archivarPieza(pieza.id, false),
      () => {},
    );
  }

  return (
    <div ref={zona} className={panel.zonaQuitar}>
      {confirmando ? (
        <div className={panel.confirmacion}>
          <p data-foco tabIndex={-1}>
            {preguntaArchivar(usos)}
          </p>
          <div className={panel.botones}>
            <Button
              variant="surface"
              status={enviando ? 'loading' : 'idle'}
              loadingLabel="Archivando"
              onClick={() => archivar(true)}
            >
              Archivar
            </Button>
            <Button variant="surface" onClick={() => setConfirmando(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <Button
            variant="surface"
            status={enviando ? 'loading' : 'idle'}
            loadingLabel={pieza.archivada ? 'Recuperando' : 'Archivando'}
            onClick={pieza.archivada ? recuperar : () => archivar(false)}
          >
            {pieza.archivada ? 'Recuperar' : 'Archivar'}
          </Button>
        </div>
      )}
      <p className={panel.errorPieza} role="alert">
        {error}
      </p>
    </div>
  );
}

/** Lo escrito en «Días de preparación» como número: un entero desde 0, o NaN (el servidor lo rechaza). */
function aNumero(texto: string): number {
  const limpio = texto.trim();
  return /^\d+$/.test(limpio) ? Number(limpio) : Number.NaN;
}

/**
 * La pieza en modo edición (o una nueva, con `pieza = null`, con los valores de partida del
 * prototipo: carrusel, Instagram, todos los días, dos de preparación y sin hora). La hora es texto
 * «hh:mm», como al editar una pieza de un plan: vacía es sin hora. El servidor lo vuelve a comprobar
 * todo y no deja quitar un día en el que una estrategia ya la tiene.
 */
function EditarPieza({
  pieza,
  alGuardar,
  alCancelar,
}: {
  pieza: Pieza | null;
  alGuardar: () => void;
  alCancelar: () => void;
}) {
  const [nombre, setNombre] = useState(pieza?.nombre ?? '');
  const [nombreCorto, setNombreCorto] = useState(pieza?.nombreCorto ?? '');
  const [formato, setFormato] = useState<Formato>(pieza?.formato ?? 'slide');
  const [canales, setCanales] = useState<Canal[]>(pieza?.canales ?? ['ig']);
  const [dias, setDias] = useState<number[]>(pieza?.diasPermitidos ?? [...DESPLAZAMIENTOS]);
  const [preparacion, setPreparacion] = useState(String(pieza?.diasPreparacion ?? 2));
  const [hora, setHora] = useState(pieza?.horaHabitual ?? '');
  const { enviando, error, enviar } = useEnvio();

  function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = {
      nombre,
      nombreCorto,
      formato,
      canales,
      diasPermitidos: dias,
      diasPreparacion: aNumero(preparacion),
      horaHabitual: hora,
    };
    enviar(() => guardarPieza(pieza ? { id: pieza.id, ...datos } : datos), alGuardar);
  }

  return (
    <form className={panel.edicion} onSubmit={guardar} noValidate>
      <div className={panel.campos}>
        <TextField label="Nombre" autoComplete="off" value={nombre} onValueChange={setNombre} />
        <TextField label="Nombre corto" autoComplete="off" value={nombreCorto} onValueChange={setNombreCorto} />
      </div>

      <RadioGroup
        label="Formato"
        orientation="horizontal"
        options={FORMATOS.map((f) => ({ value: f, label: textoFormatoPieza(f) }))}
        value={formato}
        onValueChange={(valor) => setFormato(FORMATOS.find((f) => f === valor) ?? formato)}
      />

      <Casillas
        leyenda="Canales"
        opciones={CANALES.map((c) => ({ valor: c, etiqueta: textoCanales([c]) }))}
        elegidas={canales}
        alCambiar={setCanales}
      />

      <Casillas
        leyenda="Días permitidos"
        opciones={DESPLAZAMIENTOS.map((d) => ({ valor: d, etiqueta: posicionRespectoAD(d) }))}
        elegidas={dias}
        alCambiar={setDias}
      />

      <div className={panel.campos}>
        <TextField
          label="Días de preparación"
          inputMode="numeric"
          autoComplete="off"
          value={preparacion}
          onValueChange={setPreparacion}
        />
        <TextField label="Hora habitual" autoComplete="off" placeholder="hh:mm" value={hora} onValueChange={setHora} />
      </div>

      <BotonesGuardar guardando={enviando} error={error} alCancelar={alCancelar} />
    </form>
  );
}

/** Un grupo de casillas con su título; lo elegido sale en el orden de las opciones. */
function Casillas<T extends string | number>({
  leyenda,
  opciones,
  elegidas,
  alCambiar,
}: {
  leyenda: string;
  opciones: { valor: T; etiqueta: string }[];
  elegidas: T[];
  alCambiar: (elegidas: T[]) => void;
}) {
  return (
    <fieldset className={estilos.grupoCampos}>
      <legend className={estilos.leyenda}>{leyenda}</legend>
      <div className={estilos.casillas}>
        {opciones.map(({ valor, etiqueta }) => (
          <Checkbox
            key={valor}
            label={etiqueta}
            checked={elegidas.includes(valor)}
            onCheckedChange={(marcada) =>
              alCambiar(opciones.map((o) => o.valor).filter((v) => (v === valor ? marcada : elegidas.includes(v))))
            }
          />
        ))}
      </div>
    </fieldset>
  );
}
