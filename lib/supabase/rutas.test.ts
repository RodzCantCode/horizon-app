import { describe, expect, it } from 'vitest';
import { destinoSegunSesion } from '@/lib/supabase/rutas';

describe('destinoSegunSesion', () => {
  it('sin sesión, las pantallas de la app mandan a /entrar', () => {
    expect(destinoSegunSesion('/', false)).toBe('/entrar');
    expect(destinoSegunSesion('/estrategias', false)).toBe('/entrar');
    expect(destinoSegunSesion('/ajustes', false)).toBe('/entrar');
  });

  it('con sesión, las pantallas de la app se quedan', () => {
    expect(destinoSegunSesion('/', true)).toBe(null);
    expect(destinoSegunSesion('/ajustes', true)).toBe(null);
  });

  it('/auth/confirmar no exige sesión ni la impide', () => {
    expect(destinoSegunSesion('/auth/confirmar', false)).toBe(null);
    expect(destinoSegunSesion('/auth/confirmar', true)).toBe(null);
  });

  it('/crear-contrasena exige sesión', () => {
    expect(destinoSegunSesion('/crear-contrasena', false)).toBe('/entrar');
    expect(destinoSegunSesion('/crear-contrasena', true)).toBe(null);
  });

  it('/entrar es solo para quien no tiene sesión', () => {
    expect(destinoSegunSesion('/entrar', true)).toBe('/');
    expect(destinoSegunSesion('/entrar', false)).toBe(null);
  });
});
