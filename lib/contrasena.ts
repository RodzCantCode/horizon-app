// Las mismas reglas al crear la contraseña (tras la invitación o la recuperación) y al cambiarla en
// Ajustes. Supabase admite 6 caracteres por defecto; la app pide 8.
const longitudMinima = 8;

/** El mensaje de error que se enseña, o `null` si la contraseña vale. */
export function validarContrasena(nueva: string, repetida: string): string | null {
  if (nueva.length < longitudMinima) return `Tiene que tener al menos ${longitudMinima} caracteres.`;
  if (nueva !== repetida) return 'Las dos contraseñas no coinciden.';
  return null;
}

/**
 * El mensaje que se enseña cuando Supabase no guarda la contraseña, según el código de su error
 * (`AuthError.code`). Nunca su texto, que además viene en inglés: lo que el usuario puede arreglar,
 * dicho; el resto (sesión caducada, sin conexión…), un mensaje genérico.
 */
export function mensajeErrorContrasena(code: string | undefined): string {
  if (code === 'same_password') return 'Esa ya es tu contraseña. Elige otra.';
  if (code === 'weak_password') return 'Esa contraseña es demasiado débil. Prueba con una más larga.';
  return 'No se ha podido guardar la contraseña. Inténtalo otra vez.';
}
