import type { Metadata, Viewport } from 'next';
import { Archivo } from 'next/font/google';
// Mochi va antes que global.css: así la paleta de Horizon que redefine sus variables gana.
import 'mochi-ui/styles.css';
import './global.css';

// Archivo variable con el eje de anchura (wdth 62–125), como en la web: el contraste de la marca
// sale de la anchura, no de una segunda fuente.
const archivo = Archivo({
  subsets: ['latin'],
  axes: ['wdth'],
  variable: '--fuente-archivo',
});

export const metadata: Metadata = {
  title: 'Horizon Sport',
  // Herramienta interna: que no salga en buscadores.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#07090c',
};

// El tema oscuro de Mochi se activa con data-theme en <html>, no en un contenedor, porque lo que
// abre encima (ventanas, avisos) se pinta al final de <body>.
export default function Raiz({ children }: LayoutProps<'/'>) {
  return (
    <html lang="es" data-theme="dark" className={archivo.variable}>
      <body>{children}</body>
    </html>
  );
}
