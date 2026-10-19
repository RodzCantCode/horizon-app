import { Suspense } from 'react';
import { leerSemanas } from '@/lib/datos/semanas';
import { hoyEnMadrid } from '@/lib/fechas';
import { construirSemanas, rangoSemanas } from '@/lib/semanas';
import { exigirSesion } from '@/lib/supabase/servidor';
import { CargandoSemana } from './semanas/CargandoSemana';
import { PanelesDeSemanas } from './semanas/Paneles';
import { Semana } from './semanas/Semana';
import estilos from './inicio.module.css';

// Inicio: solo la semana en curso, abierta (docs/diseno.md § Inicio). Las demás están en Semanas.
// Sus piezas y su encabezado abren los mismos paneles que allí.
export default function Inicio({ searchParams }: PageProps<'/'>) {
  return (
    <main className={estilos.pagina}>
      <Suspense fallback={<CargandoSemana />}>
        <SemanaEnCurso />
      </Suspense>
      <PanelesDeSemanas searchParams={searchParams} />
    </main>
  );
}

// Lee la sesión de las cookies y los datos, así que va dentro de <Suspense>: con Cache Components, lo
// que depende de la petición no entra en la parte que se prerenderiza. «Hoy» se calcula después de
// exigirSesion, que espera a la petición real (lib/supabase/servidor.ts): en cada petición y en hora
// de España. Se leen las mismas semanas que en Semanas porque a la actual pueden caerle piezas del
// plan de la anterior.
async function SemanaEnCurso() {
  await exigirSesion();

  const hoy = hoyEnMadrid();
  const { desde, hasta } = rangoSemanas(hoy);
  const { planes, piezas } = await leerSemanas(desde, hasta);
  const actual = construirSemanas(planes, piezas, hoy).find((s) => s.posicion === 'actual');

  return actual ? <Semana semana={actual} hoy={hoy} /> : null;
}
