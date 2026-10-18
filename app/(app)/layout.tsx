import { Cabecera } from './cabecera';

// Todo lo que va detrás de la cabecera (Semanas, Estrategias, Ajustes). /entrar, /auth/confirmar
// y /crear-contrasena quedan fuera de este grupo: se ven sin cabecera.
export default function LayoutApp({ children }: LayoutProps<'/'>) {
  return (
    <>
      <Cabecera />
      {children}
    </>
  );
}
