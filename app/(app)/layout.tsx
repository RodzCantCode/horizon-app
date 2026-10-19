import { Navegacion } from './navegacion';
import estilos from './layout.module.css';

// Todo lo que va detrás de la navegación (Inicio, Semanas, Estrategias, Ajustes). /entrar,
// /auth/confirmar y /crear-contrasena quedan fuera de este grupo: se ven sin ella.
export default function LayoutApp({ children }: LayoutProps<'/'>) {
  return (
    <div className={estilos.app}>
      <Navegacion />
      <div className={estilos.contenido}>{children}</div>
    </div>
  );
}
