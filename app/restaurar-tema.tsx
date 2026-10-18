'use client';

import { useLayoutEffect } from 'react';
import { aplicarTema, leerTema } from '@/lib/tema';

// En producción no hace nada: el guion de app/layout.tsx ya ha puesto el tema antes de pintar. En
// desarrollo, el modo estricto de React vuelve a montar <html> y le quita los atributos que no salen
// del JSX (data-tema y el data-theme elegido); esto los repone antes de pintar. Es lo que recomienda
// la guía de Next «Preventing flash before hydration».
export function RestaurarTema() {
  useLayoutEffect(() => {
    aplicarTema(leerTema());
  }, []);
  return null;
}
