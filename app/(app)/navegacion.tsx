'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLayoutEffect, useSyncExternalStore, type ReactNode } from 'react';
import { Tooltip } from 'mochi-ui';
import { aplicarBarra, guardarBarraPlegada, leerBarraPlegada } from '@/lib/barra';
import estilos from './navegacion.module.css';

// Iconos de trazo, del mismo dibujo que el de la cuenta: 24 × 24, trazo de 1,6.
function Icono({ children }: { children: ReactNode }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={estilos.icono}
    >
      {children}
    </svg>
  );
}

const secciones = [
  {
    href: '/',
    texto: 'Inicio',
    icono: <path d="M4 10.5 12 4l8 6.5V20h-5.5v-6h-5v6H4z" />,
  },
  {
    href: '/calendario',
    texto: 'Calendario',
    icono: (
      <>
        <rect x="3.5" y="5" width="17" height="15" rx="2" />
        <path d="M3.5 10h17M8 3v4M16 3v4" />
      </>
    ),
  },
  {
    href: '/estrategias',
    texto: 'Estrategias',
    icono: <path d="m12 4 8.5 4.5L12 13 3.5 8.5zM3.5 12.5 12 17l8.5-4.5M3.5 16.5 12 21l8.5-4.5" />,
  },
];

const ajustes = {
  href: '/ajustes',
  texto: 'Ajustes',
  icono: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20c0-3.6 3.4-6 7.5-6s7.5 2.4 7.5 6" />
    </>
  ),
};

// Inicio solo está activa en `/`. Las demás, también en sus subrutas.
function esActiva(ruta: string, href: string) {
  return href === '/' ? ruta === '/' : ruta === href || ruta.startsWith(`${href}/`);
}

// Si la barra está plegada, leído del atributo de <html> y avisando cuando cambia.
function suscribirABarra(avisar: () => void) {
  const observador = new MutationObserver(avisar);
  observador.observe(document.documentElement, { attributes: true, attributeFilter: ['data-barra'] });
  return () => observador.disconnect();
}

function barraPlegada() {
  return document.documentElement.getAttribute('data-barra') === 'plegada';
}

// El servidor pinta la barra desplegada.
function barraPlegadaEnServidor() {
  return false;
}

// La navegación de la app: barra lateral fija en escritorio y, en el móvil, barra de arriba con el
// logo y la cuenta y las secciones debajo. Cliente para saber en qué sección se está (usePathname) y
// para plegar la barra. Todas las rutas de la app son estáticas, así que con Cache Components se
// resuelve al prerenderizar y no pide <Suspense>.
//
// Plegada, la barra se queda en los iconos y cada uno enseña su nombre al pasar el ratón (el
// Tooltip de Mochi; desplegada no hace falta y va desactivado). Lo que se ve lo decide el CSS con el
// data-barra de <html>, que pone el guion de app/layout.tsx antes de pintar (lib/barra.ts); aquí se
// lee de ese mismo atributo para el botón y los nombres al pasar el ratón.
export function Navegacion() {
  const ruta = usePathname();
  const plegada = useSyncExternalStore(suscribirABarra, barraPlegada, barraPlegadaEnServidor);

  // Repone el atributo, que en desarrollo React le quita a <html> al volver a montarlo (como
  // RestaurarTema con el del tema).
  useLayoutEffect(() => {
    aplicarBarra(leerBarraPlegada());
  }, []);

  function alternar() {
    aplicarBarra(!plegada);
    guardarBarraPlegada(!plegada);
  }

  const enlace = ({ href, texto, icono }: (typeof secciones)[number], clase: string) => (
    <Tooltip key={href} content={texto} side="right" disabled={!plegada}>
      <Link
        href={href}
        className={`${estilos.enlace} ${clase}`}
        aria-current={esActiva(ruta, href) ? 'page' : undefined}
      >
        <Icono>{icono}</Icono>
        <span className={estilos.texto}>{texto}</span>
      </Link>
    </Tooltip>
  );

  const textoBoton = plegada ? 'Desplegar barra' : 'Plegar barra';

  return (
    <header className={estilos.barra}>
      <Link href="/" className={`logo ${estilos.logo}`} aria-label="Horizon Sport">
        <span>H</span>
        <span className={estilos.restoLogo}>orizon</span>
        <span className="logo__punto">.</span>
        <span className={estilos.restoLogo}>Sport</span>
      </Link>

      <nav id="secciones" className={estilos.secciones} aria-label="Secciones">
        {secciones.map((s) => enlace(s, estilos.seccion))}
      </nav>

      <div className={estilos.pie}>
        <Tooltip content={textoBoton} side="right" disabled={!plegada}>
          <button
            type="button"
            className={`${estilos.enlace} ${estilos.plegar}`}
            aria-expanded={!plegada}
            aria-controls="secciones"
            onClick={alternar}
          >
            <Icono>
              <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
              <path d="M9.5 4.5v15" />
            </Icono>
            <span className={estilos.texto}>{textoBoton}</span>
          </button>
        </Tooltip>
        {enlace(ajustes, estilos.cuenta)}
      </div>
    </header>
  );
}
