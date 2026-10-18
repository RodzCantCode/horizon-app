import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  diaSemana,
  diasEntre,
  esFecha,
  existeEnMadrid,
  fechaEnMadrid,
  hoyEnMadrid,
  lunesDe,
  sumarDias,
} from '@/lib/fechas';

describe('lunesDe', () => {
  it('devuelve el lunes de la semana de un viernes', () => {
    expect(lunesDe('2026-10-16')).toBe('2026-10-12');
  });

  it('devuelve el mismo día si ya es lunes', () => {
    expect(lunesDe('2026-10-12')).toBe('2026-10-12');
  });

  it('trata el domingo como último día de la semana', () => {
    expect(lunesDe('2026-10-18')).toBe('2026-10-12');
  });

  it('cruza el fin de mes y de año', () => {
    expect(lunesDe('2027-01-01')).toBe('2026-12-28');
  });

  it('no se descuadra el día del cambio de hora', () => {
    expect(lunesDe('2026-10-25')).toBe('2026-10-19');
    expect(lunesDe('2026-03-29')).toBe('2026-03-23');
  });
});

describe('sumarDias', () => {
  it('cruza el fin de mes', () => {
    expect(sumarDias('2026-10-30', 3)).toBe('2026-11-02');
  });

  it('cruza el cambio de hora de octubre', () => {
    expect(sumarDias('2026-10-24', 2)).toBe('2026-10-26');
  });

  it('cruza el cambio de hora de marzo', () => {
    expect(sumarDias('2026-03-28', 2)).toBe('2026-03-30');
  });

  it('resta con números negativos', () => {
    expect(sumarDias('2026-10-16', -1)).toBe('2026-10-15');
  });

  it('sumar cero deja la fecha igual', () => {
    expect(sumarDias('2026-10-16', 0)).toBe('2026-10-16');
  });

  it('cruza el fin de año', () => {
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01');
    expect(sumarDias('2027-01-01', -1)).toBe('2026-12-31');
  });

  it('respeta los años bisiestos', () => {
    expect(sumarDias('2028-02-28', 1)).toBe('2028-02-29');
    expect(sumarDias('2027-02-28', 1)).toBe('2027-03-01');
  });
});

describe('diasEntre', () => {
  it('cuenta una semana', () => {
    expect(diasEntre('2026-10-12', '2026-10-19')).toBe(7);
  });

  it('es cero entre el mismo día', () => {
    expect(diasEntre('2026-10-16', '2026-10-16')).toBe(0);
  });

  it('es negativo si hasta es anterior a desde', () => {
    expect(diasEntre('2026-10-19', '2026-10-12')).toBe(-7);
  });

  it('cuenta días enteros al cruzar un cambio de hora', () => {
    expect(diasEntre('2026-10-24', '2026-10-26')).toBe(2);
    expect(diasEntre('2026-03-28', '2026-03-30')).toBe(2);
  });
});

describe('hoyEnMadrid', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('a las 00:30 de España (verano) ya es el día siguiente al de UTC', () => {
    expect(hoyEnMadrid(new Date('2026-10-15T22:30:00Z'))).toBe('2026-10-16');
  });

  it('a las 00:30 de España (invierno) ya es el día siguiente al de UTC', () => {
    expect(hoyEnMadrid(new Date('2026-12-31T23:30:00Z'))).toBe('2027-01-01');
  });

  it('a las 23:59 de España sigue siendo el mismo día', () => {
    expect(hoyEnMadrid(new Date('2026-07-15T21:59:00Z'))).toBe('2026-07-15');
    expect(hoyEnMadrid(new Date('2026-07-15T22:00:00Z'))).toBe('2026-07-16');
  });

  it('sin argumento usa el instante actual', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-15T22:30:00Z'));
    expect(hoyEnMadrid()).toBe('2026-10-16');
  });
});

describe('fechaEnMadrid', () => {
  it('da el día de España de un instante guardado en UTC, también de madrugada', () => {
    // Así llega `registro.creado_en` desde Supabase.
    expect(fechaEnMadrid(new Date('2026-10-14T21:59:59.123456+00:00'))).toBe('2026-10-14');
    expect(fechaEnMadrid(new Date('2026-10-14T22:30:00+00:00'))).toBe('2026-10-15');
    expect(fechaEnMadrid(new Date('2026-12-31T23:30:00Z'))).toBe('2027-01-01');
  });
});

describe('existeEnMadrid', () => {
  it('la hora que salta en marzo no existe', () => {
    expect(existeEnMadrid('2026-03-29', '02:00')).toBe(false);
    expect(existeEnMadrid('2026-03-29', '02:30')).toBe(false);
    expect(existeEnMadrid('2026-03-29', '02:59')).toBe(false);
  });

  it('las horas alrededor del salto de marzo existen', () => {
    expect(existeEnMadrid('2026-03-29', '01:59')).toBe(true);
    expect(existeEnMadrid('2026-03-29', '03:00')).toBe(true);
  });

  it('la hora que se repite en octubre existe', () => {
    expect(existeEnMadrid('2026-10-25', '02:30')).toBe(true);
  });

  it('una hora normal existe', () => {
    expect(existeEnMadrid('2026-10-16', '18:00')).toBe(true);
    expect(existeEnMadrid('2026-03-28', '02:30')).toBe(true);
  });

  it('una fecha que no existe en el calendario no existe', () => {
    expect(existeEnMadrid('2026-02-30', '10:00')).toBe(false);
  });

  it('un texto que no es fecha ni hora no existe', () => {
    expect(existeEnMadrid('no-es-fecha', '10:00')).toBe(false);
    expect(existeEnMadrid('2026-10-16', '25:00')).toBe(false);
  });
});

describe('diaSemana', () => {
  it('cuenta desde el lunes (0) hasta el domingo (6)', () => {
    expect(diaSemana('2026-10-12')).toBe(0);
    expect(diaSemana('2026-10-16')).toBe(4);
    expect(diaSemana('2026-10-18')).toBe(6);
    expect(diaSemana('2026-10-19')).toBe(0);
  });
});

describe('esFecha', () => {
  it('acepta una fecha YYYY-MM-DD que existe en el calendario', () => {
    expect(esFecha('2026-10-19')).toBe(true);
    expect(esFecha('2028-02-29')).toBe(true);
  });

  it('rechaza los días que no existen y los textos que no son fechas', () => {
    expect(esFecha('2026-02-29')).toBe(false);
    expect(esFecha('2026-10-32')).toBe(false);
    expect(esFecha('2026-13-01')).toBe(false);
    expect(esFecha('2026-1-5')).toBe(false);
    expect(esFecha('2026-10-19T00:00')).toBe(false);
    expect(esFecha('')).toBe(false);
  });
});
