import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { Button } from 'mochi-ui';
import { crearClienteServidor } from '@/lib/supabase/servidor';
import { rutaEntrar } from '@/lib/supabase/rutas';
import { salir } from './acciones';
import estilos from './inicio.module.css';

// Portada provisional: solo confirma quién ha entrado y deja salir. proxy.ts ya manda a /entrar a
// quien no tenga sesión; la comprobación de aquí es la segunda llave, por si el proxy no corre.
export default function Inicio() {
  return (
    <main className={estilos.pagina}>
      <Suspense>
        <Sesion />
      </Suspense>
    </main>
  );
}

// Lee la sesión de las cookies de la petición, así que va dentro de <Suspense>: con Cache
// Components, lo que depende de la petición no entra en la parte que se prerenderiza.
async function Sesion() {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect(rutaEntrar);

  return (
    <div className={estilos.sesion}>
      <p className={`estrecha ${estilos.correo}`}>{data.claims.email}</p>
      <form action={salir}>
        <Button type="submit" variant="surface" size="sm">
          Salir
        </Button>
      </form>
    </div>
  );
}
