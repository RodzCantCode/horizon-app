'use client';

import { useState, useSyncExternalStore } from 'react';
import { SegmentedControl } from 'mochi-ui';
import { aplicarTema, guardarTema, leerTema, type Tema } from '@/lib/tema';
import estilos from './ajustes.module.css';

const opciones: { value: Tema; label: string }[] = [
  { value: 'claro', label: 'Claro' },
  { value: 'oscuro', label: 'Oscuro' },
  { value: 'sistema', label: 'Sistema' },
];

// Mientras la página está abierta, el tema solo lo cambia este selector: no hay nada a lo que
// suscribirse.
const sinSuscripcion = () => () => {};

export function SelectorTema() {
  // El servidor no sabe qué hay guardado en el navegador (null): pinta el hueco del selector, y al
  // hidratar se lee el tema guardado. Así no hay desajuste de hidratación ni salto.
  const guardado = useSyncExternalStore(sinSuscripcion, leerTema, () => null);
  const [elegido, setElegido] = useState<Tema | null>(null);
  const tema = elegido ?? guardado;

  if (tema === null) return <div className={estilos.selectorTema} aria-hidden="true" />;

  return (
    <SegmentedControl
      aria-labelledby="ajustes-tema"
      options={opciones}
      value={tema}
      onValueChange={(valor) => {
        const nuevo = valor as Tema;
        setElegido(nuevo);
        guardarTema(nuevo);
        aplicarTema(nuevo);
      }}
      className={estilos.selectorTema}
    />
  );
}
