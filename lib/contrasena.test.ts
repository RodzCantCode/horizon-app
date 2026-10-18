import { describe, expect, it } from 'vitest';
import { mensajeErrorContrasena, validarContrasena } from '@/lib/contrasena';

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

describe('mensajeErrorContrasena', () => {
  it('dice si es la contraseña de antes', () => {
    expect(mensajeErrorContrasena('same_password')).toBe('Esa ya es tu contraseña. Elige otra.');
  });

  it('dice si Supabase la ve demasiado débil', () => {
    expect(mensajeErrorContrasena('weak_password')).toBe(
      'Esa contraseña es demasiado débil. Prueba con una más larga.',
    );
  });

  it('para cualquier otro fallo, o sin código, el mensaje de siempre', () => {
    for (const code of ['session_not_found', 'over_request_rate_limit', undefined]) {
      expect(mensajeErrorContrasena(code)).toBe('No se ha podido guardar la contraseña. Inténtalo otra vez.');
    }
  });
});
