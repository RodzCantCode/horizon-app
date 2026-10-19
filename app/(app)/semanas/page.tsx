import { Suspense } from 'react';
import { leerSemanas } from '@/lib/datos/semanas';
import { hoyEnMadrid } from '@/lib/fechas';
import { construirSemanas, rangoSemanas } from '@/lib/semanas';
import { exigirSesion } from '@/lib/supabase/servidor';
import { CargandoSemana } from './CargandoSemana';
import { PanelesDeSemanas } from './Paneles';
import { Semana } from './Semana';
import { SemanaPlegada } from './SemanaPlegada';
import estilos from '../inicio.module.css';

// Semanas: la pasada y las lejanas plegadas, la actual abierta y la siguiente debajo (docs/diseno.md
// § Semanas). Aquí se planifica la siguiente.
export default function Semanas({ searchParams }: PageProps<'/semanas'>) {
  return (
    <main className={estilos.pagina}>
      <h1 className={`ancha ${estilos.titular}`}>Semanas</h1>
      <Suspense fallback={<CargandoSemana />}>
        <ListaSemanas />
      </Suspense>
      <PanelesDeSemanas searchParams={searchParams} />
    </main>
  );
}

// Como la semana de Inicio (app/(app)/page.tsx): dentro de <Suspense> y «hoy» tras exigirSesion.
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
      <Semana key={semana.lunes} semana={semana} hoy={hoy} titular="h2" />
    ),
  );
}
