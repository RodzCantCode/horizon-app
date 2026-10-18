'use server';

import { redirect } from 'next/navigation';
import { crearClienteServidor } from '@/lib/supabase/servidor';
import { rutaEntrar } from '@/lib/supabase/rutas';

export async function salir() {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  redirect(rutaEntrar);
}
