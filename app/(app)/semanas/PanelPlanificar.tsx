'use client';

import { useEffect, useId, useRef, useState, useTransition, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button, RadioGroup, Select, TextField } from 'mochi-ui';
import { existeEnMadrid, sumarDias } from '@/lib/fechas';
import { estrategiasParaPlanificar, generarPiezasDePlan } from '@/lib/planes';
import { etiquetaDia, fechaLarga, tituloPlanificar } from '@/lib/semanas';
import type { Estrategia, Pieza } from '@/lib/tipos';
import { Panel } from '../componentes/Panel';
import { crearPlan } from './acciones';
import { MiniFila } from './MiniFila';
import estilos from './semanas.module.css';

/** Lo que lee el servidor para planificar una semana (page.tsx). */
export type DatosParaPlanificar = {
  /** Si la semana ya tenía plan cuando se leyó. */
  yaTienePlan: boolean;
  estrategias: Estrategia[];
  /** Todas, archivadas incluidas: hacen falta para descartar las estrategias que las usan. */
  piezas: Pieza[];
  /** El siguiente al último episodio (`proponerNumero`); `null` si aún no hay ninguno. */
  numeroPropuesto: string | null;
  /** El mismo día de la semana que el último episodio, o el viernes (`proponerDiaD`). */
  diaDPropuesto: string;
};

// Lo que se enseña si la acción ni siquiera llega al servidor (sin conexión, por ejemplo). El mismo
// texto que en el panel de una pieza.
const SIN_CONEXION = 'No se ha podido conectar. Vuelve a intentarlo.';
const FALTA_NUMERO = 'Falta el número del episodio';
const SIN_ESTRATEGIAS = 'No hay ninguna estrategia disponible';

// Día de referencia que se propone en una semana sin episodio: el viernes (lunes + 4).
const VIERNES = 4;

/**
 * El panel de **Planificar** (docs/diseno.md § Planificar): si hay episodio y sus datos, la
 * estrategia con su mini fila de días, la vista previa con las fechas y horas reales y **Crear
 * plan**. Los datos los lee el servidor para la semana de `?planificar=<lunes>` (page.tsx).
 *
 * Se abre y se cierra como el de una pieza (PanelPieza.tsx): está abierto mientras la URL lleve su
 * lunes, se cierra quitándolo con history.pushState y, al cerrarse, el foco vuelve a su botón
 * **Planificar** si sigue en la semana. Al crear el plan se cierra solo; la acción ya ha refrescado
 * la página y la semana sale con su plan.
 */
export function PanelPlanificar({ lunes, datos }: { lunes: string; datos: DatosParaPlanificar }) {
  const parametros = useSearchParams();
  const abierto = parametros.get('planificar') === lunes;

  // Lee la URL de ese momento, no la del último pintado: también se llama al terminar de crear el
  // plan, y para entonces el panel puede estar cerrado (Esc mientras se creaba).
  function cerrar() {
    const siguientes = new URLSearchParams(window.location.search);
    if (siguientes.get('planificar') !== lunes) return;
    siguientes.delete('planificar');
    const consulta = siguientes.toString();
    const ruta = window.location.pathname;
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
    document.querySelector<HTMLElement>(`[data-planificar="${CSS.escape(lunes)}"]`)?.focus();
  }, [abierto, lunes]);

  return (
    <Panel abierto={abierto} alCerrar={cerrar} titulo={tituloPlanificar(lunes)}>
      <ContenidoPlanificar lunes={lunes} datos={datos} alCrear={cerrar} />
    </Panel>
  );
}

/**
 * Si la semana ya tenía plan al abrir el panel, solo el aviso. Se decide una vez, al abrirlo (Mochi
 * monta el contenido al abrir el panel y lo desmonta al cerrarlo): al crear el plan, la página se
 * refresca con el panel aún abierto y ya llega con plan, y no debe cambiar el formulario por el aviso
 * mientras se cierra.
 */
function ContenidoPlanificar({
  lunes,
  datos,
  alCrear,
}: {
  lunes: string;
  datos: DatosParaPlanificar;
  alCrear: () => void;
}) {
  const [teniaPlan] = useState(datos.yaTienePlan);
  if (teniaPlan) return <p className={estilos.yaTienePlan}>Esa semana ya tiene plan</p>;
  return <FormularioPlan lunes={lunes} datos={datos} alCrear={alCrear} />;
}

function FormularioPlan({
  lunes,
  datos,
  alCrear,
}: {
  lunes: string;
  datos: DatosParaPlanificar;
  alCrear: () => void;
}) {
  const [conEpisodio, setConEpisodio] = useState(true);
  const [numero, setNumero] = useState(datos.numeroPropuesto ?? '');
  const [diaPublicacion, setDiaPublicacion] = useState(datos.diaDPropuesto);
  const [diaReferencia, setDiaReferencia] = useState(() => sumarDias(lunes, VIERNES));
  const [invitado, setInvitado] = useState('');
  const [tema, setTema] = useState('');
  const [estrategiaElegida, setEstrategiaElegida] = useState<string | null>(null);
  const [faltaNumero, setFaltaNumero] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();
  const idVistaPrevia = useId();

  const diaD = conEpisodio ? diaPublicacion : diaReferencia;
  // Solo las del tipo que toca y sin piezas archivadas. Va elegida la primera hasta que se elija
  // otra; si la elegida deja de estar (al cambiar Sí/No), vuelve a la primera.
  const disponibles = estrategiasParaPlanificar(datos.estrategias, datos.piezas, conEpisodio);
  const estrategia = disponibles.find((e) => e.id === estrategiaElegida) ?? disponibles[0] ?? null;
  const piezas = estrategia ? generarPiezasDePlan(estrategia, datos.piezas, diaD) : [];
  const horaNoExiste = (p: { fecha: string; hora: string | null }) =>
    p.hora !== null && !existeEnMadrid(p.fecha, p.hora);

  const dias = Array.from({ length: 7 }, (_, i) => {
    const fecha = sumarDias(lunes, i);
    return { value: fecha, label: fechaLarga(fecha) };
  });

  // Lo que falta se dice al pulsar Crear plan, no desactivando el botón. La acción refresca la página
  // al terminar: el botón sigue cargando hasta que llega la semana con su plan, y entonces se cierra.
  function crear(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (enviando) return;

    const numeroLimpio = numero.trim();
    if (conEpisodio && numeroLimpio === '') {
      setFaltaNumero(true);
      setError(FALTA_NUMERO);
      return;
    }
    if (!estrategia) {
      setError(SIN_ESTRATEGIAS);
      return;
    }

    setError(null);
    iniciar(async () => {
      try {
        const resultado = await crearPlan({
          lunes,
          conEpisodio,
          diaD,
          numero: conEpisodio ? numeroLimpio : null,
          invitado: conEpisodio ? invitado : null,
          tema: conEpisodio ? tema : null,
          estrategiaId: estrategia.id,
        });
        if (resultado.error) setError(resultado.error);
        else alCrear();
      } catch {
        setError(SIN_CONEXION);
      }
    });
  }

  return (
    <form className={estilos.formularioPlan} onSubmit={crear} noValidate>
      <RadioGroup
        label="¿Hay episodio?"
        orientation="horizontal"
        options={[
          { value: 'si', label: 'Sí' },
          { value: 'no', label: 'No' },
        ]}
        value={conEpisodio ? 'si' : 'no'}
        onValueChange={(valor) => {
          setConEpisodio(valor === 'si');
          setError(null);
        }}
      />

      <div className={estilos.camposPlan}>
        {conEpisodio ? (
          <>
            <TextField
              label="Número"
              inputMode="numeric"
              autoComplete="off"
              value={numero}
              onValueChange={(valor) => {
                setNumero(valor);
                setFaltaNumero(false);
              }}
              error={faltaNumero}
            />
            <Select
              label="Día de publicación"
              options={dias}
              value={diaPublicacion}
              onValueChange={setDiaPublicacion}
            />
            <TextField label="Invitado" autoComplete="off" value={invitado} onValueChange={setInvitado} />
            <TextField label="Tema" autoComplete="off" value={tema} onValueChange={setTema} />
          </>
        ) : (
          <Select
            label="Día de referencia"
            options={dias}
            value={diaReferencia}
            onValueChange={setDiaReferencia}
          />
        )}
      </div>

      {estrategia ? (
        <RadioGroup
          label="Estrategia"
          options={disponibles.map((e) => ({
            value: e.id,
            label: e.nombre,
            description: <MiniFila estrategia={e} piezas={datos.piezas} />,
          }))}
          value={estrategia.id}
          onValueChange={setEstrategiaElegida}
        />
      ) : (
        <p className={estilos.sinEstrategias}>
          {conEpisodio
            ? 'No hay ninguna estrategia disponible para una semana con episodio.'
            : 'No hay ninguna estrategia disponible para una semana sin episodio.'}
        </p>
      )}

      {piezas.length > 0 && (
        <section className={estilos.vistaPrevia} aria-labelledby={idVistaPrevia}>
          <h3 id={idVistaPrevia} className={estilos.tituloVistaPrevia}>
            Vista previa
          </h3>
          <ol className={estilos.piezasPrevia}>
            {piezas.map((p, i) => (
              <li key={i} className={estilos.piezaPrevia}>
                <span className={estilos.diaPrevia}>{etiquetaDia(p.fecha)}</span>
                <span className={estilos.horaPrevia} data-aviso={horaNoExiste(p) ? '' : undefined}>
                  {p.hora ?? 'sin hora'}
                </span>
                <span className={estilos.nombrePrevia}>{p.nombre}</span>
              </li>
            ))}
          </ol>
          {piezas.filter(horaNoExiste).map((p, i) => (
            <p key={i} className={estilos.avisoHora}>
              {`${p.nombreCorto}: las ${p.hora} del ${fechaLarga(p.fecha).toLowerCase()} no existen en España por el cambio de horario.`}
            </p>
          ))}
        </section>
      )}

      {/* El botón y su error, como en el panel de una pieza. Azul: es la acción principal del panel. */}
      <div className={estilos.accionPieza}>
        <Button
          type="submit"
          variant="accent"
          status={enviando ? 'loading' : 'idle'}
          loadingLabel="Creando el plan"
        >
          Crear plan
        </Button>
        <p className={estilos.errorPieza} role="alert">
          {error}
        </p>
      </div>
    </form>
  );
}
