import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Skeleton } from 'mochi-ui';
import { construirCalendario, inicioCalendario, rangoCalendario } from '@/lib/calendario';
import { leerEstrategiasYPiezas } from '@/lib/datos/estrategias';
import { leerPlanes, leerSemanas } from '@/lib/datos/semanas';
import { diaSemana, esFecha, hoyEnMadrid } from '@/lib/fechas';
import { exigirSesion } from '@/lib/supabase/servidor';
import { PanelesDeSemanas } from '../semanas/Paneles';
import { Calendario } from './Calendario';
import estilos from './calendario.module.css';

export const metadata: Metadata = {
  title: 'Calendario · Horizon Sport',
};

// Calendario (docs/diseno.md § Calendario): tres semanas seguidas desde la de
// `?desde=<lunes>` (sin él, o si no es un lunes que existe, la de hoy), con los posts y el episodio
// de cada día. Pulsar una tarjeta abre los paneles de siempre (?pieza=<id>, ?semana=<lunes>), los
// mismos que en Inicio. `?programar=<lunes>` abre el modo programar esa semana (Programar.tsx).
export default function PaginaCalendario({ searchParams }: PageProps<'/calendario'>) {
  return (
    <main className={estilos.pagina}>
      <Suspense fallback={<Cargando />}>
        <SemanasDelCalendario searchParams={searchParams} />
      </Suspense>
      <PanelesDeSemanas searchParams={searchParams} />
    </main>
  );
}

// Lo que se ve mientras llegan los datos: el titular y huecos con la forma de las semanas.
function Cargando() {
  return (
    <div className={estilos.cargando}>
      <h1 className={`ancha ${estilos.titular}`}>Calendario</h1>
      <span className="solo-lectores">Cargando el calendario</span>
      <Skeleton shape="line" width="min(10rem, 50%)" />
      <Skeleton shape="block" height="9rem" />
      <Skeleton shape="line" width="min(10rem, 50%)" />
      <Skeleton shape="block" height="9rem" />
    </div>
  );
}

// Como la semana de Inicio (app/(app)/page.tsx): dentro de <Suspense> y «hoy» tras exigirSesion. Se
// leen los planes del rango y también los de los posts que caen en él (leerSemanas), para que cada
// post diga de qué episodio es aunque su plan empezara antes. Para el modo programar se leen además
// las estrategias y las piezas (las que se ofrecen y sus posts) y todos los planes (para proponer
// número, día, hora y la semana de **Programar**), como hacía el panel de planificar.
//
// Con `?programar=<lunes>` y sin `?desde=`, si esa semana no está entre las tres de hoy, se ve desde
// ella. Un `?programar=` que no es un lunes que existe (URL escrita a mano) no abre nada.
async function SemanasDelCalendario({ searchParams }: Pick<PageProps<'/calendario'>, 'searchParams'>) {
  const { desde, programar } = await searchParams;
  await exigirSesion();

  const hoy = hoyEnMadrid();
  const lunesAProgramar =
    typeof programar === 'string' && esFecha(programar) && diaSemana(programar) === 0 ? programar : null;
  let lunes = inicioCalendario(typeof desde === 'string' ? desde : undefined, hoy);
  if (lunesAProgramar !== null && desde === undefined) {
    const deHoy = rangoCalendario(lunes);
    if (lunesAProgramar < deHoy.desde || lunesAProgramar > deHoy.hasta) lunes = lunesAProgramar;
  }
  const rango = rangoCalendario(lunes);
  const [{ planes, piezas }, { estrategias, piezas: catalogo }, todosLosPlanes] = await Promise.all([
    leerSemanas(rango.desde, rango.hasta),
    leerEstrategiasYPiezas(),
    leerPlanes(),
  ]);

  return (
    <Calendario
      semanas={construirCalendario(planes, piezas, hoy, lunes)}
      hoy={hoy}
      lunes={lunes}
      datos={{ estrategias, piezas: catalogo, planes: todosLosPlanes }}
      programar={lunesAProgramar}
    />
  );
}
