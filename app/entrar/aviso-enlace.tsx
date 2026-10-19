import estilos from './entrar.module.css';

// El aviso de un enlace de invitación o de recuperación que no vale. Lo pintan page.tsx
// (?error=enlace, desde /auth/confirmar) y aceptar-enlace.tsx (el error en el fragmento).
export function AvisoEnlaceNoValido() {
  return (
    <p className={estilos.aviso} role="alert">
      El enlace no es válido o ha caducado. Pide otro a Mario.
    </p>
  );
}
