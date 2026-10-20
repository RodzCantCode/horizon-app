import { Suspense } from 'react';
import { leerEstrategiasYPiezas } from '@/lib/datos/estrategias';
import { leerRegistroDe } from '@/lib/datos/registro';
import { leerPiezaDePlan, leerPlanDeSemana } from '@/lib/datos/semanas';
import { diaSemana, esFecha, hoyEnMadrid } from '@/lib/fechas';
import { exigirSesion } from '@/lib/supabase/servidor';
import { PanelPieza } from './PanelPieza';
import { PanelSemana } from './PanelSemana';

type Parametros = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// Los paneles que se abren desde las semanas, en Inicio y en el Calendario: pulsar una pieza abre el suyo
// (?pieza=<id>), donde se marca como programada o se edita, y el encabezado de una semana con plan,
// el de esa semana (?semana=<lunes>). Cada uno en su propio <Suspense>, para que la página no espere
// a los paneles ni los paneles a la página. Planificar una semana ya no es un panel: es el modo
// programar del Calendario (calendario/Programar.tsx).
export function PanelesDeSemanas({ searchParams }: Parametros) {
  return (
    <>
      <Suspense>
        <DetallePieza searchParams={searchParams} />
      </Suspense>
      <Suspense>
        <DetalleSemana searchParams={searchParams} />
      </Suspense>
    </>
  );
}

// El panel de la pieza de ?pieza=<id>, con sus datos y su registro. Si la pieza ya no existe, el
// panel lo dice (PanelPieza con `detalle = null`).
async function DetallePieza({ searchParams }: Parametros) {
  const { pieza: id } = await searchParams;
  if (typeof id !== 'string' || id === '') return null;
  await exigirSesion();

  const hoy = hoyEnMadrid();
  const leida = await leerPiezaDePlan(id);
  const detalle = leida && { ...leida, registro: await leerRegistroDe(id) };

  return <PanelPieza id={id} detalle={detalle} hoy={hoy} />;
}

// El panel de la semana de ?semana=<lunes>: su plan con sus piezas y, para el modo edición, las
// estrategias y las piezas (cambiar la estrategia y añadir una suelta). Si esa semana no tiene plan,
// el panel lo dice (PanelSemana con `datos = null`). Un lunes que no lo es (URL escrita a mano) no
// abre nada.
async function DetalleSemana({ searchParams }: Parametros) {
  const { semana: lunes } = await searchParams;
  if (typeof lunes !== 'string' || !esFecha(lunes) || diaSemana(lunes) !== 0) return null;
  await exigirSesion();

  const hoy = hoyEnMadrid();
  const [leido, { estrategias, piezas }] = await Promise.all([leerPlanDeSemana(lunes), leerEstrategiasYPiezas()]);
  const datos = leido && { plan: leido.plan, piezasDelPlan: leido.piezas, estrategias, piezas };

  return <PanelSemana key={lunes} lunes={lunes} datos={datos} hoy={hoy} />;
}
