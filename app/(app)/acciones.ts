'use server';

import { redirect } from 'next/navigation';
import { crearClienteServidor } from '@/lib/supabase/servidor';
import { rutaEntrar } from '@/lib/supabase/rutas';

export async function salir() {
  const supabase = await crearClienteServidor();
  // Solo la sesión de este dispositivo. Por defecto Supabase las cierra todas (`global`), y cada uno
  // puede tener la app abierta en el móvil y en el ordenador: salir en uno no debe sacarle del otro.
  await supabase.auth.signOut({ scope: 'local' });
  redirect(rutaEntrar);
}
