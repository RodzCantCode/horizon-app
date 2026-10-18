import type { Metadata } from 'next';
import { FormularioCrearContrasena } from './formulario';
// Misma pantalla que Entrar: logo arriba y el formulario en el centro.
import estilos from '../entrar/entrar.module.css';

export const metadata: Metadata = {
  title: 'Crea tu contraseña · Horizon Sport',
};

// Aquí llega quien abre el enlace de invitación o de recuperación: /auth/confirmar ya ha
// comprobado el enlace y abierto la sesión. Sin sesión, proxy.ts manda a /entrar.
export default function CrearContrasena() {
  return (
    <main className={estilos.pagina}>
      <p className="logo" aria-label="Horizon Sport">
        <span>Horizon</span>
        <span className="logo__punto">.</span>
        <span>Sport</span>
      </p>
      <div className={estilos.bloque}>
        <h1 className={`ancha ${estilos.titular} ${estilos.titularLargo}`}>Crea tu contraseña</h1>
        <FormularioCrearContrasena />
      </div>
    </main>
  );
}
