'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button, PencilIcon, RadioGroup, Select, TextField } from 'mochi-ui';
import { esFecha, existeEnMadrid, lunesDe, normalizarHora } from '@/lib/fechas';
import { estrategiasParaPlanificar } from '@/lib/planes';
import { diasDelPlan, etiquetaDia, fechaLarga, tituloSemana } from '@/lib/semanas';
import type { Estrategia, Pieza, PiezaDePlan, Plan } from '@/lib/tipos';
import { BotonesGuardar, useEnvio } from '../componentes/edicion';
import { Panel, useFocoAlCambiarDeVista, useMientrasSeCierra } from '../componentes/Panel';
import {
  anadirPiezaSuelta,
  cambiarEstrategiaDePlan,
  editarEpisodio,
  moverSemana,
} from './acciones';
import { MarcaEstado } from './MarcaEstado';
import { MiniFila } from './MiniFila';
import estilos from './semanas.module.css';

/** Lo que lee el servidor para el panel de una semana con plan (page.tsx). */
export type DatosDeSemana = {
  plan: Plan;
  /** Las del plan, por fecha y hora. */
  piezasDelPlan: PiezaDePlan[];
  estrategias: Estrategia[];
  /** Todas, archivadas incluidas: para descartar las estrategias que las usan. */
  piezas: Pieza[];
};

type Vista = 'ver' | 'editar' | 'mover' | 'estrategia' | 'anadir';

/**
 * El panel de una semana con plan (docs/diseno.md § Paneles de detalle): los datos del episodio, la
 * estrategia usada y sus piezas, cada una con su enlace a su panel. Se abre al pulsar el encabezado
 * de la semana (`?semana=<lunes>`); los datos los lee el servidor (page.tsx). Si esa semana ya no
 * tiene plan (otra persona lo ha movido o borrado), llega `datos = null` y el panel lo dice.
 *
 * Con el lápiz, modo edición: los datos del episodio con **Guardar** y **Cancelar** y, aparte,
 * **Mover la semana**, **Cambiar la estrategia** y **Añadir una pieza suelta**, cada uno en su propia
 * vista con su **Guardar** y su **Cancelar**. Al terminar se vuelve a ver la semana; si se ha movido
 * a otra semana, el panel se cierra (ya no es esta) y el foco va al encabezado de la nueva.
 *
 * Se abre y se cierra como los demás paneles (PanelPlanificar.tsx): abierto mientras la URL lleve su
 * lunes, se cierra quitándolo con history.pushState y, al cerrarse, el foco vuelve a su encabezado.
 */
export function PanelSemana({ lunes, datos, hoy }: { lunes: string; datos: DatosDeSemana | null; hoy: string }) {
  const parametros = useSearchParams();
  const abierto = parametros.get('semana') === lunes;
  // Adónde vuelve el foco al cerrar: su encabezado o, si el plan se ha movido, el de su semana nueva.
  const destinoDelFoco = useRef(lunes);

  // Lee la URL de ese momento, no la del último pintado, como PanelPlanificar: también se llama al
  // terminar de mover la semana, y para entonces el panel puede estar cerrado.
  function cerrar() {
    const siguientes = new URLSearchParams(window.location.search);
    if (siguientes.get('semana') !== lunes) return;
    siguientes.delete('semana');
    const consulta = siguientes.toString();
    const ruta = window.location.pathname;
    window.history.pushState(null, '', consulta ? `${ruta}?${consulta}` : ruta);
  }

  function alMoverAOtraSemana(nuevoLunes: string) {
    destinoDelFoco.current = nuevoLunes;
    cerrar();
  }

  const estuvoAbierto = useRef(abierto);
  useEffect(() => {
    if (abierto) {
      estuvoAbierto.current = true;
      return;
    }
    if (!estuvoAbierto.current) return;
    estuvoAbierto.current = false;
    document.querySelector<HTMLElement>(`[data-semana="${CSS.escape(destinoDelFoco.current)}"]`)?.focus();
    destinoDelFoco.current = lunes;
  }, [abierto, lunes]);

  const mostrados = useMientrasSeCierra(datos, abierto);

  return (
    <Panel abierto={abierto} alCerrar={cerrar} titulo={mostrados ? tituloSemana(lunes) : 'Esa semana no tiene plan'}>
      {mostrados && (
        <ContenidoSemana lunes={lunes} datos={mostrados} hoy={hoy} alMoverAOtraSemana={alMoverAOtraSemana} />
      )}
    </Panel>
  );
}

function ContenidoSemana({
  lunes,
  datos,
  hoy,
  alMoverAOtraSemana,
}: {
  lunes: string;
  datos: DatosDeSemana;
  hoy: string;
  alMoverAOtraSemana: (nuevoLunes: string) => void;
}) {
  const [vista, setVista] = useState<Vista>('ver');
  const contenedor = useRef<HTMLDivElement>(null);
  useFocoAlCambiarDeVista(vista, contenedor);
  const volver = () => setVista('ver');

  return (
    <div ref={contenedor} className={estilos.vista}>
      {vista === 'ver' && <DatosSemana datos={datos} hoy={hoy} alEditar={() => setVista('editar')} />}
      {vista === 'editar' && <EditarSemana plan={datos.plan} alElegir={setVista} alTerminar={volver} />}
      {vista === 'mover' && (
        <MoverSemana lunes={lunes} plan={datos.plan} alTerminar={volver} alMoverAOtraSemana={alMoverAOtraSemana} />
      )}
      {vista === 'estrategia' && <CambiarEstrategia datos={datos} alTerminar={volver} />}
      {vista === 'anadir' && <AnadirPieza datos={datos} alTerminar={volver} />}
    </div>
  );
}

/** La semana tal cual: datos del episodio, estrategia y piezas. El lápiz pasa a editar. */
function DatosSemana({
  datos: { plan, piezasDelPlan },
  hoy,
  alEditar,
}: {
  datos: DatosDeSemana;
  hoy: string;
  alEditar: () => void;
}) {
  const idPiezas = useId();

  return (
    <>
      <div className={estilos.cabeceraPanel}>
        <dl className={estilos.datosPieza}>
          <dt>Episodio</dt>
          <dd>{plan.conEpisodio ? (plan.numero ? `Ep ${plan.numero}` : 'Sin número') : 'Sin episodio'}</dd>
          <dt>{plan.conEpisodio ? 'Publicación' : 'Referencia'}</dt>
          <dd>{fechaLarga(plan.diaD)}</dd>
          {plan.invitado && (
            <>
              <dt>Invitado</dt>
              <dd>{plan.invitado}</dd>
            </>
          )}
          {plan.tema && (
            <>
              <dt>Tema</dt>
              <dd>{plan.tema}</dd>
            </>
          )}
          <dt>Estrategia</dt>
          <dd>{plan.estrategiaNombre}</dd>
        </dl>
        <Button variant="surface" iconOnly aria-label="Editar" onClick={alEditar}>
          <PencilIcon size={18} />
        </Button>
      </div>

      <section className={estilos.registro} aria-labelledby={idPiezas}>
        <h3 id={idPiezas} className={estilos.tituloRegistro}>
          Piezas
        </h3>
        {piezasDelPlan.length > 0 ? (
          <ul className={estilos.piezasSemana}>
            {piezasDelPlan.map((p) => (
              <li key={p.id}>
                {/* Abre su panel en lugar de este (la URL lleva solo la pieza). */}
                <Link href={`/?pieza=${p.id}`} scroll={false} className={estilos.piezaSemana}>
                  <MarcaEstado pieza={p} hoy={hoy} />
                  <span className={estilos.diaPrevia}>{etiquetaDia(p.fecha)}</span>
                  <span className={estilos.horaPrevia}>{p.hora}</span>
                  <span className={estilos.nombrePrevia}>{p.nombre}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className={estilos.anotaciones}>Sin piezas</p>
        )}
      </section>
    </>
  );
}

/**
 * El modo edición de la semana: con episodio, su número, invitado y tema con **Guardar** y
 * **Cancelar**; debajo, para todas, los otros tres cambios, cada uno en su vista.
 */
function EditarSemana({
  plan,
  alElegir,
  alTerminar,
}: {
  plan: Plan;
  alElegir: (vista: Vista) => void;
  alTerminar: () => void;
}) {
  const [numero, setNumero] = useState(plan.numero ?? '');
  const [invitado, setInvitado] = useState(plan.invitado ?? '');
  const [tema, setTema] = useState(plan.tema ?? '');
  const { enviando, error, enviar } = useEnvio();

  function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    enviar(() => editarEpisodio(plan.id, { numero, invitado, tema }), alTerminar);
  }

  return (
    <>
      {plan.conEpisodio && (
        <form className={estilos.edicion} onSubmit={guardar} noValidate>
          <div className={estilos.campos}>
            <TextField
              label="Número"
              inputMode="numeric"
              autoComplete="off"
              value={numero}
              onValueChange={setNumero}
            />
            <TextField label="Invitado" autoComplete="off" value={invitado} onValueChange={setInvitado} />
            <TextField label="Tema" autoComplete="off" value={tema} onValueChange={setTema} />
          </div>
          <BotonesGuardar guardando={enviando} error={error} alCancelar={alTerminar} />
        </form>
      )}

      <div className={estilos.otrosCambios}>
        <Button variant="surface" onClick={() => alElegir('mover')}>
          Mover la semana
        </Button>
        <Button variant="surface" onClick={() => alElegir('estrategia')}>
          Cambiar la estrategia
        </Button>
        <Button variant="surface" onClick={() => alElegir('anadir')}>
          Añadir una pieza suelta
        </Button>
        {!plan.conEpisodio && (
          <Button variant="surface" onClick={alTerminar}>
            Cancelar
          </Button>
        )}
      </div>
    </>
  );
}

/**
 * **Mover la semana**: un día D nuevo, cualquiera. Todas las piezas se mueven los mismos días y las
 * programadas quedan para revisar en Metricool (lo hace la base). Si cae en otra semana, se dice
 * antes de guardar y, al guardar, el plan pasa a esa semana y el panel se cierra; si esa semana ya
 * tiene plan, el servidor lo dice y no cambia nada.
 */
function MoverSemana({
  lunes,
  plan,
  alTerminar,
  alMoverAOtraSemana,
}: {
  lunes: string;
  plan: Plan;
  alTerminar: () => void;
  alMoverAOtraSemana: (nuevoLunes: string) => void;
}) {
  const [diaD, setDiaD] = useState(plan.diaD);
  const { enviando, error, enviar } = useEnvio();
  const nuevoLunes = esFecha(diaD) ? lunesDe(diaD) : lunes;

  function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const siVaBien = nuevoLunes === lunes ? alTerminar : () => alMoverAOtraSemana(nuevoLunes);
    enviar(() => moverSemana(plan.id, diaD), siVaBien);
  }

  return (
    <form className={estilos.edicion} onSubmit={guardar} noValidate>
      <div className={estilos.campos}>
        <TextField
          type="date"
          label={plan.conEpisodio ? 'Nuevo día de publicación' : 'Nuevo día de referencia'}
          value={diaD}
          onValueChange={setDiaD}
        />
        {nuevoLunes !== lunes && (
          <p className={estilos.notaCampo}>{`Pasa a la ${tituloSemana(nuevoLunes).toLowerCase()}`}</p>
        )}
      </div>
      <BotonesGuardar guardando={enviando} error={error} alCancelar={alTerminar} />
    </form>
  );
}

/**
 * **Cambiar la estrategia**: las del mismo tipo (con o sin episodio) que no usan piezas archivadas,
 * con su mini fila, como al planificar. Va elegida la actual si se puede usar. Las piezas se
 * regeneran en el servidor desde el día D del plan. Si alguna ya estaba programada en Metricool, el
 * servidor pide confirmación y la fila de los botones pasa a preguntarlo; **Cancelar** ahí deja de
 * preguntar sin cambiar nada.
 */
function CambiarEstrategia({ datos, alTerminar }: { datos: DatosDeSemana; alTerminar: () => void }) {
  const { plan } = datos;
  const disponibles = estrategiasParaPlanificar(datos.estrategias, datos.piezas, plan.conEpisodio);
  const [elegida, setElegida] = useState<string | null>(null);
  const estrategia =
    disponibles.find((e) => e.id === elegida) ??
    disponibles.find((e) => e.id === plan.estrategiaId) ??
    disponibles[0] ??
    null;
  const [confirmando, setConfirmando] = useState(false);
  const { enviando, error, enviar } = useEnvio();
  const zona = useRef<HTMLDivElement>(null);
  useFocoAlCambiarDeVista(confirmando ? 'confirmar' : 'guardar', zona);

  function cambiar(confirmado: boolean) {
    if (!estrategia) return;
    enviar(() => cambiarEstrategiaDePlan(plan.id, estrategia.id, confirmado), alTerminar, (aviso) => {
      if (aviso !== 'confirmar') return false;
      setConfirmando(true);
      return true;
    });
  }

  function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    cambiar(false);
  }

  return (
    <form className={estilos.edicion} onSubmit={guardar} noValidate>
      {estrategia ? (
        <RadioGroup
          label="Estrategia"
          options={disponibles.map((e) => ({
            value: e.id,
            label: e.nombre,
            description: <MiniFila estrategia={e} piezas={datos.piezas} />,
          }))}
          value={estrategia.id}
          onValueChange={(valor) => {
            setElegida(valor);
            setConfirmando(false);
          }}
        />
      ) : (
        <p className={estilos.sinEstrategias}>
          {plan.conEpisodio
            ? 'No hay ninguna estrategia disponible para una semana con episodio.'
            : 'No hay ninguna estrategia disponible para una semana sin episodio.'}
        </p>
      )}

      <div ref={zona}>
        {confirmando ? (
          <div className={estilos.confirmacion}>
            <p data-foco tabIndex={-1}>
              Hay piezas ya programadas en Metricool: se perderán. ¿Cambiar igualmente?
            </p>
            <div className={estilos.accionPieza}>
              <div className={estilos.botones}>
                <Button
                  variant="surface"
                  className={estilos.peligro}
                  status={enviando ? 'loading' : 'idle'}
                  loadingLabel="Cambiando la estrategia"
                  onClick={() => cambiar(true)}
                >
                  Cambiar
                </Button>
                <Button variant="surface" onClick={() => setConfirmando(false)}>
                  Cancelar
                </Button>
              </div>
              <p className={estilos.errorPieza} role="alert">
                {error}
              </p>
            </div>
          </div>
        ) : estrategia ? (
          <BotonesGuardar guardando={enviando} error={error} alCancelar={alTerminar} />
        ) : (
          <Button variant="surface" onClick={alTerminar}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  );
}

/**
 * **Añadir una pieza suelta**: una pieza que no esté archivada, el día (de D-1 a D+5) y la hora, que
 * empieza siendo la habitual de la pieza y cambia con ella. Avisa, como al planificar, si la hora no
 * existe en España ese día. La pieza se copia en el servidor desde la base; la de origen no cambia.
 */
function AnadirPieza({ datos, alTerminar }: { datos: DatosDeSemana; alTerminar: () => void }) {
  const { plan } = datos;
  const disponibles = datos.piezas.filter((p) => !p.archivada);
  const [piezaId, setPiezaId] = useState(disponibles[0]?.id ?? '');
  const [fecha, setFecha] = useState(plan.diaD);
  const [hora, setHora] = useState(disponibles[0]?.horaHabitual ?? '');
  const { enviando, error, enviar } = useEnvio();

  const horaNormal = normalizarHora(hora);
  const horaNoExiste = horaNormal !== null && !existeEnMadrid(fecha, horaNormal);

  function elegirPieza(id: string) {
    setPiezaId(id);
    setHora(disponibles.find((p) => p.id === id)?.horaHabitual ?? '');
  }

  function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    // Con el día D del panel: si la semana se ha movido entretanto, el servidor no la añade.
    enviar(() => anadirPiezaSuelta(plan.id, piezaId, fecha, hora, plan.diaD), alTerminar);
  }

  if (disponibles.length === 0) {
    return (
      <>
        <p className={estilos.sinEstrategias}>No hay ninguna pieza disponible.</p>
        <div>
          <Button variant="surface" onClick={alTerminar}>
            Cancelar
          </Button>
        </div>
      </>
    );
  }

  return (
    <form className={estilos.edicion} onSubmit={guardar} noValidate>
      <div className={estilos.campos}>
        <Select
          label="Pieza"
          options={disponibles.map((p) => ({ value: p.id, label: p.nombre }))}
          value={piezaId}
          onValueChange={elegirPieza}
        />
        <Select
          label="Día"
          options={diasDelPlan(plan.diaD).map((d) => ({ value: d.fecha, label: d.etiqueta }))}
          value={fecha}
          onValueChange={setFecha}
        />
        <TextField label="Hora" autoComplete="off" placeholder="hh:mm" value={hora} onValueChange={setHora} />
      </div>
      {horaNoExiste && (
        <p className={estilos.avisoHora}>
          {`Las ${horaNormal} del ${fechaLarga(fecha).toLowerCase()} no existen en España por el cambio de horario.`}
        </p>
      )}
      <BotonesGuardar guardando={enviando} error={error} alCancelar={alTerminar} />
    </form>
  );
}
