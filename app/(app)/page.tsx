import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { leerSemanas } from '@/lib/datos/semanas';
import { hoyEnMadrid } from '@/lib/fechas';
import { construirSemanas, rangoSemanas } from '@/lib/semanas';
import { crearClienteServidor } from '@/lib/supabase/servidor';
import { rutaEntrar } from '@/lib/supabase/rutas';
import { Semana } from './semanas/Semana';
import { SemanaPlegada } from './semanas/SemanaPlegada';
import estilos from './inicio.module.css';

// Semanas, la pantalla principal: la pasada y las lejanas plegadas, la actual abierta y la siguiente
// debajo (docs/diseno.md § Semanas). De momento solo se lee: pulsar una pieza o Planificar deja la
// petición en la URL para los paneles que vendrán.
export default function Semanas() {
  return (
    <main className={estilos.pagina}>
      <Suspense>
        <ListaSemanas />
      </Suspense>
    </main>
  );
}

// Lee la sesión de las cookies y los datos, así que va dentro de <Suspense>: con Cache Components, lo
// que depende de la petición no entra en la parte que se prerenderiza. «Hoy» se calcula después de
// leer las cookies, en cada petición y en hora de España.
//
// proxy.ts ya manda a /entrar a quien no tenga sesión; la comprobación de aquí es la segunda llave,
// por si el proxy no corre: sin ella, RLS no devolvería filas y se verían semanas sin planificar.
async function ListaSemanas() {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect(rutaEntrar);

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
