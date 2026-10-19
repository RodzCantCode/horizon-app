import type { Metadata, Viewport } from 'next';
import { Archivo } from 'next/font/google';
// Mochi va antes que global.css: así la paleta de Horizon que redefine sus variables gana.
import 'mochi-ui/styles.css';
import './global.css';
import { guionBarra } from '@/lib/barra';
import { guionTema } from '@/lib/tema';
import { RestaurarTema } from './restaurar-tema';

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

// El color de la barra del navegador sigue al sistema (un tema elegido en Ajustes no lo cambia).
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4f6f8' },
    { media: '(prefers-color-scheme: dark)', color: '#07090c' },
  ],
};

// El tema va en <html> y no en un contenedor, porque lo que Mochi abre encima (ventanas, avisos) se
// pinta al final de <body>. El servidor pinta siempre el del sistema; el guion en línea de <head>
// pone el elegido en Ajustes antes de pintar (lib/tema.ts), sin leer cookies aquí, para que la
// raíz se siga prerenderizando. suppressHydrationWarning: React acepta los atributos que deja el
// guion en vez de quejarse de que no coinciden con los del servidor.
export default function Raiz({ children }: LayoutProps<'/'>) {
  return (
    <html lang="es" data-theme="system" className={archivo.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: guionTema }} />
        {/* La barra lateral plegada, igual que el tema: antes de pintar (lib/barra.ts). */}
        <script dangerouslySetInnerHTML={{ __html: guionBarra }} />
      </head>
      <body>
        {children}
        <RestaurarTema />
      </body>
    </html>
  );
}
