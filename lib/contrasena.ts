// Las mismas reglas al crear la contraseña (tras la invitación o la recuperación) y al cambiarla en
// Ajustes. Supabase admite 6 caracteres por defecto; la app pide 8.
const longitudMinima = 8;

/** El mensaje de error que se enseña, o `null` si la contraseña vale. */
export function validarContrasena(nueva: string, repetida: string): string | null {
  if (nueva.length < longitudMinima) return `Tiene que tener al menos ${longitudMinima} caracteres.`;
  if (nueva !== repetida) return 'Las dos contraseñas no coinciden.';
  return null;
}
