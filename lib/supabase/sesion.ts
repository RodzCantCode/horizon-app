import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { clavePublicableSupabase, urlSupabase } from './entorno';
import { destinoSegunSesion } from './rutas';
import type { Database } from './tipos';

// Lo llama proxy.ts en cada petición: refresca la sesión de Supabase (si el token ha caducado, lo
// renueva y reescribe las cookies) y decide a dónde va cada uno con destinoSegunSesion (rutas.ts).
export async function actualizarSesion(peticion: NextRequest) {
  let respuesta = NextResponse.next({ request: peticion });
  let cabecerasSupabase: Record<string, string> = {};

  const supabase = createServerClient<Database>(urlSupabase, clavePublicableSupabase, {
    cookies: {
      getAll() {
        return peticion.cookies.getAll();
      },
      setAll(cookiesNuevas, cabeceras) {
        // Las cookies renovadas van a la petición (para que las lean los componentes de servidor)
        // y a la respuesta (para que el navegador sustituya las viejas).
        cookiesNuevas.forEach(({ name, value }) => peticion.cookies.set(name, value));
        respuesta = NextResponse.next({ request: peticion });
        cookiesNuevas.forEach(({ name, value, options }) =>
          respuesta.cookies.set(name, value, options),
        );
        // Cabeceras que pide Supabase junto a las cookies (que ninguna caché guarde la respuesta).
        cabecerasSupabase = cabeceras;
        Object.entries(cabeceras).forEach(([clave, valor]) => respuesta.headers.set(clave, valor));
      },
    },
  });

  // No metas código entre createServerClient y getClaims: es lo que refresca el token, y si falla
  // la sesión se cierra sola sin que se vea por qué (aviso de la guía de Supabase).
  // getClaims verifica la firma del token; getSession no, así que no sirve para proteger rutas.
  const { data } = await supabase.auth.getClaims();
  const conSesion = Boolean(data?.claims);

  const destino = destinoSegunSesion(peticion.nextUrl.pathname, conSesion);
  if (destino) {
    // Una redirección tiene que llevarse las cookies (y sus cabeceras) que Supabase acabe de
    // escribir, por ejemplo al borrar una sesión caducada; si no, el navegador se queda las viejas.
    const url = peticion.nextUrl.clone();
    url.pathname = destino;
    url.search = '';
    const redireccion = NextResponse.redirect(url);
    respuesta.cookies.getAll().forEach((cookie) => redireccion.cookies.set(cookie));
    Object.entries(cabecerasSupabase).forEach(([clave, valor]) => redireccion.headers.set(clave, valor));
    return redireccion;
  }

  return respuesta;
}
