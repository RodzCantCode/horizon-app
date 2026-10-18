import type { Metadata } from 'next';
import estilos from './estrategias.module.css';

export const metadata: Metadata = {
  title: 'Estrategias · Horizon Sport',
};

// Provisional: la sección (estrategias y piezas) llega en la Tarea 11. Existe ya para que la
// cabecera no lleve a una página que no existe.
export default function Estrategias() {
  return (
    <main className={estilos.pagina}>
      <h1 className={`ancha ${estilos.titular}`}>Estrategias</h1>
    </main>
  );
}
