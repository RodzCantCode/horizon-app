import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { clavePublicableSupabase, urlSupabase } from './entorno';
import { rutaEntrar } from './rutas';
import type { Database } from './tipos';

// Cliente para componentes de servidor, acciones de servidor y route handlers.
export async function crearClienteServidor() {
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
