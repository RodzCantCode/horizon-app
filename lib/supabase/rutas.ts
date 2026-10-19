// A dónde va cada uno según tenga sesión o no. Lo aplica proxy.ts (lib/supabase/sesion.ts) antes de
// cada ruta; aquí solo está la regla, sin Next.js ni Supabase, para poder probarla.

const rutaInicio = '/';
export const rutaEntrar = '/entrar';
export const rutaCrearContrasena = '/crear-contrasena';
// Adonde llevarán los enlaces de los correos de invitación y de recuperación cuando haya plantillas
// propias (docs/acceso.md); hoy llega a /entrar el enlace por defecto de Supabase.
const rutaConfirmar = '/auth/confirmar';

/** Adónde redirigir a quien pide `ruta`, o `null` si se queda donde está. */
export function destinoSegunSesion(ruta: string, conSesion: boolean): string | null {
  // El enlace del correo llega sin sesión (la crea al comprobarse) y puede llegar con la de otra
  // cuenta abierta en el mismo navegador: pasa siempre.
  if (ruta === rutaConfirmar) return null;
  // Con sesión no hay nada que hacer en /entrar.
  if (ruta === rutaEntrar) return conSesion ? rutaInicio : null;
  // El resto, /crear-contrasena incluida, es solo para quien ha entrado.
  return conSesion ? null : rutaEntrar;
}
