import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { rutaCrearContrasena, rutaEntrar } from '@/lib/supabase/rutas';
import { crearClienteServidor } from '@/lib/supabase/servidor';

// Para las plantillas propias, que solo se pueden poner con SMTP propio (pendiente): hoy los correos
// llevan el enlace por defecto de Supabase, que recoge /entrar (app/entrar/aceptar-enlace.tsx).
// Solo los dos correos que manda Mario desde Supabase: invitación y recuperación (docs/acceso.md).
// El registro público está desactivado, así que no hay enlaces de alta que confirmar.
const tiposAceptados: EmailOtpType[] = ['invite', 'recovery'];

function esTipoAceptado(tipo: string | null): tipo is 'invite' | 'recovery' {
  return tiposAceptados.includes(tipo as EmailOtpType);
}

// El enlace del correo trae token_hash y type. verifyOtp lo comprueba y abre la sesión: el cliente
// de servidor la escribe con cookies(), y Next.js añade esas cookies a la redirección que se
// devuelve. Con sesión, a crear la contraseña; si el enlace no vale (caducado, ya usado, de otro
// tipo), a Entrar con el aviso.
export async function GET(peticion: NextRequest) {
  const tokenHash = peticion.nextUrl.searchParams.get('token_hash');
  const tipo = peticion.nextUrl.searchParams.get('type');

  // La redirección sale sin los parámetros del enlace: el token no se queda en el historial.
  const destino = peticion.nextUrl.clone();
  destino.search = '';

  if (tokenHash && esTipoAceptado(tipo)) {
    const supabase = await crearClienteServidor();
    const { error } = await supabase.auth.verifyOtp({ type: tipo, token_hash: tokenHash });
    if (!error) {
      destino.pathname = rutaCrearContrasena;
      return NextResponse.redirect(destino);
    }
  }

  destino.pathname = rutaEntrar;
  destino.searchParams.set('error', 'enlace');
  return NextResponse.redirect(destino);
}
