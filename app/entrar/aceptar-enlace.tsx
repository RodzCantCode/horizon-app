'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { leerEnlaceDeSupabase } from '@/lib/supabase/enlace';
import { crearClienteNavegador } from '@/lib/supabase/navegador';
import { rutaCrearContrasena } from '@/lib/supabase/rutas';
import { AvisoEnlaceNoValido } from './aviso-enlace';

// Recoge el enlace por defecto de los correos de Supabase, que llega a /entrar con la sesión (o el
// error) en el fragmento de la URL (docs/acceso.md). El fragmento no llega al servidor: se lee aquí.
// Mientras se abre la sesión no se enseña el formulario (children), para no escribir encima.
export function AceptarEnlace({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [estado, setEstado] = useState<'sin-enlace' | 'abriendo' | 'no-valido'>('sin-enlace');

  useEffect(() => {
    const enlace = leerEnlaceDeSupabase(window.location.hash);
    if (!enlace) return;

    // Los tokens salen de la URL antes que nada: no se quedan en la barra ni en el historial. Por
    // eso no hace falta cancelar al desmontar: si el efecto se repite (modo estricto), ya no hay
    // fragmento y el primero sigue a lo suyo.
    window.history.replaceState(
      window.history.state,
      '',
      window.location.pathname + window.location.search,
    );

    // El fragmento solo existe en el navegador y deja de existir aquí mismo, así que no se puede
    // derivar al pintar (useSyncExternalStore lo perdería en el siguiente render): se guarda una vez.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- ver el comentario de arriba
    setEstado(enlace.tipo === 'error' ? 'no-valido' : 'abriendo');
    if (enlace.tipo === 'error') return;

    abrirSesion(enlace.accessToken, enlace.refreshToken).then((abierta) => {
      // setSession ya ha escrito la cookie: proxy.ts deja pasar a /crear-contrasena.
      if (abierta) router.replace(rutaCrearContrasena);
      else setEstado('no-valido');
    });
  }, [router]);

  if (estado === 'abriendo') return <p role="status">Abriendo tu enlace…</p>;

  return (
    <>
      {estado === 'no-valido' ? <AvisoEnlaceNoValido /> : null}
      {children}
    </>
  );
}

async function abrirSesion(accessToken: string, refreshToken: string): Promise<boolean> {
  try {
    const supabase = crearClienteNavegador();
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    return !error;
  } catch {
    return false;
  }
}
