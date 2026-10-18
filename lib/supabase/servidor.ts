import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { clavePublicableSupabase, urlSupabase } from './entorno';
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
