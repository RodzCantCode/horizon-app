// Lectura del perfil de quien tiene la sesión (Ajustes), solo en el servidor. El correo viene de la
// sesión; el nombre, de su fila en `perfiles` (que el disparador de alta rellena con la parte del
// correo antes de la @).

import { crearClienteServidor } from '@/lib/supabase/servidor';

export type PerfilPropio = { correo: string; nombre: string };

/**
 * El correo con el que se ha entrado y el nombre de su perfil. Sin fila de perfil, el nombre sale
 * vacío. Si Supabase falla o no hay sesión, lanza un error (la página de error de la ruta lo recoge).
 */
export async function leerPerfilPropio(): Promise<PerfilPropio> {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) throw new Error('No se ha podido leer tu perfil: sin sesión');
  const { sub, email } = data.claims;

  const perfil = await supabase.from('perfiles').select('nombre').eq('id', sub).maybeSingle();
  if (perfil.error) throw new Error('No se ha podido leer tu perfil', { cause: perfil.error });

  return { correo: email ?? '', nombre: perfil.data?.nombre ?? '' };
}
