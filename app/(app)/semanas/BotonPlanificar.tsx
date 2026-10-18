'use client';

import Link from 'next/link';
import { LinkButton } from 'mochi-ui';

/**
 * **Planificar** de una semana sin plan. Azul (`accent`) solo en la siguiente, la única de la que se
 * avisa: es la acción principal de la pantalla. En las demás, `surface`. Lleva la semana en la URL
 * (?planificar=<lunes>), que abre su panel (PanelPlanificar.tsx); al cerrarlo, el foco vuelve aquí
 * por su data-planificar.
 *
 * Es de cliente porque LinkButton recibe el componente Link (`as`), y un componente de servidor no
 * puede pasar funciones a uno de cliente.
 */
export function BotonPlanificar({ lunes, principal }: { lunes: string; principal: boolean }) {
  return (
    <LinkButton
      as={Link}
      href={`/?planificar=${lunes}`}
      variant={principal ? 'accent' : 'surface'}
      size={principal ? 'md' : 'sm'}
      data-planificar={lunes}
    >
      Planificar
    </LinkButton>
  );
}
