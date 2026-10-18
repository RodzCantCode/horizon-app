import type { Metadata } from 'next';
import { Button } from 'mochi-ui';
import { salir } from '../acciones';
import { CambiarContrasena } from './cambiar-contrasena';
import { SelectorTema } from './selector-tema';
import estilos from './ajustes.module.css';

export const metadata: Metadata = {
  title: 'Ajustes · Horizon Sport',
};

// Solo lo que es de la app, no de la planificación: tema, contraseña y salir. No lee la sesión (no
// enseña nada de la cuenta), así que se prerenderiza entera; proxy.ts ya manda a /entrar a quien no
// la tenga.
export default function Ajustes() {
  return (
    <main className={estilos.pagina}>
      <h1 className={`ancha ${estilos.titular}`}>Ajustes</h1>

      <div className={estilos.ajustes}>
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
