import { Suspense } from 'react';
import type { Metadata } from 'next';
import { AceptarEnlace } from './aceptar-enlace';
import { AvisoEnlaceNoValido } from './aviso-enlace';
import { FormularioEntrar } from './formulario';
import estilos from './entrar.module.css';

export const metadata: Metadata = {
  title: 'Entrar · Horizon Sport',
};

// Sin registro: solo entra quien Mario invita desde Supabase (docs/acceso.md).
export default function Entrar({ searchParams }: PageProps<'/entrar'>) {
  return (
    <main className={estilos.pagina}>
      <p className="logo" aria-label="Horizon Sport">
        <span>Horizon</span>
        <span className="logo__punto">.</span>
        <span>Sport</span>
      </p>
      <div className={estilos.bloque}>
        <h1 className={`ancha ${estilos.titular}`}>Entrar</h1>
        {/* Lee la URL de la petición: con Cache Components va en <Suspense> y el resto de la
            pantalla se sigue prerenderizando. */}
        <Suspense>
          <AvisoEnlace searchParams={searchParams} />
        </Suspense>
        <AceptarEnlace>
          <FormularioEntrar />
        </AceptarEnlace>
      </div>
    </main>
  );
}

// /auth/confirmar manda aquí con ?error=enlace cuando el enlace del correo no vale.
async function AvisoEnlace({ searchParams }: Pick<PageProps<'/entrar'>, 'searchParams'>) {
  const { error } = await searchParams;
  if (error !== 'enlace') return null;
  return <AvisoEnlaceNoValido />;
}
