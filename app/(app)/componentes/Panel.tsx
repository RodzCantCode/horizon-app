'use client';

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from 'react';
import { Button, CloseIcon, Dialog, Drawer } from 'mochi-ui';
import estilos from './panel.module.css';

// Donde se abre todo el detalle (docs/diseno.md § Paneles de detalle): a la derecha en escritorio y,
// por debajo de 768 px, una hoja que sube desde abajo. Son el Drawer y el Dialog de Mochi, que ya
// traen role="dialog" con aria-modal y el título como nombre, el foco retenido dentro y devuelto al
// cerrar, Esc, el fondo que cierra al tocarlo y el desplazamiento de la página bloqueado. Aquí se
// elige cuál según el ancho y se les pone el botón de cerrar y el titular de Horizon.

// El mismo corte que el móvil de la pantalla Semanas (semanas.module.css).
const CONSULTA_MOVIL = '(max-width: 47.99rem)';

function suscribirAlAncho(avisar: () => void) {
  const consulta = window.matchMedia(CONSULTA_MOVIL);
  consulta.addEventListener('change', avisar);
  return () => consulta.removeEventListener('change', avisar);
}

// En el servidor no hay ancho: se pinta como escritorio. Da igual, porque Mochi no pinta los paneles
// hasta que corre en el navegador.
function esMovil() {
  return window.matchMedia(CONSULTA_MOVIL).matches;
}

function esMovilEnServidor() {
  return false;
}

export function Panel({
  abierto,
  alCerrar,
  titulo,
  children,
}: {
  abierto: boolean;
  alCerrar: () => void;
  titulo: string;
  children: ReactNode;
}) {
  const movil = useSyncExternalStore(suscribirAlAncho, esMovil, esMovilEnServidor);
  const cuerpo = useRef<HTMLDivElement>(null);

  // Al abrir, Mochi lleva el foco a lo marcado con data-autofocus: el contenido entero, no su primer
  // botón (que sería el principal, y un Intro de más lo pulsaría). Si después cambia lo de dentro y
  // el foco se queda en la nada (el botón pulsado ya no está), vuelve al panel.
  useEffect(() => {
    if (abierto && document.activeElement === document.body) {
      cuerpo.current?.focus({ preventScroll: true });
    }
  });

  const alCambiar = (abrir: boolean) => {
    if (!abrir) alCerrar();
  };

  const contenido = (
    <div ref={cuerpo} tabIndex={-1} data-autofocus className={estilos.cuerpo}>
      {children}
    </div>
  );

  if (movil) {
    return (
      <Dialog
        open={abierto}
        onOpenChange={alCambiar}
        title={titulo}
        presentation="sheet"
        className={estilos.hoja}
      >
        {/* La hoja de Mochi no trae botón de cerrar (se cierra arrastrándola o tocando fuera). */}
        <Button
          variant="surface"
          iconOnly
          aria-label="Cerrar"
          onClick={alCerrar}
          className={estilos.cerrar}
        >
          <CloseIcon size={20} />
        </Button>
        {contenido}
      </Dialog>
    );
  }

  return (
    <Drawer
      open={abierto}
      onOpenChange={alCambiar}
      title={titulo}
      width={420}
      closeLabel="Cerrar"
      className={estilos.lateral}
    >
      {contenido}
    </Drawer>
  );
}

/**
 * Lo que enseña un panel: con el panel abierto, lo que llega ahora; mientras se cierra, lo último que
 * tuvo. Al quitar una pieza o mover la semana a otra, la página se refresca a la vez que el panel se
 * cierra y ya no la encuentra: así no cambia a «ya no está» mientras sale.
 */
export function useMientrasSeCierra<T>(actual: T | null, abierto: boolean): T | null {
  const [ultimo, setUltimo] = useState(actual);
  if (actual !== null && actual !== ultimo) setUltimo(actual);
  return abierto ? actual : (actual ?? ultimo);
}

/**
 * Al cambiar de vista dentro de un panel (ver, editar, confirmar…), el botón pulsado desaparece y el
 * foco se quedaría en la nada. Lo lleva a lo primero de la vista nueva que lleve `data-foco` o, si no
 * hay nada marcado, a su primer control: el lápiz al volver, el primer campo al editar. Al montarse no
 * hace nada (el foco del panel recién abierto lo pone Panel).
 */
export function useFocoAlCambiarDeVista(vista: string, contenedor: RefObject<HTMLElement | null>) {
  const anterior = useRef(vista);
  useEffect(() => {
    if (anterior.current === vista) return;
    anterior.current = vista;
    const raiz = contenedor.current;
    const destino =
      raiz?.querySelector<HTMLElement>('[data-foco]') ?? raiz?.querySelector<HTMLElement>('button, input, a[href]');
    destino?.focus({ preventScroll: true });
  }, [vista, contenedor]);
}
