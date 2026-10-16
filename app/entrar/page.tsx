import type { Metadata } from 'next';
import { FormularioEntrar } from './formulario';
import estilos from './entrar.module.css';

export const metadata: Metadata = {
  title: 'Entrar · Horizon Sport',
};

// Sin registro: las cuentas las crea Mario a mano en Supabase.
export default function Entrar() {
  return (
    <main className={estilos.pagina}>
      <p className="logo" aria-label="Horizon Sport">
        <span>Horizon</span>
        <span className="logo__punto">.</span>
        <span>Sport</span>
      </p>
      <div className={estilos.bloque}>
        <h1 className={`ancha ${estilos.titular}`}>Entrar</h1>
        <FormularioEntrar />
      </div>
    </main>
  );
}
