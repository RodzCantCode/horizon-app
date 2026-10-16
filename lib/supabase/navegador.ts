import { createBrowserClient } from '@supabase/ssr';
import { clavePublicableSupabase, urlSupabase } from './entorno';

// Cliente para componentes de cliente (lo que corre en el navegador).
export function crearClienteNavegador() {
  return createBrowserClient(urlSupabase, clavePublicableSupabase);
}
