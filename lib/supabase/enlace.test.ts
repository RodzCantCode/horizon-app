import { describe, expect, it } from 'vitest';
import { leerEnlaceDeSupabase } from '@/lib/supabase/enlace';

describe('leerEnlaceDeSupabase', () => {
  it('lee la sesión de un enlace de invitación', () => {
    expect(
      leerEnlaceDeSupabase(
        '#access_token=a&refresh_token=r&expires_in=3600&token_type=bearer&type=invite',
      ),
    ).toEqual({ tipo: 'sesion', accessToken: 'a', refreshToken: 'r', enlace: 'invite' });
  });

  it('lee la sesión de un enlace de recuperación', () => {
    expect(
      leerEnlaceDeSupabase(
        '#access_token=a&refresh_token=r&expires_in=3600&token_type=bearer&type=recovery',
      ),
    ).toEqual({ tipo: 'sesion', accessToken: 'a', refreshToken: 'r', enlace: 'recovery' });
  });

  it('un enlace caducado o ya usado es un error', () => {
    expect(
      leerEnlaceDeSupabase(
        '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid',
      ),
    ).toEqual({ tipo: 'error' });
    expect(leerEnlaceDeSupabase('#error_code=otp_expired')).toEqual({ tipo: 'error' });
  });

  it('ignora los enlaces de otros tipos', () => {
    expect(leerEnlaceDeSupabase('#access_token=a&refresh_token=r&type=signup')).toBe(null);
    expect(leerEnlaceDeSupabase('#access_token=a&refresh_token=r&type=magiclink')).toBe(null);
    expect(leerEnlaceDeSupabase('#access_token=a&refresh_token=r')).toBe(null);
  });

  it('ignora un fragmento vacío o sin enlace', () => {
    expect(leerEnlaceDeSupabase('')).toBe(null);
    expect(leerEnlaceDeSupabase('#')).toBe(null);
    expect(leerEnlaceDeSupabase('#formulario')).toBe(null);
  });

  it('sin los dos tokens no hay sesión', () => {
    expect(leerEnlaceDeSupabase('#access_token=a&type=invite')).toBe(null);
    expect(leerEnlaceDeSupabase('#refresh_token=r&type=recovery')).toBe(null);
    expect(leerEnlaceDeSupabase('#access_token=&refresh_token=r&type=invite')).toBe(null);
  });
});
