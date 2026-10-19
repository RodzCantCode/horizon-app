'use client';

import Link from 'next/link';
import { LinkButton } from 'mochi-ui';

/**
 * **Ver la semana** de una semana plegada con plan: abre su panel (?semana=<lunes>, PanelSemana.tsx),
 * como el encabezado de una semana abierta. Superficie: no es la acción principal de la pantalla. Al
 * cerrar el panel, el foco vuelve aquí por su data-semana.
 *
 * Es de cliente por lo mismo que BotonPlanificar: LinkButton recibe el componente Link (`as`).
 */
export function BotonVerSemana({ lunes }: { lunes: string }) {
  return (
    <LinkButton as={Link} href={`?semana=${lunes}`} variant="surface" size="sm" data-semana={lunes}>
      Ver la semana
    </LinkButton>
  );
}
