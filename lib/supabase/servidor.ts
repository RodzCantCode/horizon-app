import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { clavePublicableSupabase, urlSupabase } from './entorno';
import { rutaEntrar } from './rutas';
import type { Database } from './tipos';

// Cliente para componentes de servidor, acciones de servidor y route handlers.
//
// Espera a la petición real (`connection()`) antes de nada. Con Cache Components y Partial
// Prefetching, Next.js prerenderiza el App Shell de cada ruta con las cookies de la sesión: leerlas
// no lo detiene. Sin esta espera, ese prerender comprobaría la caducidad de la sesión (Supabase usa
// `Date.now()`) y calcularía «hoy», y el navegador guardaría el resultado para la siguiente
// navegación. Así, lo que lee la base y lo que viene después (como `hoyEnMadrid()` en las
// pantallas) solo corre en cada petición.
export async function crearClienteServidor() {
  await connection();
  const almacenCookies = await cookies();

  return createServerClient<Database>(urlSupabase, clavePublicableSupabase, {
    cookies: {
      getAll() {
        return almacenCookies.getAll();
      },
      setAll(cookiesNuevas) {
        try {
          cookiesNuevas.forEach(({ name, value, options }) =>
            almacenCookies.set(name, value, options),
          );
        } catch {
          // Un componente de servidor no puede escribir cookies. No pasa nada: proxy.ts ya ha
          // refrescado la sesión antes de pintar.
        }
      },
    },
  });
}

/**
 * Para las páginas que leen datos. proxy.ts ya manda a /entrar a quien no tenga sesión; esta es la
 * segunda llave, por si el proxy no corre: sin sesión, la base no da permiso y se vería la página de
 * error en vez de Entrar.
 */
export async function exigirSesion() {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect(rutaEntrar);
}
