// Sin SMTP propio, los correos de invitación y de recuperación llevan el enlace por defecto de
// Supabase: lo comprueba Supabase y vuelve a la Site URL con la sesión (o el error) en el fragmento
// de la URL, que acaba en /entrar (docs/acceso.md). Aquí solo se lee ese fragmento, sin navegador
// ni Supabase, para poder probarlo; lo usa app/entrar/aceptar-enlace.tsx.

export type EnlaceDeSupabase =
  | { tipo: 'sesion'; accessToken: string; refreshToken: string; enlace: 'invite' | 'recovery' }
  | { tipo: 'error' };

/** Lo que trae el fragmento (`window.location.hash`), o `null` si no es un enlace que se acepte. */
export function leerEnlaceDeSupabase(hash: string): EnlaceDeSupabase | null {
  const parametros = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);

  // Caducado, ya usado o rechazado: Supabase manda error y error_code (y una descripción).
  if (parametros.has('error') || parametros.has('error_code')) return { tipo: 'error' };

  const accessToken = parametros.get('access_token');
  const refreshToken = parametros.get('refresh_token');
  const enlace = parametros.get('type');
  // Solo los dos correos que manda Mario: el registro público está desactivado.
  if (!accessToken || !refreshToken) return null;
  if (enlace !== 'invite' && enlace !== 'recovery') return null;
  return { tipo: 'sesion', accessToken, refreshToken, enlace };
}
