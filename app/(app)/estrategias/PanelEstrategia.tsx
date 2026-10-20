'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Button, CloseIcon, PencilIcon, RadioGroup, Select, TextField } from 'mochi-ui';
import { rangoMiniFila } from '@/lib/calendario';
import { motivoNoDisponible, NUEVA, piezasParaAnadir } from '@/lib/estrategias';
import { DESPLAZAMIENTOS_ESTRATEGIA } from '@/lib/planes';
import { posicionRespectoAD } from '@/lib/semanas';
import type { Estrategia, Pieza } from '@/lib/tipos';
import { BotonesGuardar, useEnvio } from '../componentes/edicion';
import { Panel, useFocoAlCambiarDeVista, usePanelDeLaUrl } from '../componentes/Panel';
import panel from '../semanas/semanas.module.css';
import { guardarEstrategia } from './acciones';
import estilos from './estrategias.module.css';

/**
 * El panel de una estrategia (docs/diseno.md § Estrategias), en `?estrategia=<id>`: para qué semanas
 * es (con o sin episodio), por qué no se ofrece al planificar si usa piezas archivadas, y sus piezas
 * día a día, de D-7 a D+14. Con el lápiz, modo edición: nombre, tipo y las piezas de cada día, con
 * **Guardar** y **Cancelar**. Con `?estrategia=nueva` se abre ya en edición y vacía, para crear una;
 * al guardarla o al cancelar, se cierra.
 *
 * Los datos los lee el servidor (page.tsx). Si la estrategia ya no existe, llega `estrategia = null`
 * y el título lo dice. Se abre y se cierra como los de Semanas (`usePanelDeLaUrl`).
 */
export function PanelEstrategia({
  id,
  estrategia,
  piezas,
}: {
  id: string;
  estrategia: Estrategia | null;
  /** Todas, archivadas incluidas: para nombrar las de la estrategia y ofrecer las que se pueden poner. */
  piezas: Pieza[];
}) {
  const { abierto, cerrar } = usePanelDeLaUrl('estrategia', id);
  const nueva = id === NUEVA;
  const titulo = nueva ? 'Nueva estrategia' : (estrategia?.nombre ?? 'Esa estrategia ya no existe');

  return (
    <Panel abierto={abierto} alCerrar={cerrar} titulo={titulo}>
      {nueva ? (
        <EditarEstrategia estrategia={null} piezas={piezas} alGuardar={cerrar} alCancelar={cerrar} />
      ) : (
        estrategia && <ContenidoEstrategia estrategia={estrategia} piezas={piezas} />
      )}
    </Panel>
  );
}

/** Ver o editar: el lápiz pasa a editar; **Guardar** y **Cancelar** vuelven a ver. */
function ContenidoEstrategia({ estrategia, piezas }: { estrategia: Estrategia; piezas: Pieza[] }) {
  const [editando, setEditando] = useState(false);
  const vista = useRef<HTMLDivElement>(null);
  useFocoAlCambiarDeVista(editando ? 'editar' : 'ver', vista);
  const volver = () => setEditando(false);

  return (
    <div ref={vista} className={panel.vista}>
      {editando ? (
        <EditarEstrategia estrategia={estrategia} piezas={piezas} alGuardar={volver} alCancelar={volver} />
      ) : (
        <VerEstrategia estrategia={estrategia} piezas={piezas} alEditar={() => setEditando(true)} />
      )}
    </div>
  );
}

function VerEstrategia({
  estrategia,
  piezas,
  alEditar,
}: {
  estrategia: Estrategia;
  piezas: Pieza[];
  alEditar: () => void;
}) {
  const motivo = motivoNoDisponible(estrategia, piezas);
  const idPiezas = useId();

  return (
    <>
      <div className={panel.cabeceraPanel}>
        <div className={estilos.datos}>
          <dl className={panel.datosPieza}>
            <dt>Tipo</dt>
            <dd>{estrategia.conEpisodio ? 'Con episodio' : 'Sin episodio'}</dd>
          </dl>
          {motivo && <p className={estilos.noDisponible}>{motivo}</p>}
        </div>
        <Button variant="surface" iconOnly aria-label="Editar" onClick={alEditar}>
          <PencilIcon size={18} />
        </Button>
      </div>

      <section className={panel.registro} aria-labelledby={idPiezas}>
        <h3 id={idPiezas} className={panel.tituloRegistro}>
          Piezas
        </h3>
        <ol className={estilos.dias}>
          {DESPLAZAMIENTOS_ESTRATEGIA.map((desplazamiento) => {
            const delDia = estrategia.items.filter((i) => i.desplazamiento === desplazamiento);
            if (delDia.length === 0) return null;
            return (
              <li key={desplazamiento} className={estilos.dia}>
                <span className={estilos.posicion}>{posicionRespectoAD(desplazamiento)}</span>
                <ul className={estilos.piezasDia}>
                  {delDia.map((item, i) => (
                    <li key={i}>
                      <NombrePieza pieza={piezas.find((p) => p.id === item.piezaId)} />
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ol>
      </section>
    </>
  );
}

/** El nombre de una pieza de la estrategia y, si está archivada, que lo está. */
function NombrePieza({ pieza }: { pieza: Pieza | undefined }) {
  // Una pieza en uso no se puede borrar (la base lo impide), así que siempre está entre las leídas.
  if (!pieza) return <span>Pieza que ya no existe</span>;
  return (
    <span>
      {pieza.nombre}
      {pieza.archivada && <span className={estilos.archivada}> · archivada</span>}
    </span>
  );
}

/** Una pieza de la estrategia mientras se edita, con una clave propia para la lista. */
type ItemEnEdicion = Estrategia['items'][number] & { clave: number };

/**
 * La estrategia en modo edición (o una nueva, con `estrategia = null`): nombre, tipo y, por cada
 * día, sus piezas, cada una con su botón de quitar, y un desplegable para añadir otra. Se ofrecen
 * las no archivadas que no están ya en ese día (`piezasParaAnadir`); una archivada que ya tenía se
 * ve marcada y se puede quitar. El servidor lo vuelve a comprobar todo.
 *
 * Los días van de D-7 a D+14, pero no se enseñan los 22 de entrada: solo los de la mini fila
 * (`rangoMiniFila`: de D-2 a D+12, más los que la estrategia ya usa fuera de ahí) y **Más días**
 * despliega el resto. El tramo se calcula al abrir y no encoge al quitar piezas.
 */
function EditarEstrategia({
  estrategia,
  piezas,
  alGuardar,
  alCancelar,
}: {
  estrategia: Estrategia | null;
  piezas: Pieza[];
  alGuardar: () => void;
  alCancelar: () => void;
}) {
  const [nombre, setNombre] = useState(estrategia?.nombre ?? '');
  const [conEpisodio, setConEpisodio] = useState(estrategia?.conEpisodio ?? true);
  const [items, setItems] = useState<ItemEnEdicion[]>(() =>
    (estrategia?.items ?? []).map((item, clave) => ({ ...item, clave })),
  );
  const siguienteClave = useRef(estrategia?.items.length ?? 0);
  const { enviando, error, enviar } = useEnvio();

  const [rango] = useState(() =>
    rangoMiniFila({ id: '', nombre: '', conEpisodio: true, items: estrategia?.items ?? [] }),
  );
  const [todosLosDias, setTodosLosDias] = useState(false);
  const enRango = (d: number) => d >= rango.desde && d <= rango.hasta;
  const dias = todosLosDias ? DESPLAZAMIENTOS_ESTRATEGIA : DESPLAZAMIENTOS_ESTRATEGIA.filter(enRango);

  // Al quitar una pieza, su botón desaparece: el foco pasa a lo primero que quede en ese día (otra
  // pieza o el desplegable de añadir). Con **Más días** pasa lo mismo con el botón: el foco va al
  // primer día nuevo de después (D+13) o, si no hay, al último de antes (D-3), y ahí sí se desplaza
  // hasta él.
  const lista = useRef<HTMLOListElement>(null);
  const focoEnDia = useRef<{ dia: number; desplazar: boolean } | null>(null);
  useEffect(() => {
    const foco = focoEnDia.current;
    if (foco === null) return;
    focoEnDia.current = null;
    lista.current
      ?.querySelector(`[data-dia="${foco.dia}"]`)
      ?.querySelector<HTMLElement>('button:not([tabindex="-1"]), select:not([tabindex="-1"])')
      ?.focus({ preventScroll: !foco.desplazar });
  });

  function mostrarTodosLosDias() {
    const nuevos = DESPLAZAMIENTOS_ESTRATEGIA.filter((d) => !enRango(d));
    const dia = nuevos.find((d) => d > rango.hasta) ?? nuevos[nuevos.length - 1];
    if (dia !== undefined) focoEnDia.current = { dia, desplazar: true };
    setTodosLosDias(true);
  }

  function anadir(piezaId: string, desplazamiento: number) {
    setItems([...items, { piezaId, desplazamiento, clave: siguienteClave.current++ }]);
  }

  function quitar(clave: number, desplazamiento: number) {
    focoEnDia.current = { dia: desplazamiento, desplazar: false };
    setItems(items.filter((i) => i.clave !== clave));
  }

  function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = {
      nombre,
      conEpisodio,
      items: items.map(({ piezaId, desplazamiento }) => ({ piezaId, desplazamiento })),
    };
    enviar(() => guardarEstrategia(estrategia ? { id: estrategia.id, ...datos } : datos), alGuardar);
  }

  return (
    <form className={panel.edicion} onSubmit={guardar} noValidate>
      <div className={panel.campos}>
        <TextField label="Nombre" autoComplete="off" value={nombre} onValueChange={setNombre} />
      </div>

      <RadioGroup
        label="Tipo"
        orientation="horizontal"
        options={[
          { value: 'con', label: 'Con episodio' },
          { value: 'sin', label: 'Sin episodio' },
        ]}
        value={conEpisodio ? 'con' : 'sin'}
        onValueChange={(valor) => setConEpisodio(valor === 'con')}
      />

      <fieldset className={estilos.grupoCampos}>
        <legend className={estilos.leyenda}>Piezas</legend>
        <ol ref={lista} className={estilos.dias}>
          {dias.map((desplazamiento) => {
            const posicion = posicionRespectoAD(desplazamiento);
            const delDia = items.filter((i) => i.desplazamiento === desplazamiento);
            const anadibles = piezasParaAnadir(piezas, items, desplazamiento);
            return (
              <li key={desplazamiento} data-dia={desplazamiento} className={estilos.dia} data-editable="">
                <span className={estilos.posicion}>{posicion}</span>
                <div className={estilos.contenidoDia}>
                  {delDia.length > 0 && (
                    <ul className={estilos.piezasDia}>
                      {delDia.map((item) => {
                        const pieza = piezas.find((p) => p.id === item.piezaId);
                        return (
                          <li key={item.clave} className={estilos.piezaDia}>
                            <NombrePieza pieza={pieza} />
                            <Button
                              variant="surface"
                              size="sm"
                              iconOnly
                              aria-label={`Quitar ${pieza?.nombre ?? 'la pieza'} de ${posicion}`}
                              onClick={() => quitar(item.clave, desplazamiento)}
                            >
                              <CloseIcon size={16} />
                            </Button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {anadibles.length > 0 && (
                    <Select
                      size="sm"
                      label={`Añadir una pieza en ${posicion}`}
                      placeholder="Añadir"
                      options={anadibles.map((p) => ({ value: p.id, label: p.nombre }))}
                      value=""
                      onValueChange={(piezaId) => anadir(piezaId, desplazamiento)}
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ol>
        {dias.length < DESPLAZAMIENTOS_ESTRATEGIA.length && (
          <div className={estilos.masDias}>
            <Button variant="surface" size="sm" onClick={mostrarTodosLosDias}>
              Más días
            </Button>
          </div>
        )}
      </fieldset>

      <BotonesGuardar guardando={enviando} error={error} alCancelar={alCancelar} />
    </form>
  );
}
