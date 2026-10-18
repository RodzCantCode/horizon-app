'use client';

import type { ComponentPropsWithRef } from 'react';
import Link from 'next/link';
import { LinkButton } from 'mochi-ui';
import { NUEVA } from '@/lib/estrategias';

// El Link de Next sin subir la página al abrir el panel (el panel se abre encima y la lista sigue
// donde estaba): LinkButton no deja pasar `scroll`, así que se le da este Link ya sin desplazar.
function EnlaceSinDesplazar(props: ComponentPropsWithRef<typeof Link>) {
  return <Link {...props} scroll={false} />;
}

/**
 * **Nueva estrategia** o **Nueva pieza**: abre su panel para crear una (`?estrategia=nueva`,
 * `?pieza=nueva`). Superficie: en la página no hay acción principal; el azul es el Guardar del
 * panel. Al cerrar el panel, el foco vuelve aquí por su data-estrategia o data-pieza.
 *
 * Es de cliente porque LinkButton recibe un componente de enlace (`as`), y uno de servidor no puede
 * pasar funciones a uno de cliente.
 */
export function BotonNuevo({ parametro, children }: { parametro: 'estrategia' | 'pieza'; children: string }) {
  return (
    <LinkButton
      as={EnlaceSinDesplazar}
      href={`/estrategias?${parametro}=${NUEVA}`}
      variant="surface"
      data-estrategia={parametro === 'estrategia' ? NUEVA : undefined}
      data-pieza={parametro === 'pieza' ? NUEVA : undefined}
    >
      {children}
    </LinkButton>
  );
}
