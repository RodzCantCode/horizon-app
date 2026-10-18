import { describe, expect, it } from 'vitest';
import { validarContrasena } from '@/lib/contrasena';

describe('validarContrasena', () => {
  it('pide al menos 8 caracteres', () => {
    expect(validarContrasena('corta', 'corta')).toBe('Tiene que tener al menos 8 caracteres.');
    expect(validarContrasena('siete77', 'siete77')).toBe('Tiene que tener al menos 8 caracteres.');
  });

  it('la longitud se avisa antes que la diferencia', () => {
    expect(validarContrasena('corta', 'otra')).toBe('Tiene que tener al menos 8 caracteres.');
  });

  it('las dos tienen que coincidir', () => {
    expect(validarContrasena('suficiente1', 'suficiente2')).toBe('Las dos contraseñas no coinciden.');
  });

  it('acepta una válida, también con 8 justos', () => {
    expect(validarContrasena('suficiente1', 'suficiente1')).toBe(null);
    expect(validarContrasena('ocho1234', 'ocho1234')).toBe(null);
  });
});
