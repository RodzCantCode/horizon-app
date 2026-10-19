'use client';

import { useEffect } from 'react';
import { Button } from 'mochi-ui';
import estilos from './inicio.module.css';

// Si una lectura de Supabase falla (lib/datos/ lanza un error a propósito, para no pintar semanas
// vacías que parezcan sin planificar), se ve esto en lugar de la página, con la navegación al lado.
// Reintentar vuelve a pedir los datos al servidor.
export default function ErrorDeDatos({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  // El detalle va a la consola del navegador; en producción, Next solo deja ver el `digest`, que
  // casa con el error completo en los registros del servidor.
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className={estilos.pagina}>
      <div className={estilos.error}>
        <p>No se han podido cargar los datos. Vuelve a intentarlo.</p>
        <Button variant="surface" onClick={() => retry()}>
          Reintentar
        </Button>
      </div>
    </main>
  );
}
