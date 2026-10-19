import { Skeleton } from 'mochi-ui';
import estilos from '../inicio.module.css';

// Lo que se ve mientras llegan las semanas (Inicio y Semanas): la forma de la semana actual
// (titular, datos y días).
export function CargandoSemana() {
  return (
    <div className={estilos.cargando}>
      <span className="solo-lectores">Cargando las semanas</span>
      <Skeleton shape="block" width="min(15rem, 70%)" height="2.5rem" />
      <Skeleton shape="line" width="min(20rem, 85%)" />
      <Skeleton shape="block" height="10.5rem" />
    </div>
  );
}
