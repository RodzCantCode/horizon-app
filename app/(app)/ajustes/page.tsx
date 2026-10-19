import { Suspense } from 'react';
import type { Metadata } from 'next';
import { Button, Skeleton } from 'mochi-ui';
import { leerPerfilPropio } from '@/lib/datos/perfil';
import { salir } from '../acciones';
import { CambiarContrasena } from './cambiar-contrasena';
import { EditarNombre } from './editar-nombre';
import { SelectorTema } from './selector-tema';
import estilos from './ajustes.module.css';

export const metadata: Metadata = {
  title: 'Ajustes · Horizon Sport',
};

// Solo lo que es de la app, no de la planificación: la cuenta (correo y nombre), el tema, la
// contraseña y salir. Lo único que lee la sesión es «Tu cuenta», dentro de <Suspense> (Cache
// Components); el resto se prerenderiza. proxy.ts ya manda a /entrar a quien no tenga sesión.
export default function Ajustes() {
  return (
    <main className={estilos.pagina}>
      <h1 className={`ancha ${estilos.titular}`}>Ajustes</h1>

      <div className={estilos.ajustes}>
        <section className={estilos.seccion} aria-labelledby="ajustes-cuenta">
          <h2 id="ajustes-cuenta" className="estrecha">
            Tu cuenta
          </h2>
          <Suspense fallback={<CargandoCuenta />}>
            <DatosDeLaCuenta />
          </Suspense>
        </section>

        <section className={estilos.seccion} aria-labelledby="ajustes-tema">
          <h2 id="ajustes-tema" className="estrecha">
            Tema
          </h2>
          <SelectorTema />
        </section>

        <section className={estilos.seccion} aria-labelledby="ajustes-contrasena">
          <h2 id="ajustes-contrasena" className="estrecha">
            Contraseña
          </h2>
          <CambiarContrasena />
        </section>

        <form action={salir}>
          <Button type="submit" variant="surface">
            Salir
          </Button>
        </form>
      </div>
    </main>
  );
}

// Lo que se ve mientras llega el perfil: las dos filas, del tamaño que tendrán.
function CargandoCuenta() {
  return (
    <div className={estilos.cuenta}>
      <span className="solo-lectores">Cargando tu cuenta</span>
      <Skeleton shape="line" width="min(16rem, 80%)" />
      <Skeleton shape="line" width="min(10rem, 50%)" />
    </div>
  );
}

// Lee la sesión y el perfil, así que va dentro de <Suspense>. El correo es el de la sesión y no se
// cambia; el nombre se edita (EditarNombre) y es el que sale en el registro.
async function DatosDeLaCuenta() {
  const { correo, nombre } = await leerPerfilPropio();
  return (
    <div className={estilos.cuenta}>
      <div className={estilos.dato}>
        <span className={estilos.etiqueta}>Correo</span>
        <span className={estilos.valor}>{correo}</span>
      </div>
      <EditarNombre nombre={nombre} />
    </div>
  );
}
