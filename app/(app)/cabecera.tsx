'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LinkButton } from 'mochi-ui';
import estilos from './cabecera.module.css';

const secciones = [
  { href: '/', texto: 'Semanas' },
  { href: '/estrategias', texto: 'Estrategias' },
];

// Semanas es la portada: solo está activa en `/`. Las demás, también en sus subrutas.
function esActiva(ruta: string, href: string) {
  return href === '/' ? ruta === '/' : ruta === href || ruta.startsWith(`${href}/`);
}

// Cliente solo para saber en qué sección se está (usePathname). Todas las rutas de la app son
// estáticas, así que con Cache Components se resuelve al prerenderizar y no pide <Suspense>.
export function Cabecera() {
  const ruta = usePathname();

  return (
    <header className={estilos.cabecera}>
      <Link href="/" className={`logo ${estilos.logo}`} aria-label="Horizon Sport">
        <span>Horizon</span>
        <span className="logo__punto">.</span>
        <span>Sport</span>
      </Link>

      <nav className={estilos.secciones} aria-label="Secciones">
        {secciones.map(({ href, texto }) => (
          <Link
            key={href}
            href={href}
            className={estilos.seccion}
            aria-current={esActiva(ruta, href) ? 'page' : undefined}
          >
            {texto}
          </Link>
        ))}
      </nav>

      <LinkButton
        as={Link}
        href="/ajustes"
        variant="surface"
        iconOnly
        aria-label="Ajustes"
        aria-current={esActiva(ruta, '/ajustes') ? 'page' : undefined}
        className={estilos.cuenta}
      >
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
        >
          <circle cx="12" cy="8" r="4" />
          <path d="M4.5 20c0-3.6 3.4-6 7.5-6s7.5 2.4 7.5 6" />
        </svg>
      </LinkButton>
    </header>
  );
}
