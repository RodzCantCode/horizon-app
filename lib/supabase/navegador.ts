import { createBrowserClient } from '@supabase/ssr';
import { clavePublicableSupabase, urlSupabase } from './entorno';
import type { Database } from './tipos';

// Cliente para componentes de cliente (lo que corre en el navegador).
export function crearClienteNavegador() {
  return createBrowserClient<Database>(urlSupabase, clavePublicableSupabase);
}
