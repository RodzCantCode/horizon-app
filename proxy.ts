import { type NextRequest } from 'next/server';
import { actualizarSesion } from '@/lib/supabase/sesion';

// En Next.js 16 el antiguo middleware se llama proxy. Corre antes de pintar cada ruta.
export async function proxy(peticion: NextRequest) {
  return await actualizarSesion(peticion);
}

export const config = {
  // Todo menos los archivos estáticos de Next y las imágenes.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
