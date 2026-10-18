'use client';

import { startTransition, useState, useTransition } from 'react';
import { Button } from 'mochi-ui';
// Los estilos de lo de dentro de los paneles (botones, errores, campos…) viven con los de Semanas,
// donde nacieron; los usan también los paneles de Estrategias.
import estilos from '../semanas/semanas.module.css';

// Lo que comparten los modos edición de los paneles (Semanas y Estrategias): el envío de una acción
// de servidor y los botones **Guardar** y **Cancelar** con su error.

// Lo que se enseña si la acción ni siquiera llega al servidor (sin conexión, por ejemplo). El mismo
// texto que en los otros paneles.
export const SIN_CONEXION = 'No se ha podido conectar. Vuelve a intentarlo.';

/**
 * El envío de una vista del modo edición: su estado (el botón carga mientras dura) y su error. Las
 * acciones refrescan la página al terminar; `siVaBien` se llama dentro de la transición, para que la
 * vista cambie a la vez que llegan los datos nuevos y no antes. Con `siError` una vista puede tratar
 * un error a su manera (devuelve `true` si lo ha tratado); si no, se enseña bajo los botones.
 */
export function useEnvio() {
  const [enviando, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function enviar(
    accion: () => Promise<{ error?: string }>,
    siVaBien: () => void,
    siError?: (error: string) => boolean,
  ) {
    if (enviando) return;
    setError(null);
    iniciar(async () => {
      try {
        const { error: aviso } = await accion();
        startTransition(() => {
          if (aviso === undefined) siVaBien();
          else if (!siError?.(aviso)) setError(aviso);
        });
      } catch {
        setError(SIN_CONEXION);
      }
    });
  }

  return { enviando, error, enviar };
}

/** **Guardar** y **Cancelar** con el error debajo, como en los demás paneles. Azul solo Guardar. */
export function BotonesGuardar({
  guardando,
  error,
  alCancelar,
}: {
  guardando: boolean;
  error: string | null;
  alCancelar: () => void;
}) {
  return (
    <div className={estilos.accionPieza}>
      <div className={estilos.botones}>
        <Button type="submit" variant="accent" status={guardando ? 'loading' : 'idle'} loadingLabel="Guardando">
          Guardar
        </Button>
        <Button variant="surface" onClick={alCancelar}>
          Cancelar
        </Button>
      </div>
      <p className={estilos.errorPieza} role="alert">
        {error}
      </p>
    </div>
  );
}
