'use client';

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button, CloseIcon, Dialog } from 'mochi-ui';
import estilos from './panel.module.css';

// Donde se abre todo el detalle (docs/diseno.md § Paneles de detalle): una ventana centrada en
// escritorio y, por debajo de 768 px, una hoja que sube desde abajo. Es el Dialog de Mochi, que ya
// trae role="dialog" con aria-modal y el título como nombre, el foco retenido dentro y devuelto al
// cerrar, Esc, el fondo que cierra al tocarlo y el desplazamiento de la página bloqueado. Aquí se
// elige la forma según el ancho y se le pone el botón de cerrar y el titular de Horizon.

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

// Ancho máximo de la ventana centrada, en px: lo bastante para trabajar con el detalle sin apretarlo.
// Mochi la estrecha sola si la pantalla no llega.
const ANCHO_VENTANA = 720;

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

  return (
    <Dialog
      open={abierto}
      onOpenChange={alCambiar}
      title={titulo}
      presentation={movil ? 'sheet' : 'center'}
      width={ANCHO_VENTANA}
      className={estilos.panel}
    >
      {/* El Dialog de Mochi no trae botón de cerrar (se cierra con Esc, tocando fuera o, la hoja,
          arrastrándola). */}
      <Button variant="surface" iconOnly aria-label="Cerrar" onClick={alCerrar} className={estilos.cerrar}>
        <CloseIcon size={20} />
      </Button>
      {contenido}
    </Dialog>
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

/**
 * Un panel que se abre con un parámetro de la URL (`?pieza=<id>`, `?estrategia=nueva`…), como los de
 * Semanas: está abierto mientras la URL lleve `parametro=valor`, así sobrevive a una recarga, y se
 * cierra quitándolo con history.pushState, sin ir al servidor (se cierra al momento y con su
 * animación; Atrás lo vuelve a abrir). `cerrar` lee la URL de ese momento, no la del último pintado:
 * también se llama al terminar de guardar, y para entonces el panel puede estar cerrado.
 *
 * Al cerrarse, el foco vuelve a lo que lo abrió, marcado con `data-<parametro>="<valor>"` (Mochi lo
 * devuelve a lo que lo tenía al abrir, pero tras una recarga no había nada y Safari no enfoca los
 * enlaces al pulsarlos). Si está dentro de un <details> plegado, lo despliega antes.
 */
export function usePanelDeLaUrl(parametro: string, valor: string) {
  const parametros = useSearchParams();
  const abierto = parametros.get(parametro) === valor;

  function cerrar() {
    const siguientes = new URLSearchParams(window.location.search);
    if (siguientes.get(parametro) !== valor) return;
    siguientes.delete(parametro);
    const consulta = siguientes.toString();
    const ruta = window.location.pathname;
    window.history.pushState(null, '', consulta ? `${ruta}?${consulta}` : ruta);
  }

  const estuvoAbierto = useRef(abierto);
  useEffect(() => {
    if (abierto) {
      estuvoAbierto.current = true;
      return;
    }
    if (!estuvoAbierto.current) return;
    estuvoAbierto.current = false;
    const destino = document.querySelector<HTMLElement>(`[data-${parametro}="${CSS.escape(valor)}"]`);
    const plegado = destino?.closest('details');
    if (plegado && !plegado.open) plegado.open = true;
    destino?.focus();
  }, [abierto, parametro, valor]);

  return { abierto, cerrar };
}
