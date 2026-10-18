// Lectura del registro (quién hizo qué) desde Supabase, solo en el servidor. El registro lo escriben
// los disparadores de la base con el usuario de la sesión; aquí se lee y se le pone a cada anotación
// el nombre de su perfil. No hay clave ajena de registro a perfiles (el registro sobrevive a la
// cuenta), así que los nombres se piden aparte y se juntan aquí.

import { crearClienteServidor } from '@/lib/supabase/servidor';
import type { EntradaRegistro } from '@/lib/tipos';

const CUANTAS = 10;

/**
 * Las últimas anotaciones de una fila (una pieza de plan, por ejemplo), de la más nueva a la más
 * vieja. Lo que se escribió sin sesión (los datos iniciales, o SQL a mano) sale como «Sistema»; un
 * usuario cuya cuenta ya no existe, como «Alguien». Si Supabase falla, lanza un error.
 */
export async function leerRegistroDe(filaId: string): Promise<EntradaRegistro[]> {
  const supabase = await crearClienteServidor();
  const registro = await supabase
    .from('registro')
    .select('usuario_id, accion, creado_en')
    .eq('fila_id', filaId)
    .order('creado_en', { ascending: false })
    .limit(CUANTAS);
  if (registro.error) throw new Error('No se ha podido leer el registro', { cause: registro.error });

  const filas = registro.data ?? [];
  const ids = [...new Set(filas.flatMap((f) => (f.usuario_id ? [f.usuario_id] : [])))];

  const nombres = new Map<string, string>();
  if (ids.length > 0) {
    const perfiles = await supabase.from('perfiles').select('id, nombre').in('id', ids);
    if (perfiles.error) throw new Error('No se ha podido leer el registro', { cause: perfiles.error });
    for (const { id, nombre } of perfiles.data ?? []) nombres.set(id, nombre);
  }

  return filas.map((f) => ({
    nombre: f.usuario_id === null ? 'Sistema' : (nombres.get(f.usuario_id) ?? 'Alguien'),
    accion: f.accion,
    creadoEn: f.creado_en,
  }));
}
