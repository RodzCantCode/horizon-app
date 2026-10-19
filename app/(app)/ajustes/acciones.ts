'use server';

import { refresh } from 'next/cache';
import { crearClienteServidor } from '@/lib/supabase/servidor';

// Acciones de servidor de Ajustes. Como las de Semanas: devuelven `{ error }` con un texto para
// enseñar tal cual, o `{}` si ha ido bien; nunca el mensaje de Supabase, que viene en inglés.

const NOMBRE_MAX_CARACTERES = 40;
const NOMBRE_VACIO = 'Escribe tu nombre.';
const NOMBRE_LARGO = `Como mucho ${NOMBRE_MAX_CARACTERES} caracteres.`;
const NOMBRE_NO_GUARDADO = 'No se ha podido guardar el nombre. Inténtalo otra vez.';

/**
 * Cambia el nombre del perfil de quien tiene la sesión (el que sale en el registro). El nombre se
 * recorta y se comprueba aquí otra vez, aunque el formulario ya lo haga. Escribe solo la fila de la
 * sesión (`id` = `sub` de sus claims, que verifica la firma); la política de RLS ya limita cada
 * perfil a su dueño. Sin esa fila, o con cualquier error, devuelve el mismo aviso.
 */
export async function cambiarNombre(nombre: string): Promise<{ error?: string }> {
  const limpio = nombre.trim();
  if (limpio === '') return { error: NOMBRE_VACIO };
  if ([...limpio].length > NOMBRE_MAX_CARACTERES) return { error: NOMBRE_LARGO };

  const supabase = await crearClienteServidor();
  const { data: sesion } = await supabase.auth.getClaims();
  if (!sesion?.claims) return { error: NOMBRE_NO_GUARDADO };

  const { data, error } = await supabase
    .from('perfiles')
    .update({ nombre: limpio })
    .eq('id', sesion.claims.sub)
    .select('id');
  if (error || data.length === 0) return { error: NOMBRE_NO_GUARDADO };

  refresh();
  return {};
}
