import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { Skeleton } from 'mochi-ui';
import { leerEstrategiasYPiezas } from '@/lib/datos/estrategias';
import { leerRegistroDe } from '@/lib/datos/registro';
import { leerPiezaDePlan, leerPlanDeSemana, leerPlanes, leerSemanas } from '@/lib/datos/semanas';
import { diaSemana, esFecha, hoyEnMadrid } from '@/lib/fechas';
import { proponerDiaD, proponerNumero } from '@/lib/planes';
import { construirSemanas, rangoSemanas } from '@/lib/semanas';
import { crearClienteServidor } from '@/lib/supabase/servidor';
import { rutaEntrar } from '@/lib/supabase/rutas';
import { PanelPieza } from './semanas/PanelPieza';
import { PanelPlanificar } from './semanas/PanelPlanificar';
import { PanelSemana } from './semanas/PanelSemana';
import { Semana } from './semanas/Semana';
import { SemanaPlegada } from './semanas/SemanaPlegada';
import estilos from './inicio.module.css';

// Semanas, la pantalla principal: la pasada y las lejanas plegadas, la actual abierta y la siguiente
// debajo (docs/diseno.md § Semanas). Pulsar una pieza abre su panel (?pieza=<id>), donde se marca
// como programada o se edita; Planificar abre el de planificar esa semana (?planificar=<lunes>), y el
// encabezado de una semana con plan, el de esa semana (?semana=<lunes>).
export default function Semanas({ searchParams }: PageProps<'/'>) {
  return (
    <main className={estilos.pagina}>
      <Suspense fallback={<CargandoSemanas />}>
        <ListaSemanas />
      </Suspense>
      <Suspense>
        <DetallePieza searchParams={searchParams} />
      </Suspense>
      <Suspense>
        <PlanificarSemana searchParams={searchParams} />
      </Suspense>
      <Suspense>
        <DetalleSemana searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

// Lo que se ve mientras llegan las semanas: la forma de la semana actual (titular, datos y días).
function CargandoSemanas() {
  return (
    <div className={estilos.cargando}>
      <span className="solo-lectores">Cargando las semanas</span>
      <Skeleton shape="block" width="min(15rem, 70%)" height="2.5rem" />
      <Skeleton shape="line" width="min(20rem, 85%)" />
      <Skeleton shape="block" height="10.5rem" />
    </div>
  );
}

// proxy.ts ya manda a /entrar a quien no tenga sesión; esta es la segunda llave, por si el proxy no
// corre: sin sesión, la base no da permiso y se vería la página de error en vez de Entrar.
async function exigirSesion() {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect(rutaEntrar);
}

// Lee la sesión de las cookies y los datos, así que va dentro de <Suspense>: con Cache Components, lo
// que depende de la petición no entra en la parte que se prerenderiza. «Hoy» se calcula después de
// leer las cookies, en cada petición y en hora de España.
async function ListaSemanas() {
  await exigirSesion();

  const hoy = hoyEnMadrid();
  const { desde, hasta } = rangoSemanas(hoy);
  const { planes, piezas } = await leerSemanas(desde, hasta);
  const semanas = construirSemanas(planes, piezas, hoy);

  return semanas.map((semana) =>
    semana.posicion === 'pasada' || semana.posicion === 'lejana' ? (
      <SemanaPlegada key={semana.lunes} semana={semana} hoy={hoy} />
    ) : (
      <Semana key={semana.lunes} semana={semana} hoy={hoy} />
    ),
  );
}

// El panel de la pieza de ?pieza=<id>, con sus datos y su registro. En su propio <Suspense>, para que
// las semanas no esperen a la pieza ni la pieza a las semanas. Si la pieza ya no existe, el panel lo
// dice (PanelPieza con `detalle = null`).
async function DetallePieza({ searchParams }: Pick<PageProps<'/'>, 'searchParams'>) {
  const { pieza: id } = await searchParams;
  if (typeof id !== 'string' || id === '') return null;
  await exigirSesion();

  const hoy = hoyEnMadrid();
  const leida = await leerPiezaDePlan(id);
  const detalle = leida && { ...leida, registro: await leerRegistroDe(id) };

  return <PanelPieza id={id} detalle={detalle} hoy={hoy} />;
}

// El panel de planificar la semana de ?planificar=<lunes>, también en su propio <Suspense>. Lee las
// estrategias y las piezas (para ofrecer las que se pueden usar y la vista previa) y todos los planes
// (para proponer número y día D, y saber si la semana ya tiene plan). Un lunes que no lo es (URL
// escrita a mano) no abre nada.
async function PlanificarSemana({ searchParams }: Pick<PageProps<'/'>, 'searchParams'>) {
  const { planificar: lunes } = await searchParams;
  if (typeof lunes !== 'string' || !esFecha(lunes) || diaSemana(lunes) !== 0) return null;
  await exigirSesion();

  const [{ estrategias, piezas }, planes] = await Promise.all([leerEstrategiasYPiezas(), leerPlanes()]);
  const datos = {
    yaTienePlan: planes.some((p) => p.lunes === lunes),
    estrategias,
    piezas,
    numeroPropuesto: proponerNumero(planes),
    diaDPropuesto: proponerDiaD(planes, lunes),
  };

  return <PanelPlanificar key={lunes} lunes={lunes} datos={datos} />;
}

// El panel de la semana de ?semana=<lunes>, también en su propio <Suspense>: su plan con sus piezas y,
// para el modo edición, las estrategias y las piezas (cambiar la estrategia y añadir una suelta). Si
// esa semana no tiene plan, el panel lo dice (PanelSemana con `datos = null`). Un lunes que no lo es
// (URL escrita a mano) no abre nada.
async function DetalleSemana({ searchParams }: Pick<PageProps<'/'>, 'searchParams'>) {
  const { semana: lunes } = await searchParams;
  if (typeof lunes !== 'string' || !esFecha(lunes) || diaSemana(lunes) !== 0) return null;
  await exigirSesion();

  const hoy = hoyEnMadrid();
  const [leido, { estrategias, piezas }] = await Promise.all([leerPlanDeSemana(lunes), leerEstrategiasYPiezas()]);
  const datos = leido && { plan: leido.plan, piezasDelPlan: leido.piezas, estrategias, piezas };

  return <PanelSemana key={lunes} lunes={lunes} datos={datos} hoy={hoy} />;
}
