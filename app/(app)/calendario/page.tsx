import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Skeleton } from 'mochi-ui';
import { construirCalendario, inicioCalendario, rangoCalendario } from '@/lib/calendario';
import { leerSemanas } from '@/lib/datos/semanas';
import { hoyEnMadrid } from '@/lib/fechas';
import { exigirSesion } from '@/lib/supabase/servidor';
import { PanelesDeSemanas } from '../semanas/Paneles';
import { Calendario } from './Calendario';
import estilos from './calendario.module.css';

export const metadata: Metadata = {
  title: 'Calendario · Horizon Sport',
};

// Calendario (docs/rediseno-calendario.md § La pantalla): tres semanas seguidas desde la de
// `?desde=<lunes>` (sin él, o si no es un lunes que existe, la de hoy), con los posts y el episodio
// de cada día. Pulsar una tarjeta abre los paneles de siempre (?pieza=<id>, ?semana=<lunes>), los
// mismos que en Inicio.
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
// post diga de qué episodio es aunque su plan empezara antes.
async function SemanasDelCalendario({ searchParams }: Pick<PageProps<'/calendario'>, 'searchParams'>) {
  const { desde } = await searchParams;
  await exigirSesion();

  const hoy = hoyEnMadrid();
  const lunes = inicioCalendario(typeof desde === 'string' ? desde : undefined, hoy);
  const rango = rangoCalendario(lunes);
  const { planes, piezas } = await leerSemanas(rango.desde, rango.hasta);

  return <Calendario semanas={construirCalendario(planes, piezas, hoy, lunes)} hoy={hoy} lunes={lunes} />;
}
